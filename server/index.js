const express = require('express');
const cors = require('cors');
const { Worker } = require('worker_threads');


const app = express();
app.use(cors());
app.use(express.json());

let coinswapNapi = null;
let takerInstance = null;
const activeSwaps = new Map();


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

function ensureInitialized(req, res, next) {
    if (!takerInstance) {
        return res.status(503).json({
            success: false,
            error: 'Taker not initialized'
        });
    }
    next();
}


// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'Bridge server running',
        napiLoaded: coinswapNapi !== null,
        takerReady: takerInstance !== null
    });
});

// Initialize taker (creates wallet internally)
app.post('/api/taker/initialize', async (req, res) => {
    try {
        const config = req.body || {};

        const rpcConfig = {
            url: `${config.rpc?.host || "127.0.0.1"}:${config.rpc?.port || 38332}`,
            username: config.rpc?.username || "user",
            password: config.rpc?.password || "password",
            walletName: "taker-wallet"
        };

        const dataDir = `${process.env.HOME}/.coinswap/taker`;
        const zmqAddr = config.zmq?.address || "tcp://127.0.0.1:28332";

        console.log('🔧 Initializing Taker with config:', { dataDir, rpcConfig, zmqAddr });
        console.log('⚠️  Make sure Bitcoin Core has ZMQ enabled in bitcoin.conf:');
        console.log('   zmqpubrawblock=tcp://127.0.0.1:29332');
        console.log('   zmqpubrawtx=tcp://127.0.0.1:29332');

        takerInstance = new coinswapNapi.Taker(
            dataDir,
            "taker-wallet",
            rpcConfig,
            9051,  // Tor control port for coinswap instance
            undefined,  // tor_auth_password (CookieAuthentication is 0)
            zmqAddr
        );

        coinswapNapi.Taker.setupLogging(`${process.env.HOME}/.coinswap/taker`);

        console.log("logger set up");

    
        console.log('✅ Taker initialized (wallet created internally)');
        res.json({ success: true, message: "Taker initialized and ready" });

    } catch (error) {
        console.error('❌ Initialization failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get balance (from taker)
app.get('/api/taker/balance', ensureInitialized, async (req, res) => {
    try {
        takerInstance.syncAndSave();
        const balance = takerInstance.getBalances();

        res.json({
            success: true,
            balance: {
                spendable: balance.spendable,
                regular: balance.regular,
                swap: balance.swap,
                contract: balance.contract,
                fidelity: balance.fidelity
            }
        });
    } catch (error) {
        console.error('❌ Failed to get balance:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get new address (from taker's wallet)
app.post('/api/taker/address', ensureInitialized, async (req, res) => {
    try {
        const address = takerInstance.getNextExternalAddress();
        takerInstance.syncAndSave();

        res.json({
            success: true,
            address: address.address || address
        });
    } catch (error) {
        console.error('❌ Failed to generate address:', error);
        res.json({ success: false, error: error.message });
    }
});

// Sync wallet
app.post('/api/taker/sync', ensureInitialized, async (req, res) => {
    try {
        console.log('🔄 Syncing wallet...');
        takerInstance.syncAndSave();
        console.log('✅ Wallet synced');
        res.json({ success: true, message: 'Wallet synced' });
    } catch (error) {
        console.error('❌ Sync failed:', error);
        res.json({ success: false, error: error.message });
    }
});


// Sync offerbook
app.post('/api/taker/sync-offerbook', ensureInitialized, async (req, res) => {
    try {
        console.log('🔄 Syncing offerbook...');
        takerInstance.syncOfferbook();
        console.log('✅ Offerbook synced');
        res.json({ success: true, message: 'Offerbook synced' });
    } catch (error) {
        console.error('❌ Sync offerbook failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get offers
app.get('/api/taker/offers', ensureInitialized, async (req, res) => {
    try {
        console.log('📊 Fetching offers...');

        // OPTION 1: Try to read from cached offerbook file (fast)
        const fs = require('fs');
        const path = require('path');
        const offerbookPath = path.join(process.env.HOME, '.coinswap/taker/offerbook.json');

        try {
            if (fs.existsSync(offerbookPath)) {
                const offerbookData = fs.readFileSync(offerbookPath, 'utf8');
                const offerbook = JSON.parse(offerbookData);

                if (offerbook.all_makers && offerbook.all_makers.length > 0) {
                    console.log('✅ Loaded cached offerbook:', {
                        allMakers: offerbook.all_makers.length,
                        badMakers: offerbook.bad_makers?.length || 0
                    });
                }

                // Transform to expected format with CORRECT field mapping
                const transformedOfferbook = {
                    goodMakers: (offerbook.all_makers || []).map(maker => ({
                        address: maker.address,
                        offer: {
                            baseFee: maker.offer.base_fee,
                            amountRelativeFeePct: maker.offer.amount_relative_fee_pct,
                            timeRelativeFeePct: maker.offer.time_relative_fee_pct,
                            requiredConfirms: maker.offer.required_confirms,
                            minimumLocktime: maker.offer.minimum_locktime,
                            maxSize: maker.offer.max_size,        // ← FIX: snake_case
                            minSize: maker.offer.min_size,        // ← FIX: snake_case
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
                            maxSize: maker.offer.max_size,        // ← FIX: snake_case
                            minSize: maker.offer.min_size,        // ← FIX: snake_case
                            tweakablePoint: maker.offer.tweakable_point,
                            fidelity: maker.offer.fidelity
                        }
                    }))
                };

                return res.json({
                    success: true,
                    offerbook: transformedOfferbook,
                    cached: true
                });
            }
        } catch (fileError) {
            console.log('⚠️ Could not read cached offerbook:', fileError.message);
        }

        // OPTION 2: Fetch live (slow - will block for 30-60 seconds)
        console.log('📡 Fetching live offers (this may take a minute)...');
        const offerbook = takerInstance.fetchOffers();

        console.log('✅ Offers fetched:', {
            goodMakers: offerbook.goodMakers?.length || 0,
            allMakers: offerbook.allMakers?.length || 0
        });

        res.json({
            success: true,
            offerbook: {
                goodMakers: offerbook.goodMakers || [],
                allMakers: offerbook.allMakers || []
            },
            cached: false
        });
    } catch (error) {
        console.error('❌ Fetch offers failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get good makers
app.get('/api/taker/good-makers', ensureInitialized, async (req, res) => {
    try {
        console.log('📋 Fetching good makers...');
        const goodMakers = takerInstance.getAllGoodMakers();
        console.log('✅ Good makers fetched:', goodMakers.length);
        res.json({ success: true, makers: goodMakers });
    } catch (error) {
        console.error('❌ Fetch good makers failed:', error);
        res.json({ success: false, error: error.message });
    }
});

const fs = require('fs');
const path = require('path');

app.get('/api/taker/logs', (req, res) => {
    const logPath = path.join(process.env.HOME, '.coinswap/taker/debug.log');
    const lines = parseInt(req.query.lines) || 100;

    try {
        if (!fs.existsSync(logPath)) {
            return res.json({ success: true, logs: [] });
        }
        const content = fs.readFileSync(logPath, 'utf8');
        const allLines = content.split('\n').filter(l => l.trim());
        const lastLines = allLines.slice(-lines);
        res.json({ success: true, logs: lastLines });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Get transactions (from taker)
app.get('/api/taker/transactions', ensureInitialized, async (req, res) => {
    try {
        const { count = 10, skip = 0 } = req.query;
        console.log(`📊 Getting ${count} transactions (skip ${skip})...`);

        const transactions = takerInstance.getTransactions(parseInt(count), parseInt(skip));

        console.log('✅ Transactions retrieved:', transactions?.length || 0);
        res.json({ success: true, transactions: transactions || [] });

    } catch (error) {
        console.log(`⚠️ Transaction retrieval failed: ${error.message}`);
        res.json({ success: true, transactions: [], message: 'Transaction history unavailable' });
    }
});


// Get UTXOs
app.get('/api/taker/utxos', ensureInitialized, async (req, res) => {
    try {
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

        res.json({ success: true, utxos: transformedUtxos || [] });

    } catch (error) {
        console.log(`⚠️ UTXO retrieval failed: ${error.message}`);
        res.json({ success: true, utxos: [], message: 'UTXO list unavailable' });
    }
});

// Send to address (from taker)
app.post('/api/taker/send', ensureInitialized, async (req, res) => {
    try {
        const { address, amount } = req.body;

        if (!address || !amount || amount <= 0) {
            throw new Error('Invalid address or amount');
        }

        console.log(`📤 Sending ${amount} sats to ${address}...`);

        const txidObj = takerInstance.sendToAddress(address, amount);
        takerInstance.syncAndSave();

        const txid = txidObj.hex || txidObj;
        console.log(`✅ Transaction sent: ${txid}`);
        res.json({ success: true, txid });

    } catch (error) {
        console.error('❌ Send failed:', error);
        res.json({ success: false, error: error.message });
    }
});


// Start coinswap (WORKER THREAD VERSION)
app.post('/api/taker/start-coinswap', ensureInitialized, async (req, res) => {
    try {
        const { amount, makerCount, outpoints } = req.body;

        if (!amount || amount <= 0) {
            return res.json({ success: false, error: 'Invalid amount' });
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

        res.json({ success: true, swapId });

    } catch (error) {
        console.error('❌ Coinswap error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Status endpoint stays the same
app.get('/api/taker/coinswap-status/:swapId', (req, res) => {
    const { swapId } = req.params;
    const swap = activeSwaps.get(swapId);

    if (!swap) {
        return res.json({ success: false, error: 'Swap not found' });
    }

    // Don't send worker object to client
    const { worker, ...swapData } = swap;
    res.json({ success: true, swap: swapData });
});


// Recover from failed swap
app.post('/api/taker/recover', ensureInitialized, async (req, res) => {
    try {
        console.log('🔄 Recovering from failed swap...');
        takerInstance.recoverFromSwap();
        console.log('✅ Recovery completed');
        res.json({ success: true, message: 'Recovery completed' });
    } catch (error) {
        console.error('❌ Recovery failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

const PORT = 3001;
app.listen(PORT, async () => {
    console.log(`🚀 Bridge server running on http://localhost:${PORT}`);
    console.log(`🎯 Taker manages wallet internally - no separate wallet needed!`);
    await initNAPI();
});