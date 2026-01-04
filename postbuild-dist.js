// postbuild-dist.js
const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, 'package.json');
const PACKAGE_JSON_BACKUP = PACKAGE_JSON + '.backup';

console.log('\n=== Restoring package.json ===\n');

if (fs.existsSync(PACKAGE_JSON_BACKUP)) {
  // Restore original package.json
  fs.copyFileSync(PACKAGE_JSON_BACKUP, PACKAGE_JSON);
  fs.unlinkSync(PACKAGE_JSON_BACKUP);
  console.log('✓ Restored original package.json\n');
} else {
  console.log('⚠️  No backup found, skipping restore\n');
}
