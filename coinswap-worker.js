const { parentPort, workerData } = require('worker_threads');

/**
 * Worker thread for running long-running coinswap operations
 * This prevents blocking the main Electron process
 * Swap protocol is now a swap parameter on the unified Taker class.
 */

(async () => {
  try {
    const coinswapNapi = require('coinswap-napi');

    const { amount, makerCount, outpoints, config } = workerData;
    const protocol = config.protocol || 'v1';
    const protocolName = protocol === 'v2' ? 'Taproot (V2)' : 'P2WSH (V1)';

    console.log(`🔧 Coinswap worker starting with ${protocolName} protocol`);

    const TakerClass = coinswapNapi.Taker;

    if (!TakerClass) {
      throw new Error('Taker class not found. Please rebuild coinswap-napi.');
    }

    // Setup logging if available
    try {
      if (TakerClass.setupLogging) {
        TakerClass.setupLogging(config.dataDir, config.logLevel || 'debug');
      } else if (coinswapNapi.setupLogging) {
        coinswapNapi.setupLogging(config.dataDir, config.logLevel || 'debug');
      }
    } catch (logError) {
      console.warn('⚠️ Worker could not setup logging:', logError.message);
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
    parentPort.postMessage({
      type: 'status',
      status: 'in_progress',
      protocol: config.protocol,
    });

    const swapParams = {
      protocol: protocol === 'v2' ? 'Taproot' : 'Legacy',
      sendAmount: amount,
      makerCount: makerCount,
      manuallySelectedOutpoints: outpoints || undefined,
    };

    console.log(`🔄 Syncing offerbook in swap worker before prepare...`);
    taker.syncOfferbookAndWait();

    console.log(`🚀 Preparing ${protocolName} coinswap...`);
    const swapId = taker.prepareCoinswap(swapParams);

    parentPort.postMessage({
      type: 'status',
      status: 'prepared',
      protocol: config.protocol,
      nativeSwapId: swapId,
    });

    console.log(`🚀 Starting ${protocolName} coinswap...`);
    const report = taker.startCoinswap(swapId);

    // Send success message
    parentPort.postMessage({
      type: 'complete',
      report: {
        ...report,
        nativeSwapId: swapId,
        appSwapId: config.appSwapId,
        protocol: config.protocol,
      },
      protocol: config.protocol || 'v1',
      nativeSwapId: swapId,
      appSwapId: config.appSwapId,
    });
  } catch (error) {
    // Send error message
    parentPort.postMessage({ type: 'error', error: error.message });
  }
})();
