#!/usr/bin/env node
/**
 * Automatic coinswap-napi setup script
 * Runs automatically during npm install via the "prepare" lifecycle hook
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

function log(message, color = NC) {
  console.log(`${color}${message}${NC}`);
}

function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
}

function main() {
  log('\n=== Coinswap Native Module Setup ===\n', GREEN);

  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    log('Error: Must run from taker-app root directory', RED);
    process.exit(1);
  }

  // Search for coinswap core
  const projectRoot = path.join(__dirname, '..');
  let coinswapCore = null;
  
  // Try to find local coinswap in common locations
  const possiblePaths = [
    path.join(projectRoot, '..', 'coinswap'),           // ../coinswap (sibling)
    path.join(projectRoot, 'coinswap'),                 // ./coinswap (inside taker-app)
    process.env.COINSWAP_PATH,                          // Custom env variable
    path.join(projectRoot, '..', '..', 'coinswap')     // ../../coinswap (parent's sibling)
  ].filter(Boolean);
  
  for (const tryPath of possiblePaths) {
    const resolved = path.resolve(tryPath);
    if (fs.existsSync(resolved)) {
      coinswapCore = resolved;
      log(`✓ Found coinswap at: ${coinswapCore}`, GREEN);
      break;
    }
  }
  
  if (!coinswapCore) {
    log('Error: coinswap repository not found', RED);
    log('\nSearched in:', YELLOW);
    possiblePaths.forEach(p => log(`  - ${path.resolve(p)}`, YELLOW));
    log('\nPlease either:', YELLOW);
    log('  1. Clone coinswap next to taker-app: git clone <url> ../coinswap', YELLOW);
    log('  2. Set COINSWAP_PATH environment variable to your coinswap location', YELLOW);
    process.exit(1);
  }

  const ffiDir = path.join(__dirname, '..', 'coinswap-ffi');
  const napiDir = path.join(ffiDir, 'coinswap-napi');
  const indexNode = path.join(napiDir, 'index.node');

  // Link local coinswap to FFI's Cargo.toml
  const cargoToml = path.join(napiDir, 'Cargo.toml');
  if (fs.existsSync(cargoToml)) {
    let cargo = fs.readFileSync(cargoToml, 'utf8');
    
    // Calculate relative path from napiDir to coinswapCore
    const relativePath = path.relative(napiDir, coinswapCore).replace(/\\/g, '/');
    
    // Replace git dependency with local path
    const gitPattern = /coinswap\s*=\s*\{[^}]*git[^}]*\}/;
    const pathPattern = /coinswap\s*=\s*\{[^}]*path[^}]*\}/;
    
    if (cargo.match(gitPattern)) {
      // Replace git with path
      cargo = cargo.replace(gitPattern, `coinswap = { path = "${relativePath}" }`);
      fs.writeFileSync(cargoToml, cargo);
      log(`✓ Linked coinswap to FFI (path: ${relativePath})`, GREEN);
    } else if (cargo.match(pathPattern)) {
      // Update existing path
      cargo = cargo.replace(pathPattern, `coinswap = { path = "${relativePath}" }`);
      fs.writeFileSync(cargoToml, cargo);
      log(`✓ Updated coinswap path in FFI (path: ${relativePath})`, GREEN);
    } else {
      log('⚠ Could not find coinswap dependency in Cargo.toml', YELLOW);
    }
  } else {
    log('⚠ Cargo.toml not found', YELLOW);
  }

  // Check if already built
  if (fs.existsSync(indexNode)) {
    log('✓ coinswap-napi already built', GREEN);
  } else {
    log('Setting up coinswap-ffi...', YELLOW);

    // Clone if needed
    if (!fs.existsSync(ffiDir)) {
      log('Cloning coinswap-ffi...', YELLOW);
      if (!exec('git clone --depth 1 https://github.com/citadel-tech/coinswap-ffi.git')) {
        log('Error: Failed to clone coinswap-ffi', RED);
        process.exit(1);
      }
    }

    // Build coinswap-napi
    log('Building coinswap-napi (this may take a minute)...', YELLOW);
    const buildSuccess = exec('npm install && npm run build', {
      cwd: napiDir,
      stdio: 'pipe' // Hide verbose build output
    });

    if (!buildSuccess) {
      log('Error: Failed to build coinswap-napi', RED);
      process.exit(1);
    }

    log('✓ coinswap-napi built successfully', GREEN);
  }

  // Deploy to node_modules
  const nodeModulesNapi = path.join(__dirname, '..', 'node_modules', 'coinswap-napi');
  
  log('Deploying to node_modules...', YELLOW);
  
  // Remove existing if present
  if (fs.existsSync(nodeModulesNapi)) {
    fs.rmSync(nodeModulesNapi, { recursive: true, force: true });
  }

  // Ensure node_modules exists
  const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) {
    fs.mkdirSync(nodeModulesDir, { recursive: true });
  }

  // Copy to node_modules
  fs.cpSync(napiDir, nodeModulesNapi, { recursive: true });
  log('✓ Deployed to node_modules/coinswap-napi', GREEN);

  // Rebuild for Electron (if electron-rebuild is available)
  if (fs.existsSync(path.join(nodeModulesDir, '.bin', 'electron-rebuild'))) {
    log('Rebuilding for Electron...', YELLOW);
    const rebuildSuccess = exec('npx electron-rebuild -f -w coinswap-napi', {
      stdio: 'pipe'
    });
    
    if (rebuildSuccess) {
      log('✓ Rebuilt for Electron', GREEN);
    } else {
      log('⚠ Electron rebuild failed (may work anyway)', YELLOW);
    }
  }

  log('\n✓ Setup complete! Run: npm run dev\n', GREEN);
}

// Only run if called directly (not when required)
if (require.main === module) {
  main();
}

module.exports = main;