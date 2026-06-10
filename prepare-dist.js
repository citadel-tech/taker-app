// prepare-dist.js
const fs = require('fs');
const path = require('path');

const NAPI_SOURCE = path.join(__dirname, 'coinswap-ffi', 'coinswap-js');
const NAPI_TARGET = path.join(__dirname, 'node_modules', 'coinswap-napi');
const PACKAGE_JSON = path.join(__dirname, 'package.json');

console.log('\n=== Preparing for distribution build ===\n');

// Simple check: does coinswap-napi exist in node_modules?
if (!fs.existsSync(NAPI_TARGET)) {
  console.error('❌ Error: coinswap-napi not found in node_modules!');
  console.error('\n📦 Please run: npm install\n');
  process.exit(1);
}

// Check if it's a symlink or directory
const stats = fs.lstatSync(NAPI_TARGET);

if (stats.isSymbolicLink()) {
  console.log('➡️  Converting symlink to actual files for distribution...');
  
  // Remove symlink
  fs.unlinkSync(NAPI_TARGET);
  
  // Copy actual files
  fs.cpSync(NAPI_SOURCE, NAPI_TARGET, { recursive: true });
  
  console.log('✓ Copied coinswap-napi for distribution\n');
} else {
  console.log('✓ coinswap-napi already prepared\n');
}

// IMPORTANT: Temporarily add coinswap-napi to dependencies for electron-builder
console.log('➡️  Adding coinswap-napi to package.json dependencies...');

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));

// Save original package.json
fs.writeFileSync(PACKAGE_JSON + '.backup', JSON.stringify(packageJson, null, 2));

// Add coinswap-napi as a file dependency
packageJson.dependencies = packageJson.dependencies || {};
packageJson.dependencies['coinswap-napi'] = 'file:./node_modules/coinswap-napi';

// Write modified package.json
fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageJson, null, 2));

console.log('✓ Modified package.json for build\n');

// Copy tor-manager binary to bin/ so electron-builder includes it
// (tor-manager/target/ is gitignored and would otherwise be excluded)
const TOR_BINARY = process.platform === 'win32' ? 'coinswap-tor-manager.exe' : 'coinswap-tor-manager';
const torBinarySource = path.join(__dirname, 'tor-manager', 'target', 'debug', TOR_BINARY);
const binDir = path.join(__dirname, 'bin');
const torBinaryTarget = path.join(binDir, TOR_BINARY);

if (fs.existsSync(torBinarySource)) {
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  fs.copyFileSync(torBinarySource, torBinaryTarget);
  fs.chmodSync(torBinaryTarget, 0o755);
  console.log('✓ Copied tor-manager binary to bin/\n');
} else {
  console.warn('⚠️  tor-manager binary not found at', torBinarySource);
  console.warn('   Tor will not be auto-started in the built app.\n');
}