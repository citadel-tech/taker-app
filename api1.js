const { ipcMain, dialog, app } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const store = new Store();

// ============================================================================
// SHARED STATE - Exported for main.js to access if needed
// ============================================================================
const api1State = {
  coinswapNapi: null,
  takerInstance: null,
  storedTakerConfig: null,
  activeSwaps: new Map(),
  activeSyncs: new Map(),
  DATA_DIR: `${process.env.HOME}/.coinswap/taker`,
  DEFAULT_WALLET_NAME: 'taker-wallet',
  currentWalletName: 'taker-wallet',
  currentWalletPassword: '',
  protocolVersion: 'v1', // App-local protocol string: 'v1'/'v2'
  walletSyncInterval: null,

  syncState: {
    isRunning: false, // Is any sync currently running?
    currentSyncId: null, // ID of current sync
    lastSyncTime: null, // When was last sync completed?
    periodicInterval: null, // setInterval reference for periodic syncs
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Returns true if a maker from the offerbook is usable for a swap.
 * Mirrors the categorization logic in the offerbook handler.
 */
function isUsableMaker(maker) {
  const state = maker.state;
  const normalizedState =
    typeof state === 'string'
      ? state.toLowerCase()
      : state && typeof state === 'object'
        ? Object.keys(state)[0]?.toLowerCase()
        : null;
  if (normalizedState === 'unresponsive' || normalizedState === 'bad') {
    return false;
  }
  if (normalizedState === 'good') {
    return true;
  }
  // Fallback for older payloads without an explicit state.
  return maker.offer != null;
}

function getCurrentWalletName() {
  try {
    const configPath = path.join(api1State.DATA_DIR, 'config.toml');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const walletMatch = configContent.match(
        /wallet_file_name\s*=\s*"([^"]+)"/
      );
      if (walletMatch) {
        return walletMatch[1];
      }
    }
  } catch (error) {
    console.error('Failed to read wallet name from config:', error);
  }
  return api1State.DEFAULT_WALLET_NAME;
}

function buildTakerConfig({
  dataDir = api1State.DATA_DIR,
  walletName = api1State.currentWalletName || api1State.DEFAULT_WALLET_NAME,
  rpcConfig,
  controlPort = 9051,
  torAuthPassword,
  zmqAddr = 'tcp://127.0.0.1:28332',
  password = '',
  protocol = api1State.protocolVersion || 'v1',
  logLevel = store.get('logLevel') || process.env.LOG_LEVEL || 'debug',
  appSwapId,
} = {}) {
  return {
    dataDir,
    walletName,
    rpcConfig,
    controlPort,
    torAuthPassword,
    zmqAddr,
    password,
    protocol,
    logLevel,
    appSwapId,
  };
}

function safelyShutdownTaker(takerInstance) {
  if (!takerInstance) return;
  if (typeof takerInstance.shutdown === 'function') {
    takerInstance.shutdown();
  }
}

function toNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function getOfferbookSnapshot() {
  const offerbookPath = path.join(api1State.DATA_DIR, 'offerbook.json');
  const snapshot = {
    exists: false,
    path: offerbookPath,
    makerCount: 0,
    stateCounts: {},
    updatedAt: null,
    sample: [],
  };

  try {
    if (!fs.existsSync(offerbookPath)) {
      return snapshot;
    }

    snapshot.exists = true;
    snapshot.updatedAt = fs.statSync(offerbookPath).mtimeMs;

    const offerbook = JSON.parse(fs.readFileSync(offerbookPath, 'utf8'));
    const makers = Array.isArray(offerbook.makers) ? offerbook.makers : [];

    snapshot.makerCount = makers.length;
    snapshot.stateCounts = makers.reduce((acc, maker) => {
      const key =
        typeof maker.state === 'string'
          ? maker.state
          : maker.state && typeof maker.state === 'object'
            ? Object.keys(maker.state)[0] || 'Unknown'
            : 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    snapshot.sample = makers.slice(0, 3).map((maker) => ({
      address: maker.address
        ? `${maker.address.onion_addr}:${maker.address.port}`
        : 'unknown',
      state: maker.state,
      maxSize: maker.offer?.max_size ?? null,
      bondExpiry: maker.offer?.fidelity?.bond?.cert_expiry ?? null,
    }));
  } catch (error) {
    snapshot.error = error.message;
  }

  return snapshot;
}

function getAllSwapReportPaths() {
  const reportsRoot = path.join(api1State.DATA_DIR, 'swap_reports');
  const reportPaths = [];

  function walk(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        reportPaths.push(fullPath);
      }
    }
  }

  walk(reportsRoot);
  return reportPaths;
}

