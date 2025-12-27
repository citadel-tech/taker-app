export function SettingsComponent(container) {
  const content = document.createElement('div');
  content.id = 'settings-content';

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Settings</h2>
        <p class="text-gray-400 mb-8">Configure your taker wallet and Bitcoin Core connection</p>

        <div class="space-y-8">
            <!-- Wallet Backup Section -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-6">Wallet Backup</h3>
                
                <div class="space-y-4">
                    <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                        <h4 class="text-lg font-medium text-white mb-3">Create Backup</h4>
                        <p class="text-sm text-gray-400 mb-4">
                            Export your wallet to an encrypted JSON file. You can use this backup to restore your wallet on another device or after reinstallation.
                        </p>
                        
                        <button id="backup-wallet-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            💾 Create Backup
                        </button>
                    </div>
                    
                    <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p class="text-xs text-blue-400">
                            <strong>💡 Backup Tips:</strong>
                        </p>
                        <ul class="text-xs text-blue-400 mt-2 space-y-1">
                            <li>• Store your backup file in a safe location (external drive, cloud storage)</li>
                            <li>• Remember your backup password - you'll need it to restore</li>
                            <li>• Create regular backups after significant transactions</li>
                            <li>• Keep multiple backup copies in different locations</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Taker Configuration Section -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-6">Taker Configuration</h3>
                
                <div class="space-y-4">
                    <h4 class="text-lg font-medium text-white mb-4">Tor Configuration</h4>
                    
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">Control Port</label>
                            <input 
                                type="number" 
                                id="tor-control-port-input"
                                value="9051"
                                min="1024"
                                max="65535"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">Control port for Tor interface</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">SOCKS Port</label>
                            <input 
                                type="number" 
                                id="tor-socks-port-input"
                                value="9050"
                                min="1024"
                                max="65535"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">SOCKS port for Tor proxy</p>
                        </div>
                        
                        <div>
    <label class="block text-sm text-gray-400 mb-2">Tor Auth Password</label>
    <div class="relative">
        <input 
            type="password" 
            id="tor-auth-password-input"
            placeholder="Enter Tor authentication password (optional)"
            class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
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
    <p class="text-xs text-gray-500 mt-1">Authentication password for Tor interface</p>
</div>
                    </div>
                    
                    <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mt-4">
                        <p class="text-xs text-purple-400">
                            <strong>🧅 Tor Network:</strong> Coinswap uses Tor for private maker discovery and communication. Make sure Tor is running on your system.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Bitcoin Core RPC Configuration -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-6">Bitcoin Core RPC Configuration</h3>
                
                <div class="grid grid-cols-2 gap-6">
                    <!-- RPC Connection Settings -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Connection Settings</h4>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">RPC Host</label>
                            <input 
                                type="text" 
                                id="rpc-host-input"
                                value="127.0.0.1"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">Bitcoin Core RPC host address</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">RPC Port</label>
                            <input 
                                type="number" 
                                id="rpc-port-input"
                                value="38332"
                                min="1"
                                max="65535"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">Bitcoin Core RPC port (8332 for mainnet, 18332 for testnet, 38332 for regtest)</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">RPC Username</label>
                            <input 
                                type="text" 
                                id="rpc-username-input"
                                value="user"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">RPC username from bitcoin.conf</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">RPC Password</label>
                            <input 
                                type="password" 
                                id="rpc-password-input"
                                placeholder="Enter RPC password"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">RPC password from bitcoin.conf</p>
                        </div>
                    </div>
                    
                    <!-- RPC Status & Testing -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Connection Status</h4>
                        
                        <div class="bg-[#0f1419] rounded-lg p-4">
                            <div class="flex justify-between items-center mb-3">
                                <div class="flex items-center">
                                    <div id="connection-indicator" class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                    <span class="text-sm text-gray-400">Connection Status</span>
                                </div>
                                <span id="rpc-status" class="text-sm font-semibold text-red-400">Not Connected</span>
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
                        
                        <div class="space-y-3">
                            <button id="test-connection-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                                Test Connection
                            </button>
                            
                            <div class="grid grid-cols-2 gap-2">
                                <button id="connect-btn" class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                    Connect
                                </button>
                                <button id="disconnect-btn" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors" disabled>
                                    Disconnect
                                </button>
                            </div>
                            
                            <button id="refresh-status-btn" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                                Refresh Status
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ZMQ Configuration -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-6">ZMQ Configuration</h3>
                
                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">ZMQ Endpoints</h4>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">ZMQ Raw Block</label>
                            <input 
                                type="text" 
                                id="zmq-rawblock-input"
                                value="tcp://127.0.0.1:28332"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">ZMQ endpoint for raw block notifications</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">ZMQ Raw Transaction</label>
                            <input 
                                type="text" 
                                id="zmq-rawtx-input"
                                value="tcp://127.0.0.1:28332"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">ZMQ endpoint for raw transaction notifications</p>
                        </div>
                        
                        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                            <p class="text-xs text-yellow-400">
                                ⚠️ <strong>Note:</strong> Both ZMQ ports should be set to 28332 for proper operation.
                            </p>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Bitcoin.conf Setup</h4>
                        
                        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                            <p class="text-xs text-yellow-400 mb-2">
                                ⚠️ <strong>ZMQ Required:</strong> Bitcoin Core must have ZMQ enabled for real-time notifications.
                            </p>
                            <p class="text-xs text-gray-400">Add these lines to your bitcoin.conf:</p>
                        </div>
                        
                        <div class="bg-[#0f1419] rounded-lg p-4 font-mono text-xs text-gray-300">
                            <div id="zmq-config-preview">
                                zmqpubrawblock=tcp://127.0.0.1:28332<br/>
                                zmqpubrawtx=tcp://127.0.0.1:28332
                            </div>
                        </div>
                        
                        <button id="copy-zmq-config-btn" class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-white py-2 px-4 rounded-lg text-sm transition-colors">
                            📋 Copy ZMQ Config
                        </button>
                        
                        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <p class="text-xs text-blue-400">
                                💡 After adding ZMQ config, restart Bitcoin Core for changes to take effect.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Full Bitcoin.conf Reference -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-4">Complete bitcoin.conf Reference</h3>
                
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
                    📋 Copy Full Config
                </button>
            </div>

            <!-- Save Settings Button -->
            <div class="flex justify-end space-x-4">
                <button id="reset-settings-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-700">
                    Reset to Defaults
                </button>
                <button id="save-settings-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                    Save Settings
                </button>
            </div>
        </div>

        <!-- Backup Password Modal -->
        <div id="backup-password-modal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 hidden">
            <div class="bg-[#1a2332] rounded-lg max-w-md w-full mx-4 p-6">
                <h3 class="text-xl font-semibold text-white mb-4">Encrypt Backup</h3>
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
                    <button id="cancel-backup-btn" class="flex-1 bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button id="confirm-backup-btn" class="flex-1 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                        Create Backup
                    </button>
                </div>
            </div>
        </div>
    `;

  container.appendChild(content);

  // FUNCTIONS

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
          if (config.zmq.rawblock)
            content.querySelector('#zmq-rawblock-input').value =
              config.zmq.rawblock;
          if (config.zmq.rawtx)
            content.querySelector('#zmq-rawtx-input').value = config.zmq.rawtx;
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
    const rawblock = content.querySelector('#zmq-rawblock-input').value;
    const rawtx = content.querySelector('#zmq-rawtx-input').value;
    const rpcUser =
      content.querySelector('#rpc-username-input').value || 'user';
    const rpcPass =
      content.querySelector('#rpc-password-input').value || 'password';
    const rpcPort = content.querySelector('#rpc-port-input').value || '38332';

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
          `✅ Backup created successfully!\n\nLocation: ${destinationPath}`
        );
      } else {
        alert(`❌ Backup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Backup error:', error);
      alert(`❌ Backup failed: ${error.message}`);
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

  // ZMQ input changes - update previews
  content
    .querySelector('#zmq-rawblock-input')
    .addEventListener('input', updateConfigPreviews);
  content
    .querySelector('#zmq-rawtx-input')
    .addEventListener('input', updateConfigPreviews);
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
      const rawblock = content.querySelector('#zmq-rawblock-input').value;
      const rawtx = content.querySelector('#zmq-rawtx-input').value;
      const configText = `zmqpubrawblock=${rawblock}\nzmqpubrawtx=${rawtx}`;

      try {
        await navigator.clipboard.writeText(configText);
        const btn = content.querySelector('#copy-zmq-config-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
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
      const rawblock = content.querySelector('#zmq-rawblock-input').value;
      const rawtx = content.querySelector('#zmq-rawtx-input').value;
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
zmqpubrawblock=${rawblock}
zmqpubrawtx=${rawtx}`;
      try {
        await navigator.clipboard.writeText(configText);
        const btn = content.querySelector('#copy-full-config-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

  // Enhanced connection status management
  let connectionTimer = null;
  let isConnected = false;

  function updateConnectionStatus(connected, info = {}) {
    const indicator = content.querySelector('#connection-indicator');
    const status = content.querySelector('#rpc-status');
    const connectBtn = content.querySelector('#connect-btn');
    const disconnectBtn = content.querySelector('#disconnect-btn');

    if (connected) {
      indicator.className = 'w-3 h-3 bg-green-500 rounded-full mr-2';
      status.textContent = 'Connected';
      status.className = 'text-sm font-semibold text-green-400';
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      isConnected = true;

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
      status.className = 'text-sm font-semibold text-red-400';
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      isConnected = false;

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

    const url = `http://${host}:${port}`;
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

  async function testZMQConnection() {
    const rawblock = content.querySelector('#zmq-rawblock-input').value;
    const rawtx = content.querySelector('#zmq-rawtx-input').value;

    // Extract port from ZMQ address
    const portMatch = rawblock.match(/:(\d+)$/);
    if (!portMatch) {
      throw new Error('Invalid ZMQ address format');
    }

    // Just validate format for now - actual ZMQ test would need socket connection
    if (rawblock !== rawtx) {
      throw new Error('ZMQ ports must match (both should be 28332)');
    }

    return { rawblock, rawtx };
  }

  // Test RPC connection
  content
    .querySelector('#test-connection-btn')
    .addEventListener('click', async () => {
      const btn = content.querySelector('#test-connection-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Testing...';
      btn.disabled = true;

      try {
        const info = await makeRPCCall('getblockchaininfo');
        const networkInfo = await makeRPCCall('getnetworkinfo');

        updateConnectionStatus(true, {
          version: networkInfo.subversion || 'Unknown',
          network: info.chain,
          blocks: info.blocks,
          verificationprogress: info.verificationprogress,
        });

        console.log('✅ RPC connection successful:', info);
      } catch (error) {
        console.error('❌ RPC connection failed:', error);
        updateConnectionStatus(false);
        alert(
          `RPC Connection failed: ${error.message}\n\nPlease check:\n- Bitcoin Core is running\n- RPC credentials are correct\n- RPC port matches your bitcoin.conf`
        );
      }

      btn.textContent = originalText;
      btn.disabled = false;
    });

  // Connect button
  content.querySelector('#connect-btn').addEventListener('click', async () => {
    const btn = content.querySelector('#connect-btn');
    btn.textContent = 'Connecting...';
    btn.disabled = true;

    try {
      // First save the configuration
      const updatedConfig = buildConfig();
      localStorage.setItem('coinswap_config', JSON.stringify(updatedConfig));
      console.log('💾 Config saved:', updatedConfig);

      // Test the connection
      const info = await makeRPCCall('getblockchaininfo');
      const networkInfo = await makeRPCCall('getnetworkinfo');

      updateConnectionStatus(true, {
        version: networkInfo.subversion || 'Unknown',
        network: info.chain,
        blocks: info.blocks,
        verificationprogress: info.verificationprogress,
      });

      // Start status refresh timer
      if (connectionTimer) clearInterval(connectionTimer);
      connectionTimer = setInterval(async () => {
        if (isConnected) {
          try {
            const info = await makeRPCCall('getblockchaininfo');
            content.querySelector('#block-height').textContent =
              info.blocks.toLocaleString();
            const progress = (info.verificationprogress * 100).toFixed(1);
            content.querySelector('#sync-progress').textContent =
              `${progress}%`;
          } catch (error) {
            console.log('Status refresh failed');
            updateConnectionStatus(false);
            if (connectionTimer) {
              clearInterval(connectionTimer);
              connectionTimer = null;
            }
          }
        }
      }, 5000);

      console.log('✅ Connected and monitoring status');
    } catch (error) {
      console.error('❌ Connection failed:', error);
      updateConnectionStatus(false);
      alert(`Connection failed: ${error.message}`);
    }

    btn.textContent = 'Connect';
    btn.disabled = false;
  });

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

  // Disconnect button
  content.querySelector('#disconnect-btn').addEventListener('click', () => {
    if (connectionTimer) {
      clearInterval(connectionTimer);
      connectionTimer = null;
    }
    updateConnectionStatus(false);
    console.log('🔌 Disconnected from Bitcoin Core');
  });

  // Refresh status button
  content
    .querySelector('#refresh-status-btn')
    .addEventListener('click', async () => {
      const btn = content.querySelector('#refresh-status-btn');
      btn.textContent = 'Refreshing...';
      btn.disabled = true;

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
        console.log('Refresh failed:', error.message);
        updateConnectionStatus(false);
      }

      btn.textContent = 'Refresh Status';
      btn.disabled = false;
    });

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
      zmq: {
        rawblock: content.querySelector('#zmq-rawblock-input').value,
        rawtx: content.querySelector('#zmq-rawtx-input').value,
        address: content.querySelector('#zmq-rawblock-input').value,
      },
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

      // Reset ZMQ fields (both to 28332)
      content.querySelector('#zmq-rawblock-input').value =
        'tcp://127.0.0.1:28332';
      content.querySelector('#zmq-rawtx-input').value = 'tcp://127.0.0.1:28332';

      // Update previews
      updateConfigPreviews();

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
