function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function reportAndExit(result, code = result.success ? 0 : 1) {
  process.stdout.write(
    `__WALLET_PREFLIGHT_RESULT__${JSON.stringify(result)}\n`,
    () => process.exit(code)
  );
}

async function main() {
  try {
    const raw = await readStdin();
    const config = JSON.parse(raw);
    const coinswapNapi = require('coinswap-napi');
    const TakerClass = coinswapNapi.Taker;

    if (!TakerClass) {
      reportAndExit({
        success: false,
        error: 'Taker class not found. Rebuild coinswap-napi.',
        walletLoadFailed: true,
        recoverable: true,
      });
      return;
    }

    const taker = new TakerClass(
      config.dataDir,
      config.walletName,
      config.rpcConfig,
      config.controlPort,
      config.torAuthPassword,
      config.zmqAddr,
      config.password
    );

    if (typeof taker.shutdown === 'function') {
      taker.shutdown();
    }

    reportAndExit({ success: true });
  } catch (error) {
    reportAndExit({
      success: false,
      error:
        error?.message ||
        'Wallet could not be opened safely. It may be corrupted or incompatible with this app build.',
      walletLoadFailed: true,
      recoverable: true,
      details: error?.stack || String(error),
    });
  }
}

main();
