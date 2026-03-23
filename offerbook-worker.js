const { parentPort, workerData } = require('worker_threads');

/**
 * Worker thread for running offerbook sync operations.
 * Creates its own Taker instance so the sync doesn't block the main process IPC.
 */

(async () => {
  try {
    const coinswapNapi = require('coinswap-napi');
    const { config } = workerData;

    const protocol = config.protocol || 'v1';
    const TakerClass =
      protocol === 'v2' ? coinswapNapi.TaprootTaker : coinswapNapi.Taker;

    if (!TakerClass) {
      throw new Error(
        `${protocol === 'v2' ? 'TaprootTaker' : 'Taker'} class not found. Please rebuild coinswap-napi.`
      );
    }

    const taker = new TakerClass(
      config.dataDir,
      config.walletName || 'taker-wallet',
      config.rpcConfig,
      config.controlPort || 9051,
      config.torAuthPassword || undefined,
      config.zmqAddr,
      config.password || ''
    );

    taker.syncOfferbookAndWait();

    parentPort.postMessage({ type: 'completed' });
  } catch (err) {
    parentPort.postMessage({ type: 'error', error: err.message });
  }
})();
