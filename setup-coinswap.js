// setup-coinswap.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FFI_DIR = path.join(__dirname, "coinswap-ffi");
const NAPI_DIR = path.join(FFI_DIR, "coinswap-napi");
const NODE_MODULES_TARGET = path.join(__dirname, "node_modules", "coinswap-napi");

console.log("\n=== Coinswap Native Module Auto Setup ===\n");

// STEP 1 — Clone coinswap-ffi if missing
if (!fs.existsSync(FFI_DIR)) {
  console.log("➡️  Cloning coinswap-ffi...");
  execSync(
    "git clone https://github.com/citadel-tech/coinswap-ffi.git",
    { stdio: "inherit" }
  );
  console.log("✓ Cloned coinswap-ffi\n");
} else {
  execSync(
    "cd coinswap-ffi && git pull",
    { stdio: "inherit" }
  );
  console.log("✓ coinswap-ffi updated with upstream\n");
}

// STEP 2 — Install deps & build coinswap-napi
console.log("➡️  Installing dependencies for coinswap-napi...");
execSync("npm install", { cwd: NAPI_DIR, stdio: "inherit" });

console.log("➡️  Building coinswap-napi...");
execSync("npm run build", { cwd: NAPI_DIR, stdio: "inherit" });

// STEP 3 — Copy coinswap-napi into node_modules
console.log("➡️  Linking coinswap-napi into node_modules...");

// remove old version if exists
if (fs.existsSync(NODE_MODULES_TARGET)) {
  fs.rmSync(NODE_MODULES_TARGET, { recursive: true, force: true });
}

execSync(`cp -r "${NAPI_DIR}" "${path.join(__dirname, "node_modules")}/"`);

console.log("✓ coinswap-napi copied into node_modules\n");

console.log("🎉 Setup complete! Coinswap-NAPI is ready.\n");