function getCoreSwapReportPaths() {
  const reportsRoot = path.join(api1State.DATA_DIR, 'swap_reports');
  if (!fs.existsSync(reportsRoot)) return [];

  return fs
    .readdirSync(reportsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(reportsRoot, entry.name));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildSwapReportRecord(filePath, rawReport) {
  const fileName = path.basename(filePath, '.json');
  const nativeSwapId =
    rawReport.nativeSwapId ||
    rawReport.native_swap_id ||
    rawReport.swap_id ||
    rawReport.swapId ||
    rawReport.report?.nativeSwapId ||
    rawReport.report?.native_swap_id ||
    rawReport.report?.swap_id ||
    rawReport.report?.swapId ||
    null;
  const appSwapId =
    rawReport.appSwapId ||
    rawReport.app_swap_id ||
    rawReport.swapId ||
    rawReport.swap_id ||
    rawReport.report?.appSwapId ||
    rawReport.report?.app_swap_id ||
    null;
  const normalizedSwapId = appSwapId || nativeSwapId || fileName;
  const nestedReport = rawReport.report ? rawReport.report : rawReport;
  const isCoreReport = !filePath.includes(
    `${path.sep}swap_reports${path.sep}${getCurrentWalletName()}${path.sep}`
  );
  const rawStatus =
    rawReport.status || rawReport.report?.status || (isCoreReport ? 'Success' : null);
  const normalizedStatus =
    String(rawStatus || '').toLowerCase() === 'success'
      ? 'completed'
      : String(rawStatus || '').toLowerCase().startsWith('recovery')
        ? 'completed'
        : rawStatus;
  const rawCompletedAt =
    rawReport.completedAt ||
    rawReport.completed_at ||
    rawReport.report?.completedAt ||
    rawReport.report?.completed_at ||
    rawReport.report?.endTimestamp ||
    rawReport.report?.end_timestamp ||
    null;
  const completedAt =
    Number.isFinite(Number(rawCompletedAt)) && Number(rawCompletedAt) < 1e12
      ? Number(rawCompletedAt) * 1000
      : rawCompletedAt;

  return {
    ...rawReport,
    report: nestedReport,
    swapId: normalizedSwapId,
    nativeSwapId,
    appSwapId,
    status: normalizedStatus,
    completedAt,
    filePath,
    fileName,
    isCoreReport,
  };
}

function getPreferredSwapReports() {
  const records = [];
  const seen = new Set();

  const corePaths = getCoreSwapReportPaths();
  for (const filePath of corePaths) {
    try {
      const record = buildSwapReportRecord(filePath, readJsonFile(filePath));
      const key = record.nativeSwapId || record.swapId || record.fileName;
      seen.add(key);
      records.push(record);
    } catch (error) {
      console.error(`Failed to read core swap report ${filePath}:`, error);
    }
  }

  for (const filePath of getAllSwapReportPaths()) {
    try {
      const record = buildSwapReportRecord(filePath, readJsonFile(filePath));
      const key = record.nativeSwapId || record.swapId || record.fileName;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    } catch (error) {
      console.error(`Failed to read swap report ${filePath}:`, error);
    }
  }

  return records.sort((a, b) => {
    const aTime = Number(a.completedAt || 0);
    const bTime = Number(b.completedAt || 0);
    return bTime - aTime;
  });
}

function findSwapReportRecord(swapId) {
  const normalizedTarget = String(swapId || '');
  return getPreferredSwapReports().find((record) => {
    return [
      record.swapId,
      record.nativeSwapId,
      record.appSwapId,
      record.fileName,
    ]
      .filter(Boolean)
      .some((candidate) => String(candidate) === normalizedTarget);
  });
}

function getHistoricalSwapOutputMap() {
  const swapOutputs = new Map();

  for (const reportPath of getAllSwapReportPaths()) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const outputSwapUtxos =
        report.output_swap_utxos ||
        report.outputSwapUtxos ||
        report.report?.output_swap_utxos ||
        report.report?.outputSwapUtxos ||
        [];

      outputSwapUtxos.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length < 2) return;
        const [amount, address] = entry;
        if (!address) return;
        swapOutputs.set(address, toNumber(amount, 0));
      });
    } catch (error) {
      console.warn('⚠️ Failed to parse swap report for balance derivation:', {
        reportPath,
        error: error.message,
      });
    }
  }

  return swapOutputs;
}

function deriveBalancesFromUtxos(rawUtxos = []) {
  const derived = {
    spendable: 0,
    regular: 0,
    swap: 0,
    contract: 0,
    fidelity: 0,
  };

  rawUtxos.forEach(([utxoEntry, spendInfo]) => {
    const amount = toNumber(utxoEntry?.amount?.sats, 0);
    const spendType = String(spendInfo?.spendType || '').toLowerCase();
    const isSpendable = Boolean(utxoEntry?.spendable);

    if (isSpendable) {
      derived.spendable += amount;
    }

    if (spendType.includes('swap')) {
      derived.swap += amount;
      return;
    }

    if (spendType.includes('contract')) {
      derived.contract += amount;
      return;
    }

    if (spendType.includes('fidelity')) {
      derived.fidelity += amount;
      return;
    }

    if (spendType.includes('seed') || spendType.includes('regular')) {
      derived.regular += amount;
    }
  });

  return derived;
}

function normalizeBalancePayload(rawBalance = {}, rawUtxos = []) {
  const derivedFromUtxos = deriveBalancesFromUtxos(rawUtxos);
  const historicalSwapOutputs = getHistoricalSwapOutputMap();

  const matchedHistoricalSwapUtxos = rawUtxos.filter(([utxoEntry]) =>
    historicalSwapOutputs.has(utxoEntry?.address)
  );
  const historicalSwapBalance = matchedHistoricalSwapUtxos.reduce(
    (sum, [utxoEntry]) => sum + toNumber(utxoEntry?.amount?.sats, 0),
    0
  );

  const normalized = {
    spendable: toNumber(
      rawBalance.spendable ?? rawBalance.spendable_balance,
      derivedFromUtxos.spendable
    ),
    regular: toNumber(
      rawBalance.regular ?? rawBalance.regular_balance,
      derivedFromUtxos.regular
    ),
    swap: toNumber(
      rawBalance.swap ??
        rawBalance.swap_balance ??
        rawBalance.swapCoin ??
        rawBalance.swapcoin,
      derivedFromUtxos.swap
    ),
    contract: toNumber(
      rawBalance.contract ?? rawBalance.contract_balance,
      derivedFromUtxos.contract
    ),
    fidelity: toNumber(
      rawBalance.fidelity ?? rawBalance.fidelity_balance,
      derivedFromUtxos.fidelity
    ),
  };

  // Completed swap outputs can show up as SeedCoin/regular in the current UTXO API.
  // Recover that provenance by matching active UTXOs against saved swap reports.
  if (historicalSwapBalance > normalized.swap) {
    normalized.swap = historicalSwapBalance;
    normalized.regular = Math.max(
      0,
      normalized.spendable -
        normalized.swap -
        normalized.contract -
        normalized.fidelity
    );
  }

  return {
    normalized,
    debug: {
      rawBalance,
      derivedFromUtxos,
      historicalSwapBalance,
      historicalSwapMatches: matchedHistoricalSwapUtxos.map(([utxoEntry, spendInfo]) => ({
        address: utxoEntry?.address,
        amount: toNumber(utxoEntry?.amount?.sats, 0),
        spendType: spendInfo?.spendType,
      })),
    },
  };
}

