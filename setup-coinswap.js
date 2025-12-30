// setup-coinswap.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFI_DIR = path.join(__dirname, 'coinswap-ffi');
const NAPI_DIR = path.join(FFI_DIR, 'coinswap-js'); // CHANGED FROM coinswap-napi
const NODE_MODULES_TARGET = path.join(
  __dirname,
  'node_modules',
  'coinswap-napi'
); // Keep same target name

console.log('\n=== Coinswap Native Module Auto Setup ===\n');

// Helper to run commands with proper shell
function runCommand(cmd, options = {}) {
  return execSync(cmd, {
    stdio: 'inherit',
    shell: '/bin/bash',
    ...options,
  });
}

// STEP 1 — Clone coinswap-ffi if missing
if (!fs.existsSync(FFI_DIR)) {
  console.log('➡️  Cloning coinswap-ffi...');
  runCommand('git clone https://github.com/citadel-tech/coinswap-ffi.git');
  console.log('✓ Cloned coinswap-ffi\n');
} else {
  console.log('➡️  Updating coinswap-ffi...');
  runCommand('git pull', { cwd: FFI_DIR });
  console.log('✓ coinswap-ffi updated with upstream\n');
}

// STEP 2 — Install deps & build coinswap-js
console.log('➡️  Installing dependencies for coinswap-js...');
runCommand('npm install', { cwd: NAPI_DIR });

console.log('➡️  Building coinswap-js...');
runCommand('npm run build', { cwd: NAPI_DIR });

// STEP 3 — Copy coinswap-js into node_modules as coinswap-napi
console.log('➡️  Linking coinswap-js into node_modules...');

// remove old version if exists
if (fs.existsSync(NODE_MODULES_TARGET)) {
  fs.rmSync(NODE_MODULES_TARGET, { recursive: true, force: true });
}

// Use fs.cpSync instead of exec cp
fs.cpSync(NAPI_DIR, NODE_MODULES_TARGET, { recursive: true });

console.log('✓ coinswap-js copied into node_modules as coinswap-napi\n');

console.log('🎉 Setup complete! Coinswap-NAPI is ready.\n');
