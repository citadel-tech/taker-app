const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');

console.log('MAIN.JS __dirname:', __dirname);
console.log('PRELOAD PATH:', path.join(__dirname, 'preload.js'));
console.log(
  'Does preload exist?',
  require('fs').existsSync(path.join(__dirname, 'preload.js'))
);

// Add hot reload in development
try {
  require('electron-reloader')(module, {
    watchRenderer: true,
  });
} catch (_) {}

// Native module and taker instance
let coinswapNapi = null;
let takerInstance = null;
let storedTakerConfig = null;
const activeSwaps = new Map();
const activeSyncs = new Map();

/**
 * Initialize the native coinswap module
 */
async function initNAPI() {
  try {
    coinswapNapi = require('coinswap-napi');
    console.log('✅ coinswap-napi loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load coinswap-napi:', error);
    return false;
  }
}

/**
 * Create the main application window
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false, // ❌ DISABLED - security
      contextIsolation: true, // ✅ ENABLED - security
      enableRemoteModule: false, // ❌ DISABLED - deprecated
      preload: path.join(__dirname, 'preload.js'), // ✅ Use IPC bridge
    },
    icon: path.join(__dirname, 'assets/icon.png'),
  });

  // Log any errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  const htmlPath = path.join(__dirname, 'src', 'index.html');
  console.log('Loading file from:', htmlPath);

  win.loadFile(htmlPath);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

/**
 * IPC Handlers for Taker operations
 */

