// setup-openswap.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFI_DIR = path.join(__dirname, 'openswap-ffi');
const NAPI_SOURCE = path.join(FFI_DIR, 'openswap-js');
const NODE_MODULES_TARGET = path.join(__dirname, 'node_modules', 'openswap-napi');

console.log('\n=== Openswap Native Module Auto Setup ===\n');

function runCommand(cmd, options = {}) {
  return execSync(cmd, {
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'bash' : '/bin/bash',
    ...options,
  });
}

// STEP 1 — Clone openswap-ffi if missing
const BRANCH = 'main';
const REPO_URL = 'https://github.com/citadel-foss/openswap-ffi.git';

if (!fs.existsSync(FFI_DIR)) {
  console.log(`➡️  Cloning openswap-ffi (branch ${BRANCH})...`);
  runCommand(`git clone -b ${BRANCH} ${REPO_URL}`);
} else {
  console.log(`➡️  Updating openswap-ffi to branch ${BRANCH}...`);
  // Fetch all branches and checkout the desired one
  runCommand('git fetch --all', { cwd: FFI_DIR });
  runCommand(`git checkout ${BRANCH}`, { cwd: FFI_DIR });
  runCommand('git pull', { cwd: FFI_DIR });
}
// STEP 2 — Install deps & build openswap-js
console.log('➡️  Installing dependencies for openswap-js...');
runCommand('npm install', { cwd: NAPI_SOURCE });

console.log('➡️  Building openswap-js...');
runCommand('npm run build', { cwd: NAPI_SOURCE });

// STEP 3 — Create symlink in node_modules
console.log('➡️  Setting up openswap-napi in node_modules...');

// Ensure node_modules exists
const nodeModulesDir = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesDir)) {
  fs.mkdirSync(nodeModulesDir, { recursive: true });
}

// Remove old link/directory if exists
if (fs.existsSync(NODE_MODULES_TARGET)) {
  fs.rmSync(NODE_MODULES_TARGET, { recursive: true, force: true });
}

// Create symlink (works on Linux/Mac, falls back to copy on Windows)
try {
  fs.symlinkSync(NAPI_SOURCE, NODE_MODULES_TARGET, 'dir');
  console.log('✓ Symlinked openswap-js → node_modules/openswap-napi\n');
} catch (err) {
  console.log('⚠️  Symlink failed, copying instead...');
  fs.cpSync(NAPI_SOURCE, NODE_MODULES_TARGET, { recursive: true });
  console.log('✓ Copied openswap-js → node_modules/openswap-napi\n');
}

// STEP 4 — Verify
console.log('➡️  Verifying module...');
const indexPath = path.join(NODE_MODULES_TARGET, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ Error: index.js not found!');
  process.exit(1);
}

// Find the actual .node file
console.log('➡️  Searching for native binary...');
try {
  const result = execSync(`find ${NODE_MODULES_TARGET} -name "*.node"`, { 
    encoding: 'utf-8' 
  }).trim();
  
  if (result) {
    console.log('✓ Found native binary at:', result);
  } else {
    console.warn('⚠️  Warning: No .node file found, module may not work');
  }
} catch (err) {
  console.warn('⚠️  Warning: Could not search for .node file');
}

console.log('\n✓ Module structure verified');
console.log('🎉 Setup complete! Openswap-NAPI is ready.\n');