const { spawn } = require('child_process');
const path = require('path');

function spawnLogged(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

const manifestPath = path.join('tor-manager', 'Cargo.toml');
const torBinary = path.join(
  'tor-manager',
  'target',
  'debug',
  process.platform === 'win32'
    ? 'coinswap-tor-manager.exe'
    : 'coinswap-tor-manager'
);

function runToCompletion(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnLogged(command, args);
    child.on('error', (error) => {
      reject(error);
    });
    child.on('exit', (code, signal) => {
      resolve({ code: code ?? 0, signal });
    });
  });
}

let shuttingDown = false;
let tor = null;
let electron = null;

function stopTor() {
  if (!tor) return;
  if (tor.killed || tor.exitCode !== null || tor.signalCode !== null) return;
  tor.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopTor();
  process.exitCode = code;
}

process.on('SIGINT', () => {
  stopTor();
  electron?.kill('SIGINT');
  shutdown(130);
});

process.on('SIGTERM', () => {
  stopTor();
  electron?.kill('SIGTERM');
  shutdown(143);
});

async function main() {
  const build = await runToCompletion('cargo', [
    'build',
    '--manifest-path',
    manifestPath,
    '--quiet',
  ]);

  if (build.signal || build.code !== 0) {
    process.exitCode = build.code || 1;
    return;
  }

  tor = spawnLogged(torBinary, []);
  tor.on('error', (error) => {
    console.error(`[tor-manager] failed to start:`, error);
  });

  electron = spawnLogged('electron', ['.']);
  electron.on('error', (error) => {
    console.error('[electron] failed to start:', error);
    stopTor();
    shutdown(1);
  });

  electron.on('exit', (code, signal) => {
    stopTor();
    if (signal) {
      shutdown(1);
      return;
    }
    shutdown(code ?? 0);
  });

  tor.on('exit', (code) => {
    if (shuttingDown) return;
    if (code && code !== 0) {
      console.warn(
        `[tor-manager] exited early with code ${code}; continuing app startup`
      );
    }
  });
}

main().catch((error) => {
  console.error('Startup failed:', error);
  shutdown(1);
});