// Initialize taker - SIMPLIFIED
ipcMain.handle('taker:initialize', async (event, config) => {
  try {
    if (!coinswapNapi) {
      await initNAPI();
      if (!coinswapNapi) {
        return { success: false, error: 'Failed to load coinswap-napi' };
      }
    }

    const rpcConfig = {
      url: `${config.rpc?.host || '127.0.0.1'}:${config.rpc?.port || 38332}`,
      username: config.rpc?.username || 'user',
      password: config.rpc?.password || 'password',
      walletName: 'taker-wallet',
    };

    const dataDir = `${process.env.HOME}/.coinswap/taker`;
    const zmqAddr = config.zmq?.address || 'tcp://127.0.0.1:29332';

    console.log('🔧 Initializing Taker with config:', {
      dataDir,
      rpcConfig,
      zmqAddr,
    });

    // Setup logging
    try {
      if (coinswapNapi.Taker.setupLogging) {
        coinswapNapi.Taker.setupLogging(dataDir);
      } else if (coinswapNapi.setupLogging) {
        coinswapNapi.setupLogging(dataDir);
      }
    } catch (logError) {
      console.warn('⚠️ Could not setup logging:', logError.message);
    }

    const walletPassword = config.wallet?.password || '';
    console.log(
      '🔐 Creating Taker with password:',
      walletPassword ? 'YES' : 'NO'
    );

    takerInstance = new coinswapNapi.Taker(
      dataDir,
      'taker-wallet',
      rpcConfig,
      9053,
      undefined,
      zmqAddr,
      walletPassword
    );

    storedTakerConfig = { dataDir, rpcConfig, zmqAddr };

    console.log('✅ Taker initialized');
    return { success: true, message: 'Taker initialized and ready' };
  } catch (error) {
    console.error('❌ Initialization failed:', error);

    // Check if wrong password
    if (
      error.message.includes('decrypting wallet') ||
      error.message.includes('wrong passphrase')
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

// Get balance
ipcMain.handle('taker:getBalance', async () => {
  try {
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    takerInstance.syncAndSave();
    const balance = takerInstance.getBalances();

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

// Get next address
ipcMain.handle('taker:getNextAddress', async () => {
  try {
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    const address = takerInstance.getNextExternalAddress();
    takerInstance.syncAndSave();

    return {
      success: true,
      address: address.address || address,
    };
  } catch (error) {
    console.error('❌ Failed to generate address:', error);
    return { success: false, error: error.message };
  }
});

// Sync wallet
ipcMain.handle('taker:sync', async () => {
  try {
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    console.log('🔄 Syncing wallet...');
    takerInstance.syncAndSave();
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
      if (!takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      console.log(`📊 Getting ${count} transactions (skip ${skip})...`);
      const transactions = takerInstance.getTransactions(
        parseInt(count),
        parseInt(skip)
      );

      console.log('✅ Transactions retrieved:', transactions?.length || 0);
      return { success: true, transactions: transactions || [] };
    } catch (error) {
      console.log(`⚠️ Transaction retrieval failed: ${error.message}`);
      return {
        success: true,
        transactions: [],
        message: 'Transaction history unavailable',
      };
    }
  }
);

// Get UTXOs
ipcMain.handle('taker:getUtxos', async () => {
  try {
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    console.log('📊 Getting UTXOs...');
    const rawUtxos = takerInstance.listAllUtxoSpendInfo();

    console.log('✅ UTXOs retrieved:', rawUtxos?.length || 0);

    const transformedUtxos = rawUtxos.map(([utxoEntry, spendInfo]) => ({
      utxo: {
        txid: utxoEntry.txid.hex,
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
    console.log(`⚠️ UTXO retrieval failed: ${error.message}`);
    return { success: true, utxos: [], message: 'UTXO list unavailable' };
  }
});

// Send to address
ipcMain.handle(
  'taker:sendToAddress',
  async (event, { address, amount, feeRate, manuallySelectedOutpoints }) => {
    try {
      if (!takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      if (!address || !amount || amount <= 0) {
        return { success: false, error: 'Invalid address or amount' };
      }

      console.log(`📤 Sending ${amount} sats to ${address}...`);
      console.log(`   Fee rate: ${feeRate || 'default'}`);
      console.log(
        `   Manual UTXOs: ${manuallySelectedOutpoints ? manuallySelectedOutpoints.length : 'none'}`
      );

      // Call with all 4 parameters (fee_rate and manually_selected_outpoints can be null/undefined)
      const txidObj = takerInstance.sendToAddress(
        address,
        amount,
        feeRate || null, // Pass null if not provided
        manuallySelectedOutpoints || null // Pass null if not provided
      );

      takerInstance.syncAndSave();

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
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    console.log('🔄 Recovering from failed swap...');
    takerInstance.recoverFromSwap();
    console.log('✅ Recovery completed');
    return { success: true, message: 'Recovery completed' };
  } catch (error) {
    console.error('❌ Recovery failed:', error);
    return { success: false, error: error.message };
  }
});

// Add after taker:recover handler (around line ~290):
ipcMain.handle('taker:backup', async (event, { destinationPath, password }) => {
  try {
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    console.log(`💾 Backing up wallet to: ${destinationPath}`);

    takerInstance.backup(destinationPath, password || undefined);

    console.log('✅ Backup completed');
    return { success: true, message: 'Backup completed successfully' };
  } catch (error) {
    console.error('❌ Backup failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('dialog:openFile', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      defaultPath:
        options?.defaultPath || `${process.env.HOME}/.coinswap/taker/wallets`,
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

// File picker for saving files
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

// Add after taker:backup handler:
ipcMain.handle('taker:restore', async (event, { backupFilePath, password }) => {
  try {
    if (!coinswapNapi) {
      await initNAPI();
      if (!coinswapNapi) {
        return { success: false, error: 'Failed to load coinswap-napi' };
      }
    }

    console.log(`♻️ Restoring wallet from: ${backupFilePath}`);

    const dataDir = `${process.env.HOME}/.coinswap/taker`;
    const rpcConfig = {
      url: '127.0.0.1:18443', // Will be updated from config later
      username: 'user',
      password: 'password',
      walletName: 'taker-wallet',
    };

    // Call static restore method
    coinswapNapi.Taker.restoreWalletGuiApp(
      dataDir,
      'taker-wallet',
      rpcConfig,
      backupFilePath,
      password || ''
    );

    console.log('✅ Wallet restored successfully');
    return {
      success: true,
      message: 'Wallet restored - please initialize taker now',
    };
  } catch (error) {
    console.error('❌ Restore failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('taker:isWalletEncrypted', async (event, walletPath) => {
  try {
    // If no path provided, use default
    if (!walletPath) {
      const dataDir = `${process.env.HOME}/.coinswap/taker`;
      walletPath = path.join(dataDir, 'wallets', 'taker-wallet');
    }

    const isEncrypted = coinswapNapi.Taker.isWalletEncrypted(walletPath);
    console.log(
      `🔐 Wallet encryption check: ${walletPath} -> ${isEncrypted ? 'ENCRYPTED' : 'NOT ENCRYPTED'}`
    );
    return isEncrypted;
  } catch (error) {
    console.error('Failed to check wallet encryption:', error);
    return false;
  }
});

// Sync offerbook (using worker thread to avoid blocking)
ipcMain.handle('taker:syncOfferbook', async () => {
  try {
    if (!takerInstance || !storedTakerConfig) {
      return { success: false, error: 'Taker not initialized' };
    }

    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`🔄 [${syncId}] Starting offerbook sync in worker...`);
    console.log('Using config:', storedTakerConfig);

    const worker = new Worker(path.join(__dirname, 'offerbook-worker.js'), {
      workerData: { config: storedTakerConfig },
    });

    activeSyncs.set(syncId, {
      status: 'starting',
      startedAt: Date.now(),
    });

    worker.on('message', (msg) => {
      console.log(`📨 [${syncId}] Worker:`, msg.type);
      if (msg.type === 'status') {
        activeSyncs.set(syncId, {
          ...activeSyncs.get(syncId),
          status: msg.status,
        });
      } else if (msg.type === 'complete') {
        activeSyncs.set(syncId, {
          ...activeSyncs.get(syncId),
          status: 'completed',
          message: msg.message,
          completedAt: Date.now(),
        });
      } else if (msg.type === 'error') {
        activeSyncs.set(syncId, {
          ...activeSyncs.get(syncId),
          status: 'failed',
          error: msg.error,
          failedAt: Date.now(),
        });
      }
    });

    worker.on('error', (err) => {
      console.error(`❌ [${syncId}] Worker error:`, err);
      activeSyncs.set(syncId, {
        ...activeSyncs.get(syncId),
        status: 'failed',
        error: err.message,
      });
    });

    return { success: true, syncId };
  } catch (error) {
    console.error('❌ Sync offerbook failed:', error);
    return { success: false, error: error.message };
  }
});

// Get sync status
ipcMain.handle('taker:getSyncStatus', async (event, syncId) => {
  const sync = activeSyncs.get(syncId);

  if (!sync) {
    return { success: false, error: 'Sync not found' };
  }

  return { success: true, sync };
});

// Get offers (ONLY returns cached data - use syncOfferbook to update)
ipcMain.handle('taker:getOffers', async () => {
  try {
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    console.log('📊 Reading cached offerbook...');
    const offerbookPath = path.join(
      process.env.HOME,
      '.coinswap/taker/offerbook.json'
    );

    try {
      if (fs.existsSync(offerbookPath)) {
        const offerbookData = fs.readFileSync(offerbookPath, 'utf8');
        const offerbook = JSON.parse(offerbookData);

        if (offerbook.all_makers) {
          // Create a Set of bad maker addresses for fast lookup
          const badMakerAddresses = new Set(
            (offerbook.bad_makers || []).map(
              (maker) => `${maker.address.onion_addr}:${maker.address.port}`
            )
          );

          // Filter out bad makers from all_makers
          const goodMakers = offerbook.all_makers.filter((maker) => {
            const makerAddr = `${maker.address.onion_addr}:${maker.address.port}`;
            return !badMakerAddresses.has(makerAddr);
          });

          console.log('✅ Loaded cached offerbook:', {
            allMakers: offerbook.all_makers.length,
            badMakers: offerbook.bad_makers?.length || 0,
            goodMakers: goodMakers.length,
          });

          // Transform to expected format
          const transformedOfferbook = {
            goodMakers: goodMakers.map((maker) => ({
              address: maker.address,
              offer: {
                baseFee: maker.offer.base_fee,
                amountRelativeFeePct: maker.offer.amount_relative_fee_pct,
                timeRelativeFeePct: maker.offer.time_relative_fee_pct,
                requiredConfirms: maker.offer.required_confirms,
                minimumLocktime: maker.offer.minimum_locktime,
                maxSize: maker.offer.max_size,
                minSize: maker.offer.min_size,
                tweakablePoint: maker.offer.tweakable_point,
                fidelity: maker.offer.fidelity,
              },
            })),
            allMakers: offerbook.all_makers.map((maker) => ({
              address: maker.address,
              offer: {
                baseFee: maker.offer.base_fee,
                amountRelativeFeePct: maker.offer.amount_relative_fee_pct,
                timeRelativeFeePct: maker.offer.time_relative_fee_pct,
                requiredConfirms: maker.offer.required_confirms,
                minimumLocktime: maker.offer.minimum_locktime,
                maxSize: maker.offer.max_size,
                minSize: maker.offer.min_size,
                tweakablePoint: maker.offer.tweakable_point,
                fidelity: maker.offer.fidelity,
              },
            })),
          };

          return {
            success: true,
            offerbook: transformedOfferbook,
            cached: true,
          };
        }
      }
    } catch (fileError) {
      console.log('⚠️ Could not read cached offerbook:', fileError.message);
    }

    return {
      success: true,
      offerbook: { goodMakers: [], allMakers: [] },
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
    if (!takerInstance) {
      return { success: false, error: 'Taker not initialized' };
    }

    console.log('📋 Fetching good makers...');
    const goodMakers = takerInstance.getAllGoodMakers();
    console.log('✅ Good makers fetched:', goodMakers.length);
    return { success: true, makers: goodMakers };
  } catch (error) {
    console.error('❌ Fetch good makers failed:', error);
    return { success: false, error: error.message };
  }
});

/**
 * IPC Handlers for Coinswap operations (using worker threads)
 */

// Start coinswap
ipcMain.handle(
  'coinswap:start',
  async (event, { amount, makerCount, outpoints, password }) => {
    try {
      if (!takerInstance) {
        return { success: false, error: 'Taker not initialized' };
      }

      if (!amount || amount <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      const swapId = `swap_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(
        `🚀 [${swapId}] Starting coinswap in worker: ${amount} sats, ${makerCount} makers`
      );

      // Get config for worker
      const config = {
        dataDir: `${process.env.HOME}/.coinswap/taker`,
        rpcConfig: {
          url: '127.0.0.1:18443',
          username: 'user',
          password: 'password',
          walletName: 'taker-wallet',
        },
        zmqAddr: 'tcp://127.0.0.1:29332',
        password: password || '',
      };

      const worker = new Worker(path.join(__dirname, 'coinswap-worker.js'), {
        workerData: { amount, makerCount, outpoints, config },
      });

      activeSwaps.set(swapId, {
        status: 'starting',
        amount,
        makerCount,
        startedAt: Date.now(),
      });

      worker.on('message', (msg) => {
        console.log(`📨 [${swapId}] Worker:`, msg.type);
        if (msg.type === 'status') {
          activeSwaps.set(swapId, {
            ...activeSwaps.get(swapId),
            status: msg.status,
          });
        } else if (msg.type === 'complete') {
          activeSwaps.set(swapId, {
            ...activeSwaps.get(swapId),
            status: 'completed',
            report: msg.report,
            completedAt: Date.now(),
          });
        } else if (msg.type === 'error') {
          activeSwaps.set(swapId, {
            ...activeSwaps.get(swapId),
            status: 'failed',
            error: msg.error,
            failedAt: Date.now(),
          });
        }
      });

      worker.on('error', (err) => {
        console.error(`❌ [${swapId}] Worker error:`, err);
        activeSwaps.set(swapId, {
          ...activeSwaps.get(swapId),
          status: 'failed',
          error: err.message,
        });
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
  const swap = activeSwaps.get(swapId);

  if (!swap) {
    return { success: false, error: 'Swap not found' };
  }

  return { success: true, swap };
});

/**
 * IPC Handlers for Logs
 */

// Get logs
ipcMain.handle('logs:get', async (event, lines = 100) => {
  const logPath = path.join(process.env.HOME, '.coinswap/taker/debug.log');

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

/**
 * App lifecycle
 */

app.whenReady().then(async () => {
  console.log('🚀 Electron app starting...');
  await initNAPI();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

console.log('🚀 Modern IPC-enabled Electron app starting...');
