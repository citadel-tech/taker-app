import { icons } from '../../js/icons.js';

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
        <div class="app-actions">
          <button id="reset-settings-btn" class="app-button ghost">Reset to Defaults</button>
          <button id="save-settings-btn" class="app-button primary">${icons.save(14)} Save Settings</button>
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
            Export your wallet to an encrypted backup file. This is useful for recovering the wallet or migrating it to other Coinswap clients.
          </p>
          <ul class="settings-backup-info">
            <li>Wallet Backup is an encrypted JSON file that contains all wallet data and swap histories.</li>
            <li>Use it to recover this wallet or migrate it to another Coinswap client.</li>
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
        <section class="settings-section">
          <div class="settings-section-label">
            <div id="connection-indicator" class="settings-status-dot"></div>
            CONNECTION STATUS
            <span id="rpc-status" class="settings-conn-status">Not Connected</span>
          </div>
          <div class="settings-status-grid">
            <div><span>Bitcoin Version</span><strong id="bitcoin-version">--</strong></div>
            <div><span>Network</span><strong id="bitcoin-network">--</strong></div>
            <div><span>Block Height</span><strong id="block-height">--</strong></div>
            <div><span>Sync Progress</span><strong id="sync-progress">--</strong></div>
          </div>
        </section>

        <!-- BITCOIN CORE RPC -->
        <section class="settings-section">
          <div class="settings-section-label">
            <span class="settings-section-dot"></span>
            BITCOIN CORE RPC
          </div>
          <div class="settings-inner-grid">
            <div>
              <div class="settings-fields" style="--cols:2">
                <div class="settings-field">
                  <label>RPC Host</label>
                  <input type="text" id="rpc-host-input" value="127.0.0.1" />
                </div>
                <div class="settings-field">
                  <label>RPC Port</label>
                  <input type="number" id="rpc-port-input" value="38332" min="1" max="65535" />
                </div>
                <div class="settings-field">
                  <label>RPC Username</label>
                  <input type="text" id="rpc-username-input" value="user" />
                </div>
                <div class="settings-field">
                  <label>RPC Password</label>
                  <input type="password" id="rpc-password-input" placeholder="Enter RPC password" />
                </div>
              </div>
              <div class="settings-field settings-zmq-field">
                <label>ZMQ Port</label>
                <input type="number" id="zmq-port-input" value="28332" min="1" max="65535" />
              </div>
              <div class="settings-test-bar">
                <button id="test-connection-btn" class="app-button secondary sm">Test Bitcoind</button>
                <div id="bitcoind-test-result" class="settings-test-result" style="display:none"></div>
              </div>
            </div>
            <div>
              <div class="settings-readonly-label">
                bitcoin.conf snippet
                <span>READ-ONLY</span>
              </div>
              <div class="settings-code" id="zmq-config-preview">zmqpubrawblock=tcp://127.0.0.1:28332<br/>zmqpubrawtx=tcp://127.0.0.1:28332</div>
              <button id="copy-zmq-config-btn" class="app-button ghost sm settings-full-btn" style="margin-top:10px">${icons.clipboardCopy(13)} Copy ZMQ Config</button>
              <a id="bitcoin-guide-link" href="https://github.com/citadel-tech/coinswap/blob/master/docs/bitcoind.md" target="_blank" rel="noreferrer" class="settings-link" style="margin-top:10px">
                ${icons.externalLink(14)} Bitcoin Core setup guide
                <span class="settings-link-kicker">coinswap docs →</span>
              </a>
            </div>
          </div>
        </section>

        <!-- TOR -->
        <section class="settings-section settings-section-last">
          <div class="settings-section-label">
            <span class="settings-section-dot purple"></span>
            TOR
          </div>
          <div class="settings-fields" style="--cols:3">
            <div class="settings-field">
              <label>Control Port</label>
              <input type="number" id="tor-control-port-input" value="9051" min="1024" max="65535" />
            </div>
            <div class="settings-field">
              <label>SOCKS Port</label>
              <input type="number" id="tor-socks-port-input" value="9050" min="1024" max="65535" />
            </div>
            <div class="settings-field">
              <label>Auth Password</label>
              <div class="settings-password">
                <input type="password" id="tor-auth-password-input" placeholder="Optional" />
                <button type="button" id="toggle-tor-password" class="settings-eye-btn" aria-label="Toggle password visibility">
                  <svg id="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                  <svg id="eye-slash-icon" style="display:none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="settings-test-bar">
            <button id="test-tor-btn" class="app-button secondary sm">Test Tor</button>
            <div id="tor-test-result" class="settings-test-result" style="display:none"></div>
          </div>
        </section>

      </div>
    </div>
  `;

  container.appendChild(content);

  // FUNCTIONS

  function getRpcUrl(host, port) {
    return `http://${host}:${port}`;
  }

  function getRestUrl(host, port) {
    return `${getRpcUrl(host, port)}/rest/chaininfo.json`;
  }

  function getZmqAddress(port) {
    return `tcp://127.0.0.1:${port}`;
  }

  function extractPortFromAddress(address, fallback = '28332') {
    if (!address) return fallback;
    const match = String(address).match(/:(\d+)$/);
    return match ? match[1] : fallback;
  }

  function renderConnectionResults(resultDiv, results) {
    const hasFailure = results.some((r) => !r.ok);
    resultDiv.className = `settings-test-result ${hasFailure ? 'error' : 'ok'}`;
    resultDiv.style.display = 'block';

    const wrap = document.createElement('div');
    wrap.className = 'settings-test-rows';

    results.forEach((result) => {
      const row = document.createElement('div');
      row.className = 'settings-test-row';

      const label = document.createElement('span');
      label.className = result.ok ? 'ok' : 'error';
      label.innerHTML = `${result.ok ? icons.checkCircle(13) : icons.xCircle(13)} ${result.label}`;

      const msg = document.createElement('span');
      msg.className = 'settings-test-msg';
      msg.textContent = result.message ?? '';

      row.append(label, msg);
      wrap.appendChild(row);
    });

    resultDiv.replaceChildren(wrap);
  }

  function loadExistingConfig() {
    try {
      const savedConfig = localStorage.getItem('coinswap_config');
      if (!savedConfig) return;
      const config = JSON.parse(savedConfig);

      if (config.rpc) {
        if (config.rpc.host) content.querySelector('#rpc-host-input').value = config.rpc.host;
        if (config.rpc.port) content.querySelector('#rpc-port-input').value = config.rpc.port;
        if (config.rpc.username) content.querySelector('#rpc-username-input').value = config.rpc.username;
        if (config.rpc.password) content.querySelector('#rpc-password-input').value = config.rpc.password;
      }

      if (config.taker) {
        if (config.taker.control_port)
          content.querySelector('#tor-control-port-input').value = config.taker.control_port;
        if (config.taker.socks_port)
          content.querySelector('#tor-socks-port-input').value = config.taker.socks_port;
        if (config.taker.tor_auth_password)
          content.querySelector('#tor-auth-password-input').value = config.taker.tor_auth_password;
      }

      if (config.zmq) {
        const derivedPort =
          config.zmq.port || extractPortFromAddress(config.zmq.rawblock || config.zmq.address);
        content.querySelector('#zmq-port-input').value = derivedPort;
      }

      updateConfigPreviews();
    } catch (error) {
      console.error('Error loading existing config:', error);
    }
  }

  function updateConfigPreviews() {
    const zmqPort = content.querySelector('#zmq-port-input').value || '28332';
    const zmqPreview = content.querySelector('#zmq-config-preview');
    if (zmqPreview) {
      zmqPreview.innerHTML = `zmqpubrawblock=${getZmqAddress(zmqPort)}<br/>zmqpubrawtx=${getZmqAddress(zmqPort)}`;
    }
  }

  function showBackupError(message) {
    const errorDiv = content.querySelector('#backup-password-error');
    errorDiv.querySelector('p').textContent = message;
    errorDiv.style.display = 'block';
  }

  async function performBackup(password) {
    try {
      const saveResult = await window.api.saveFile({
        defaultPath: `coinswap-wallet-backup-${new Date().toISOString().split('T')[0]}.json`,
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

  // ZMQ preview: update on input changes
  content.querySelector('#zmq-port-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#rpc-username-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#rpc-password-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#rpc-port-input').addEventListener('input', updateConfigPreviews);

  // Copy ZMQ config
  content.querySelector('#copy-zmq-config-btn').addEventListener('click', async () => {
    const zmqPort = content.querySelector('#zmq-port-input').value || '28332';
    const configText = `zmqpubrawblock=${getZmqAddress(zmqPort)}\nzmqpubrawtx=${getZmqAddress(zmqPort)}`;
    try {
      await navigator.clipboard.writeText(configText);
      const btn = content.querySelector('#copy-zmq-config-btn');
      const orig = btn.innerHTML;
      btn.innerHTML = icons.check(13) + ' Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  // Bitcoin guide link (Electron-aware)
  content.querySelector('#bitcoin-guide-link').addEventListener('click', (e) => {
    e.preventDefault();
    const url = e.currentTarget.href;
    if (typeof require !== 'undefined') {
      try {
        const { shell } = require('electron');
        shell.openExternal(url);
        return;
      } catch (err) {
        console.warn('Falling back to window.open:', err);
      }
    }
    window.open(url, '_blank');
  });

  // Tor password toggle
  content.querySelector('#toggle-tor-password').addEventListener('click', () => {
    const passwordInput = content.querySelector('#tor-auth-password-input');
    const eyeIcon = content.querySelector('#eye-icon');
    const eyeSlashIcon = content.querySelector('#eye-slash-icon');
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.style.display = 'none';
      eyeSlashIcon.style.display = '';
    } else {
      passwordInput.type = 'password';
      eyeIcon.style.display = '';
      eyeSlashIcon.style.display = 'none';
    }
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

  async function makeRPCCall(method, params = []) {
    const host = content.querySelector('#rpc-host-input').value;
    const port = content.querySelector('#rpc-port-input').value;
    const username = content.querySelector('#rpc-username-input').value;
    const password = content.querySelector('#rpc-password-input').value;

    if (!username || !password) throw new Error('RPC username and password are required');

    const response = await fetch(getRpcUrl(host, port), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({ jsonrpc: '1.0', id: Date.now(), method, params }),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Authentication failed - check RPC username/password');
      if (response.status === 404) throw new Error('Bitcoin Core RPC not found - is bitcoind running?');
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(`RPC Error: ${data.error.message}`);
    return data.result;
  }

  async function testTorConnection() {
    const btn = content.querySelector('#test-tor-btn');
    const resultDiv = content.querySelector('#tor-test-result');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Testing...';
    btn.disabled = true;

    const socksPort = parseInt(content.querySelector('#tor-socks-port-input').value, 10);
    const controlPort = parseInt(content.querySelector('#tor-control-port-input').value, 10);

    try {
      const [socksResult, controlResult] = await Promise.all([
        window.api.testTcpPort({ host: '127.0.0.1', port: socksPort }),
        window.api.testTcpPort({ host: '127.0.0.1', port: controlPort }),
      ]);

      renderConnectionResults(resultDiv, [
        {
          label: 'SOCKS Port',
          ok: Boolean(socksResult?.success),
          message: socksResult?.success ? `Port ${socksPort} reachable` : socksResult?.error,
        },
        {
          label: 'Control Port',
          ok: Boolean(controlResult?.success),
          message: controlResult?.success ? `Port ${controlPort} reachable` : controlResult?.error,
        },
      ]);
    } catch (error) {
      renderConnectionResults(resultDiv, [
        { label: 'Tor Connection', ok: false, message: error.message || String(error) },
      ]);
    }

    btn.innerHTML = orig;
    btn.disabled = false;
  }

  async function testBitcoindConnection() {
    const btn = content.querySelector('#test-connection-btn');
    const resultDiv = content.querySelector('#bitcoind-test-result');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Testing...';
    btn.disabled = true;

    const host = content.querySelector('#rpc-host-input').value;
    const port = content.querySelector('#rpc-port-input').value;
    const zmqPort = parseInt(content.querySelector('#zmq-port-input').value, 10);

    try {
      const [blockchainInfo, networkInfo, restResponse, zmqResult] = await Promise.allSettled([
        makeRPCCall('getblockchaininfo'),
        makeRPCCall('getnetworkinfo'),
        fetch(getRestUrl(host, port)),
        window.api.testTcpPort({ host: '127.0.0.1', port: zmqPort }),
      ]);

      const rpcOk = blockchainInfo.status === 'fulfilled' && networkInfo.status === 'fulfilled';
      const chain = rpcOk ? blockchainInfo.value?.chain || 'unknown' : null;
      const blocks = rpcOk ? blockchainInfo.value?.blocks || 0 : null;
      const version = rpcOk ? networkInfo.value?.subversion || 'Unknown' : null;
      const restOk = restResponse.status === 'fulfilled' && restResponse.value.ok;
      const zmqOk = zmqResult.status === 'fulfilled' && Boolean(zmqResult.value?.success);

      renderConnectionResults(resultDiv, [
        {
          label: 'RPC',
          ok: rpcOk,
          message: rpcOk
            ? `${version} • ${chain} • ${blocks.toLocaleString()} blocks`
            : blockchainInfo.reason?.message || networkInfo.reason?.message,
        },
        {
          label: 'REST',
          ok: restOk,
          message: restOk
            ? `${getRestUrl(host, port)} reachable`
            : restResponse.status === 'fulfilled'
              ? `HTTP ${restResponse.value.status}: ${restResponse.value.statusText}`
              : restResponse.reason?.message,
        },
        {
          label: 'ZMQ',
          ok: zmqOk,
          message: zmqOk
            ? `Port ${zmqPort} reachable`
            : zmqResult.status === 'fulfilled'
              ? zmqResult.value?.error
              : zmqResult.reason?.message,
        },
      ]);

      if (rpcOk) {
        updateConnectionStatus(true, {
          version,
          network: chain,
          blocks,
          verificationprogress: blockchainInfo.value?.verificationprogress,
        });
      } else {
        updateConnectionStatus(false);
      }
    } catch (error) {
      updateConnectionStatus(false);
      renderConnectionResults(resultDiv, [
        { label: 'Bitcoind Test', ok: false, message: error.message || String(error) },
      ]);
    }

    btn.innerHTML = orig;
    btn.disabled = false;
  }

  content.querySelector('#test-connection-btn').addEventListener('click', testBitcoindConnection);
  content.querySelector('#test-tor-btn').addEventListener('click', testTorConnection);

  function buildConfig() {
    let existingConfig = {};
    try {
      const saved = localStorage.getItem('coinswap_config');
      if (saved) existingConfig = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading existing config:', e);
    }

    const zmqPortInput = content.querySelector('#zmq-port-input').value.trim();
    const zmqPort = parseInt(zmqPortInput, 10);
    const hasValidZmqPort = Number.isInteger(zmqPort) && zmqPort > 0;

    return {
      ...existingConfig,
      rpc: {
        host: content.querySelector('#rpc-host-input').value,
        port: parseInt(content.querySelector('#rpc-port-input').value),
        username: content.querySelector('#rpc-username-input').value,
        password: content.querySelector('#rpc-password-input').value,
      },
      taker: {
        control_port: parseInt(content.querySelector('#tor-control-port-input').value),
        socks_port: parseInt(content.querySelector('#tor-socks-port-input').value),
        tor_auth_password: content.querySelector('#tor-auth-password-input').value || undefined,
      },
      zmq: hasValidZmqPort
        ? {
            port: zmqPort,
            rawblock: getZmqAddress(zmqPort),
            rawtx: getZmqAddress(zmqPort),
            address: getZmqAddress(zmqPort),
          }
        : {},
      setupComplete: true,
      setupDate: existingConfig.setupDate || new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
  }

  content.querySelector('#save-settings-btn').addEventListener('click', () => {
    localStorage.setItem('coinswap_config', JSON.stringify(buildConfig()));
    const btn = content.querySelector('#save-settings-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = icons.check(14) + ' Saved!';
    btn.classList.replace('primary', 'settings-saved');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.replace('settings-saved', 'primary');
    }, 2000);
  });

  content.querySelector('#reset-settings-btn').addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    content.querySelector('#tor-control-port-input').value = '9051';
    content.querySelector('#tor-socks-port-input').value = '9050';
    content.querySelector('#tor-auth-password-input').value = '';
    content.querySelector('#rpc-host-input').value = '127.0.0.1';
    content.querySelector('#rpc-port-input').value = '38332';
    content.querySelector('#rpc-username-input').value = 'user';
    content.querySelector('#rpc-password-input').value = '';
    content.querySelector('#zmq-port-input').value = '28332';
    updateConfigPreviews();
    updateConnectionStatus(false);
    alert('Settings reset to defaults');
  });

  // INITIALIZE
  loadExistingConfig();
  updateConfigPreviews();

  (async function checkInitialStatus() {
    try {
      const info = await makeRPCCall('getblockchaininfo');
      const networkInfo = await makeRPCCall('getnetworkinfo');
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
