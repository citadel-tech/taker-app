const { ipcMain, dialog, app } = require('electron');
const { Worker } = require('worker_threads');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

function getMakerProtocolName(maker = {}) {
  if (maker.protocol === 'Unified') return 'Unified';
  if (maker.protocol === 'Taproot' || maker.protocol === 'v2') return 'Taproot';
  if (maker.protocol === 'Legacy' || maker.protocol === 'v1') return 'Legacy';
  return maker.offer?.tweakable_point || maker.offer?.tweakablePoint
    ? 'Taproot'
    : 'Legacy';
}

function isMakerCompatibleWithProtocol(maker, protocol) {
  const makerProtocol = getMakerProtocolName(maker);
  if (makerProtocol === 'Unified') return true;
  return protocol === 'v2' ? makerProtocol === 'Taproot' : makerProtocol === 'Legacy';
}

function countUsableCompatibleMakers(makers, protocol) {
  return makers.filter(
    (maker) => isUsableMaker(maker) && isMakerCompatibleWithProtocol(maker, protocol)
  ).length;
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

function requireWalletPassword(password) {
  if (typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('Wallet password is required');
  }

  return password;
}

function readFileTail(filePath, maxBytes = 1024 * 1024) {
  const stats = fs.statSync(filePath);
  const start = Math.max(0, stats.size - maxBytes);
  const length = stats.size - start;
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function parseRecoveryStatusFromLog(logText = '') {
  const pendingByTxid = new Map();
  const targetByTxid = new Map();
  const recoveredTxids = new Set();
  const recoveryTxids = new Set();
  const lines = String(logText || '').split(/\r?\n/);
  let latestCurrentHeight = null;
  let latestRecoveryStartedAt = null;
  let latestRecoverTimelockedCount = 0;
  let latestRecoverTimelockedAt = null;
  let lastCoinSelectionTarget = null;

  for (const line of lines) {
    const timestamp = line.match(/^(\S+)/)?.[1] || null;

    const targetMatch = line.match(/Coinselection\s*:\s*.*Target\s*:\s*(\d+)/i);
    if (targetMatch) {
      lastCoinSelectionTarget = Number(targetMatch[1]);
    }

    const createdTxMatch = line.match(/Created tx,\s*txid:\s*([0-9a-f]{64})/i);
    if (createdTxMatch && Number.isFinite(lastCoinSelectionTarget)) {
      targetByTxid.set(createdTxMatch[1], lastCoinSelectionTarget);
      lastCoinSelectionTarget = null;
    }

    if (/Funds were broadcast, triggering recovery|Starting swap recovery/i.test(line)) {
      latestRecoveryStartedAt = timestamp;
    }

    const recoverCountMatch = line.match(
      /recover_timelocked:\s*(\d+)\s+outgoing swapcoins in store at height\s+(\d+)/i
    );
    if (recoverCountMatch) {
      latestRecoverTimelockedCount = Number(recoverCountMatch[1]);
      latestCurrentHeight = Number(recoverCountMatch[2]);
      latestRecoverTimelockedAt = timestamp;

      if (latestRecoverTimelockedCount === 0) {
        pendingByTxid.clear();
      }
    }

    const notReadyMatch = line.match(
      /Outgoing swapcoin\s+([0-9a-f]{64})\s+not yet ready\s+\(current:\s*(\d+),\s*CLTV:\s*(\d+)\)/i
    );
    if (notReadyMatch) {
      const [, txid, currentRaw, cltvRaw] = notReadyMatch;
      const currentHeight = Number(currentRaw);
      const cltv = Number(cltvRaw);
      latestCurrentHeight = currentHeight;
      if (!recoveredTxids.has(txid)) {
        pendingByTxid.set(txid, {
          txid,
          amount: targetByTxid.get(txid) ?? null,
          currentHeight,
          unlockBlock: cltv,
          blocksRemaining: Math.max(0, cltv - currentHeight),
          status: currentHeight >= cltv ? 'ready' : 'waiting_timelock',
          detectedAt: timestamp,
        });
      }
    }

    const removedMatch = line.match(/Removed outgoing swapcoin:\s*([0-9a-f]{64})/i);
    if (removedMatch) {
      const txid = removedMatch[1];
      recoveredTxids.add(txid);
      pendingByTxid.delete(txid);
    }

    const recoveryTxMatch = line.match(
      /(?:Sweep|Recovery|Refund) transaction\s+([0-9a-f]{64})/i
    );
    if (recoveryTxMatch) {
      recoveryTxids.add(recoveryTxMatch[1]);
    }
  }

  const pending = Array.from(pendingByTxid.values()).sort(
    (a, b) => (b.detectedAt || '').localeCompare(a.detectedAt || '')
  );
  const totalPendingAmount = pending.reduce(
    (sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0),
    0
  );

  return {
    source: 'debug-log',
    currentHeight: latestCurrentHeight,
    pendingCount: pending.length,
    latestRecoverTimelockedCount,
    pending,
    totalPendingAmount,
    recoveredCount: recoveredTxids.size,
    recoveryTxids: Array.from(recoveryTxids),
    lastRecoveryStartedAt: latestRecoveryStartedAt,
    lastRecoverTimelockedAt: latestRecoverTimelockedAt,
  };
}

function classifyWalletInitializationError(error) {
  const message = error?.message || String(error || 'Unknown wallet error');
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('decrypt') ||
    lowerMessage.includes('passphrase') ||
    lowerMessage.includes('incorrect password') ||
    lowerMessage.includes('wrong password')
  ) {
    return {
      success: false,
      error: 'Incorrect password. Please try again.',
      wrongPassword: true,
      recoverable: true,
    };
  }

  if (message === 'Wallet password is required') {
    return {
      success: false,
      error: message,
      needsPassword: true,
      recoverable: true,
    };
  }

  if (
    lowerMessage.includes('wallet') ||
    lowerMessage.includes('json') ||
    lowerMessage.includes('parse') ||
    lowerMessage.includes('serde') ||
    lowerMessage.includes('deserialize') ||
    lowerMessage.includes('eof') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('corrupt') ||
    lowerMessage.includes('malformed')
  ) {
    return {
      success: false,
      error:
        'Unable to open this wallet. It may be corrupted, incomplete, or not a valid Coinswap wallet file.',
      walletLoadFailed: true,
      recoverable: true,
      details: message,
    };
  }

  return null;
}

function createCborReader(buffer) {
  let offset = 0;

  function readByte() {
    if (offset >= buffer.length) {
      throw new Error('Unexpected end of wallet file');
    }
    return buffer[offset++];
  }

  function readLength(additionalInfo) {
    if (additionalInfo < 24) return additionalInfo;
    if (additionalInfo === 24) return readByte();
    if (additionalInfo === 25) {
      const value = buffer.readUInt16BE(offset);
      offset += 2;
      return value;
    }
    if (additionalInfo === 26) {
      const value = buffer.readUInt32BE(offset);
      offset += 4;
      return value;
    }
    if (additionalInfo === 27) {
      const value = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
      return value;
    }
    throw new Error('Unsupported wallet CBOR encoding');
  }

  function readHeader() {
    const byte = readByte();
    return {
      majorType: byte >> 5,
      length: readLength(byte & 0x1f),
    };
  }

  function readText() {
    const header = readHeader();
    if (header.majorType !== 3) {
      throw new Error('Invalid wallet CBOR map key');
    }
    const end = offset + header.length;
    const value = buffer.toString('utf8', offset, end);
    offset = end;
    return value;
  }

  function readUnsigned() {
    const header = readHeader();
    if (header.majorType !== 0) {
      throw new Error('Invalid wallet CBOR byte value');
    }
    return header.length;
  }

  function readBytesLike() {
    const header = readHeader();

    if (header.majorType === 2) {
      const end = offset + header.length;
      const value = buffer.subarray(offset, end);
      offset = end;
      return Buffer.from(value);
    }

    if (header.majorType === 4) {
      const bytes = Buffer.alloc(header.length);
      for (let i = 0; i < header.length; i += 1) {
        bytes[i] = readUnsigned();
      }
      return bytes;
    }

    throw new Error('Invalid encrypted wallet data');
  }

  function skipValue() {
    const header = readHeader();

    if (header.majorType === 0 || header.majorType === 1) return;

    if (header.majorType === 2 || header.majorType === 3) {
      offset += header.length;
      return;
    }

    if (header.majorType === 4) {
      for (let i = 0; i < header.length; i += 1) skipValue();
      return;
    }

    if (header.majorType === 5) {
      for (let i = 0; i < header.length; i += 1) {
        skipValue();
        skipValue();
      }
      return;
    }

    if (header.majorType === 6) {
      skipValue();
      return;
    }

    if (header.majorType === 7) return;

    throw new Error('Unsupported wallet CBOR encoding');
  }

  return {
    readEncryptedWalletHeader() {
      const header = readHeader();
      if (header.majorType !== 5) {
        throw new Error('Wallet file is not a valid CBOR map');
      }

      const encrypted = {};
      for (let i = 0; i < header.length; i += 1) {
        const key = readText();
        if (
          key === 'nonce' ||
          key === 'encrypted_payload' ||
          key === 'pbkdf2_salt'
        ) {
          encrypted[key] = readBytesLike();
        } else {
          skipValue();
        }
      }
      return encrypted;
    },
  };
}

function reverseTxid(hex) {
  if (!hex || hex.length !== 64) return hex;
  return hex.match(/.{2}/g).reverse().join('');
}

function decodeCbor(buffer) {
  let offset = 0;

  function readByte() {
    if (offset >= buffer.length) throw new Error('Unexpected end of CBOR data');
    return buffer[offset++];
  }

  function readLength(additionalInfo) {
    if (additionalInfo < 24) return additionalInfo;
    if (additionalInfo === 24) return readByte();
    if (additionalInfo === 25) { const v = buffer.readUInt16BE(offset); offset += 2; return v; }
    if (additionalInfo === 26) { const v = buffer.readUInt32BE(offset); offset += 4; return v; }
    if (additionalInfo === 27) { const v = Number(buffer.readBigUInt64BE(offset)); offset += 8; return v; }
    throw new Error('Unsupported CBOR additional info: ' + additionalInfo);
  }

  function readValue() {
    const byte = readByte();
    const majorType = byte >> 5;
    const additionalInfo = byte & 0x1f;

    if (majorType === 6) { readLength(additionalInfo); return readValue(); } // tagged — skip tag

    const len = readLength(additionalInfo);

    if (majorType === 0) return len;
    if (majorType === 1) return -1 - len;
    if (majorType === 2) { const v = buffer.slice(offset, offset + len).toString('hex'); offset += len; return v; }
    if (majorType === 3) { const v = buffer.toString('utf8', offset, offset + len); offset += len; return v; }
    if (majorType === 4) { const arr = []; for (let i = 0; i < len; i++) arr.push(readValue()); return arr; }
    if (majorType === 5) { const obj = {}; for (let i = 0; i < len; i++) { const k = readValue(); obj[k] = readValue(); } return obj; }
    if (majorType === 7) {
      if (additionalInfo === 20) return false;
      if (additionalInfo === 21) return true;
      if (additionalInfo === 22) return null;
      return null;
    }
    throw new Error('Unsupported CBOR major type: ' + majorType);
  }

  return readValue();
}

function formatFailureReason(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const general = raw.match(/^General\("(.+)"\)$/s);
  if (general) return general[1];
  if (raw === 'FundingTxWaitTimeOut') return 'Funding transaction timed out';
  if (raw.startsWith('ContractsBroadcasted')) return 'Contracts broadcast without maker response';
  if (raw.startsWith('Net(')) return 'Network connection error';
  return raw;
}

function enrichRecoveryFromLog(pending, logPath) {
  if (!pending.length || !fs.existsSync(logPath)) return pending;
  try {
    const logTail = readFileTail(logPath, 2 * 1024 * 1024);
    const lines = logTail.split(/\r?\n/);

    const cltvByTxid = new Map();
    let latestHeight = null;

    for (const line of lines) {
      const heightMatch = line.match(/recover_timelocked:\s*\d+\s+outgoing swapcoins in store at height\s+(\d+)/i);
      if (heightMatch) latestHeight = Number(heightMatch[1]);

      const cltvMatch = line.match(/Outgoing swapcoin\s+([0-9a-f]{64})\s+not yet ready\s+\(current:\s*(\d+),\s*CLTV:\s*(\d+)\)/i);
      if (cltvMatch) {
        cltvByTxid.set(cltvMatch[1].toLowerCase(), {
          currentHeight: Number(cltvMatch[2]),
          unlockBlock: Number(cltvMatch[3]),
        });
      }
    }

    return pending.map(item => {
      const info = cltvByTxid.get((item.txid || '').toLowerCase());
      if (!info) return item;
      const currentHeight = latestHeight ?? info.currentHeight;
      const blocksRemaining = Math.max(0, info.unlockBlock - currentHeight);
      return {
        ...item,
        currentHeight,
        unlockBlock: info.unlockBlock,
        blocksRemaining,
        status: blocksRemaining === 0 ? 'ready' : 'waiting_timelock',
      };
    });
  } catch (err) {
    console.error('⚠️ Failed to enrich recovery from log:', err.message);
    return pending;
  }
}

function getSwapFromTracker(swapId) {
  try {
    const trackerPath = path.join(api1State.DATA_DIR, 'swap_tracker.cbor');
    if (!fs.existsSync(trackerPath)) return null;
    const data = decodeCbor(fs.readFileSync(trackerPath));
    return (data && data.swaps && data.swaps[String(swapId)]) || null;
  } catch (err) {
    console.error('⚠️ Failed to read swap from tracker:', err.message);
    return null;
  }
}

function buildMakerProgress(makerEntry) {
  if (!makerEntry) return null;
  const exchangeData = makerEntry.exchange
    ? Object.values(makerEntry.exchange)[0]
    : null;
  return {
    negotiated: Boolean(makerEntry.negotiated),
    connected: Boolean(exchangeData?.connected),
    contractDataSent: Boolean(exchangeData?.contract_data_sent),
    makerContractReceived: Boolean(exchangeData?.maker_contract_received),
    swapcoinCreated: Boolean(exchangeData?.swapcoins_created),
    privkeyReceived: Boolean(makerEntry.finalization?.privkey_received),
    privkeyForwarded: Boolean(makerEntry.finalization?.privkey_forwarded),
  };
}

function parseSwapTracker(trackerPath) {
  if (!fs.existsSync(trackerPath)) return null;
  try {
    const buffer = fs.readFileSync(trackerPath);
    const data = decodeCbor(buffer);
    const swaps = data && data.swaps;
    if (!swaps || typeof swaps !== 'object' || Array.isArray(swaps)) return null;

    const result = {
      source: 'swap-tracker',
      total: 0,
      completed: 0,
      failed: 0,
      pending: [],
      cleanedUp: 0,
      totalPendingAmount: 0,
      pendingCount: 0,
      recoveredCount: 0,
    };

    for (const swapId of Object.keys(swaps)) {
      const swap = swaps[swapId];
      result.total++;

      if (swap.phase === 'Completed') {
        result.completed++;
        continue;
      }

      if (swap.phase === 'Failed') {
        result.failed++;
        const recoveryPhase = swap.recovery && swap.recovery.phase;

        if (recoveryPhase === 'CleanedUp') {
          result.cleanedUp++;
        } else {
          // CBOR stores txids in internal byte order; Bitcoin logs/UI use reversed (display) order
          const rawTxid = Array.isArray(swap.outgoing_contract_txids) && swap.outgoing_contract_txids[0] || null;
          const displayTxid = rawTxid ? reverseTxid(rawTxid) : null;
          const amount = Number(swap.send_amount_sat || 0);
          result.pending.push({
            swapId: String(swap.swap_id || swapId),
            txid: displayTxid,
            amount,
            status: 'pending_recovery',
            failedAtPhase: swap.failed_at_phase || null,
            failureReason: formatFailureReason(
              typeof swap.failure_reason === 'string' ? swap.failure_reason : null
            ),
            createdAt: swap.created_at ? new Date(swap.created_at * 1000).toISOString() : null,
            blocksRemaining: null,
            currentHeight: null,
            unlockBlock: null,
          });
          result.totalPendingAmount += amount;
        }
      }
    }

    result.pendingCount = result.pending.length;
    result.recoveredCount = result.cleanedUp;
    return result;
  } catch (err) {
    console.error('⚠️ Failed to parse swap_tracker.cbor:', err.message);
    return null;
  }
}

function preflightExistingWallet(walletPath, password) {
  if (!fs.existsSync(walletPath)) {
    return { success: true, exists: false, encrypted: false };
  }

  let encryptedData;
  try {
    const walletBytes = fs.readFileSync(walletPath);
    encryptedData = createCborReader(walletBytes).readEncryptedWalletHeader();
  } catch (error) {
    return {
      success: false,
      error:
        'Unable to open this wallet. It may be corrupted, incomplete, or not a valid Coinswap wallet file.',
      walletLoadFailed: true,
      recoverable: true,
      details: error.message,
    };
  }

  const { nonce, encrypted_payload: encryptedPayload, pbkdf2_salt: salt } =
    encryptedData;

  if (!nonce || !encryptedPayload || !salt) {
    return {
      success: false,
      error:
        'This wallet is not encrypted. Password-protected wallets are required.',
      walletLoadFailed: true,
      recoverable: true,
    };
  }

  if (typeof password !== 'string' || password.trim().length === 0) {
    return {
      success: false,
      error: 'Wallet password is required',
      needsPassword: true,
      recoverable: true,
    };
  }

  const authTagLength = 16;
  if (encryptedPayload.length <= authTagLength) {
    return {
      success: false,
      error:
        'Unable to open this wallet. It may be corrupted, incomplete, or not a valid Coinswap wallet file.',
      walletLoadFailed: true,
      recoverable: true,
      details: 'Encrypted wallet payload is too short',
    };
  }

  const ciphertext = encryptedPayload.subarray(
    0,
    encryptedPayload.length - authTagLength
  );
  const authTag = encryptedPayload.subarray(
    encryptedPayload.length - authTagLength
  );

  try {
    const key = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    decipher.update(ciphertext);
    decipher.final();
  } catch (error) {
    return {
      success: false,
      error: 'Incorrect password. Please try again.',
      wrongPassword: true,
      recoverable: true,
    };
  }

  return { success: true, exists: true, encrypted: true };
}

function runNativeWalletPreflight(config) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'wallet-native-preflight.js')],
      {
        cwd: __dirname,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        success: false,
        error: 'Wallet validation timed out. Please try again.',
        walletLoadFailed: true,
        recoverable: true,
      });
    }, 30000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        success: false,
        error: `Unable to validate wallet: ${error.message}`,
        walletLoadFailed: true,
        recoverable: true,
      });
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const marker = stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith('__WALLET_PREFLIGHT_RESULT__'));
      if (marker) {
        try {
          const result = JSON.parse(
            marker.replace('__WALLET_PREFLIGHT_RESULT__', '')
          );
          resolve(result);
          return;
        } catch (error) {
          // Fall through to the generic failure below.
        }
      }

      const combinedOutput = `${stderr}\n${stdout}`.trim();
      resolve({
        success: false,
        error:
          signal || code
            ? 'Wallet could not be opened safely. It may be corrupted or incompatible with this app build.'
            : 'Wallet validation failed.',
        walletLoadFailed: true,
        recoverable: true,
        details: combinedOutput.slice(-1000),
      });
    });

    child.stdin.end(JSON.stringify(config));
  });
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