async function initNAPI() {
  try {
    api1State.coinswapNapi = require('coinswap-napi');
    console.log('✅ coinswap-napi loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load coinswap-napi:', error);
    return false;
  }
}

// ============================================================================
// TAKER API HANDLERS
// ============================================================================

function registerTakerHandlers() {
  ipcMain.handle('preferences:get', async (event, key) => {
    try {
      return { success: true, value: store.get(key) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('preferences:set', async (event, key, value) => {
    try {
      store.set(key, value);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Add setupLogging handler
  ipcMain.handle('taker:setupLogging', async (event, { dataDir, level }) => {
    try {
      console.log(`🔧 Setting up logging: level=${level}, dataDir=${dataDir}`);

      if (!api1State.coinswapNapi) {
        await initNAPI();
      }

      // Default to Taker class for logging setup (shared mechanism)
      const TakerClass = api1State.coinswapNapi?.Taker;

      if (!TakerClass?.setupLogging) {
        throw new Error('setupLogging method not available');
      }

      TakerClass.setupLogging(dataDir, level);

      // Store the preference
      store.set('logLevel', level);

      console.log('✅ Logging initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Logging setup failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Initialize taker
  ipcMain.handle('taker:initialize', async (event, config) => {
    try {
      console.log('🔧 Taker initialization requested');

      // ✅ EXTRACT CONFIG VALUES ONCE
      const walletName =
        config.wallet?.name ||
        config.wallet?.fileName ||
        api1State.DEFAULT_WALLET_NAME;
      const protocol = config.protocol || 'v1';
      const network = config.network || 'signet';
      const walletPath = path.join(api1State.DATA_DIR, 'wallets', walletName);

      // ✅ CHECK IF WE CAN REUSE EXISTING INSTANCE (simplified)
      const canReuse =
        api1State.takerInstance &&
        api1State.protocolVersion === protocol &&
        api1State.currentWalletName === walletName;

      console.log('🔍 Reuse check:', {
        hasInstance: !!api1State.takerInstance,
        protocolMatch: api1State.protocolVersion === protocol,
        walletMatch: api1State.currentWalletName === walletName,
        canReuse,
      });

      if (canReuse) {
        console.log('✅ Reusing existing Taker instance');
        const protocolName = protocol === 'v2' ? 'Taproot (V2)' : 'P2WSH (V1)';
        return {
          success: true,
          message: `Reusing existing ${protocolName} Taker instance`,
          protocol,
          walletName,
          reused: true,
        };
      }

      // ✅ SHUTDOWN OLD INSTANCE IF EXISTS
      if (api1State.takerInstance) {
        console.log('🔄 Shutting down old taker instance...');
        try {
          stopPeriodicSync();
          if (api1State.walletSyncInterval) {
            clearInterval(api1State.walletSyncInterval);
            api1State.walletSyncInterval = null;
          }
          safelyShutdownTaker(api1State.takerInstance);
        } catch (err) {
          console.error('⚠️ Shutdown error:', err);
        }
        api1State.takerInstance = null;
      }

      console.log('🔧 Creating NEW Taker instance...');

      const protocolName = protocol === 'v2' ? 'Taproot (V2)' : 'P2WSH (V1)';
      console.log(`📦 Initializing ${protocolName} taker...`);

      if (!api1State.coinswapNapi) {
        await initNAPI();
        if (!api1State.coinswapNapi) {
          return { success: false, error: 'Failed to load coinswap-napi' };
        }
      }

      // ✅ PREPARE CONSTRUCTOR PARAMS
      const zmqAddr = config.zmq?.address || 'tcp://127.0.0.1:28332';
      const rpcConfig = {
        url: `${config.rpc?.host || '127.0.0.1'}:${config.rpc?.port || 38332}`,
        username: config.rpc?.username || 'user',
        password: config.rpc?.password || 'password',
        walletName,
      };
      const finalPassword = config.wallet?.password?.trim() || '';
      const torAuthPassword = config.taker?.tor_auth_password;
      const controlPort = config.taker?.control_port || 9051;

      // Unified FFI now always exposes a single Taker class.
      const TakerClass = api1State.coinswapNapi.Taker;

      if (!TakerClass) {
        return {
          success: false,
          error: 'Taker class not found. Rebuild coinswap-napi.',
        };
      }

      // ✅ SETUP LOGGING
      try {
        // Get log level from store, environment, or default to 'info'
        const logLevel =
          store.get('logLevel') || process.env.LOG_LEVEL || 'debug';

        console.log(`🔧 Setting up logging with level: ${logLevel}`);
        TakerClass.setupLogging?.(api1State.DATA_DIR, logLevel);
        console.log('✅ Logging initialized');
      } catch (err) {
        console.warn('⚠️ Logging setup failed:', err.message);
      }

      // ✅ CREATE INSTANCE
      api1State.takerInstance = new TakerClass(
        api1State.DATA_DIR,
        walletName,
        rpcConfig,
        controlPort,
        torAuthPassword,
        zmqAddr,
        finalPassword
      );

      // ✅ SAVE STATE
      api1State.protocolVersion = protocol;
      api1State.currentWalletName = walletName;
      api1State.currentWalletPassword = finalPassword;
      api1State.storedTakerConfig = buildTakerConfig({
        dataDir: api1State.DATA_DIR,
        walletName,
        rpcConfig,
        controlPort,
        torAuthPassword,
        zmqAddr,
        password: finalPassword,
        protocol,
      });

      console.log(`✅ ${protocolName} Taker initialized`);

      // ✅ START BACKGROUND SERVICES
      setTimeout(async () => {
        console.log('🔄 Starting background services...');
        // Offerbook sync is triggered explicitly on launch and manually by the user.
        // The Rust backend keeps offerbook.json up to date internally.
        startPeriodicWalletSync();
        console.log('✅ Background services started');
      }, 2000);

      return {
        success: true,
        message: `${protocolName} Taker initialized`,
        protocol,
        walletName,
        reused: false,
      };
    } catch (error) {
      console.error('❌ Initialization failed:', error);

      if (
        error.message.includes('decrypt') ||
        error.message.includes('passphrase')
      ) {
        return {
          success: false,
          error: 'Incorrect password',
          wrongPassword: true,
        };
      }

      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('taker:shutdown', async () => {
    try {
      console.log('🛑 Shutting down taker...');
      console.trace('Shutdown called from:'); // ← ADD THIS to see who called it

      // Stop wallet sync
      if (api1State.walletSyncInterval) {
        clearInterval(api1State.walletSyncInterval);
        api1State.walletSyncInterval = null;
      }

      // Shutdown taker instance
      if (api1State.takerInstance) {
        safelyShutdownTaker(api1State.takerInstance);
        api1State.takerInstance = null;
        api1State.protocolVersion = null;
        api1State.currentWalletName = null;
        console.log('✅ Taker shutdown complete');
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Taker shutdown error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Spawn a worker thread to run syncOfferbookAndWait().
   *
   * The sync MUST run off the main thread — calling it on the main thread
   * blocks Electron's entire event loop and triggers the OS "not responding"
   * dialog. The worker creates its own Taker instance. At launch this matches
   * the main Taker (both cold). Mid-session the worker's Tor circuits warm up
   * quickly because the Tor daemon reuses circuits it already established for
   * the main Taker.
   *
   * Returns { success, syncId } immediately. Caller polls getSyncStatus(syncId).
   */
  function startSyncWorker(source = 'manual') {
    if (!api1State.takerInstance || !api1State.storedTakerConfig) {
      return { success: false, error: 'Taker not initialized' };
    }

    if (api1State.syncState.isRunning) {
      console.log(`⏭️ Sync already running (${source}), skipping`);
      return { success: false, duplicate: true };
    }

    const syncId = `${source}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const preSyncSnapshot = getOfferbookSnapshot();
    console.log(`🔄 [${syncId}] Starting offerbook sync`, {
      source,
      walletName: api1State.currentWalletName || api1State.DEFAULT_WALLET_NAME,
      protocol: api1State.protocolVersion || 'v1',
      offerbook: preSyncSnapshot,
    });
    api1State.syncState.isRunning = true;
    api1State.syncState.currentSyncId = syncId;
    api1State.activeSyncs.set(syncId, {
      status: 'syncing',
      startedAt: Date.now(),
      source,
    });

    const workerConfig = buildTakerConfig({
      ...api1State.storedTakerConfig,
      walletName: api1State.currentWalletName || api1State.DEFAULT_WALLET_NAME,
      protocol: api1State.protocolVersion || 'v1',
    });

    const worker = new Worker(path.join(__dirname, 'offerbook-worker.js'), {
      workerData: { config: workerConfig },
    });

    const finish = (status, extra = {}) => {
      const postSyncSnapshot = getOfferbookSnapshot();
      api1State.activeSyncs.set(syncId, {
        ...api1State.activeSyncs.get(syncId),
        ...extra,
        offerbook: postSyncSnapshot,
        status,
        completedAt: Date.now(),
      });
      console.log(`📘 [${syncId}] Offerbook snapshot after sync`, {
        status,
        offerbook: postSyncSnapshot,
      });
      if (status === 'completed') api1State.syncState.lastSyncTime = Date.now();
      api1State.syncState.isRunning = false;
      api1State.syncState.currentSyncId = null;
    };

    worker.on('message', (msg) => {
      if (msg.type === 'completed') {
        console.log(`✅ [${syncId}] Offerbook sync completed`);
        finish('completed');
      } else if (msg.type === 'error') {
        console.error(`❌ [${syncId}] Offerbook sync failed:`, msg.error);
        finish('failed', { error: msg.error });
      }
    });

    worker.on('error', (err) => {
      console.error(`❌ [${syncId}] Offerbook worker error:`, err.message);
      finish('failed', { error: err.message });
    });

    return { success: true, syncId };
  }

  // Get wallet info
  ipcMain.handle('taker:getWalletInfo', async () => {
    try {
      const walletName =
        api1State.currentWalletName || api1State.DEFAULT_WALLET_NAME;
      const walletPath = path.join(api1State.DATA_DIR, 'wallets', walletName);

      return {
        success: true,
        walletName: walletName,
        walletPath: walletPath,
        dataDir: api1State.DATA_DIR,
      };
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      return { success: false, error: error.message };
    }
  });

  // Get balance
  ipcMain.handle('taker:getBalance', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      // Sync removed to prevent UI blocking on page load - relies on background sync
      // api1State.takerInstance.syncAndSave();
      const balance = api1State.takerInstance.getBalances();
      const rawUtxos = api1State.takerInstance.listAllUtxoSpendInfo();
      const { normalized, debug } = normalizeBalancePayload(balance, rawUtxos);

      console.log('💰 Raw taker balance payload:', balance);
      console.log('💰 Normalized taker balance payload:', normalized);
      console.log('💰 Balance derivation details:', debug);

      return {
        success: true,
        balance: normalized,
      };
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('taker:checkSwapLiquidity', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      const balance = api1State.takerInstance.getBalances();
      const regular = Number(balance?.regular || 0);
      const swap = Number(balance?.swap || 0);
      const spendable = Number(balance?.spendable || 0);

      let maxSwappable = Math.max(regular, swap) - 3000;

      return {
        success: true,
        liquidity: {
          spendable,
          regular,
          swap,
          maxSwappable: Math.max(0, Math.floor(maxSwappable)),
        },
      };
    } catch (error) {
      console.error('❌ Failed to check swap liquidity:', error);
      return { success: false, error: error.message };
    }
  });

  // Start periodic wallet sync (every 5 minutes)
  function startPeriodicWalletSync() {
    if (api1State.walletSyncInterval) {
      clearInterval(api1State.walletSyncInterval);
    }

    console.log('⏰ Starting periodic wallet sync (every 5 minutes)');

    api1State.walletSyncInterval = setInterval(
      async () => {
        if (api1State.takerInstance) {
          try {
            console.log('⏰ Periodic wallet sync triggered');
            api1State.takerInstance.syncAndSave();
            console.log('✅ Periodic wallet sync completed');
          } catch (error) {
            console.error('❌ Periodic wallet sync failed:', error);
          }
        }
      },
      15 * 60 * 1000 // 15 minutes
    );
  }

  // Get next address
  ipcMain.handle('taker:getNextAddress', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      // ✅ Determine address type based on protocol
      const protocol = api1State.protocolVersion || 'v1';
      const addressType = protocol === 'v2' ? 1 : 0; // 1 = Taproot (P2TR), 0 = Legacy (P2WPKH)

      console.log(
        `📍 Generating ${protocol === 'v2' ? 'Taproot (P2TR)' : 'Legacy (P2WPKH)'} address...`
      );

      const address =
        api1State.takerInstance.getNextExternalAddress(addressType);
      api1State.takerInstance.syncAndSave();

      return {
        success: true,
        address: address.address || address,
        addressType: protocol === 'v2' ? 'P2TR' : 'P2WPKH',
      };
    } catch (error) {
      console.error('❌ Failed to generate address:', error);
      return { success: false, error: error.message };
    }
  });

  // Sync wallet
  ipcMain.handle('taker:sync', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      console.log('🔄 Syncing wallet...');
      api1State.takerInstance.syncAndSave();
      console.log('✅ Wallet synced');
      return { success: true, message: 'Wallet synced' };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Get transactions
  ipcMain.handle(
    'taker:getTransactions',
    async (event, { count = 10, skip = 0 }) => {
      try {
        if (!api1State.takerInstance) {
          return { success: false, error: 'Taker not initialized' };
        }

        const transactions = api1State.takerInstance.getTransactions(
          parseInt(count),
          parseInt(skip)
        );
        return { success: true, transactions: transactions || [] };
      } catch (error) {
        return {
          success: true,
          transactions: [],
          message: 'Transaction history unavailable',
        };
      }
    }
  );

  // Add this IPC handler with the other taker handlers
  ipcMain.handle('taker:getProtocol', async () => {
    try {
      if (!api1State.protocolVersion) {
        // Read from config if not in memory
        const configPath = path.join(api1State.DATA_DIR, 'config.toml');
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const protocolMatch = configContent.match(/protocol\s*=\s*"([^"]+)"/);
          if (protocolMatch) {
            api1State.protocolVersion = protocolMatch[1];
          }
        }
      }

      // Returns the app-local protocol string. Native calls map this to
      // 'Legacy'/'Taproot' when building SwapParams.
      const protocol = api1State.protocolVersion || 'v1';
      const protocolName = protocol === 'v2' ? 'Taproot' : 'Legacy';

      return {
        success: true,
        protocol: protocol,
        protocolName: protocolName,
      };
    } catch (error) {
      console.error('Failed to get protocol:', error);
      return {
        success: false,
        error: error.message,
        protocol: 'v1',
        protocolName: 'Legacy',
      };
    }
  });

  // Get UTXOs
  ipcMain.handle('taker:getUtxos', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      const rawUtxos = api1State.takerInstance.listAllUtxoSpendInfo();

      const transformedUtxos = rawUtxos.map(([utxoEntry, spendInfo]) => ({
        utxo: {
          txid: utxoEntry.txid.value,
          vout: utxoEntry.vout,
          amount: utxoEntry.amount.sats,
          confirmations: utxoEntry.confirmations,
          address: utxoEntry.address,
          scriptPubKey: utxoEntry.scriptPubKey,
          spendable: utxoEntry.spendable,
          solvable: utxoEntry.solvable,
          safe: utxoEntry.safe,
        },
        spendInfo: {
          spendType: spendInfo.spendType,
          path: spendInfo.path,
          multisigRedeemscript: spendInfo.multisigRedeemscript,
          inputValue: spendInfo.inputValue,
          index: spendInfo.index,
        },
      }));

      return { success: true, utxos: transformedUtxos || [] };
    } catch (error) {
      return { success: true, utxos: [], message: 'UTXO list unavailable' };
    }
  });

  // Send to address
  ipcMain.handle(
    'taker:sendToAddress',
    async (event, { address, amount, feeRate, manuallySelectedOutpoints }) => {
      try {
        if (!api1State.takerInstance) {
          return { success: false, error: 'Taker not initialized' };
        }

        if (!address || !amount || amount <= 0) {
          return { success: false, error: 'Invalid address or amount' };
        }

        console.log(`📤 Sending ${amount} sats to ${address}...`);

        const txidObj = api1State.takerInstance.sendToAddress(
          address,
          amount,
          feeRate || null,
          manuallySelectedOutpoints || null
        );

        api1State.takerInstance.syncAndSave();

        const txid = txidObj.hex || txidObj;
        console.log(`✅ Transaction sent: ${txid}`);
        return { success: true, txid };
      } catch (error) {
        console.error('❌ Send failed:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Recover from failed swap
  ipcMain.handle('taker:recover', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      console.log('🔄 Recovering from failed swap...');
      api1State.takerInstance.recoverActiveSwap();
      console.log('✅ Recovery completed');
      return { success: true, message: 'Recovery completed' };
    } catch (error) {
      console.error('❌ Recovery failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Backup wallet
  ipcMain.handle(
    'taker:backup',
    async (event, { destinationPath, password }) => {
      try {
        if (!api1State.takerInstance) {
          return { success: false, error: 'Taker not initialized' };
        }

        console.log(`💾 Backing up wallet to: ${destinationPath}`);
        api1State.takerInstance.backup(destinationPath, password || undefined);
        console.log('✅ Backup completed');
        return { success: true, message: 'Backup completed successfully' };
      } catch (error) {
        console.error('❌ Backup failed:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Restore wallet
  ipcMain.handle(
    'taker:restore',
    async (event, { backupFilePath, password, walletName }) => {
      try {
        if (!api1State.coinswapNapi) {
          await initNAPI();
          if (!api1State.coinswapNapi) {
            return { success: false, error: 'Failed to load coinswap-napi' };
          }
        }

        console.log(`♻️ Restoring wallet from: ${backupFilePath}`);

        const restoredWalletName =
          walletName || `restored-wallet-${Date.now()}`;
        console.log(
          `📁 Restoring to: ${api1State.DATA_DIR}/wallets/${restoredWalletName}`
        );

        const rpcConfig = {
          url: '127.0.0.1:38332',
          username: 'user',
          password: 'password',
          walletName: restoredWalletName,
        };

        api1State.coinswapNapi.Taker.restoreWalletGuiApp(
          api1State.DATA_DIR,
          restoredWalletName,
          rpcConfig,
          backupFilePath,
          password || ''
        );

        console.log('✅ Wallet restored successfully to:', restoredWalletName);
        return {
          success: true,
          message: 'Wallet restored successfully',
          walletName: restoredWalletName,
        };
      } catch (error) {
        console.error('❌ Restore failed:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Check if wallet is encrypted
  ipcMain.handle(
    'taker:isWalletEncrypted',
    async (event, walletPath, walletName) => {
      try {
        if (!walletPath) {
          const name =
            walletName ||
            api1State.currentWalletName ||
            api1State.DEFAULT_WALLET_NAME;
          walletPath = path.join(api1State.DATA_DIR, 'wallets', name);
        }

        if (!fs.existsSync(walletPath)) {
          return false;
        }

        if (!api1State.coinswapNapi) {
          await initNAPI();
          if (!api1State.coinswapNapi) {
            console.error(
              'coinswap-napi not loaded for isWalletEncrypted check'
            );
            return false;
          }
        }

        const isEncrypted =
          api1State.coinswapNapi.Taker.isWalletEncrypted(walletPath);
        return isEncrypted;
      } catch (error) {
        console.error('Failed to check wallet encryption:', error);
        return false;
      }
    }
  );

  ipcMain.handle('taker:syncOfferbookAndWait', () => {
    return startSyncWorker('manual');
  });

  // Get sync status
  ipcMain.handle('taker:getSyncStatus', async (event, syncId) => {
    const sync = api1State.activeSyncs.get(syncId);
    if (!sync) {
      return { success: false, error: 'Sync not found' };
    }
    console.log(`📡 [${syncId}] Sync status requested`, {
      status: sync.status,
      source: sync.source,
      startedAt: sync.startedAt,
      completedAt: sync.completedAt,
      offerbook: sync.offerbook,
    });
    return {
      success: true,
      sync,
      // Also return global sync state
      isAnySyncRunning: api1State.syncState.isRunning,
      currentSyncId: api1State.syncState.currentSyncId,
    };
  });

  // ✅ NEW: Get current sync state (for UI)
  ipcMain.handle('taker:getCurrentSyncState', async () => {
    return {
      success: true,
      isRunning: api1State.syncState.isRunning,
      currentSyncId: api1State.syncState.currentSyncId,
      lastSyncTime: api1State.syncState.lastSyncTime,
    };
  });

  // Get offers
  ipcMain.handle('taker:getOffers', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      const offerbookPath = path.join(api1State.DATA_DIR, 'offerbook.json');
      console.log('📖 [getOffers] Reading offerbook', getOfferbookSnapshot());

      if (fs.existsSync(offerbookPath)) {
        const offerbookData = fs.readFileSync(offerbookPath, 'utf8');

        let offerbook;
        try {
          offerbook = JSON.parse(offerbookData);
        } catch (parseError) {
          console.error('❌ Malformed offerbook.json:', parseError.message);
          return {
            success: true,
            offerbook: {
              goodMakers: [],
              badMakers: [],
              unresponsiveMakers: [],
              allMakers: [],
            },
            cached: false,
            message: 'Offerbook file is malformed',
          };
        }

        // NEW STRUCTURE: Single "makers" array with state
        const makers = offerbook.makers || [];

        // Categorize makers based on state
        const goodMakers = [];
        const badMakers = [];
        const unresponsiveMakers = [];

        makers.forEach((maker) => {
          const state = maker.state;
          const normalizedState =
            typeof state === 'string'
              ? state.toLowerCase()
              : state && typeof state === 'object'
                ? Object.keys(state)[0]?.toLowerCase()
                : null;

          if (normalizedState === 'unresponsive') {
            unresponsiveMakers.push(maker);
          } else if (normalizedState === 'bad') {
            badMakers.push(maker);
          } else if (normalizedState === 'good') {
            goodMakers.push(maker);
          } else if (maker.offer != null) {
            // Fallback for older payloads without an explicit state.
            goodMakers.push(maker);
          } else {
            unresponsiveMakers.push(maker);
          }
        });

        const transformMaker = (m) => ({
          address: m.address,
          protocol: m.protocol,
          offer: m.offer
            ? {
              baseFee: m.offer.base_fee,
              amountRelativeFeePct: m.offer.amount_relative_fee_pct,
              timeRelativeFeePct: m.offer.time_relative_fee_pct,
              requiredConfirms: m.offer.required_confirms,
              minimumLocktime: m.offer.minimum_locktime,
              maxSize: m.offer.max_size,
              minSize: m.offer.min_size,
              tweakablePoint: m.offer.tweakable_point,
              fidelity: m.offer.fidelity,
            }
            : null,
        });

        const transformedOfferbook = {
          goodMakers: goodMakers.map(transformMaker),
          badMakers: badMakers.map(transformMaker),
          unresponsiveMakers: unresponsiveMakers.map(transformMaker),
          allMakers: makers.map(transformMaker),
        };

        console.log('📊 [getOffers] Categorized offerbook', {
          good: goodMakers.length,
          bad: badMakers.length,
          unresponsive: unresponsiveMakers.length,
        });

        return {
          success: true,
          offerbook: transformedOfferbook,
          cached: true,
        };
      }

      return {
        success: true,
        offerbook: {
          goodMakers: [],
          badMakers: [],
          unresponsiveMakers: [],
          allMakers: [],
        },
        cached: false,
        message: 'No cached data - click sync to fetch offers',
      };
    } catch (error) {
      console.error('❌ Fetch offers failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Get good makers
  ipcMain.handle('taker:getGoodMakers', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      const offerbookPath = path.join(api1State.DATA_DIR, 'offerbook.json');
      if (!fs.existsSync(offerbookPath)) {
        return { success: true, makers: [] };
      }

      const offerbookData = fs.readFileSync(offerbookPath, 'utf8');
      const offerbook = JSON.parse(offerbookData);
      const makers = Array.isArray(offerbook.makers) ? offerbook.makers : [];
      const goodMakers = makers.filter(isUsableMaker);

      return { success: true, makers: goodMakers };
    } catch (error) {
      console.error('❌ Fetch good makers failed:', error);
      return { success: false, error: error.message };
    }
  });
}

// ============================================================================
// COINSWAP API HANDLERS
// ============================================================================

function registerCoinswapHandlers() {
  // Start coinswap
  ipcMain.handle(
    'coinswap:start',
    async (event, { amount, makerCount, outpoints, password }) => {
      try {
        if (!api1State.takerInstance) {
          return { success: false, error: 'Taker not initialized' };
        }
        const offerbookPath = path.join(api1State.DATA_DIR, 'offerbook.json');

        if (!amount || amount <= 0) {
          return { success: false, error: 'Invalid amount' };
        }

        const protocol = api1State.protocolVersion || 'v1';
        const protocolName = protocol === 'v2' ? 'Taproot' : 'P2WSH';
        const swapId = `swap_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log(
          `🚀 [${swapId}] Starting ${protocolName} coinswap: ${amount} sats, ${makerCount} makers`
        );

        // WAIT FOR OFFERBOOK SYNC TO COMPLETE
        console.log('⏳ Waiting for offerbook sync to complete...');
        let retries = 0;
        const maxRetries = 30; // 30 seconds max wait

        while (retries < maxRetries) {
          try {
            // Check if app-level sync is still running.
            const isSyncing = api1State.syncState.isRunning;

            if (!isSyncing) {
              // Sync complete - now check if we have enough makers
              const offerbookPath = path.join(
                api1State.DATA_DIR,
                'offerbook.json'
              );

              if (fs.existsSync(offerbookPath)) {
                const offerbookData = fs.readFileSync(offerbookPath, 'utf8');
                const offerbook = JSON.parse(offerbookData);
                const makers = offerbook.makers || [];
                const goodMakersCount = makers.filter(isUsableMaker).length;

                if (goodMakersCount >= makerCount) {
                  console.log(
                    `✅ Offerbook ready with ${goodMakersCount} good makers`
                  );
                  break;
                }
              }
            }

            console.log(
              `⏳ Waiting for offerbook sync... (attempt ${retries + 1}/${maxRetries})`
            );
          } catch (err) {
            console.log(
              `⏳ Error checking sync status (attempt ${retries + 1}/${maxRetries}):`,
              err.message
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          retries++;
        }

        // Final check
        try {
          if (fs.existsSync(offerbookPath)) {
            const offerbookData = fs.readFileSync(offerbookPath, 'utf8');
            const offerbook = JSON.parse(offerbookData);
            const makers = offerbook.makers || [];
            const goodMakersCount = makers.filter(isUsableMaker).length;

            if (goodMakersCount < makerCount) {
              console.error(
                `❌ Not enough makers available: ${goodMakersCount}/${makerCount}`
              );
              return {
                success: false,
                error: `Not enough makers available. Found ${goodMakersCount}, need ${makerCount}. Please sync market data first.`,
              };
            }

            console.log(
              `✅ Ready to start swap with ${goodMakersCount} makers`
            );
          } else {
            return {
              success: false,
              error: 'Offerbook not found. Please sync market data first.',
            };
          }
        } catch (err) {
          console.error('❌ Failed to read offerbook:', err);
          return {
            success: false,
            error: 'Failed to load offerbook. Please sync market data first.',
          };
        }

        const walletName =
          api1State.currentWalletName || api1State.DEFAULT_WALLET_NAME;

        const config = buildTakerConfig({
          ...api1State.storedTakerConfig,
          dataDir: api1State.DATA_DIR,
          walletName,
          rpcConfig: api1State.storedTakerConfig?.rpcConfig || {
            url: '127.0.0.1:38332',
            username: 'user',
            password: 'password',
            walletName,
          },
          password: password || api1State.storedTakerConfig?.password || '',
          protocol,
          appSwapId: swapId,
        });

        const worker = new Worker(path.join(__dirname, 'coinswap-worker.js'), {
          workerData: { amount, makerCount, outpoints, config },
        });

        api1State.activeSwaps.set(swapId, {
          status: 'starting',
          amount,
          makerCount,
          protocol: protocol,
          isTaproot: protocol === 'v2',
          protocolVersion: protocol === 'v2' ? 2 : 1,
          nativeSwapId: null,
          startedAt: Date.now(),
        });

        worker.on('message', (msg) => {
          if (msg.type === 'status') {
            const existingSwap = api1State.activeSwaps.get(swapId) || {};
            api1State.activeSwaps.set(swapId, {
              ...existingSwap,
              status: msg.status || existingSwap.status,
              nativeSwapId: msg.nativeSwapId || existingSwap.nativeSwapId,
              protocol: msg.protocol || existingSwap.protocol || protocol,
              isTaproot:
                (msg.protocol || existingSwap.protocol || protocol) === 'v2',
              protocolVersion:
                (msg.protocol || existingSwap.protocol || protocol) === 'v2'
                  ? 2
                  : 1,
            });
          } else if (msg.type === 'complete') {
            const existingSwap = api1State.activeSwaps.get(swapId);
            const swapData = {
              ...existingSwap,
              status: 'completed',
              report: msg.report,
              protocol: msg.protocol || protocol,
              isTaproot: (msg.protocol || protocol) === 'v2',
              protocolVersion: protocol === 'v2' ? 2 : 1,
          nativeSwapId: msg.nativeSwapId || existingSwap?.nativeSwapId,
          appSwapId: msg.appSwapId || swapId,
          completedAt: Date.now(),
        };
        api1State.activeSwaps.set(swapId, swapData);
      } else if (msg.type === 'error') {
        const existingSwap = api1State.activeSwaps.get(swapId);
        const swapData = {
              ...existingSwap,
              status: 'failed',
              error: msg.error,
              protocol: protocol,
              isTaproot: protocol === 'v2',
              protocolVersion: protocol === 'v2' ? 2 : 1,
              failedAt: Date.now(),
            };
            api1State.activeSwaps.set(swapId, swapData);
          }
        });

        worker.on('error', (err) => {
          console.error(`❌ [${swapId}] Worker error:`, err);
        });

        return { success: true, swapId };
      } catch (error) {
        console.error('❌ Coinswap error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  // Get coinswap status
  ipcMain.handle('coinswap:getStatus', async (event, swapId) => {
    const swap = api1State.activeSwaps.get(swapId);
    if (!swap) {
      return { success: false, error: 'Swap not found' };
    }
    return { success: true, swap };
  });
}

// ============================================================================
// SWAP REPORTS API HANDLERS
// ============================================================================

function registerSwapReportsHandlers() {
  // Get all swap reports
  ipcMain.handle('swapReports:getAll', async () => {
    try {
      const reports = getPreferredSwapReports();
      return { success: true, reports };
    } catch (error) {
      console.error('Failed to get swap reports:', error);
      return { success: false, error: error.message };
    }
  });

  // Get specific swap report
  ipcMain.handle('swapReports:get', async (event, swapId) => {
    try {
      const report = findSwapReportRecord(swapId);
      if (!report) {
        return { success: false, error: 'Swap report not found' };
      }

      return { success: true, report };
    } catch (error) {
      console.error('Failed to get swap report:', error);
      return { success: false, error: error.message };
    }
  });
}

// ============================================================================
// SWAP STATE API HANDLERS
// ============================================================================

function registerSwapStateHandlers() {
  // Save swap state
  ipcMain.handle('swapState:save', async (event, state) => {
    try {
      const stateFile = path.join(api1State.DATA_DIR, 'swap_state.json');
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to save swap state:', error);
      return { success: false, error: error.message };
    }
  });

  // Load swap state
  ipcMain.handle('swapState:load', async () => {
    try {
      const stateFile = path.join(api1State.DATA_DIR, 'swap_state.json');
      if (!fs.existsSync(stateFile)) {
        return { success: true, state: null };
      }
      const content = fs.readFileSync(stateFile, 'utf8');
      const state = JSON.parse(content);
      return { success: true, state };
    } catch (error) {
      console.error('❌ Failed to load swap state:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear swap state
  ipcMain.handle('swapState:clear', async () => {
    try {
      const stateFile = path.join(api1State.DATA_DIR, 'swap_state.json');
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear swap state:', error);
      return { success: false, error: error.message };
    }
  });
}

// ============================================================================
// LOGS API HANDLERS
// ============================================================================

function registerLogsHandlers() {
  ipcMain.handle('logs:get', async (event, lines = 100) => {
    const logPath = path.join(api1State.DATA_DIR, 'debug.log');
    try {
      if (!fs.existsSync(logPath)) {
        return { success: true, logs: [] };
      }
      const content = fs.readFileSync(logPath, 'utf8');
      const allLines = content.split('\n').filter((l) => l.trim());
      const lastLines = allLines.slice(-lines);
      return { success: true, logs: lastLines };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

function registerShellHandlers() {
  const { shell } = require('electron');

  ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
    try {
      // This opens the file explorer/finder and highlights the file
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to show item in folder:', error);
      return { success: false, error: error.message };
    }
  });
}

// ============================================================================
// DIALOG API HANDLERS
// ============================================================================

function registerDialogHandlers() {
  ipcMain.handle('dialog:openFile', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        defaultPath: options?.defaultPath || `${api1State.DATA_DIR}/wallets`,
        filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
      });
      if (result.canceled) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: options?.defaultPath || 'wallet-backup.json',
        filters: options?.filters || [
          { name: 'JSON Files', extensions: ['json'] },
        ],
      });
      if (result.canceled) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// Add this function
function registerTorHandlers() {
  const net = require('net');

  ipcMain.handle('network:testTcpPort', async (event, config) => {
    const host = config?.host || '127.0.0.1';
    const port = config?.port;
    const timeout = config?.timeout || 3000;

    return new Promise((resolve) => {
      if (!port) {
        resolve({
          success: false,
          host,
          port,
          error: 'Port is required',
        });
        return;
      }

      const socket = new net.Socket();
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        finish({
          success: true,
          host,
          port,
        });
      });

      socket.on('error', () => {
        finish({
          success: false,
          host,
          port,
          error: `Cannot connect to ${host}:${port}`,
        });
      });

      socket.on('timeout', () => {
        finish({
          success: false,
          host,
          port,
          error: `Connection timeout to ${host}:${port}`,
        });
      });

      socket.connect(port, host);
    });
  });

  ipcMain.handle('tor:testConnection', async (event, config) => {
    const socksPort = config?.socksPort || 9050;
    const controlPort = config?.controlPort || 9051;

    return new Promise((resolve) => {
      // Test SOCKS port
      const socksSocket = new net.Socket();
      let socksConnected = false;

      socksSocket.setTimeout(3000);

      socksSocket.on('connect', () => {
        socksConnected = true;
        socksSocket.destroy();

        // SOCKS port is open, now test if it's actually Tor
        // by trying to connect through it
        resolve({
          success: true,
          port: socksPort,
          message: `Tor SOCKS proxy is running on port ${socksPort}`,
        });
      });

      socksSocket.on('error', (err) => {
        resolve({
          success: false,
          port: socksPort,
          error: `Cannot connect to Tor SOCKS proxy on port ${socksPort}. Is Tor running?`,
        });
      });

      socksSocket.on('timeout', () => {
        socksSocket.destroy();
        resolve({
          success: false,
          port: socksPort,
          error: `Connection timeout on port ${socksPort}`,
        });
      });

      socksSocket.connect(socksPort, '127.0.0.1');
    });
  });
}
// ============================================================================
// MAIN REGISTRATION FUNCTION
// ============================================================================

function registerAPI1() {
  console.log('📦 Registering API v1 handlers...');

  registerTakerHandlers();
  registerCoinswapHandlers();
  registerSwapReportsHandlers();
  registerSwapStateHandlers();
  registerLogsHandlers();
  registerDialogHandlers();
  registerShellHandlers();
  registerTorHandlers();

  console.log('✅ API v1 handlers registered');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  registerAPI1,
  api1State,
};
