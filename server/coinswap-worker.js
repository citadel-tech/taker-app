const { parentPort, workerData } = require('worker_threads');

(async () => {
    try {
        const coinswapNapi = require('coinswap-napi');
        
        const { amount, makerCount, outpoints, config } = workerData;
        
        const taker = new coinswapNapi.Taker(
            config.dataDir,
            "taker-wallet",
            config.rpcConfig,
            9051,
            undefined,
            config.zmqAddr
        );
        
        coinswapNapi.Taker.setupLogging(config.dataDir);
        
        parentPort.postMessage({ type: 'status', status: 'in_progress' });
        
        const swapParams = {
            sendAmount: amount,
            makerCount: makerCount,
            manuallySelectedOutpoints: outpoints || undefined
        };
        
        const report = taker.doCoinswap(swapParams);
        
        parentPort.postMessage({ type: 'complete', report });
    } catch (error) {
        parentPort.postMessage({ type: 'error', error: error.message });
    }
})();