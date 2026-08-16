import { icons } from '../../js/icons.js';
import { makeRPCCall } from '../../js/openswapHelpers.js';

export function SettingsComponent(container) {
  const content = document.createElement('div');
  content.id = 'settings-content';

  content.innerHTML = `
    <div class="app-page settings-page">
      <header class="app-head">
        <div>
          <h2>Settings</h2>
          <div class="app-meta">
            <span>Wallet &amp; Network</span>
          </div>
        </div>
      </header>

      <div class="settings-card">

        <!-- WALLET BACKUP -->
        <section class="settings-section">
          <div class="settings-section-label">
            <span class="settings-section-dot orange"></span>
            WALLET BACKUP
          </div>
          <p class="settings-section-desc">
            Export your wallet to an encrypted backup file. This is useful for recovering the wallet or migrating it to other Openswap clients.
          </p>
          <ul class="settings-backup-info">
            <li>Wallet Backup is an encrypted JSON file that contains all wallet data and swap histories.</li>
            <li>Use it to recover this wallet or migrate it to another Openswap client.</li>
            <li>Recommended to use a strong password for the backup file.</li>
            <li>Use the same password while restoring wallet from backup.</li>
          </ul>
          <button id="init-backup-btn" class="app-button primary settings-full-btn">${icons.save(15)} Create Backup</button>
          <div id="backup-form-section" style="display:none">
            <div class="settings-fields settings-backup-fields">
              <div class="settings-field">
                <label>Backup Password</label>
                <input type="password" id="backup-password-input" placeholder="Enter password" />
              </div>
              <div class="settings-field">
                <label>Confirm Password</label>
                <input type="password" id="backup-password-confirm-input" placeholder="Re-enter password" />
              </div>
            </div>
            <div id="backup-password-error" class="settings-error" style="display:none"><p></p></div>
            <button id="confirm-backup-btn" class="app-button secondary settings-full-btn">${icons.check(14)} Confirm &amp; Create Backup</button>
          </div>
        </section>

        <!-- CONNECTION STATUS -->
        <section class="settings-section settings-section-last">
          <div class="settings-section-label">
            <div id="connection-indicator" class="settings-status-dot"></div>
            CONNECTION STATUS
            <span id="rpc-status" class="settings-conn-status">Not Connected</span>
          </div>
          <div class="settings-status-grid" id="connection-status-grid">
            <div><span>Bitcoin Version</span><strong id="bitcoin-version">--</strong></div>
            <div><span>Network</span><strong id="bitcoin-network">--</strong></div>
            <div><span>Block Height</span><strong id="block-height">--</strong></div>
            <div><span>Sync Progress</span><strong id="sync-progress">--</strong></div>
          </div>
          <p class="settings-section-desc" style="margin-top:12px">
            The backend (Bitcoin Core or Electrum) is selected during first-time setup and can only be changed by restarting setup. Tor is managed automatically by the app.
          </p>
        </section>

      </div>
    </div>
  `;

  container.appendChild(content);

  // FUNCTIONS

  function showBackupError(message) {
    const errorDiv = content.querySelector('#backup-password-error');
    errorDiv.querySelector('p').textContent = message;
    errorDiv.style.display = 'block';
  }

  async function performBackup(password) {
    try {
      const saveResult = await window.api.saveFile({
        defaultPath: `openswap-wallet-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!saveResult.success || saveResult.canceled) return;

      const result = await window.api.backupWallet({
        destinationPath: saveResult.filePath,
        password: password || undefined,
      });

      if (result.success) {
        alert(`Backup created successfully!\n\nLocation: ${saveResult.filePath}`);
        // Collapse the form after success
        content.querySelector('#backup-form-section').style.display = 'none';
        content.querySelector('#backup-password-input').value = '';
        content.querySelector('#backup-password-confirm-input').value = '';
      } else {
        alert(`Backup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Backup error:', error);
      alert(`Backup failed: ${error.message}`);
    }
  }

  // EVENT LISTENERS

  // Backup: reveal form
  content.querySelector('#init-backup-btn').addEventListener('click', () => {
    const form = content.querySelector('#backup-form-section');
    const isVisible = form.style.display === 'block';
    if (isVisible) {
      form.style.display = 'none';
    } else {
      form.style.display = 'block';
      content.querySelector('#backup-password-input').focus();
    }
  });

  // Backup: confirm
  content.querySelector('#confirm-backup-btn').addEventListener('click', async () => {
    const password = content.querySelector('#backup-password-input').value;
    const confirmPassword = content.querySelector('#backup-password-confirm-input').value;

    content.querySelector('#backup-password-error').style.display = 'none';

    if (!password) { showBackupError('Please enter a backup password'); return; }
    if (password !== confirmPassword) { showBackupError('Passwords do not match'); return; }
    if (password.length < 8) { showBackupError('Password must be at least 8 characters'); return; }

    await performBackup(password);
  });

  function updateConnectionStatus(connected, info = {}) {
    const indicator = content.querySelector('#connection-indicator');
    const status = content.querySelector('#rpc-status');

    if (connected) {
      indicator.className = 'settings-status-dot ok';
      status.textContent = 'Connected';
      status.style.color = 'var(--color-success)';
      if (info.version) content.querySelector('#bitcoin-version').textContent = info.version;
      if (info.network) content.querySelector('#bitcoin-network').textContent = info.network;
      if (info.blocks) content.querySelector('#block-height').textContent = info.blocks.toLocaleString();
      if (info.verificationprogress) {
        content.querySelector('#sync-progress').textContent =
          `${(info.verificationprogress * 100).toFixed(1)}%`;
      }
    } else {
      indicator.className = 'settings-status-dot';
      status.textContent = 'Not Connected';
      status.style.color = 'var(--color-danger)';
      content.querySelector('#bitcoin-version').textContent = '--';
      content.querySelector('#bitcoin-network').textContent = '--';
      content.querySelector('#block-height').textContent = '--';
      content.querySelector('#sync-progress').textContent = '--';
    }
  }

  // INITIALIZE

  (async function checkInitialStatus() {
    let savedConfig = null;
    try {
      savedConfig = JSON.parse(localStorage.getItem('openswap_config') || 'null');
    } catch (error) {
      console.warn('Could not read saved config:', error.message);
    }

    // Electrum backend: there is no local node to poll — show the configured
    // server instead of Bitcoin Core stats.
    if (savedConfig?.backend?.type === 'electrum') {
      const indicator = content.querySelector('#connection-indicator');
      const status = content.querySelector('#rpc-status');
      indicator.className = 'settings-status-dot ok';
      status.textContent = 'Electrum';
      status.style.color = 'var(--color-success)';

      const grid = content.querySelector('#connection-status-grid');
      const backendRow = document.createElement('div');
      const backendLabel = document.createElement('span');
      backendLabel.textContent = 'Backend';
      const backendValue = document.createElement('strong');
      backendValue.textContent = 'Electrum';
      backendRow.append(backendLabel, backendValue);

      const serverRow = document.createElement('div');
      const serverLabel = document.createElement('span');
      serverLabel.textContent = 'Server';
      const serverValue = document.createElement('strong');
      serverValue.textContent = savedConfig.backend.url || '--';
      serverRow.append(serverLabel, serverValue);

      grid.replaceChildren(backendRow, serverRow);
      return;
    }

    try {
      const rpcConfig = {
        host: savedConfig?.rpc?.host || '127.0.0.1',
        port: savedConfig?.rpc?.port || 38332,
        username: savedConfig?.rpc?.username || 'user',
        password: savedConfig?.rpc?.password || 'password',
      };
      const info = await makeRPCCall(rpcConfig, 'getblockchaininfo');
      const networkInfo = await makeRPCCall(rpcConfig, 'getnetworkinfo');
      updateConnectionStatus(true, {
        version: networkInfo.subversion || 'Unknown',
        network: info.chain,
        blocks: info.blocks,
        verificationprogress: info.verificationprogress,
      });
    } catch (error) {
      console.log('Initial connection check failed:', error.message);
    }
  })();
}
