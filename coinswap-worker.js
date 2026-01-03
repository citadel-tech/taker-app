const { parentPort, workerData } = require('worker_threads');

/**
 * Worker thread for running long-running coinswap operations
 * This prevents blocking the main Electron process
 * Supports both V1 (P2WSH/Taker) and V2 (Taproot/TaprootTaker) protocols
 */

(async () => {
  try {
    const coinswapNapi = require('coinswap-napi');

    const { amount, makerCount, outpoints, config } = workerData;
    const protocol = config.protocol || 'v1';
    const protocolName = protocol === 'v2' ? 'Taproot (V2)' : 'P2WSH (V1)';

    console.log(`🔧 Coinswap worker starting with ${protocolName} protocol`);

    // Select the appropriate Taker class based on protocol
    const TakerClass =
      protocol === 'v2' ? coinswapNapi.TaprootTaker : coinswapNapi.Taker;

    if (!TakerClass) {
      throw new Error(
        `${protocol === 'v2' ? 'TaprootTaker' : 'Taker'} class not found. Please rebuild coinswap-napi.`
      );
    }

    // Setup logging if available
    try {
      if (TakerClass.setupLogging) {
        TakerClass.setupLogging(config.dataDir);
      } else if (coinswapNapi.setupLogging) {
        coinswapNapi.setupLogging(config.dataDir);
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
      isTaproot: protocol === 'v2',
    });

    // Run the coinswap
    const swapParams = {
      sendAmount: amount,
      makerCount: makerCount,
      manuallySelectedOutpoints: outpoints || undefined,
    };

    console.log(`🚀 Executing ${protocolName} coinswap...`);
    const report = taker.doCoinswap(swapParams);

    // Send success message
    parentPort.postMessage({
      type: 'complete',
      report,
      protocol: config.protocol || 'v1',
      isTaproot: (config.protocol || 'v1') === 'v2',
    });
  } catch (error) {
    // Send error message
    parentPort.postMessage({ type: 'error', error: error.message });
  }
})();
