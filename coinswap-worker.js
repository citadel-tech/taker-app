const { parentPort, workerData } = require('worker_threads');

/**
 * Worker thread for running long-running coinswap operations
 * This prevents blocking the main Electron process
 */

(async () => {
    try {
        const coinswapNapi = require('coinswap-napi');

        const { amount, makerCount, outpoints, config } = workerData;

        // Setup logging if available
        try {
            if (coinswapNapi.Taker.setupLogging) {
                coinswapNapi.Taker.setupLogging(config.dataDir);
            } else if (coinswapNapi.setupLogging) {
                coinswapNapi.setupLogging(config.dataDir);
            }
        } catch (logError) {
            console.warn('⚠️ Worker could not setup logging:', logError.message);
        }

        // Create a new Taker instance for this worker
        const taker = new coinswapNapi.Taker(
            config.dataDir,
            "taker-wallet",
            config.rpcConfig,
            9051,
            undefined,
            config.zmqAddr
        );

        // Notify that we're in progress
        parentPort.postMessage({ type: 'status', status: 'in_progress' });

        // Run the coinswap
        const swapParams = {
            sendAmount: amount,
            makerCount: makerCount,
            manuallySelectedOutpoints: outpoints || undefined
        };

        const report = taker.doCoinswap(swapParams);

        // Send success message
        parentPort.postMessage({ type: 'complete', report });
    } catch (error) {
        // Send error message
        parentPort.postMessage({ type: 'error', error: error.message });
    }
})();
