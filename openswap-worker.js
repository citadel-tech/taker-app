const { parentPort, workerData } = require('worker_threads');

function requireWalletPassword(password) {
  if (typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('Wallet password is required');
  }

  return password;
}

/**
 * Worker thread for running long-running openswap operations
 * This prevents blocking the main Electron process
 * Swap protocol is now a swap parameter on the unified Taker class.
 */

(async () => {
  try {
    const openswapNapi = require('openswap-napi');

    const { amount, makerCount, outpoints, selectedMakerAddresses, config } = workerData;
    const walletPassword = requireWalletPassword(config.password);
    const protocol = config.protocol || 'v1';
    const normalizedProtocol = protocol === 'v2' ? 'Taproot' : 'Legacy';
    const protocolName =
      normalizedProtocol === 'Taproot' ? 'Taproot (V2)' : 'P2WSH (V1)';

    console.log(`🔧 Openswap worker starting with ${protocolName} protocol`);

    const TakerClass = openswapNapi.Taker;

    if (!TakerClass) {
      throw new Error('Taker class not found. Please rebuild openswap-napi.');
    }

    // Setup logging if available
    try {
      if (TakerClass.setupLogging) {
        TakerClass.setupLogging(config.dataDir, config.logLevel || 'debug');
      } else if (openswapNapi.setupLogging) {
        openswapNapi.setupLogging(config.dataDir, config.logLevel || 'debug');
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
      walletPassword,
      config.backendConfig || undefined
    );

    // Notify that we're in progress
    parentPort.postMessage({
      type: 'status',
      status: 'in_progress',
      protocol: normalizedProtocol || config.protocol,
    });

    const swapParams = {
      protocol: normalizedProtocol,
      sendAmount: amount,
      makerCount: makerCount,
      manuallySelectedOutpoints: outpoints || undefined,
      preferredMakers: selectedMakerAddresses && selectedMakerAddresses.length > 0 ? selectedMakerAddresses : undefined,
    };

    console.log(`🔄 Syncing offerbook in swap worker before prepare...`);
    taker.syncOfferbookAndWait();

    console.log(`🚀 Preparing ${protocolName} openswap...`);
    const swapId = taker.prepareOpenswap(swapParams);

    parentPort.postMessage({
      type: 'status',
      status: 'prepared',
      protocol: normalizedProtocol || config.protocol,
      nativeSwapId: swapId,
    });

    console.log(`🚀 Starting ${protocolName} openswap...`);
    const report = taker.startOpenswap(swapId);

    // Send success message
    parentPort.postMessage({
      type: 'complete',
      report: {
        ...report,
        nativeSwapId: swapId,
        appSwapId: config.appSwapId,
        protocol: swapParams.protocol || normalizedProtocol || config.protocol,
      },
      protocol: normalizedProtocol || config.protocol,
      nativeSwapId: swapId,
      appSwapId: config.appSwapId,
    });
  } catch (error) {
    // Send error message
    parentPort.postMessage({ type: 'error', error: error.message });
  }
})();
