const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Import coinswap-napi
let coinswapNapi = null;
let takerInstance = null;
let walletInstance = null;

async function initNAPI() {
    try {
        coinswapNapi = require('coinswap-napi');
        console.log('✅ coinswap-napi loaded successfully');
        console.log('🔍 All available exports:', Object.keys(coinswapNapi));

        // Test the default RPC config format
        const defaultConfig = coinswapNapi.createDefaultRpcConfig();
        console.log('🔍 Default RPC config:', defaultConfig);

        return true;
    } catch (error) {
        console.error('❌ Failed to load coinswap-napi:', error);
        return false;
    }
}

// Middleware to ensure services are initialized
function ensureInitialized(req, res, next) {
    if (!takerInstance || !walletInstance) {
        return res.status(503).json({ 
            success: false, 
            error: 'Service not initialized. Please initialize taker first.' 
        });
    }
    next();
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'Bridge server running',
        napiLoaded: coinswapNapi !== null,
        takerReady: takerInstance !== null,
        walletReady: walletInstance !== null
    });
});

// Initialize taker
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
        const walletPath = `${dataDir}/wallets/taker-wallet`;

        console.log('🔧 Initializing Taker with config:', { dataDir, walletPath, rpcConfig });

        takerInstance = new coinswapNapi.Taker(
            dataDir,
            "taker-wallet",
            rpcConfig,
            null,
            config.tor?.control_port || null,  // null = no Tor for now
            config.tor?.tor_auth_password || null
        );

        // Load the wallet for direct access
        // TODO: Replace with takerInstance.getWallet() when available
        walletInstance = coinswapNapi.Wallet.loadWallet(walletPath, rpcConfig);

        console.log('✅ Taker initialized successfully');
        res.json({ success: true, message: "Taker initialized and ready" });

    } catch (error) {
        console.error('❌ Initialization failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get balance
app.get('/api/taker/balance', ensureInitialized, async (req, res) => {
    try {
        // Sync both to ensure latest state
        takerInstance.syncWallet();
        walletInstance.syncAndSave();

        const balance = walletInstance.getBalances();

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

// Get new address - NOTE: Currently returns same address due to NAPI limitation
app.post('/api/taker/address', ensureInitialized, async (req, res) => {
    try {
        const address = walletInstance.getNextExternalAddress();
        
        // TODO: This currently returns the same address each time
        // Need taker.getWallet() API to properly increment address index
        console.log('⚠️  Address generation limitation - returns same address');
        
        // Sync after generating new address
        walletInstance.syncAndSave();
        takerInstance.syncWallet();

        // Return just the address string, not nested object
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
        
        // Sync both instances
        takerInstance.syncWallet();
        walletInstance.syncAndSave();

        console.log('✅ Wallet synced successfully');
        res.json({ success: true, message: 'Wallet synced successfully' });

    } catch (error) {
        console.error('❌ Sync failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// Fetch offers (Taker only)
// ADD THESE ENDPOINTS TO YOUR index.js (bridge server)

// Get offerbook (all makers and offers)
// app.get('/api/taker/offers', async (req, res) => {
//   try {
//     console.log('📊 Fetching offers...');

//     if (!takerInstance) {
//       return res.json({
//         success: false,
//         error: 'Taker not initialized'
//       });
//     }

//     // Fetch offers from the taker
//     const offerbook = takerInstance.fetchOffers();

//     console.log('✅ Offers fetched:', {
//       goodMakers: offerbook.goodMakers?.length || 0,
//       allMakers: offerbook.allMakers?.length || 0
//     });

//     res.json({
//       success: true,
//       offerbook: {
//         goodMakers: offerbook.goodMakers || [],
//         allMakers: offerbook.allMakers || []
//       }
//     });

//   } catch (error) {
//     console.error('❌ Fetch offers error:', error);
//     res.json({
//       success: false,
//       error: error.message || 'Failed to fetch offers'
//     });
//   }
// });

// Sync offerbook (refresh makers list)
app.post('/api/taker/sync-offerbook', async (req, res) => {
  try {
    console.log('🔄 Syncing offerbook...');

    if (!takerInstance) {
      return res.json({
        success: false,
        error: 'Taker not initialized'
      });
    }

    // Sync the offerbook
    takerInstance.syncOfferbook();

    console.log('✅ Offerbook synced');

    res.json({
      success: true,
      message: 'Offerbook synced successfully'
    });

  } catch (error) {
    console.error('❌ Sync offerbook error:', error);
    res.json({
      success: false,
      error: error.message || 'Failed to sync offerbook'
    });
  }
});

// Get good makers (addresses only)
app.get('/api/taker/good-makers', async (req, res) => {
  try {
    console.log('📋 Fetching good makers...');

    if (!takerInstance) {
      return res.json({
        success: false,
        error: 'Taker not initialized'
      });
    }

    const goodMakers = takerInstance.fetchGoodMakers();

    console.log('✅ Good makers fetched:', goodMakers.length);

    res.json({
      success: true,
      makers: goodMakers
    });

  } catch (error) {
    console.error('❌ Fetch good makers error:', error);
    res.json({
      success: false,
      error: error.message || 'Failed to fetch good makers'
    });
  }
});

// ADD THIS TO YOUR index.js (bridge server)

// Start coinswap
app.post('/api/taker/start-coinswap', async (req, res) => {
  try {
    console.log('🔄 Starting coinswap...', req.body);

    const { amount, makerCount, outpoints } = req.body;

    if (!takerInstance) {
      return res.json({
        success: false,
        error: 'Taker not initialized'
      });
    }

    if (!amount || amount <= 0) {
      return res.json({
        success: false,
        error: 'Invalid amount'
      });
    }

    if (!makerCount || makerCount < 1) {
      return res.json({
        success: false,
        error: 'Invalid maker count'
      });
    }

    // Create swap params
    const swapParams = {
      sendAmount: amount,
      makerCount: makerCount,
      manuallySelectedOutpoints: outpoints || null
    };

    console.log('📤 Calling do_coinswap with params:', swapParams);

    // Start the coinswap (this will take time)
    const swapReport = takerInstance.doCoinswap(swapParams);

    if (swapReport) {
      console.log('✅ Coinswap completed successfully:', swapReport);
      
      res.json({
        success: true,
        report: swapReport
      });
    } else {
      console.log('⚠️ Coinswap returned null');
      res.json({
        success: false,
        error: 'Coinswap returned no report'
      });
    }

  } catch (error) {
    console.error('❌ Coinswap error:', error);
    res.json({
      success: false,
      error: error.message || 'Coinswap failed'
    });
  }
});


// Get transactions
app.get('/api/taker/transactions', ensureInitialized, async (req, res) => {
    try {
        const { count = 10, skip = 0 } = req.query;
        console.log(`📊 Getting ${count} transactions (skip ${skip})...`);

        const transactions = walletInstance.getTransactions(parseInt(count), parseInt(skip));
        console.log('✅ Transactions retrieved:', transactions?.length || 0);
        
        res.json({ success: true, transactions: transactions || [] });

    } catch (error) {
        console.log(`⚠️  Transaction retrieval failed: ${error.message}`);
        // Graceful fallback to prevent UI breakage
        res.json({
            success: true,
            transactions: [],
            message: 'Transaction history temporarily unavailable'
        });
    }
});

// Get UTXOs
app.get('/api/taker/utxos', ensureInitialized, async (req, res) => {
    try {
        console.log('📊 Getting UTXOs...');
        
        const rawUtxos = walletInstance.listAllUtxos();
        console.log('✅ UTXOs retrieved:', rawUtxos?.length || 0);
        
        // Transform NAPI format [ListUnspentResultEntry, UtxoSpendInfo] to frontend format
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
        console.log(`⚠️  UTXO retrieval failed: ${error.message}`);
        // Graceful fallback
        res.json({
            success: true,
            utxos: [],
            message: 'UTXO list temporarily unavailable'
        });
    }
});

// Send to address
app.post('/api/taker/send', ensureInitialized, async (req, res) => {
    try {
        const { address, amount } = req.body;
        
        if (!address || !amount || amount <= 0) {
            throw new Error('Invalid address or amount');
        }

        console.log(`📤 Sending ${amount} sats to ${address}...`);
        
        const txid = walletInstance.sendToAddress(address, amount);
        
        // Sync after sending
        walletInstance.syncAndSave();
        takerInstance.syncWallet();

        console.log(`✅ Transaction sent: ${txid}`);
        res.json({ success: true, txid });

    } catch (error) {
        console.error('❌ Send failed:', error);
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

// Start server
const PORT = 3001;
app.listen(PORT, async () => {
    console.log(`🚀 Bridge server running on http://localhost:${PORT}`);
    console.log(`🎯 Taker is designed to be plug-and-play!`);
    console.log(`💡 Users just need: 1) Get address 2) Send funds 3) Start coinswapping`);
    console.log(`🔧 No Bitcoin Core wallet setup required!`);
    await initNAPI();
});