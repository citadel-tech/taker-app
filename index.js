const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');

// Add hot reload in development
try {
    require('electron-reloader')(module, {
        watchRenderer: true
    });
} catch (_) { }

// Native module and taker instance
let coinswapNapi = null;
let takerInstance = null;
let storedTakerConfig = null; // Store config for workers
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
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Log any errors
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    const htmlPath = path.join(__dirname, 'src', 'index.html');
    console.log('Loading file from:', htmlPath);

    win.loadFile(htmlPath);
}

/**
 * IPC Handlers for Taker operations
 */

// Initialize taker
ipcMain.handle('taker:initialize', async (event, config) => {
    try {
        if (!coinswapNapi) {
            await initNAPI();
            if (!coinswapNapi) {
                return { success: false, error: 'Failed to load coinswap-napi' };
            }
        }

        const rpcConfig = {
            url: `${config.rpc?.host || "127.0.0.1"}:${config.rpc?.port || 38332}`,
            username: config.rpc?.username || "user",
            password: config.rpc?.password || "password",
            walletName: "taker-wallet"
        };

        const dataDir = `${process.env.HOME}/.coinswap/taker`;
        const zmqAddr = config.zmq?.address || "tcp://127.0.0.1:28332";

        console.log('🔧 Initializing Taker with config:', { dataDir, rpcConfig, zmqAddr });

        // Setup logging if available
        try {
            if (coinswapNapi.Taker.setupLogging) {
                coinswapNapi.Taker.setupLogging(dataDir);
                console.log('✅ Logging configured');
            } else if (coinswapNapi.setupLogging) {
                coinswapNapi.setupLogging(dataDir);
                console.log('✅ Logging configured');
            }
        } catch (logError) {
            console.warn('⚠️ Could not setup logging:', logError.message);
        }

        takerInstance = new coinswapNapi.Taker(
            dataDir,
            "taker-wallet",
            rpcConfig,
            9051,  // Tor control port
            undefined,  // tor_auth_password (CookieAuthentication is 0)
            zmqAddr
        );

        // Store config for worker threads
        storedTakerConfig = {
            dataDir,
            rpcConfig,
            zmqAddr
        };

        console.log('✅ Taker initialized');
        return { success: true, message: "Taker initialized and ready" };

    } catch (error) {
        console.error('❌ Initialization failed:', error);
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
                fidelity: balance.fidelity
            }
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
            address: address.address || address
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
            workerData: { config: storedTakerConfig }
        });

        activeSyncs.set(syncId, {
            status: 'starting',
            startedAt: Date.now()
        });

        worker.on('message', (msg) => {
            console.log(`📨 [${syncId}] Worker:`, msg.type);
            if (msg.type === 'status') {
                activeSyncs.set(syncId, { ...activeSyncs.get(syncId), status: msg.status });
            } else if (msg.type === 'complete') {
                activeSyncs.set(syncId, {
                    ...activeSyncs.get(syncId),
                    status: 'completed',
                    message: msg.message,
                    completedAt: Date.now()
                });
            } else if (msg.type === 'error') {
                activeSyncs.set(syncId, {
                    ...activeSyncs.get(syncId),
                    status: 'failed',
                    error: msg.error,
                    failedAt: Date.now()
                });
            }
        });

        worker.on('error', (err) => {
            console.error(`❌ [${syncId}] Worker error:`, err);
            activeSyncs.set(syncId, { ...activeSyncs.get(syncId), status: 'failed', error: err.message });
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

        // Only read from cached offerbook file - never fetch live (that's blocking!)
        const offerbookPath = path.join(process.env.HOME, '.coinswap/taker/offerbook.json');

        try {
            if (fs.existsSync(offerbookPath)) {
                const offerbookData = fs.readFileSync(offerbookPath, 'utf8');
                const offerbook = JSON.parse(offerbookData);

                if (offerbook.all_makers) {
                    console.log('✅ Loaded cached offerbook:', {
                        allMakers: offerbook.all_makers.length,
                        badMakers: offerbook.bad_makers?.length || 0
                    });

                    // Transform to expected format
                    const transformedOfferbook = {
                        goodMakers: (offerbook.all_makers || []).map(maker => ({
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
                                fidelity: maker.offer.fidelity
                            }
                        })),
                        allMakers: (offerbook.all_makers || []).map(maker => ({
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
                                fidelity: maker.offer.fidelity
                            }
                        }))
                    };

                    return {
                        success: true,
                        offerbook: transformedOfferbook,
                        cached: true
                    };
                }
            }
        } catch (fileError) {
            console.log('⚠️ Could not read cached offerbook:', fileError.message);
        }

        // Return empty offerbook if no cache exists
        console.log('⚠️ No cached offerbook found - use syncOfferbook to fetch');
        return {
            success: true,
            offerbook: {
                goodMakers: [],
                allMakers: []
            },
            cached: false,
            message: 'No cached data - click sync to fetch offers'
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

// Get transactions
ipcMain.handle('taker:getTransactions', async (event, { count = 10, skip = 0 }) => {
    try {
        if (!takerInstance) {
            return { success: false, error: 'Taker not initialized' };
        }

        console.log(`📊 Getting ${count} transactions (skip ${skip})...`);
        const transactions = takerInstance.getTransactions(parseInt(count), parseInt(skip));

        console.log('✅ Transactions retrieved:', transactions?.length || 0);
        return { success: true, transactions: transactions || [] };

    } catch (error) {
        console.log(`⚠️ Transaction retrieval failed: ${error.message}`);
        return { success: true, transactions: [], message: 'Transaction history unavailable' };
    }
});

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
                safe: utxoEntry.safe
            },
            spendInfo: {
                spendType: spendInfo.spendType,
                path: spendInfo.path,
                multisigRedeemscript: spendInfo.multisigRedeemscript,
                inputValue: spendInfo.inputValue,
                index: spendInfo.index
            }
        }));

        return { success: true, utxos: transformedUtxos || [] };

    } catch (error) {
        console.log(`⚠️ UTXO retrieval failed: ${error.message}`);
        return { success: true, utxos: [], message: 'UTXO list unavailable' };
    }
});

