const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

/**
 * Worker thread for running offerbook sync operations.
 * Creates its own Taker instance so the sync doesn't block the main process IPC.
 */

(async () => {
  try {
    const coinswapNapi = require('coinswap-napi');
    const { config } = workerData;

    const TakerClass = coinswapNapi.Taker;

    if (!TakerClass) {
      throw new Error('Taker class not found. Please rebuild coinswap-napi.');
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

    const offerbookPath = path.join(config.dataDir, 'offerbook.json');
    const initialMtime = fs.existsSync(offerbookPath)
      ? fs.statSync(offerbookPath).mtimeMs
      : 0;

    taker.syncOfferbookAndWait();

    // Keep the worker alive until the offerbook file has had a chance to be
    // refreshed on disk. The unified backend can continue processing Nostr
    // announcements briefly after syncOfferbookAndWait() returns.
    const timeoutAt = Date.now() + 12000;
    let sawUpdatedOfferbook = false;

    while (Date.now() < timeoutAt) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      let stat;

      try {
        stat = fs.statSync(offerbookPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }

        throw error;
      }

      if (!stat) {
        continue;
      }

      if (stat.mtimeMs <= initialMtime) {
        continue;
      }

      sawUpdatedOfferbook = true;

      try {
        const offerbook = JSON.parse(fs.readFileSync(offerbookPath, 'utf8'));
        const makers = Array.isArray(offerbook.makers) ? offerbook.makers : [];

        // Once the file is rewritten and we have maker entries, let the main
        // process consume the refreshed offerbook immediately.
        if (makers.length > 0) {
          break;
        }
      } catch (error) {
        // File may be mid-write; keep polling briefly.
      }
    }

    parentPort.postMessage({
      type: 'completed',
      offerbookUpdated: sawUpdatedOfferbook,
    });
  } catch (err) {
    parentPort.postMessage({ type: 'error', error: err.message });
  }
})();
