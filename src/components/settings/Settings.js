export function SettingsComponent(container) {
  const content = document.createElement('div');
  content.id = 'settings-content';

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Settings</h2>
        <p class="text-gray-400 mb-8">Configure your taker wallet and Bitcoin Core connection</p>

        <div class="space-y-8">
            <!-- Wallet Backup & Restore Section -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-6">Wallet Backup & Restore</h3>
                
                <div class="grid grid-cols-2 gap-6">
                    <!-- Seed Phrase Backup -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Seed Phrase Backup</h4>
                        
                        <button id="show-seed-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            Show Seed Phrase
                        </button>
                        
                        <div id="seed-display" class="hidden bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                            <div class="flex items-center mb-3">
                                <span class="text-yellow-400 text-sm">⚠️ Keep this safe and private!</span>
                            </div>
                            <div id="seed-words-grid" class="grid grid-cols-3 gap-2 mb-4">
                                <!-- Seed words will be populated dynamically -->
                            </div>
                            <button id="copy-seed-btn" class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-white py-2 px-4 rounded text-sm transition-colors">
                                Copy to Clipboard
                            </button>
                        </div>
                        
                        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <p class="text-xs text-blue-400">
                                💡 Write down your seed phrase and store it in a safe place. Anyone with access to your seed phrase can restore your wallet.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Wallet Restore -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Restore Wallet</h4>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">Enter Seed Phrase</label>
                            <textarea 
                                id="restore-seed-input"
                                placeholder="Enter your 12-word seed phrase separated by spaces..."
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B35] transition-colors h-24 resize-none"
                            ></textarea>
                        </div>
                        
                        <button id="restore-wallet-btn" class="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            Restore Wallet
                        </button>
                        
                        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <p class="text-xs text-red-400">
                                ⚠️ Warning: Restoring a wallet will replace your current wallet. Make sure you have backed up your current seed phrase.
                            </p>
                        </div>
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
                            <input 
                                type="password" 
                                id="tor-auth-password-input"
                                placeholder="Enter Tor authentication password (optional)"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
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
                                value="18443"
                                min="1"
                                max="65535"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">Bitcoin Core RPC port (8332 for mainnet, 18332 for testnet, 18443 for regtest)</p>
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
                                value="tcp://127.0.0.1:28333"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">ZMQ endpoint for raw transaction notifications</p>
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
                                zmqpubrawtx=tcp://127.0.0.1:28333
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
                
                <div class="bg-[#0f1419] rounded-lg p-4 font-mono text-xs text-gray-300">
                    <div id="full-config-preview">
                        # Network (choose one)<br/>
                        regtest=1<br/>
                        # testnet=1<br/>
                        # mainnet (no flag needed)<br/>
                        <br/>
                        # Server settings<br/>
                        server=1<br/>
                        <br/>
                        # RPC settings<br/>
                        rpcuser=user<br/>
                        rpcpassword=password<br/>
                        rpcport=18443<br/>
                        rpcallowip=127.0.0.1<br/>
                        <br/>
                        # ZMQ settings (required for Coinswap)<br/>
                        zmqpubrawblock=tcp://127.0.0.1:28332<br/>
                        zmqpubrawtx=tcp://127.0.0.1:28333
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
          if (config.rpc.host) content.querySelector('#rpc-host-input').value = config.rpc.host;
          if (config.rpc.port) content.querySelector('#rpc-port-input').value = config.rpc.port;
          if (config.rpc.username) content.querySelector('#rpc-username-input').value = config.rpc.username;
          if (config.rpc.password) content.querySelector('#rpc-password-input').value = config.rpc.password;
        }

        // Populate Taker/Tor config fields
        if (config.taker) {
          if (config.taker.control_port) content.querySelector('#tor-control-port-input').value = config.taker.control_port;
          if (config.taker.socks_port) content.querySelector('#tor-socks-port-input').value = config.taker.socks_port;
          if (config.taker.tor_auth_password) content.querySelector('#tor-auth-password-input').value = config.taker.tor_auth_password;
        }

        // Populate ZMQ fields
        if (config.zmq) {
          if (config.zmq.rawblock) content.querySelector('#zmq-rawblock-input').value = config.zmq.rawblock;
          if (config.zmq.rawtx) content.querySelector('#zmq-rawtx-input').value = config.zmq.rawtx;
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
    const rpcUser = content.querySelector('#rpc-username-input').value || 'user';
    const rpcPass = content.querySelector('#rpc-password-input').value || 'password';
    const rpcPort = content.querySelector('#rpc-port-input').value || '18443';

    // Update ZMQ config preview
    const zmqPreview = content.querySelector('#zmq-config-preview');
    if (zmqPreview) {
      zmqPreview.innerHTML = `zmqpubrawblock=${rawblock}<br/>zmqpubrawtx=${rawtx}`;
    }

    // Update full config preview
    const fullPreview = content.querySelector('#full-config-preview');
    if (fullPreview) {
      fullPreview.innerHTML = `# Network (choose one)<br/>
regtest=1<br/>
# testnet=1<br/>
# mainnet (no flag needed)<br/>
<br/>
# Server settings<br/>
server=1<br/>
<br/>
# RPC settings<br/>
rpcuser=${rpcUser}<br/>
rpcpassword=${rpcPass}<br/>
rpcport=${rpcPort}<br/>
rpcallowip=127.0.0.1<br/>
<br/>
# ZMQ settings (required for Coinswap)<br/>
zmqpubrawblock=${rawblock}<br/>
zmqpubrawtx=${rawtx}`;
    }
  }

  // Fetch and display seed phrase
  async function fetchSeedPhrase() {
    try {
      const response = await fetch('http://localhost:3001/api/taker/seed');
      const data = await response.json();

      if (data.success && data.seed) {
        const seedWords = data.seed.split(' ');
        const grid = content.querySelector('#seed-words-grid');

        grid.innerHTML = seedWords.map((word, index) => `
          <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
            <span class="text-xs text-gray-500">${index + 1}.</span>
            <div class="font-mono text-sm text-white">${word}</div>
          </div>
        `).join('');

        return seedWords.join(' ');
      }
    } catch (error) {
      console.error('Failed to fetch seed phrase:', error);
    }
    return null;
  }

  // EVENT LISTENERS

  // ZMQ input changes - update previews
  content.querySelector('#zmq-rawblock-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#zmq-rawtx-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#rpc-username-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#rpc-password-input').addEventListener('input', updateConfigPreviews);
  content.querySelector('#rpc-port-input').addEventListener('input', updateConfigPreviews);

  // Copy ZMQ config
  content.querySelector('#copy-zmq-config-btn').addEventListener('click', async () => {
    const rawblock = content.querySelector('#zmq-rawblock-input').value;
    const rawtx = content.querySelector('#zmq-rawtx-input').value;
    const configText = `zmqpubrawblock=${rawblock}\nzmqpubrawtx=${rawtx}`;

    try {
      await navigator.clipboard.writeText(configText);
      const btn = content.querySelector('#copy-zmq-config-btn');
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  // Copy full config
  content.querySelector('#copy-full-config-btn').addEventListener('click', async () => {
    const rawblock = content.querySelector('#zmq-rawblock-input').value;
    const rawtx = content.querySelector('#zmq-rawtx-input').value;
    const rpcUser = content.querySelector('#rpc-username-input').value || 'user';
    const rpcPass = content.querySelector('#rpc-password-input').value || 'password';
    const rpcPort = content.querySelector('#rpc-port-input').value || '18443';

    const configText = `# Network (choose one)
regtest=1
# testnet=1
# mainnet (no flag needed)

# Server settings
server=1

# RPC settings
rpcuser=${rpcUser}
rpcpassword=${rpcPass}
rpcport=${rpcPort}
rpcallowip=127.0.0.1

# ZMQ settings (required for Coinswap)
zmqpubrawblock=${rawblock}
zmqpubrawtx=${rawtx}`;

    try {
      await navigator.clipboard.writeText(configText);
      const btn = content.querySelector('#copy-full-config-btn');
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  // Seed phrase display
  content.querySelector('#show-seed-btn').addEventListener('click', async () => {
    const seedDisplay = content.querySelector('#seed-display');
    const btn = content.querySelector('#show-seed-btn');

    if (seedDisplay.classList.contains('hidden')) {
      btn.textContent = 'Loading...';
      btn.disabled = true;

      await fetchSeedPhrase();

      seedDisplay.classList.remove('hidden');
      btn.textContent = 'Hide Seed Phrase';
      btn.disabled = false;
    } else {
      seedDisplay.classList.add('hidden');
      btn.textContent = 'Show Seed Phrase';
    }
  });

  // Copy seed phrase
  content.querySelector('#copy-seed-btn').addEventListener('click', async () => {
    const seedWords = Array.from(content.querySelectorAll('#seed-words-grid .font-mono'))
      .map(el => el.textContent);
    const seedPhrase = seedWords.join(' ');

    try {
      await navigator.clipboard.writeText(seedPhrase);
      const btn = content.querySelector('#copy-seed-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('bg-green-600');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-600');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  });

  // Restore wallet
  content.querySelector('#restore-wallet-btn').addEventListener('click', () => {
    const seedInput = content.querySelector('#restore-seed-input').value.trim();
    if (!seedInput) {
      alert('Please enter a seed phrase');
      return;
    }

    const words = seedInput.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      alert('Seed phrase must be 12 or 24 words');
      return;
    }

    if (confirm('Are you sure you want to restore from this seed phrase? This will replace your current wallet.')) {
      // TODO: Implement actual restore logic via API
      alert('Wallet restore functionality would be implemented here');
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

      if (info.version) content.querySelector('#bitcoin-version').textContent = info.version;
      if (info.network) content.querySelector('#bitcoin-network').textContent = info.network;
      if (info.blocks) content.querySelector('#block-height').textContent = info.blocks.toLocaleString();
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
      jsonrpc: "1.0",
      id: Date.now(),
      method: method,
      params: params
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(body)
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

  // Test RPC connection
  content.querySelector('#test-connection-btn').addEventListener('click', async () => {
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
        verificationprogress: info.verificationprogress
      });

      console.log('✅ RPC connection successful:', info);
    } catch (error) {
      console.error('❌ RPC connection failed:', error);
      updateConnectionStatus(false);
      alert(`Connection failed: ${error.message}`);
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
        verificationprogress: info.verificationprogress
      });

      // Start status refresh timer
      if (connectionTimer) clearInterval(connectionTimer);
      connectionTimer = setInterval(async () => {
        if (isConnected) {
          try {
            const info = await makeRPCCall('getblockchaininfo');
            content.querySelector('#block-height').textContent = info.blocks.toLocaleString();
            const progress = (info.verificationprogress * 100).toFixed(1);
            content.querySelector('#sync-progress').textContent = `${progress}%`;
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
  content.querySelector('#refresh-status-btn').addEventListener('click', async () => {
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
        verificationprogress: info.verificationprogress
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
    return {
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
      zmq: {
        rawblock: content.querySelector('#zmq-rawblock-input').value,
        rawtx: content.querySelector('#zmq-rawtx-input').value,
        // Combined address for backward compatibility (uses rawblock endpoint)
        address: content.querySelector('#zmq-rawblock-input').value,
      },
      setupComplete: true,
      setupDate: new Date().toISOString(),
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
      content.querySelector('#rpc-port-input').value = '18443';
      content.querySelector('#rpc-username-input').value = 'user';
      content.querySelector('#rpc-password-input').value = '';

      // Reset ZMQ fields
      content.querySelector('#zmq-rawblock-input').value = 'tcp://127.0.0.1:28332';
      content.querySelector('#zmq-rawtx-input').value = 'tcp://127.0.0.1:28333';

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
        verificationprogress: info.verificationprogress
      });
    } catch (error) {
      console.log('Initial connection check failed:', error.message);
    }
  })();
}