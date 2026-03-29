import { icons } from '../../js/icons.js';

export function SettingsComponent(container) {
  const content = document.createElement('div');
  content.id = 'settings-content';

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Settings</h2>
        <p class="text-gray-400 mb-8">Configure your taker wallet and Bitcoin Core connection</p>

        <div class="space-y-8">
            <!-- Wallet Backup Section -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-lg text-gray-300 mb-6">Wallet Backup</h3>
                
                <div class="space-y-4">
                    <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                        <h4 class="text-lg font-medium text-white mb-3">Create Backup</h4>
                        <p class="text-sm text-gray-400 mb-4">
                            Export your wallet to an encrypted JSON file. You can use this backup to restore your wallet on another device or after reinstallation.
                        </p>
                        
                        <button id="backup-wallet-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-3 px-4 rounded-lg transition-colors">
                            ${icons.save(16, 'mr-2')} Create Backup
                        </button>
                    </div>
                    
                    <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                        <div class="space-y-2 text-sm text-gray-400">
                            <p>• Wallet Backup is an encrypted json file that restores your coinswap wallet in any client app.</p>
                            <p>• The backup file contains all data related to swaps to restore swap histories.</p>
                            <p>• The backup file can also be used to migrate your coinswap wallet from one client app to another.</p>
                            <p>• Always use a strong password for the backup file, or else your seed phrase can be compromised.</p>
                            <p>• Use the same password while restoring wallet from backup.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Node & Network Configuration -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-lg text-gray-300 mb-6">Node & Network Configuration</h3>
                
                <div class="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
                    <div class="space-y-6">
                        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                            <h4 class="text-lg font-medium text-white mb-4">Tor</h4>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">Control Port</label>
                                    <input 
                                        type="number" 
                                        id="tor-control-port-input"
                                        value="9051"
                                        min="1024"
                                        max="65535"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">SOCKS Port</label>
                                    <input 
                                        type="number" 
                                        id="tor-socks-port-input"
                                        value="9050"
                                        min="1024"
                                        max="65535"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">Tor Auth Password</label>
                                    <div class="relative">
                                        <input 
                                            type="password" 
                                            id="tor-auth-password-input"
                                            placeholder="Optional"
                                            class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                        />
                                        <button
                                            type="button"
                                            id="toggle-tor-password"
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                            aria-label="Toggle password visibility"
                                        >
                                            <svg id="eye-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                            </svg>
                                            <svg id="eye-slash-icon" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="mt-4 flex items-center gap-3">
                                <button id="test-tor-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors">
                                    Test Tor
                                </button>
                                <div id="tor-test-result" class="hidden flex-1"></div>
                            </div>
                        </div>

                        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                            <h4 class="text-lg font-medium text-white mb-4">Bitcoin Core</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">RPC Host</label>
                                    <input 
                                        type="text" 
                                        id="rpc-host-input"
                                        value="127.0.0.1"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">RPC Port</label>
                                    <input 
                                        type="number" 
                                        id="rpc-port-input"
                                        value="38332"
                                        min="1"
                                        max="65535"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">RPC Username</label>
                                    <input 
                                        type="text" 
                                        id="rpc-username-input"
                                        value="user"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">RPC Password</label>
                                    <input 
                                        type="password" 
                                        id="rpc-password-input"
                                        placeholder="Enter RPC password"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-400 mb-2">ZMQ Port</label>
                                    <input 
                                        type="number" 
                                        id="zmq-port-input"
                                        value="28332"
                                        min="1"
                                        max="65535"
                                        class="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                                    />
                                </div>
                            </div>
                            <div class="mt-4 flex items-center gap-3">
                                <button id="test-connection-btn" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors">
                                    Test Bitcoind
                                </button>
                                <div id="bitcoind-test-result" class="hidden flex-1"></div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                            <h4 class="text-lg font-medium text-white mb-4">Connection Status</h4>
                            <div class="flex justify-between items-center mb-3">
                                <div class="flex items-center">
                                    <div id="connection-indicator" class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                    <span class="text-sm text-gray-400">RPC Status</span>
                                </div>
                                <span id="rpc-status" class="text-sm font-semibold text-lg text-red-400">Not Connected</span>
                            </div>
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Bitcoin Version</span>
                                    <span id="bitcoin-version" class="text-gray-300">--</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Network</span>
                                    <span id="bitcoin-network" class="text-gray-300">--</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Block Height</span>
                                    <span id="block-height" class="text-gray-300">--</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-500">Sync Progress</span>
                                    <span id="sync-progress" class="text-gray-300">--</span>
                                </div>
                            </div>
                        </div>

                        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                            <h4 class="text-lg font-medium text-white mb-4">Bitcoin.conf Setup</h4>
                            <div class="bg-[#111827] rounded-lg p-4 font-mono text-xs text-gray-300">
                                <div id="zmq-config-preview">
                                    zmqpubrawblock=tcp://127.0.0.1:28332<br/>
                                    zmqpubrawtx=tcp://127.0.0.1:28332
                                </div>
                            </div>
                            <button id="copy-zmq-config-btn" class="w-full mt-4 bg-[#242d3d] hover:bg-[#2d3748] text-white py-2 px-4 rounded-lg text-sm transition-colors">
                                ${icons.clipboardCopy(14, 'mr-1')} Copy ZMQ Config
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Full Bitcoin.conf Reference -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-lg text-gray-300 mb-4">Complete bitcoin.conf Reference</h3>
                
                <div class="bg-[#0f1419] rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                    <div id="full-config-preview">
[signet]<br/>
# Signet network configuration for running Coinswap Taker and Maker<br/>
# Mutinynet default signet parameters<br/>
signetchallenge=512102f7561d208dd9ae99bf497273e16f389bdbd6c4742ddb8e6b216e64fa2928ad8f51ae<br/>
addnode=45.79.52.207:38333<br/>
dnsseed=0<br/>
signetblocktime=30<br/>
# RPC Configurations for Coinswap operations<br/>
server=1<br/>
rpcuser=user<br/>
rpcpassword=password<br/>
rpcport=38332<br/>
rpcbind=127.0.0.1<br/>
rpcallowip=127.0.0.1<br/>
rest=1<br/>
# ZMQ Configurations for real-time transaction and block notifications<br/>
# Needed for the Watchers.<br/>
zmqpubrawblock=tcp://127.0.0.1:28332<br/>
zmqpubrawtx=tcp://127.0.0.1:28332<br/>
# Required indexes for faster wallet sync<br/>
txindex=1<br/>
blockfilterindex=1<br/>
<br/>
[regtest]<br/>
# Regtest network configurations for running Coinswap Taker and Maker<br/>
fallbackfee=0.00001000<br/>
# RPC Configurations for Coinswap operations<br/>
server=1<br/>
rpcuser=user<br/>
rpcpassword=password<br/>
rpcport=18442<br/>
rpcbind=127.0.0.1<br/>
rpcallowip=127.0.0.1<br/>
rest=1<br/>
# ZMQ Configurations for real-time transaction and block notifications<br/>
# Needed for the Watchers.<br/>
zmqpubrawblock=tcp://127.0.0.1:28332<br/>
zmqpubrawtx=tcp://127.0.0.1:28332<br/>
# Required indexes for faster wallet sync<br/>
txindex=1<br/>
blockfilterindex=1
</div>
                </div>
                
                <button id="copy-full-config-btn" class="mt-4 bg-[#242d3d] hover:bg-[#2d3748] text-white py-2 px-4 rounded-lg text-sm transition-colors">
                    ${icons.clipboardCopy(14, 'mr-1')} Copy Full Config
                </button>
            </div>

            <!-- Save Settings Button -->
            <div class="flex justify-end space-x-4">
                <button id="reset-settings-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold text-lg py-3 px-6 rounded-lg transition-colors border border-gray-700">
                    Reset to Defaults
                </button>
                <button id="save-settings-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-3 px-6 rounded-lg transition-colors">
                    Save Settings
                </button>
            </div>
        </div>

        <!-- Backup Password Modal -->
        <div id="backup-password-modal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 hidden">
            <div class="bg-[#1a2332] rounded-lg max-w-md w-full mx-4 p-6">
                <h3 class="text-xl font-semibold text-lg text-white mb-4">Encrypt Backup</h3>
                <p class="text-gray-400 text-sm mb-6">
                    Set a password to encrypt your wallet backup. You'll need this password to restore from this backup.
                </p>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">Backup Password</label>
                        <input 
                            type="password" 
                            id="backup-password-input"
                            placeholder="Enter backup password"
                            class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                        />
                    </div>
                    
                    <div>
                        <label class="block text-sm text-gray-400 mb-2">Confirm Password</label>
                        <input 
                            type="password" 
                            id="backup-password-confirm-input"
                            placeholder="Re-enter password"
                            class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                        />
                    </div>
                    
                    <div class="flex items-center">
                        <input 
                            type="checkbox" 
                            id="skip-backup-encryption"
                            class="mr-2"
                        />
                        <label for="skip-backup-encryption" class="text-xs text-gray-400">
                            Skip encryption (not recommended)
                        </label>
                    </div>
                    
                    <div id="backup-password-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p class="text-xs text-red-400"></p>
                    </div>
                </div>
                
                <div class="flex space-x-3 mt-6">
                    <button id="cancel-backup-btn" class="flex-1 bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold text-lg py-3 px-4 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button id="confirm-backup-btn" class="flex-1 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-3 px-4 rounded-lg transition-colors">
                        Create Backup
                    </button>
                </div>
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
    const hasFailure = results.some((result) => !result.ok);
    resultDiv.className = hasFailure
      ? 'bg-red-500/10 border border-red-500/30 rounded-lg p-3'
      : 'bg-green-500/10 border border-green-500/30 rounded-lg p-3';

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'space-y-2';

    results.forEach((result) => {
      const row = document.createElement('div');
      row.className = 'flex items-start justify-between gap-3';

      const label = document.createElement('span');
      label.className = `text-sm ${result.ok ? 'text-green-400' : 'text-red-400'}`;
      label.innerHTML = `${result.ok ? icons.checkCircle(14, 'mr-1 text-green-400') : icons.xCircle(14, 'mr-1 text-red-400')} ${result.label}`;

      const message = document.createElement('span');
      message.className = 'text-xs text-gray-400 text-right';
      message.textContent = result.message ?? '';

      row.append(label, message);
      resultsContainer.appendChild(row);
    });

    resultDiv.replaceChildren(resultsContainer);
    resultDiv.classList.remove('hidden');
  }

  // Load existing configuration and populate form fields
  function loadExistingConfig() {
    try {
      const savedConfig = localStorage.getItem('coinswap_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        console.log('📋 Loading existing config:', config);

        // Populate RPC fields
        if (config.rpc) {
          if (config.rpc.host)
            content.querySelector('#rpc-host-input').value = config.rpc.host;
          if (config.rpc.port)
            content.querySelector('#rpc-port-input').value = config.rpc.port;
          if (config.rpc.username)
            content.querySelector('#rpc-username-input').value =
              config.rpc.username;
          if (config.rpc.password)
            content.querySelector('#rpc-password-input').value =
              config.rpc.password;
        }

        // Populate Taker/Tor config fields
        if (config.taker) {
          if (config.taker.control_port)
            content.querySelector('#tor-control-port-input').value =
              config.taker.control_port;
          if (config.taker.socks_port)
            content.querySelector('#tor-socks-port-input').value =
              config.taker.socks_port;
          if (config.taker.tor_auth_password)
            content.querySelector('#tor-auth-password-input').value =
              config.taker.tor_auth_password;
        }

        // Populate ZMQ fields
        if (config.zmq) {
          const derivedPort =
            config.zmq.port ||
            extractPortFromAddress(config.zmq.rawblock || config.zmq.address);
          content.querySelector('#zmq-port-input').value = derivedPort;
        }

        // Update config previews
        updateConfigPreviews();
      }
    } catch (error) {
      console.error('Error loading existing config:', error);
    }
  }

  // Update the config preview sections
  function updateConfigPreviews() {
    const zmqPort = content.querySelector('#zmq-port-input').value || '28332';
    const rawblock = getZmqAddress(zmqPort);
    const rawtx = getZmqAddress(zmqPort);
    const rpcUser =
      content.querySelector('#rpc-username-input').value || 'user';
    const rpcPass =
      content.querySelector('#rpc-password-input').value || 'password';
    const rpcPort = content.querySelector('#rpc-port-input').value || '18442';

    // Update ZMQ config preview
    const zmqPreview = content.querySelector('#zmq-config-preview');
    if (zmqPreview) {
      zmqPreview.innerHTML = `zmqpubrawblock=${rawblock}<br/>zmqpubrawtx=${rawtx}`;
    }

    // Update full config preview
    const fullPreview = content.querySelector('#full-config-preview');
    if (fullPreview) {
      fullPreview.innerHTML = `[signet]<br/>
# Signet network configuration for running Coinswap Taker and Maker<br/>
# Mutinynet default signet parameters<br/>
signetchallenge=512102f7561d208dd9ae99bf497273e16f389bdbd6c4742ddb8e6b216e64fa2928ad8f51ae<br/>
addnode=45.79.52.207:38333<br/>
dnsseed=0<br/>
signetblocktime=30<br/>
# RPC Configurations for Coinswap operations<br/>
server=1<br/>
rpcuser=${rpcUser}<br/>
rpcpassword=${rpcPass}<br/>
rpcport=38332<br/>
rpcbind=127.0.0.1<br/>
rpcallowip=127.0.0.1<br/>
rest=1<br/>
# ZMQ Configurations for real-time transaction and block notifications<br/>
# Needed for the Watchers.<br/>
zmqpubrawblock=${rawblock}<br/>
zmqpubrawtx=${rawtx}<br/>
# Required indexes for faster wallet sync<br/>
txindex=1<br/>
blockfilterindex=1<br/>
<br/>
[regtest]<br/>
# Regtest network configurations for running Coinswap Taker and Maker<br/>
fallbackfee=0.00001000<br/>
# RPC Configurations for Coinswap operations<br/>
server=1<br/>
rpcuser=${rpcUser}<br/>
rpcpassword=${rpcPass}<br/>
rpcport=${rpcPort}<br/>
rpcbind=127.0.0.1<br/>
rpcallowip=127.0.0.1<br/>
rest=1<br/>
# ZMQ Configurations for real-time transaction and block notifications<br/>
# Needed for the Watchers.<br/>
zmqpubrawblock=${rawblock}<br/>
zmqpubrawtx=${rawtx}<br/>
# Required indexes for faster wallet sync<br/>
txindex=1<br/>
blockfilterindex=1`;
    }
  }

  // Show backup password modal
  function showBackupModal() {
    const modal = content.querySelector('#backup-password-modal');
    modal.classList.remove('hidden');
    content.querySelector('#backup-password-input').value = '';
    content.querySelector('#backup-password-confirm-input').value = '';
    content.querySelector('#skip-backup-encryption').checked = false;
    content.querySelector('#backup-password-error').classList.add('hidden');
  }

  // Hide backup password modal
  function hideBackupModal() {
    content.querySelector('#backup-password-modal').classList.add('hidden');
  }

  // Perform wallet backup
  async function performBackup(password) {
    try {
      // First, open save dialog
      const saveResult = await window.api.saveFile({
        defaultPath: `coinswap-wallet-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!saveResult.success || saveResult.canceled) {
        return;
      }

      const destinationPath = saveResult.filePath;

      // Call backup API
      const result = await window.api.backupWallet({
        destinationPath,
        password: password || undefined,
      });

      if (result.success) {
        alert(
          `Backup created successfully!\n\nLocation: ${destinationPath}`
        );
      } else {
        alert(`Backup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Backup error:', error);
      alert(`Backup failed: ${error.message}`);
    }
  }

  // EVENT LISTENERS

  // Backup wallet button
  content.querySelector('#backup-wallet-btn').addEventListener('click', () => {
    showBackupModal();
  });

  // Skip encryption checkbox
  content
    .querySelector('#skip-backup-encryption')
    .addEventListener('change', (e) => {
      const passwordInputs = content.querySelectorAll(
        '#backup-password-input, #backup-password-confirm-input'
      );
      passwordInputs.forEach((input) => {
        input.disabled = e.target.checked;
        if (e.target.checked) {
          input.value = '';
        }
      });
    });

  // Cancel backup
  content.querySelector('#cancel-backup-btn').addEventListener('click', () => {
    hideBackupModal();
  });

  // Confirm backup
  content
    .querySelector('#confirm-backup-btn')
    .addEventListener('click', async () => {
      const password = content.querySelector('#backup-password-input').value;
      const confirmPassword = content.querySelector(
        '#backup-password-confirm-input'
      ).value;
      const skipEncryption = content.querySelector(
        '#skip-backup-encryption'
      ).checked;
      const errorDiv = content.querySelector('#backup-password-error');

      // Validate
      if (!skipEncryption) {
        if (!password) {
          errorDiv.querySelector('p').textContent =
            'Please enter a password or check "Skip encryption"';
          errorDiv.classList.remove('hidden');
          return;
        }

        if (password !== confirmPassword) {
          errorDiv.querySelector('p').textContent = 'Passwords do not match';
          errorDiv.classList.remove('hidden');
          return;
        }

        if (password.length < 8) {
          errorDiv.querySelector('p').textContent =
            'Password must be at least 8 characters';
          errorDiv.classList.remove('hidden');
          return;
        }
      }

      hideBackupModal();
      await performBackup(skipEncryption ? '' : password);
    });

  // Config input changes - update previews
  content.querySelector('#zmq-port-input').addEventListener('input', updateConfigPreviews);
  content
    .querySelector('#rpc-username-input')
    .addEventListener('input', updateConfigPreviews);
  content
    .querySelector('#rpc-password-input')
    .addEventListener('input', updateConfigPreviews);
  content
    .querySelector('#rpc-port-input')
    .addEventListener('input', updateConfigPreviews);

  // Copy ZMQ config
  content
    .querySelector('#copy-zmq-config-btn')
    .addEventListener('click', async () => {
      const zmqPort = content.querySelector('#zmq-port-input').value || '28332';
      const rawblock = getZmqAddress(zmqPort);
      const rawtx = getZmqAddress(zmqPort);
      const configText = `zmqpubrawblock=${rawblock}\nzmqpubrawtx=${rawtx}`;

      try {
        await navigator.clipboard.writeText(configText);
        const btn = content.querySelector('#copy-zmq-config-btn');
        const originalText = btn.textContent;
        btn.innerHTML = icons.check(14, 'mr-1') + ' Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

  // Copy full config
  content
    .querySelector('#copy-full-config-btn')
    .addEventListener('click', async () => {
      const zmqPort = content.querySelector('#zmq-port-input').value || '28332';
      const rawblock = getZmqAddress(zmqPort);
      const rawtx = getZmqAddress(zmqPort);
      const rpcUser =
        content.querySelector('#rpc-username-input').value || 'user';
      const rpcPass =
        content.querySelector('#rpc-password-input').value || 'password';
      const rpcPort = content.querySelector('#rpc-port-input').value || '38332';

      const configText = `# ========================================
# SIGNET CONFIGURATION
# ========================================
[signet]
signetchallenge=512102f7561d208dd9ae99bf497273e16f389bdbd6c4742ddb8e6b216e64fa2928ad8f51ae
addnode=45.79.52.207:38333
dnsseed=0
signetblocktime=30
rpcuser=${rpcUser}
rpcpassword=${rpcPass}
server=1
txindex=1
blockfilterindex=1
rpcport=38332
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rest=1
zmqpubrawblock=${rawblock}
zmqpubrawtx=${rawtx}

# ========================================
# REGTEST CONFIGURATION
# ========================================
[regtest]
rpcuser=${rpcUser}
rpcpassword=${rpcPass}
fallbackfee=0.00001000
server=1
txindex=1
blockfilterindex=1
rpcport=18442
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rest=1
zmqpubrawblock=${rawblock}
zmqpubrawtx=${rawtx}`;
      try {
        await navigator.clipboard.writeText(configText);
        const btn = content.querySelector('#copy-full-config-btn');
        const originalText = btn.textContent;
        btn.innerHTML = icons.check(14, 'mr-1') + ' Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

  function updateConnectionStatus(connected, info = {}) {
    const indicator = content.querySelector('#connection-indicator');
    const status = content.querySelector('#rpc-status');

    if (connected) {
      indicator.className = 'w-3 h-3 bg-green-500 rounded-full mr-2';
      status.textContent = 'Connected';
      status.className = 'text-sm font-semibold text-lg text-green-400';

      if (info.version)
        content.querySelector('#bitcoin-version').textContent = info.version;
      if (info.network)
        content.querySelector('#bitcoin-network').textContent = info.network;
      if (info.blocks)
        content.querySelector('#block-height').textContent =
          info.blocks.toLocaleString();
      if (info.verificationprogress) {
        const progress = (info.verificationprogress * 100).toFixed(1);
        content.querySelector('#sync-progress').textContent = `${progress}%`;
      }
    } else {
      indicator.className = 'w-3 h-3 bg-red-500 rounded-full mr-2';
      status.textContent = 'Not Connected';
      status.className = 'text-sm font-semibold text-lg text-red-400';

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

    if (!username || !password) {
      throw new Error('RPC username and password are required');
    }

    const url = getRpcUrl(host, port);
    const auth = btoa(`${username}:${password}`);

    const body = {
      jsonrpc: '1.0',
      id: Date.now(),
      method: method,
      params: params,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - check RPC username/password');
      } else if (response.status === 404) {
        throw new Error('Bitcoin Core RPC not found - is bitcoind running?');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`);
    }

    return data.result;
  }

  async function testTorConnection() {
    const btn = content.querySelector('#test-tor-btn');
    const resultDiv = content.querySelector('#tor-test-result');
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    const socksPort = parseInt(
      content.querySelector('#tor-socks-port-input').value,
      10
    );
    const controlPort = parseInt(
      content.querySelector('#tor-control-port-input').value,
      10
    );

    try {
      const [socksResult, controlResult] = await Promise.all([
        window.api.testTcpPort({ host: '127.0.0.1', port: socksPort }),
        window.api.testTcpPort({ host: '127.0.0.1', port: controlPort }),
      ]);

      renderConnectionResults(resultDiv, [
        {
          label: 'SOCKS Port',
          ok: Boolean(socksResult?.success),
          message: socksResult?.success
            ? `Port ${socksPort} reachable`
            : socksResult?.error,
        },
        {
          label: 'Control Port',
          ok: Boolean(controlResult?.success),
          message: controlResult?.success
            ? `Port ${controlPort} reachable`
            : controlResult?.error,
        },
      ]);
    } catch (error) {
      console.error('Tor test failed:', error);
      renderConnectionResults(resultDiv, [
        {
          label: 'Tor Connection',
          ok: false,
          message: error.message || String(error),
        },
      ]);
    }

    btn.textContent = originalText;
    btn.disabled = false;
  }

  async function testBitcoindConnection() {
    const btn = content.querySelector('#test-connection-btn');
    const resultDiv = content.querySelector('#bitcoind-test-result');
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    const host = content.querySelector('#rpc-host-input').value;
    const port = content.querySelector('#rpc-port-input').value;
    const zmqPort = parseInt(content.querySelector('#zmq-port-input').value, 10);

    try {
      const [blockchainInfo, networkInfo, restResponse, zmqResult] =
        await Promise.allSettled([
          makeRPCCall('getblockchaininfo'),
          makeRPCCall('getnetworkinfo'),
          fetch(getRestUrl(host, port)),
          window.api.testTcpPort({ host: '127.0.0.1', port: zmqPort }),
        ]);

      const rpcOk =
        blockchainInfo.status === 'fulfilled' &&
        networkInfo.status === 'fulfilled';
      const chain =
        blockchainInfo.status === 'fulfilled'
          ? blockchainInfo.value?.chain || 'unknown'
          : null;
      const blocks =
        blockchainInfo.status === 'fulfilled'
          ? blockchainInfo.value?.blocks || 0
          : null;
      const version =
        networkInfo.status === 'fulfilled'
          ? networkInfo.value?.subversion || 'Unknown'
          : null;
      const restOk =
        restResponse.status === 'fulfilled' && restResponse.value.ok;
      const zmqOk =
        zmqResult.status === 'fulfilled' && Boolean(zmqResult.value?.success);

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
      console.error('Bitcoind test failed:', error);
      updateConnectionStatus(false);
      renderConnectionResults(resultDiv, [
        {
          label: 'Bitcoind Test',
          ok: false,
          message: error.message || String(error),
        },
      ]);
    }

    btn.textContent = originalText;
    btn.disabled = false;
  }

  // Toggle password visibility
  content
    .querySelector('#toggle-tor-password')
    .addEventListener('click', () => {
      const passwordInput = content.querySelector('#tor-auth-password-input');
      const eyeIcon = content.querySelector('#eye-icon');
      const eyeSlashIcon = content.querySelector('#eye-slash-icon');

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.add('hidden');
        eyeSlashIcon.classList.remove('hidden');
      } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('hidden');
        eyeSlashIcon.classList.add('hidden');
      }
    });

  content
    .querySelector('#test-connection-btn')
    .addEventListener('click', testBitcoindConnection);
  content.querySelector('#test-tor-btn').addEventListener('click', testTorConnection);

  // Build config object from form values
  function buildConfig() {
    // Get existing config to preserve wallet info
    let existingConfig = {};
    try {
      const saved = localStorage.getItem('coinswap_config');
      if (saved) {
        existingConfig = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading existing config:', e);
    }

    const zmqPortInput = content.querySelector('#zmq-port-input').value.trim();
    const zmqPort = parseInt(zmqPortInput, 10);
    const hasValidZmqPort = Number.isInteger(zmqPort) && zmqPort > 0;

    return {
      ...existingConfig, // Preserve wallet config
      rpc: {
        host: content.querySelector('#rpc-host-input').value,
        port: parseInt(content.querySelector('#rpc-port-input').value),
        username: content.querySelector('#rpc-username-input').value,
        password: content.querySelector('#rpc-password-input').value,
      },
      taker: {
        control_port: parseInt(
          content.querySelector('#tor-control-port-input').value
        ),
        socks_port: parseInt(
          content.querySelector('#tor-socks-port-input').value
        ),
        tor_auth_password:
          content.querySelector('#tor-auth-password-input').value || undefined,
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

  // Save settings
  content.querySelector('#save-settings-btn').addEventListener('click', () => {
    const updatedConfig = buildConfig();

    // Save to localStorage
    localStorage.setItem('coinswap_config', JSON.stringify(updatedConfig));
    console.log('💾 Settings saved:', updatedConfig);

    // Show success feedback
    const btn = content.querySelector('#save-settings-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.classList.remove('bg-[#FF6B35]', 'hover:bg-[#ff7d4d]');
    btn.classList.add('bg-green-600', 'hover:bg-green-700');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('bg-green-600', 'hover:bg-green-700');
      btn.classList.add('bg-[#FF6B35]', 'hover:bg-[#ff7d4d]');
    }, 2000);
  });

  // Reset settings
  content.querySelector('#reset-settings-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      // Reset Tor config fields
      content.querySelector('#tor-control-port-input').value = '9051';
      content.querySelector('#tor-socks-port-input').value = '9050';
      content.querySelector('#tor-auth-password-input').value = '';

      // Reset RPC fields
      content.querySelector('#rpc-host-input').value = '127.0.0.1';
      content.querySelector('#rpc-port-input').value = '38332';
      content.querySelector('#rpc-username-input').value = 'user';
      content.querySelector('#rpc-password-input').value = '';

      // Reset ZMQ field
      content.querySelector('#zmq-port-input').value = '28332';

      // Update previews
      updateConfigPreviews();
      updateConnectionStatus(false);

      alert('Settings reset to defaults');
    }
  });

  // INITIALIZE
  loadExistingConfig();
  updateConfigPreviews();

  // Auto-check connection status on page load
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
