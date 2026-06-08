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
let electron = null;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;
}

process.on('SIGINT', () => {
  electron?.kill('SIGINT');
  shutdown(130);
});

process.on('SIGTERM', () => {
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

  electron = spawnLogged('electron', ['.']);
  electron.on('error', (error) => {
    console.error('[electron] failed to start:', error);
    shutdown(1);
  });

  electron.on('exit', (code, signal) => {
    if (signal) {
      shutdown(1);
      return;
    }
    shutdown(code ?? 0);
  });
}

main().catch((error) => {
  console.error('Startup failed:', error);
  shutdown(1);
});
