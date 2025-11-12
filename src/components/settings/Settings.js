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
                            <div class="grid grid-cols-3 gap-2 mb-4">
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">1.</span>
                                    <div class="font-mono text-sm text-white">abandon</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">2.</span>
                                    <div class="font-mono text-sm text-white">ability</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">3.</span>
                                    <div class="font-mono text-sm text-white">able</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">4.</span>
                                    <div class="font-mono text-sm text-white">about</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">5.</span>
                                    <div class="font-mono text-sm text-white">above</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">6.</span>
                                    <div class="font-mono text-sm text-white">absent</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">7.</span>
                                    <div class="font-mono text-sm text-white">absorb</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">8.</span>
                                    <div class="font-mono text-sm text-white">abstract</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">9.</span>
                                    <div class="font-mono text-sm text-white">absurd</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">10.</span>
                                    <div class="font-mono text-sm text-white">abuse</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">11.</span>
                                    <div class="font-mono text-sm text-white">access</div>
                                </div>
                                <div class="bg-[#0f1419] rounded px-3 py-2 text-center">
                                    <span class="text-xs text-gray-500">12.</span>
                                    <div class="font-mono text-sm text-white">accident</div>
                                </div>
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
                
                <div class="grid grid-cols-2 gap-6">
                    <!-- Tor Configuration -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Tor Configuration</h4>
                        
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
                    
                    <!-- Tracker Configuration -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-medium text-white mb-4">Tracker Configuration</h4>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">Tracker Address</label>
                            <input 
                                type="text" 
                                id="tracker-address-input"
                                value="lp75qh3del4qot6fmkqq4taqm33pidvk63lncvhlwsllbwrl2f4g4qqd.onion:8080"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">Onion address for maker discovery</p>
                        </div>
                        
                        <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                            <p class="text-xs text-purple-400 mb-2">
                                <strong>Tor Network Required:</strong>
                            </p>
                            <ul class="text-xs text-purple-400 space-y-1">
                                <li>• Tracker runs on Tor hidden service</li>
                                <li>• Ensures maker discovery privacy</li>
                                <li>• Configure Tor settings above</li>
                            </ul>
                        </div>
                        
                        <button id="test-tracker-btn" class="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            Test Tracker Connection
                        </button>
                        
                        <div id="tracker-status" class="hidden bg-[#0f1419] rounded-lg p-3">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm text-gray-400">Tracker Status</span>
                                <span id="tracker-status-text" class="text-sm font-semibold text-yellow-400">Testing...</span>
                            </div>
                            <div class="text-xs text-gray-500">
                                <div class="flex justify-between">
                                    <span>Available Makers</span>
                                    <span id="available-makers-count">--</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Response Time</span>
                                    <span id="tracker-response-time">--</span>
                                </div>
                            </div>
                        </div>
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
                                value="8332"
                                min="1"
                                max="65535"
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <p class="text-xs text-gray-500 mt-1">Bitcoin Core RPC port (8332 for mainnet, 18332 for testnet)</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">RPC Username</label>
                            <input 
                                type="text" 
                                id="rpc-username-input"
                                value="bitcoinrpc"
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
                                <span class="text-sm text-gray-400">Connection Status</span>
                                <span id="rpc-status" class="text-sm font-semibold text-yellow-400">Not Connected</span>
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
                        
                        <button id="test-connection-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            Test Connection
                        </button>
                        
                        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <p class="text-xs text-blue-400">
                                💡 Make sure Bitcoin Core is running with RPC enabled. Add these lines to your bitcoin.conf:
                            </p>
                            <div class="bg-[#0f1419] rounded mt-2 p-2 font-mono text-xs text-gray-300">
                                server=1<br/>
                                rpcuser=bitcoinrpc<br/>
                                rpcpassword=yourpassword<br/>
                                rpcallowip=127.0.0.1
                            </div>
                        </div>
                    </div>
                </div>
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
        
        // Populate Taker config fields
        if (config.taker) {
          if (config.taker.control_port) content.querySelector('#tor-control-port-input').value = config.taker.control_port;
          if (config.taker.socks_port) content.querySelector('#tor-socks-port-input').value = config.taker.socks_port;
          if (config.taker.tor_auth_password) content.querySelector('#tor-auth-password-input').value = config.taker.tor_auth_password;
          if (config.taker.tracker_address) content.querySelector('#tracker-address-input').value = config.taker.tracker_address;
        }
      }
    } catch (error) {
      console.error('Error loading existing config:', error);
    }
  }

  // EVENT LISTENERS

  // Seed phrase display
  content.querySelector('#show-seed-btn').addEventListener('click', () => {
    const seedDisplay = content.querySelector('#seed-display');
    if (seedDisplay.classList.contains('hidden')) {
      seedDisplay.classList.remove('hidden');
      content.querySelector('#show-seed-btn').textContent = 'Hide Seed Phrase';
    } else {
      seedDisplay.classList.add('hidden');
      content.querySelector('#show-seed-btn').textContent = 'Show Seed Phrase';
    }
  });

  // Copy seed phrase
  content.querySelector('#copy-seed-btn').addEventListener('click', async () => {
    const seedWords = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent',
      'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'
    ];
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
    
    if (confirm('Are you sure you want to restore from this seed phrase? This will replace your current wallet.')) {
      // Here you would implement the actual restore logic
      alert('Wallet restore functionality would be implemented here');
    }
  });

  // Test RPC connection
  content.querySelector('#test-connection-btn').addEventListener('click', async () => {
    const btn = content.querySelector('#test-connection-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    const host = content.querySelector('#rpc-host-input').value;
    const port = content.querySelector('#rpc-port-input').value;
    const username = content.querySelector('#rpc-username-input').value;
    const password = content.querySelector('#rpc-password-input').value;

    // Simulate RPC test (in real implementation, this would make an actual RPC call)
    setTimeout(() => {
      // Mock successful connection
      content.querySelector('#rpc-status').textContent = 'Connected';
      content.querySelector('#rpc-status').className = 'text-sm font-semibold text-green-400';
      content.querySelector('#bitcoin-version').textContent = 'v25.0.0';
      content.querySelector('#bitcoin-network').textContent = 'mainnet';
      content.querySelector('#block-height').textContent = '820,123';
      content.querySelector('#sync-progress').textContent = '100%';

      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  });

  // Test tracker connection
  content.querySelector('#test-tracker-btn').addEventListener('click', async () => {
    const btn = content.querySelector('#test-tracker-btn');
    const statusDiv = content.querySelector('#tracker-status');
    const statusText = content.querySelector('#tracker-status-text');
    const makersCount = content.querySelector('#available-makers-count');
    const responseTime = content.querySelector('#tracker-response-time');
    
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;
    
    // Show status div
    statusDiv.classList.remove('hidden');
    statusText.textContent = 'Testing...';
    statusText.className = 'text-sm font-semibold text-yellow-400';

    const trackerAddress = content.querySelector('#tracker-address-input').value;
    
    // Simulate tracker test (in real implementation, this would test the actual tracker connection)
    setTimeout(() => {
      // Mock successful connection
      statusText.textContent = 'Connected';
      statusText.className = 'text-sm font-semibold text-green-400';
      makersCount.textContent = '4 makers';
      responseTime.textContent = '1.2s';

      btn.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  });

  // Save settings
  content.querySelector('#save-settings-btn').addEventListener('click', () => {
    // Collect all current form values
    const updatedConfig = {
      rpc: {
        host: content.querySelector('#rpc-host-input').value,
        port: parseInt(content.querySelector('#rpc-port-input').value),
        username: content.querySelector('#rpc-username-input').value,
        password: content.querySelector('#rpc-password-input').value,
      },
      taker: {
        control_port: parseInt(content.querySelector('#tor-control-port-input').value),
        socks_port: parseInt(content.querySelector('#tor-socks-port-input').value),
        tor_auth_password: content.querySelector('#tor-auth-password-input').value,
        tracker_address: content.querySelector('#tracker-address-input').value,
      },
      setupComplete: true,
      setupDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

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
      // Reset Taker Config fields to match Rust defaults
      content.querySelector('#tor-control-port-input').value = '9051';
      content.querySelector('#tor-socks-port-input').value = '9050';
      content.querySelector('#tor-auth-password-input').value = '';
      content.querySelector('#tracker-address-input').value = 'lp75qh3del4qot6fmkqq4taqm33pidvk63lncvhlwsllbwrl2f4g4qqd.onion:8080';
      
      // Reset RPC fields
      content.querySelector('#rpc-host-input').value = '127.0.0.1';
      content.querySelector('#rpc-port-input').value = '8332';
      content.querySelector('#rpc-username-input').value = 'bitcoinrpc';
      content.querySelector('#rpc-password-input').value = '';
      
      // Hide status displays
      content.querySelector('#tracker-status').classList.add('hidden');
      
      alert('Settings reset to defaults');
    }
  });

  // INITIALIZE - Load existing configuration
  loadExistingConfig();
}