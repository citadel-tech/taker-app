const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function startBitcoind() {
  try {
    execSync('pkill bitcoind || true');
    console.log('Cleaned up existing bitcoind processes');
  } catch (error) {
    console.log('No existing bitcoind processes to kill');
  }

  const dataDir = path.join(os.tmpdir(), 'coinswap_taker_app');
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  const bitcoinDataDir = path.join(dataDir, '.bitcoin');
  fs.mkdirSync(bitcoinDataDir, { recursive: true });

  console.log('Starting Bitcoin Core in regtest mode...');
  console.log(`Data directory: ${bitcoinDataDir}`);

  const exePath = path.join(__dirname, '../bin/bitcoin-28.1/bitcoind');
  const daemonCmd = `${exePath} -regtest -server -rest -txindex=1 -datadir="${bitcoinDataDir}" -rpcallowip=127.0.0.1 -rpcbind=127.0.0.1`;

  try {
    execSync(daemonCmd, { stdio: 'inherit' });
    console.log('✅ Bitcoin Core daemon started successfully');
    console.log('📍 RPC available at: http://127.0.0.1:18443');
    await new Promise(resolve => setTimeout(resolve, 2000));
    isBitcoindRunning();
  } catch (err) {
    process.exit(1);
  }
}

startBitcoind().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Bitcoin Core...');
  try {
    execSync('pkill bitcoind || true');
    console.log('✅ Bitcoin Core stopped');
  } catch (error) {
    console.log('Bitcoin Core may have already stopped');
  }
  process.exit(0);
});