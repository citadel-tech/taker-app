const { parentPort, workerData } = require('worker_threads');

/**
 * Worker thread for syncing offerbook
 * This prevents blocking the main Electron process
 * Supports both V1 (P2WSH/Taker) and V2 (Taproot/TaprootTaker) protocols
 */

(async () => {
  try {
    const coinswapNapi = require('coinswap-napi');
    const { config } = workerData;
    const protocol = config.protocol || 'v1';
    const protocolName = protocol === 'v2' ? 'Taproot (V2)' : 'P2WSH (V1)';

    console.log(`🔧 Offerbook worker starting with ${protocolName} protocol`);

    // Select the appropriate Taker class based on protocol
    const TakerClass =
      protocol === 'v2' ? coinswapNapi.TaprootTaker : coinswapNapi.Taker;

    if (!TakerClass) {
      throw new Error(
        `${protocol === 'v2' ? 'TaprootTaker' : 'Taker'} class not found. Please rebuild coinswap-napi.`
      );
    }

    // Setup logging if available
    console.log('🔧 Worker attempting to setup logging...');
    try {
      if (TakerClass.setupLogging) {
        TakerClass.setupLogging(config.dataDir);
        console.log(
          `✅ Worker logging setup via ${protocol === 'v2' ? 'TaprootTaker' : 'Taker'}.setupLogging`
        );
      } else if (coinswapNapi.setupLogging) {
        coinswapNapi.setupLogging(config.dataDir);
        console.log('✅ Worker logging setup via setupLogging');
      }
    } catch (logError) {
      console.error('❌ Worker logging failed:', logError);
    }

    // Create a new Taker instance for this worker
    const taker = new TakerClass(
      config.dataDir,
      config.walletName || 'taker-wallet',
      config.rpcConfig,
      config.controlPort || 9051,
      config.torAuthPassword || undefined,
      config.zmqAddr,
      config.password || ''
    );

    // Notify that we're in progress
    parentPort.postMessage({ type: 'status', status: 'syncing', protocol });

    // Small delay to ensure status message is received
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Sync the offerbook (this will block for 30-60s in the worker)
    console.log(`🔄 Syncing offerbook with ${protocolName}...`);
    taker.fetchOffers();

    // Send success message
    parentPort.postMessage({
      type: 'complete',
      message: `Offerbook synced successfully (${protocolName})`,
      protocol,
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