function normalizeTimestamp(value, fallback = null) {
  if (value == null || value === '') return fallback;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
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

function getWalletSwapReportPaths() {
  const walletsDir = path.join(api1State.DATA_DIR, 'wallets');
  const reportPaths = [];
  const walletNames = new Set(
    [
      api1State.currentWalletName,
      getCurrentWalletName(),
      api1State.storedTakerConfig?.walletName,
      api1State.DEFAULT_WALLET_NAME,
    ].filter(Boolean)
  );

  for (const walletName of walletNames) {
    reportPaths.push(path.join(walletsDir, `${walletName}_swap_report.json`));
  }

  if (fs.existsSync(walletsDir)) {
    for (const entry of fs.readdirSync(walletsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('_swap_report.json')) {
        reportPaths.push(path.join(walletsDir, entry.name));
      }
    }
  }

  return [...new Set(reportPaths)].filter((filePath) =>
    fs.existsSync(filePath)
  );
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSwapProtocol(value, fallbackIsTaproot = false) {
  switch (value) {
    case 'v2':
    case 'Taproot':
      return 'Taproot';
    case 'Unified':
      return 'Unified';
    case 'v1':
    case 'Legacy':
    case 'Legacy P2WSH':
      return 'Legacy';
    default:
      return fallbackIsTaproot ? 'Taproot' : 'Legacy';
  }
}

function inferTaprootFromReport(rawReport = {}) {
  const nestedReport = rawReport.report || rawReport;
  const rawProtocol = rawReport.protocol || nestedReport.protocol || null;
  const explicitIsTaproot =
    rawReport.isTaproot ?? nestedReport.isTaproot ?? null;

  if (explicitIsTaproot === true) return true;
  if (explicitIsTaproot === false) return false;

  const explicitProtocol = rawProtocol
    ? normalizeSwapProtocol(rawProtocol, false)
    : null;

  if (explicitProtocol === 'Taproot') return true;
  if (explicitProtocol === 'Legacy') return false;

  const protocolVersion =
    rawReport.protocolVersion ||
    rawReport.protocol_version ||
    nestedReport.protocolVersion ||
    nestedReport.protocol_version ||
    null;
  if (Number(protocolVersion) === 2) return true;
  if (Number(protocolVersion) === 1) return false;

  const outputSwapUtxos =
    rawReport.outputSwapUtxos ||
    rawReport.output_swap_utxos ||
    nestedReport.outputSwapUtxos ||
    nestedReport.output_swap_utxos ||
    [];

  return outputSwapUtxos.some((entry) => {
    const address = Array.isArray(entry) ? String(entry[1] || '') : '';
    return /^(bc1p|tb1p|bcrt1p)/i.test(address);
  });
}

function buildSwapReportRecord(filePath, rawReport, meta = {}) {
  const fileStats = fs.statSync(filePath);
  const baseFileName = path.basename(filePath, '.json');
  const fileName =
    meta.section != null && meta.index != null
      ? `${baseFileName}:${meta.section}:${meta.index}`
      : baseFileName;
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
  const normalizedFilePath = path.normalize(String(filePath || ''));
  const escapedSep = path.sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const walletAdjacentReportPattern = new RegExp(
    `${escapedSep}wallets${escapedSep}[^${escapedSep}]+_swap_report\\.json$`
  );
  const isWalletAdjacentReport =
    meta.source === 'wallet' ||
    walletAdjacentReportPattern.test(normalizedFilePath);
  const isCoreReport = !isWalletAdjacentReport;
  const rawStatus =
    rawReport.status ||
    rawReport.report?.status ||
    (isCoreReport ? 'Success' : null);
  const normalizedStatus =
    String(rawStatus || '').toLowerCase() === 'success'
      ? 'completed'
      : String(rawStatus || '').toLowerCase().startsWith('recovery')
        ? 'completed'
        : rawStatus;
  const rawCompletedAt =
    rawReport.completedAt ||
    rawReport.completed_at ||
    rawReport.endTimestamp ||
    rawReport.end_timestamp ||
    rawReport.report?.completedAt ||
    rawReport.report?.completed_at ||
    rawReport.report?.endTimestamp ||
    rawReport.report?.end_timestamp ||
    null;
  const completedAt = normalizeTimestamp(rawCompletedAt, fileStats.mtimeMs);
  const startedAt = normalizeTimestamp(
    rawReport.startedAt ||
      rawReport.started_at ||
      rawReport.startTimestamp ||
      rawReport.start_timestamp ||
      rawReport.report?.startedAt ||
      rawReport.report?.started_at ||
      rawReport.report?.startTimestamp ||
      rawReport.report?.start_timestamp,
    null
  );
  const isTaproot = inferTaprootFromReport(rawReport);
  const protocol = normalizeSwapProtocol(
    rawReport.protocol || nestedReport.protocol,
    isTaproot
  );
  const protocolVersion =
    rawReport.protocolVersion ||
    rawReport.protocol_version ||
    nestedReport.protocolVersion ||
    nestedReport.protocol_version ||
    (protocol === 'Taproot' ? 2 : 1);

  return {
    ...rawReport,
    report: nestedReport,
    swapId: normalizedSwapId,
    nativeSwapId,
    appSwapId,
    status: normalizedStatus,
    startedAt,
    completedAt,
    fileModifiedAt: fileStats.mtimeMs,
    filePath,
    fileName,
    isCoreReport,
    isWalletAdjacentReport,
    isUnifiedReport: false,
    reportSource: 'wallet',
    protocol,
    isTaproot,
    protocolVersion,
  };
}

function buildSwapReportRecords(filePath, rawReport, source) {
  if (Array.isArray(rawReport)) {
    return rawReport.map((entry, index) =>
      buildSwapReportRecord(filePath, entry, {
        source,
        section: 'items',
        index,
      })
    );
  }

  if (Array.isArray(rawReport?.taker)) {
    return rawReport.taker.map((entry, index) =>
      buildSwapReportRecord(filePath, entry, {
        source,
        section: 'taker',
        index,
      })
    );
  }

  return [buildSwapReportRecord(filePath, rawReport, { source })];
}

function readSwapReportRecords(filePath, source) {
  return buildSwapReportRecords(filePath, readJsonFile(filePath), source);
}

function getSwapStateHistoryMetadata() {
  const stateFile = path.join(api1State.DATA_DIR, 'swap_state.json');
  const metadataById = new Map();

  if (!fs.existsSync(stateFile)) return metadataById;

  try {
    const state = readJsonFile(stateFile);
    const history = Array.isArray(state.swap_history) ? state.swap_history : [];

    history.forEach((entry) => {
      const report = entry.report || {};
      const swapId =
        entry.id ||
        entry.swapId ||
        entry.swap_id ||
        report.swapId ||
        report.swap_id ||
        null;
      if (!swapId) return;

      const protocol = entry.protocol || report.protocol || null;
      const hasIsTaproot =
        typeof entry.isTaproot === 'boolean' ||
        typeof report.isTaproot === 'boolean';
      const isTaproot =
        typeof entry.isTaproot === 'boolean'
          ? entry.isTaproot
          : typeof report.isTaproot === 'boolean'
            ? report.isTaproot
            : null;
      const protocolVersion =
        entry.protocolVersion ||
        entry.protocol_version ||
        report.protocolVersion ||
        report.protocol_version ||
        null;

      if (protocol || hasIsTaproot || protocolVersion) {
        metadataById.set(String(swapId), {
          protocol,
          isTaproot,
          protocolVersion,
        });
      }
    });
  } catch (error) {
    console.error('Failed to read swap state protocol metadata:', error);
  }

  return metadataById;
}

function getSwapLogProtocolMetadata() {
  const logPath = path.join(api1State.DATA_DIR, 'debug.log');
  const metadataById = new Map();

  if (!fs.existsSync(logPath)) return metadataById;

  try {
    const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
    let pendingProtocol = null;

    lines.forEach((line) => {
      const prepareMatch = line.match(
        /Preparing coinswap:\s+amount=.*protocol=(Taproot|Legacy)/i
      );
      if (prepareMatch) {
        pendingProtocol = normalizeSwapProtocol(prepareMatch[1], false);
        return;
      }

      const idMatch = line.match(/Preparing coinswap with id:\s+([a-f0-9]+)/i);
      if (!idMatch || !pendingProtocol) return;

      metadataById.set(idMatch[1], {
        protocol: pendingProtocol,
        isTaproot: pendingProtocol === 'Taproot',
        protocolVersion: pendingProtocol === 'Taproot' ? 2 : 1,
      });
      pendingProtocol = null;
    });
  } catch (error) {
    console.error('Failed to read swap log protocol metadata:', error);
  }

  return metadataById;
}

function getPreferredSwapReports() {
  const records = [];
  const seen = new Set();

  const addRecord = (record) => {
    const key = record.nativeSwapId || record.swapId || record.fileName;
    if (seen.has(key)) return;
    seen.add(key);
    records.push(record);
  };

  for (const filePath of getWalletSwapReportPaths()) {
    try {
      readSwapReportRecords(filePath, 'wallet').forEach(addRecord);
    } catch (error) {
      console.error(`Failed to read wallet swap report ${filePath}:`, error);
    }
  }

  const localMetadata = getSwapStateHistoryMetadata();
  const logMetadata = getSwapLogProtocolMetadata();
  records.forEach((record) => {
    const metadata =
      localMetadata.get(String(record.swapId || '')) ||
      localMetadata.get(String(record.nativeSwapId || '')) ||
      localMetadata.get(String(record.appSwapId || '')) ||
      logMetadata.get(String(record.swapId || '')) ||
      logMetadata.get(String(record.nativeSwapId || '')) ||
      logMetadata.get(String(record.appSwapId || ''));
    if (!metadata) return;

    const fallbackIsTaproot =
      typeof metadata.isTaproot === 'boolean'
        ? metadata.isTaproot
        : record.isTaproot;
    const protocol = normalizeSwapProtocol(metadata.protocol, fallbackIsTaproot);

    record.protocol = protocol;
    record.isTaproot = protocol === 'Taproot';
    record.protocolVersion =
      metadata.protocolVersion || (protocol === 'Taproot' ? 2 : 1);
    record.report = {
      ...record.report,
      protocol,
      isTaproot: record.isTaproot,
      protocolVersion: record.protocolVersion,
    };
  });

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

  for (const record of getPreferredSwapReports()) {
    try {
      const report = record.report || record;
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
        reportPath: record.filePath,
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
    console.log('✅ coinswap-napi module loaded (wallet not initialized yet)');
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
      const finalPassword = requireWalletPassword(config.wallet?.password);

      // ✅ CHECK IF WE CAN REUSE EXISTING INSTANCE (simplified)
      const canReuse =
        api1State.takerInstance &&
        api1State.protocolVersion === protocol &&
        api1State.currentWalletName === walletName &&
        api1State.currentWalletPassword === finalPassword;

      console.log('🔍 Reuse check:', {
        hasInstance: !!api1State.takerInstance,
        protocolMatch: api1State.protocolVersion === protocol,
        walletMatch: api1State.currentWalletName === walletName,
        passwordMatch: api1State.currentWalletPassword === finalPassword,
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

      const protocolName = protocol === 'v2' ? 'Taproot (V2)' : 'P2WSH (V1)';
      console.log(`📦 Preparing ${protocolName} taker...`);

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

      const walletPreflight = preflightExistingWallet(
        walletPath,
        finalPassword
      );
      if (!walletPreflight.success) {
        console.warn('⚠️ Wallet preflight failed before native init:', {
          walletName,
          error: walletPreflight.error,
          details: walletPreflight.details,
        });
        return walletPreflight;
      }
      console.log('✅ Wallet password preflight passed');

      if (walletPreflight.exists) {
        const nativePreflight = await runNativeWalletPreflight({
          dataDir: api1State.DATA_DIR,
          walletName,
          rpcConfig,
          controlPort,
          torAuthPassword,
          zmqAddr,
          password: finalPassword,
        });

        if (!nativePreflight.success) {
          console.warn('⚠️ Native wallet preflight failed:', {
            walletName,
            error: nativePreflight.error,
            details: nativePreflight.details,
          });
          return nativePreflight;
        }
        console.log('✅ Native wallet preflight passed');
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
      console.log('🔧 Creating NEW native Taker instance...');
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

      const walletError = classifyWalletInitializationError(error);
      if (walletError) return walletError;

      return {
        success: false,
        error: error?.message || String(error || 'Initialization failed'),
      };
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
   * Trigger an offerbook sync via the napi async method.
   *
   * `syncOfferbookAndWaitAsync()` runs the blocking sync on libuv's worker pool
   * and returns a Promise — the JS event loop is never blocked, and other
   * Taker calls (getBalance, listUnspent, etc.) proceed in parallel because
   * the napi binding uses a clone-able OfferSyncClient instead of locking the
   * inner Taker Mutex.
   *
   * Returns { success, syncId } immediately. Caller polls getSyncStatus(syncId).
   */
  function startSyncWorker(source = 'manual') {
    if (!api1State.takerInstance) {
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

    api1State.takerInstance
      .syncOfferbookAndWaitAsync()
      .then(() => {
        console.log(`✅ [${syncId}] Offerbook sync completed`);
        finish('completed');
      })
      .catch((err) => {
        console.error(`❌ [${syncId}] Offerbook sync failed:`, err.message);
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
  ipcMain.handle('taker:getNextAddress', async (_event, requestedAddressType) => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      const normalizedType = String(requestedAddressType || '').toUpperCase();
      const hasRequestedType =
        normalizedType === 'P2TR' ||
        normalizedType === 'TAPROOT' ||
        normalizedType === 'P2WPKH' ||
        normalizedType === 'SEGWIT';
      const protocol = api1State.protocolVersion || 'v1';
      const requestedType =
        normalizedType === 'P2TR' || normalizedType === 'TAPROOT'
          ? 'P2TR'
          : normalizedType === 'P2WPKH' || normalizedType === 'SEGWIT'
            ? 'P2WPKH'
            : protocol === 'v2'
              ? 'P2TR'
              : 'P2WPKH';
      const initialAddressType = hasRequestedType
        ? normalizedType === 'P2TR' || normalizedType === 'TAPROOT'
          ? 1
          : 0
        : protocol === 'v2'
          ? 1
          : 0; // 1 = Taproot (P2TR), 0 = P2WPKH

      const detectGeneratedAddressType = (value) => {
        const addressString = String(value?.address || value || '');
        if (
          addressString.startsWith('bc1p') ||
          addressString.startsWith('tb1p') ||
          addressString.startsWith('bcrt1p')
        ) {
          return 'P2TR';
        }
        return 'P2WPKH';
      };

      console.log(`📍 Generating ${requestedType} address...`);

      let nativeAddressType = initialAddressType;
      let address = api1State.takerInstance.getNextExternalAddress(nativeAddressType);
      let actualType = detectGeneratedAddressType(address);

      if (hasRequestedType && actualType !== requestedType) {
        const alternateAddressType = nativeAddressType === 1 ? 0 : 1;
        console.warn(
          `Requested ${requestedType}, but native type ${nativeAddressType} returned ${actualType}. Retrying with ${alternateAddressType}.`
        );
        nativeAddressType = alternateAddressType;
        address = api1State.takerInstance.getNextExternalAddress(nativeAddressType);
        actualType = detectGeneratedAddressType(address);
      }

      api1State.takerInstance.syncAndSave();

      return {
        success: true,
        address: address.address || address,
        addressType: actualType,
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
      const historicalSwapOutputs = getHistoricalSwapOutputMap();

      const transformedUtxos = rawUtxos.map(([utxoEntry, spendInfo]) => {
        const historicalSwapAmount = historicalSwapOutputs.get(
          utxoEntry.address
        );
        const isHistoricalSwapOutput =
          historicalSwapAmount !== undefined &&
          historicalSwapAmount === toNumber(utxoEntry.amount?.sats, 0);
        const spendType = isHistoricalSwapOutput
          ? 'SwapCoin'
          : spendInfo.spendType;

        return {
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
            spendType,
            originalSpendType: spendInfo.spendType,
            swapOrigin: isHistoricalSwapOutput ? 'historical-report' : null,
            path: spendInfo.path,
            multisigRedeemscript: spendInfo.multisigRedeemscript,
            inputValue: spendInfo.inputValue,
            index: spendInfo.index,
          },
        };
      });

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

        console.log(`📤 Sending ${amount} 丰 to ${address}...`);

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

  ipcMain.handle('taker:getRecoveryStatus', async () => {
    try {
      const trackerPath = path.join(api1State.DATA_DIR, 'swap_tracker.cbor');
      const trackerData = parseSwapTracker(trackerPath);
      if (trackerData) {
        const logPath = path.join(api1State.DATA_DIR, 'debug.log');
        trackerData.pending = enrichRecoveryFromLog(trackerData.pending, logPath);
        trackerData.totalPendingAmount = trackerData.pending.reduce((s, p) => s + (p.amount || 0), 0);
        return { success: true, recovery: trackerData };
      }

      // Fall back to log parsing if tracker is unavailable
      const logPath = path.join(api1State.DATA_DIR, 'debug.log');
      if (!fs.existsSync(logPath)) {
        return {
          success: true,
          recovery: {
            source: 'debug-log',
            currentHeight: null,
            pendingCount: 0,
            pending: [],
            totalPendingAmount: 0,
            recoveredCount: 0,
            recoveryTxids: [],
            lastRecoveryStartedAt: null,
          },
        };
      }

      const logTail = readFileTail(logPath, 2 * 1024 * 1024);
      return {
        success: true,
        recovery: parseRecoveryStatusFromLog(logTail),
      };
    } catch (error) {
      console.error('❌ Failed to get recovery status:', error);
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

        const finalPassword = requireWalletPassword(password);

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
          finalPassword
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

  /**
   * Poll a single maker on demand. Uses the napi async variant which routes
   * through the cloned `OfferSyncClient` (no inner Mutex hold), so concurrent
   * Taker calls remain unblocked. Returns the maker's final state.
   */
  ipcMain.handle('taker:pollMaker', async (_event, address) => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }
      if (!address || typeof address !== 'string') {
        return { success: false, error: 'Address is required (string)' };
      }
      console.log(`🎯 [pollMaker] ${address}`);
      const candidate = await api1State.takerInstance.pollMakerAsync(address);

      // Normalize NAPI candidate into the same format getOffers returns so the
      // renderer can merge it into the in-memory makers array without a disk read.
      // pollMakerAsync uses OfferSyncClient directly and never writes offerbook.json,
      // so re-reading the file would return stale data.
      const candidateAddress = candidate.address?.address || address;
      const stateType = candidate.state?.stateType || 'Good';

      let normalizedOffer = null;
      if (candidate.offer) {
        const fid = candidate.offer.fidelity || {};
        const bond = fid.bond || {};
        const rawOutpoint = bond.outpoint;
        const outpointStr =
          rawOutpoint && typeof rawOutpoint === 'object'
            ? `${rawOutpoint.txid}:${rawOutpoint.vout}`
            : rawOutpoint || '';

        normalizedOffer = {
          baseFee: candidate.offer.baseFee,
          amountRelativeFeePct: candidate.offer.amountRelativeFeePct,
          timeRelativeFeePct: candidate.offer.timeRelativeFeePct,
          requiredConfirms: candidate.offer.requiredConfirms,
          minimumLocktime: candidate.offer.minimumLocktime,
          maxSize: candidate.offer.maxSize,
          minSize: candidate.offer.minSize,
          fidelity: {
            bond: {
              outpoint: outpointStr,
              amount: bond.amount || 0,
              lock_time: bond.lockTime || 0,
              is_spent: bond.isSpent || false,
            },
          },
        };
      }

      return {
        success: true,
        maker: {
          address: candidateAddress,
          protocol: candidate.protocol?.protocolType || null,
          offer: normalizedOffer,
          stateType,
        },
      };
    } catch (error) {
      console.error('❌ pollMaker failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Remove a maker from the offerbook by address. Persists to disk.
   * Returns { success, removed } where `removed` is true if the entry existed.
   */
  ipcMain.handle('taker:removeMaker', async (_event, address) => {
    try {
      if (!api1State.takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }
      if (!address || typeof address !== 'string') {
        return { success: false, error: 'Address is required (string)' };
      }
      console.log(`🗑️ [removeMaker] ${address}`);
      const removed = api1State.takerInstance.removeMaker(address);
      return { success: true, removed };
    } catch (error) {
      console.error('❌ removeMaker failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Return live per-maker progress from swap_tracker.cbor for animation driving.
  // Only reads from disk — no NAPI call — so it is always safe to call during a swap.
  ipcMain.handle('taker:getSwapProgress', async (_event, nativeSwapId) => {
    try {
      if (!nativeSwapId) return { success: false, error: 'No swap ID provided' };
      const swap = getSwapFromTracker(nativeSwapId);
      if (!swap) return { success: true, swap: null };
      return {
        success: true,
        swap: {
          phase: swap.phase || null,
          failedAtPhase: swap.failed_at_phase || null,
          failureReason: formatFailureReason(swap.failure_reason),
          makers: (swap.makers || []).map((m) => ({
            address: typeof m.address === 'string' ? m.address : null,
            ...buildMakerProgress(m),
          })),
          outgoingContractTxids: swap.outgoing_contract_txids || [],
          incomingContractTxids: swap.incoming_contract_txids || [],
        },
      };
    } catch (err) {
      console.error('⚠️ getSwapProgress error:', err.message);
      return { success: false, error: err.message };
    }
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
    async (event, { amount, makerCount, outpoints, password, selectedMakerAddresses, protocol: requestedProtocol }) => {
      try {
        if (!api1State.takerInstance) {
          return { success: false, error: 'Taker not initialized' };
        }
        const offerbookPath = path.join(api1State.DATA_DIR, 'offerbook.json');

        if (!amount || amount <= 0) {
          return { success: false, error: 'Invalid amount' };
        }

        if (
          selectedMakerAddresses != null &&
          (!Array.isArray(selectedMakerAddresses) ||
            selectedMakerAddresses.some((a) => typeof a !== 'string' || !a.trim()))
        ) {
          return { success: false, error: 'Invalid selectedMakerAddresses: must be an array of non-empty strings' };
        }

        const protocol =
          requestedProtocol === 'v1' ||
          requestedProtocol === 'v2' ||
          requestedProtocol === 'Legacy' ||
          requestedProtocol === 'Taproot'
            ? requestedProtocol === 'Legacy'
              ? 'v1'
              : requestedProtocol === 'Taproot'
                ? 'v2'
                : requestedProtocol
            : 'v2';
        const protocolName = protocol === 'v2' ? 'Taproot' : 'P2WSH';
        const swapId = `swap_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log(
          `🚀 [${swapId}] Starting ${protocolName} coinswap: ${amount} 丰, ${makerCount} makers`
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
                const goodMakersCount = countUsableCompatibleMakers(makers, protocol);

                if (goodMakersCount >= makerCount) {
                  console.log(
                    `✅ Offerbook ready with ${goodMakersCount} ${protocolName} makers`
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
            const goodMakersCount = countUsableCompatibleMakers(makers, protocol);

            if (goodMakersCount < makerCount) {
              console.error(
                `❌ Not enough ${protocolName} makers available: ${goodMakersCount}/${makerCount}`
              );
              return {
                success: false,
                error: `Not enough ${protocolName} makers available. Found ${goodMakersCount}, need ${makerCount}. Please sync market data first.`,
              };
            }

            console.log(
              `✅ Ready to start ${protocolName} swap with ${goodMakersCount} makers`
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
          password: requireWalletPassword(
            password || api1State.storedTakerConfig?.password
          ),
          protocol,
          appSwapId: swapId,
        });

        const worker = new Worker(path.join(__dirname, 'coinswap-worker.js'), {
          workerData: { amount, makerCount, outpoints, selectedMakerAddresses, config },
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
            const normalizedProtocol = normalizeSwapProtocol(
              msg.protocol || existingSwap.protocol || protocol,
              existingSwap.isTaproot || protocol === 'v2'
            );
            api1State.activeSwaps.set(swapId, {
              ...existingSwap,
              status: msg.status || existingSwap.status,
              nativeSwapId: msg.nativeSwapId || existingSwap.nativeSwapId,
              protocol: normalizedProtocol,
              isTaproot: normalizedProtocol === 'Taproot',
              protocolVersion: normalizedProtocol === 'Taproot' ? 2 : 1,
            });
          } else if (msg.type === 'complete') {
            const existingSwap = api1State.activeSwaps.get(swapId);
            const normalizedProtocol = normalizeSwapProtocol(
              msg.protocol || msg.report?.protocol || existingSwap?.protocol || protocol,
              existingSwap?.isTaproot || protocol === 'v2'
            );
            const swapData = {
              ...existingSwap,
              status: 'completed',
              report: msg.report,
              protocol: normalizedProtocol,
              isTaproot: normalizedProtocol === 'Taproot',
              protocolVersion: normalizedProtocol === 'Taproot' ? 2 : 1,
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

      const trackerSwapId = report.nativeSwapId || report.swapId;
      const trackerEntry = trackerSwapId ? getSwapFromTracker(trackerSwapId) : null;
      let trackerInfo = null;

      if (trackerEntry) {
        trackerInfo = {
          failedAtPhase: trackerEntry.failed_at_phase || null,
          failureReasonFormatted: formatFailureReason(
            typeof trackerEntry.failure_reason === 'string' ? trackerEntry.failure_reason : null
          ),
          recoveryPhase: trackerEntry.recovery?.phase || null,
          makerProgress: Array.isArray(trackerEntry.makers)
            ? trackerEntry.makers.map((m) => ({
                address: m.address,
                ...buildMakerProgress(m),
              }))
            : null,
        };
      }

      return { success: true, report, trackerInfo };
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

function registerAppHandlers() {
  ipcMain.handle('app:getVersionInfo', async () => {
    try {
      const appVersion = app.getVersion();
      let binaryVersion = 'unknown';
      try {
        const napiPkgPath = require.resolve('coinswap-napi/package.json');
        const napiPkg = JSON.parse(fs.readFileSync(napiPkgPath, 'utf8'));
        binaryVersion = napiPkg.version || 'unknown';
      } catch (_) {}
      return { success: true, appVersion, binaryVersion };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

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
  registerAppHandlers();

  console.log('✅ API v1 handlers registered');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  registerAPI1,
  api1State,
};
