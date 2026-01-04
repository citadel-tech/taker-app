// postbuild-dist.js
const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, 'package.json');

console.log('\n=== Cleaning up package.json ===\n');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  
  // Check if coinswap-napi dependency exists
  if (packageJson.dependencies && packageJson.dependencies['coinswap-napi']) {
    console.log('➡️  Removing temporary coinswap-napi dependency...');
    
    // Remove the dependency
    delete packageJson.dependencies['coinswap-napi'];
    
    // Write back to package.json
    fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log('✓ Cleaned up package.json\n');
  } else {
    console.log('✓ No cleanup needed, package.json is clean\n');
  }
  
  // Remove backup file if it exists
  const backupFile = PACKAGE_JSON + '.backup';
  if (fs.existsSync(backupFile)) {
    fs.unlinkSync(backupFile);
    console.log('✓ Removed backup file\n');
  }
  
} catch (error) {
  console.error('❌ Error cleaning package.json:', error.message);
  process.exit(1);
}