// Send to address
ipcMain.handle('taker:sendToAddress', async (event, { address, amount }) => {
    try {
        if (!takerInstance) {
            return { success: false, error: 'Taker not initialized' };
        }

        if (!address || !amount || amount <= 0) {
            return { success: false, error: 'Invalid address or amount' };
        }

        console.log(`📤 Sending ${amount} sats to ${address}...`);

        const txidObj = takerInstance.sendToAddress(address, amount);
        takerInstance.syncAndSave();

        const txid = txidObj.hex || txidObj;
        console.log(`✅ Transaction sent: ${txid}`);
        return { success: true, txid };

    } catch (error) {
        console.error('❌ Send failed:', error);
        return { success: false, error: error.message };
    }
});

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

/**
 * IPC Handlers for Coinswap operations (using worker threads)
 */

// Start coinswap
ipcMain.handle('coinswap:start', async (event, { amount, makerCount, outpoints }) => {
    try {
        if (!takerInstance) {
            return { success: false, error: 'Taker not initialized' };
        }

        if (!amount || amount <= 0) {
            return { success: false, error: 'Invalid amount' };
        }

        const swapId = `swap_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log(`🚀 [${swapId}] Starting coinswap in worker: ${amount} sats, ${makerCount} makers`);

        // Get config for worker
        const config = {
            dataDir: `${process.env.HOME}/.coinswap/taker`,
            rpcConfig: {
                url: "127.0.0.1:18443",
                username: "user",
                password: "password",
                walletName: "taker-wallet"
            },
            zmqAddr: "tcp://127.0.0.1:29332"
        };

        const worker = new Worker(path.join(__dirname, 'coinswap-worker.js'), {
            workerData: { amount, makerCount, outpoints, config }
        });

        activeSwaps.set(swapId, {
            status: 'starting',
            amount,
            makerCount,
            startedAt: Date.now()
        });

        worker.on('message', (msg) => {
            console.log(`📨 [${swapId}] Worker:`, msg.type);
            if (msg.type === 'status') {
                activeSwaps.set(swapId, { ...activeSwaps.get(swapId), status: msg.status });
            } else if (msg.type === 'complete') {
                activeSwaps.set(swapId, { ...activeSwaps.get(swapId), status: 'completed', report: msg.report, completedAt: Date.now() });
            } else if (msg.type === 'error') {
                activeSwaps.set(swapId, { ...activeSwaps.get(swapId), status: 'failed', error: msg.error, failedAt: Date.now() });
            }
        });

        worker.on('error', (err) => {
            console.error(`❌ [${swapId}] Worker error:`, err);
            activeSwaps.set(swapId, { ...activeSwaps.get(swapId), status: 'failed', error: err.message });
        });

        return { success: true, swapId };

    } catch (error) {
        console.error('❌ Coinswap error:', error);
        return { success: false, error: error.message };
    }
});

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
        const allLines = content.split('\n').filter(l => l.trim());
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
