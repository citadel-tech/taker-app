// prepare-dist.js
const fs = require('fs');
const path = require('path');

const NAPI_SOURCE = path.join(__dirname, 'openswap-ffi', 'openswap-js');
const NAPI_TARGET = path.join(__dirname, 'node_modules', 'openswap-napi');
const PACKAGE_JSON = path.join(__dirname, 'package.json');

console.log('\n=== Preparing for distribution build ===\n');

// Simple check: does openswap-napi exist in node_modules?
if (!fs.existsSync(NAPI_TARGET)) {
  console.error('❌ Error: openswap-napi not found in node_modules!');
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
  
  console.log('✓ Copied openswap-napi for distribution\n');
} else {
  console.log('✓ openswap-napi already prepared\n');
}

// IMPORTANT: Temporarily add openswap-napi to dependencies for electron-builder
console.log('➡️  Adding openswap-napi to package.json dependencies...');

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));

// Save original package.json
fs.writeFileSync(PACKAGE_JSON + '.backup', JSON.stringify(packageJson, null, 2));

// Add openswap-napi as a file dependency
packageJson.dependencies = packageJson.dependencies || {};
packageJson.dependencies['openswap-napi'] = 'file:./node_modules/openswap-napi';

// Write modified package.json
fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageJson, null, 2));

console.log('✓ Modified package.json for build\n');

// Copy tor-manager binary to bin/ so electron-builder includes it
// (tor-manager/target/ is gitignored and would otherwise be excluded)
const TOR_BINARY = process.platform === 'win32' ? 'openswap-tor-manager.exe' : 'openswap-tor-manager';
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