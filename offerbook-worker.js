const { parentPort, workerData } = require('worker_threads');

/**
 * Worker thread for syncing offerbook
 * This prevents blocking the main Electron process
 */

(async () => {
  try {
    const coinswapNapi = require('coinswap-napi');
    const { config } = workerData;

    // Setup logging if available
    console.log('🔧 Worker attempting to setup logging...');
    try {
      if (coinswapNapi.Taker.setupLogging) {
        coinswapNapi.Taker.setupLogging(config.dataDir);
        console.log('✅ Worker logging setup via Taker.setupLogging');
      } else if (coinswapNapi.setupLogging) {
        coinswapNapi.setupLogging(config.dataDir);
        console.log('✅ Worker logging setup via setupLogging');
      }
    } catch (logError) {
      console.error('❌ Worker logging failed:', logError);
    }

    // Create a new Taker instance for this worker
    const taker = new coinswapNapi.Taker(
      config.dataDir,
      'taker-wallet',
      config.rpcConfig,
      9051,
      undefined,
      config.zmqAddr
    );

    // Notify that we're in progress
    parentPort.postMessage({ type: 'status', status: 'syncing' });

    // Sync the offerbook (this will block for 30-60s in the worker)
    taker.syncOfferbook();

    // Send success message
    parentPort.postMessage({
      type: 'complete',
      message: 'Offerbook synced successfully',
    });
  } catch (error) {
    // Send detailed error message
    console.error('❌ Offerbook worker error:', error);
    parentPort.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack,
    });
  }
})();
