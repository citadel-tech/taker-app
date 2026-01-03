const { ipcMain, dialog } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');

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
  protocolVersion: 'v1', // 'v1' (P2WSH/Taker) or 'v2' (Taproot/TaprootTaker)
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

function saveSwapReport(swapId, swapData) {
  try {
    const walletName = api1State.currentWalletName || getCurrentWalletName();
    const reportsDir = path.join(
      api1State.DATA_DIR,
      'swap_reports',
      walletName
    );

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      console.log('📁 Created swap_reports directory');
    }

    const reportData = {
      ...swapData,
      swapId: swapId,
      status: swapData.status || 'completed',
      amount: swapData.amount,
      startedAt: swapData.startedAt || Date.now(),
      completedAt: swapData.completedAt || Date.now(),
    };

    const filename = `${swapId}.json`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`💾 Swap report saved: ${filepath}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to save swap report:', error);
    return false;
  }
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
  // Initialize taker
  ipcMain.handle('taker:initialize', async (event, config) => {
  try {
    console.log('🔧 Taker initialization requested');

    // ✅ EXTRACT CONFIG VALUES ONCE
    const walletName = config.wallet?.name || config.wallet?.fileName || api1State.DEFAULT_WALLET_NAME;
    const protocol = config.protocol || 'v1';
    const network = config.network || 'signet';
    const walletPath = path.join(api1State.DATA_DIR, 'wallets', walletName);

    // ✅ CHECK IF WE CAN REUSE EXISTING INSTANCE (simplified)
    const canReuse = api1State.takerInstance &&
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
        api1State.takerInstance.shutdown();
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

    // ✅ SELECT TAKER CLASS
    const TakerClass = protocol === 'v2' 
      ? api1State.coinswapNapi.TaprootTaker 
      : api1State.coinswapNapi.Taker;

    if (!TakerClass) {
      return {
        success: false,
        error: `${protocol === 'v2' ? 'TaprootTaker' : 'Taker'} class not found. Rebuild coinswap-napi.`,
      };
    }

    // ✅ SETUP LOGGING
    try {
      TakerClass.setupLogging?.(api1State.DATA_DIR);
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
    api1State.storedTakerConfig = {
      dataDir: api1State.DATA_DIR,
      rpcConfig,
      zmqAddr,
      controlPort,
      torAuthPassword,
      password: finalPassword,
      protocol,
    };

    console.log(`✅ ${protocolName} Taker initialized`);

    // ✅ START BACKGROUND SERVICES
    setTimeout(async () => {
      console.log('🔄 Starting background services...');
      await startOfferbookSync('auto');
      startPeriodicSync();
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

    if (error.message.includes('decrypt') || error.message.includes('passphrase')) {
      return { success: false, error: 'Incorrect password', wrongPassword: true };
    }

    return { success: false, error: error.message };
  }
});

  ipcMain.handle('taker:shutdown', async () => {
    try {
      console.log('🛑 Shutting down taker...');
      console.trace('Shutdown called from:'); // ← ADD THIS to see who called it

      // Stop periodic syncs
      stopPeriodicSync();

      // Stop wallet sync
      if (api1State.walletSyncInterval) {
        clearInterval(api1State.walletSyncInterval);
        api1State.walletSyncInterval = null;
      }

      // Shutdown taker instance
      if (api1State.takerInstance) {
        api1State.takerInstance.shutdown();
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

  async function startOfferbookSync(source = 'manual') {
    try {
      if (!api1State.takerInstance || !api1State.storedTakerConfig) {
        return { success: false, error: 'Taker not initialized' };
      }

      // 🛡️ CHECK: If sync is already running
      if (api1State.syncState.isRunning) {
        console.log(
          `⏭️ Sync already running (${source}), joining existing sync`
        );
        return {
          success: false,
          duplicate: true,
          existingSyncId: api1State.syncState.currentSyncId,
        };
      }

      const syncId = `${source}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(`🔄 [${syncId}] Starting offerbook sync (${source})...`);

      // ✅ SET FLAGS
      api1State.syncState.isRunning = true;
      api1State.syncState.currentSyncId = syncId;

      // Delete old offerbook
      const offerbookPath = path.join(
        api1State.storedTakerConfig.dataDir,
        'offerbook.json'
      );
      if (fs.existsSync(offerbookPath)) {
        fs.unlinkSync(offerbookPath);
      }

      const config = {
        ...api1State.storedTakerConfig,
        walletName: api1State.currentWalletName,
        password: api1State.currentWalletPassword,
        protocol: api1State.protocolVersion || 'v1',
      };

      const worker = new Worker(path.join(__dirname, 'offerbook-worker.js'), {
        workerData: { config },
      });

      api1State.activeSyncs.set(syncId, {
        status: 'starting',
        startedAt: Date.now(),
        source: source,
      });

      worker.on('message', (msg) => {
        if (msg.type === 'complete') {
          console.log(`✅ Offerbook sync completed (${source})`);
          api1State.activeSyncs.set(syncId, {
            ...api1State.activeSyncs.get(syncId),
            status: 'completed',
            completedAt: Date.now(),
          });

          // ✅ CLEAR FLAGS
          api1State.syncState.isRunning = false;
          api1State.syncState.currentSyncId = null;
          api1State.syncState.lastSyncTime = Date.now();
        } else if (msg.type === 'error') {
          console.error(`❌ Offerbook sync failed (${source}):`, msg.error);
          api1State.activeSyncs.set(syncId, {
            ...api1State.activeSyncs.get(syncId),
            status: 'failed',
            error: msg.error,
          });

          // ✅ CLEAR FLAGS
          api1State.syncState.isRunning = false;
          api1State.syncState.currentSyncId = null;
        } else if (msg.type === 'status') {
          api1State.activeSyncs.set(syncId, {
            ...api1State.activeSyncs.get(syncId),
            status: msg.status,
          });
        }
      });

      worker.on('error', (err) => {
        console.error(`❌ [${syncId}] Worker error (${source}):`, err);

        // ✅ CLEAR FLAGS
        api1State.syncState.isRunning = false;
        api1State.syncState.currentSyncId = null;
      });

      return { success: true, syncId, source };
    } catch (error) {
      console.error('❌ Sync offerbook failed:', error);

      // ✅ CLEAR FLAGS
      api1State.syncState.isRunning = false;
      api1State.syncState.currentSyncId = null;

      return { success: false, error: error.message };
    }
  }

  function startPeriodicSync() {
    // Clear any existing interval
    if (api1State.syncState.periodicInterval) {
      clearInterval(api1State.syncState.periodicInterval);
    }

    console.log('⏰ Starting periodic sync scheduler (every 15 minutes)');

    api1State.syncState.periodicInterval = setInterval(
      async () => {
        console.log('⏰ Periodic sync triggered');
        await startOfferbookSync('periodic');
      },
      15 * 60 * 1000
    ); // 15 minutes
  }

  /**
   * Stop periodic offerbook syncs
   */
  function stopPeriodicSync() {
    if (api1State.syncState.periodicInterval) {
      clearInterval(api1State.syncState.periodicInterval);
      api1State.syncState.periodicInterval = null;
      console.log('⏰ Periodic sync scheduler stopped');
    }
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

      api1State.takerInstance.syncAndSave();
      const balance = api1State.takerInstance.getBalances();

      return {
        success: true,
        balance: {
          spendable: balance.spendable,
          regular: balance.regular,
          swap: balance.swap,
          contract: balance.contract,
          fidelity: balance.fidelity,
        },
      };
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
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
      5 * 60 * 1000 // 5 minutes
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

  // Check if offerbook is syncing
  ipcMain.handle('taker:isOfferbookSyncing', async () => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      const isSyncing = api1State.takerInstance.isOfferbookSyncing();

      return {
        success: true,
        isSyncing: isSyncing,
      };
    } catch (error) {
      console.error('Failed to check offerbook sync status:', error);
      return { success: false, error: error.message, isSyncing: false };
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
      api1State.takerInstance.recoverFromSwap();
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

        const isEncrypted =
          api1State.coinswapNapi.Taker.isWalletEncrypted(walletPath);
        return isEncrypted;
      } catch (error) {
        console.error('Failed to check wallet encryption:', error);
        return false;
      }
    }
  );

  // Sync offerbook
  ipcMain.handle('taker:syncOfferbook', async () => {
    return await startOfferbookSync('manual');
  });

  // Get sync status
  ipcMain.handle('taker:getSyncStatus', async (event, syncId) => {
    const sync = api1State.activeSyncs.get(syncId);
    if (!sync) {
      return { success: false, error: 'Sync not found' };
    }
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

          if (state && state.Unresponsive) {
            unresponsiveMakers.push(maker);
          } else if (state && state.Bad) {
            badMakers.push(maker);
          } else if (maker.offer !== null) {
            // Good makers have offers
            goodMakers.push(maker);
          } else {
            // Fallback: makers without offers go to unresponsive
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

      const goodMakers = api1State.takerInstance.getAllGoodMakers();
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
            // Check if sync is still running
            const isSyncing = api1State.takerInstance.isOfferbookSyncing();

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
                const goodMakersCount = makers.filter(
                  (m) =>
                    m.offer !== null &&
                    !(m.state && (m.state.Unresponsive || m.state.Bad))
                ).length;

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
            const goodMakersCount = makers.filter(
              (m) =>
                m.offer !== null &&
                !(m.state && (m.state.Unresponsive || m.state.Bad))
            ).length;

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

        const config = {
          dataDir: api1State.DATA_DIR,
          walletName: walletName,
          controlPort: api1State.storedTakerConfig?.controlPort || 9051,
          rpcConfig: api1State.storedTakerConfig?.rpcConfig || {
            url: '127.0.0.1:38332',
            username: 'user',
            password: 'password',
            walletName: walletName,
          },
          zmqAddr:
            api1State.storedTakerConfig?.zmqAddr || 'tcp://127.0.0.1:28332',
          password: password || '',
          protocol: protocol,
        };

        const worker = new Worker(path.join(__dirname, 'coinswap-worker.js'), {
          workerData: { amount, makerCount, outpoints, config },
        });

        api1State.activeSwaps.set(swapId, {
          status: 'starting',
          amount,
          makerCount,
          startedAt: Date.now(),
        });

        worker.on('message', (msg) => {
          if (msg.type === 'complete') {
            const swapData = {
              ...api1State.activeSwaps.get(swapId),
              status: 'completed',
              report: msg.report,
              completedAt: Date.now(),
            };
            api1State.activeSwaps.set(swapId, swapData);
            saveSwapReport(swapId, swapData);
          } else if (msg.type === 'error') {
            const swapData = {
              ...api1State.activeSwaps.get(swapId),
              status: 'failed',
              error: msg.error,
              failedAt: Date.now(),
            };
            api1State.activeSwaps.set(swapId, swapData);
            saveSwapReport(swapId, swapData);
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
      const walletName = api1State.currentWalletName || getCurrentWalletName();
      const reportsDir = path.join(
        api1State.DATA_DIR,
        'swap_reports',
        walletName
      );

      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
        return { success: true, reports: [] };
      }

      const files = fs.readdirSync(reportsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const reports = jsonFiles
        .map((file) => {
          try {
            const filePath = path.join(reportsDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const report = JSON.parse(content);
            const swapId = file.replace('.json', '');
            return { ...report, swapId };
          } catch (error) {
            console.error(`Failed to read swap report ${file}:`, error);
            return null;
          }
        })
        .filter((r) => r !== null);

      return { success: true, reports };
    } catch (error) {
      console.error('Failed to get swap reports:', error);
      return { success: false, error: error.message };
    }
  });

  // Get specific swap report
  ipcMain.handle('swapReports:get', async (event, swapId) => {
    try {
      const walletName = api1State.currentWalletName || getCurrentWalletName();
      const reportsDir = path.join(
        api1State.DATA_DIR,
        'swap_reports',
        walletName
      );

      if (!fs.existsSync(reportsDir)) {
        return {
          success: false,
          error: 'Swap reports directory does not exist',
        };
      }

      const files = fs.readdirSync(reportsDir);
      const matchingFile = files.find(
        (f) => f.startsWith(swapId) && f.endsWith('.json')
      );

      if (!matchingFile) {
        return { success: false, error: 'Swap report not found' };
      }

      const filePath = path.join(reportsDir, matchingFile);
      const content = fs.readFileSync(filePath, 'utf-8');
      const report = JSON.parse(content);

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
