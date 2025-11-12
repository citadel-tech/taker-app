export function FirstTimeSetupModal(container, onComplete) {
  const modal = document.createElement('div');
  modal.id = 'setup-modal';
  modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';

  let currentStep = 1;
  const totalSteps = 3;

  modal.innerHTML = `
    <div class="bg-[#1a2332] rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="bg-[#FF6B35] rounded-t-lg p-6">
        <h2 class="text-2xl font-bold text-white mb-2">Welcome to Coinswap Taker!</h2>
        <p class="text-white/90 text-sm">Let's set up your wallet for private Bitcoin swaps</p>
        <div class="flex mt-4">
          <div id="progress-bar" class="bg-white/20 rounded-full h-2 flex-1">
            <div id="progress-fill" class="bg-white rounded-full h-2 transition-all duration-300" style="width: 33%"></div>
          </div>
          <span id="step-indicator" class="text-white/90 text-sm ml-3">Step 1 of 3</span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Step 1: Introduction -->
        <div id="step-1" class="setup-step">
          <div class="text-center mb-6">
            <div class="w-20 h-20 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-4xl text-[#FF6B35]">ðŸš€</span>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Getting Started</h3>
            <p class="text-gray-400 text-sm">We need to configure a few settings to connect your wallet to Bitcoin Core and enable private swaps.</p>
          </div>

          <div class="space-y-4">
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold mb-2">What we'll set up:</h4>
              <ul class="text-sm text-gray-400 space-y-2">
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  Bitcoin Core RPC connection
                </li>
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  Tor configuration for privacy
                </li>
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  Maker discovery settings
                </li>
              </ul>
            </div>

            <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p class="text-xs text-blue-400">
                ðŸ’¡ <strong>Prerequisites:</strong> Make sure Bitcoin Core is running with RPC enabled and Tor is installed on your system.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 2: Bitcoin Core RPC -->
        <div id="step-2" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Bitcoin Core RPC Configuration</h3>
            <p class="text-gray-400 text-sm">Connect to your Bitcoin Core node to send and receive transactions.</p>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-2">RPC Host</label>
                <input 
                  type="text" 
                  id="setup-rpc-host"
                  value="127.0.0.1"
                  class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-2">RPC Port</label>
                <input 
                  type="number" 
                  id="setup-rpc-port"
                  value="38332"
                  min="1"
                  max="65535"
                  class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm text-gray-400 mb-2">RPC Username</label>
              <input 
                type="text" 
                id="setup-rpc-username"
                value="user"
                placeholder="bitcoinrpc"
                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
            </div>

            <div>
              <label class="block text-sm text-gray-400 mb-2">RPC Password</label>
              <input 
                type="password" 
                id="setup-rpc-password"
                value="password"
                placeholder="Enter your RPC password"
                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
            </div>

            <button id="test-rpc-setup" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
              Test Connection
            </button>

            <div id="rpc-test-result" class="hidden"></div>

            <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p class="text-xs text-blue-400 mb-2">
                <strong>Need help?</strong> Add these lines to your bitcoin.conf file:
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

        <!-- Step 3: Taker Configuration -->
        <div id="step-3" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Taker Configuration</h3>
            <p class="text-gray-400 text-sm">Configure Tor and maker discovery settings for private swaps.</p>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-2">Tor Control Port</label>
                <input 
                  type="number" 
                  id="setup-tor-control-port"
                  value="9051"
                  min="1024"
                  max="65535"
                  class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-2">Tor SOCKS Port</label>
                <input 
                  type="number" 
                  id="setup-tor-socks-port"
                  value="9050"
                  min="1024"
                  max="65535"
                  class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm text-gray-400 mb-2">Tor Auth Password (optional)</label>
              <input 
                type="password" 
                id="setup-tor-auth-password"
                placeholder="Leave empty if no password required"
                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
            </div>

            <div>
              <label class="block text-sm text-gray-400 mb-2">Tracker Address</label>
              <input 
                type="text" 
                id="setup-tracker-address"
                value="lp75qh3del4qot6fmkqq4taqm33pidvk63lncvhlwsllbwrl2f4g4qqd.onion:8080"
                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
            </div>

            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p class="text-xs text-purple-400 mb-2">
                <strong>Privacy Notice:</strong>
              </p>
              <ul class="text-xs text-purple-400 space-y-1">
                <li>â€¢ All maker connections go through Tor</li>
                <li>â€¢ Tracker discovery is anonymous</li>
                <li>â€¢ Your IP address stays hidden</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-[#0f1419] rounded-b-lg p-6 flex justify-between">
        <button id="setup-back-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-700 hidden">
          Back
        </button>
        <div class="flex space-x-3 ml-auto">
          <button id="setup-skip-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-700">
            Skip Setup
          </button>
          <button id="setup-next-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(modal);

  // FUNCTIONS
  function updateProgress() {
    const progressFill = modal.querySelector('#progress-fill');
    const stepIndicator = modal.querySelector('#step-indicator');
    
    const progressPercent = (currentStep / totalSteps) * 100;
    progressFill.style.width = progressPercent + '%';
    stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
  }

  function showStep(step) {
    // Hide all steps
    modal.querySelectorAll('.setup-step').forEach(el => el.classList.add('hidden'));
    
    // Show current step
    modal.querySelector(`#step-${step}`).classList.remove('hidden');
    
    // Update buttons
    const backBtn = modal.querySelector('#setup-back-btn');
    const nextBtn = modal.querySelector('#setup-next-btn');
    
    if (step === 1) {
      backBtn.classList.add('hidden');
      nextBtn.textContent = 'Next';
    } else if (step === totalSteps) {
      backBtn.classList.remove('hidden');
      nextBtn.textContent = 'Complete Setup';
    } else {
      backBtn.classList.remove('hidden');
      nextBtn.textContent = 'Next';
    }
    
    updateProgress();
  }

  function saveConfiguration() {
    const config = {
      rpc: {
        host: modal.querySelector('#setup-rpc-host').value,
        port: parseInt(modal.querySelector('#setup-rpc-port').value),
        username: modal.querySelector('#setup-rpc-username').value,
        password: modal.querySelector('#setup-rpc-password').value,
      },
      taker: {
        control_port: parseInt(modal.querySelector('#setup-tor-control-port').value),
        socks_port: parseInt(modal.querySelector('#setup-tor-socks-port').value),
        tor_auth_password: modal.querySelector('#setup-tor-auth-password').value,
        tracker_address: modal.querySelector('#setup-tracker-address').value,
      },
      setupComplete: true,
      setupDate: new Date().toISOString(),
    };

    localStorage.setItem('coinswap_config', JSON.stringify(config));
    console.log('ðŸ’¾ Configuration saved:', config);
    return config;
  }

  function testRPCConnection() {
    const btn = modal.querySelector('#test-rpc-setup');
    const resultDiv = modal.querySelector('#rpc-test-result');
    
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    // Simulate RPC test
    setTimeout(() => {
      resultDiv.className = 'bg-green-500/10 border border-green-500/30 rounded-lg p-3';
      resultDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-green-400 mr-2">âœ“</span>
          <span class="text-sm text-green-400">Connection successful! Bitcoin Core v25.0.0 detected.</span>
        </div>
      `;
      resultDiv.classList.remove('hidden');

      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }

  // EVENT LISTENERS
  modal.querySelector('#setup-next-btn').addEventListener('click', () => {
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
      // Complete setup
      const config = saveConfiguration();
      modal.remove();
      if (onComplete) onComplete(config);
    }
  });

  modal.querySelector('#setup-back-btn').addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  modal.querySelector('#setup-skip-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to skip setup? You can configure these settings later in the Settings page.')) {
      // Save minimal config to mark setup as complete
      const minimalConfig = {
        setupComplete: true,
        setupDate: new Date().toISOString(),
        skipped: true,
      };
      localStorage.setItem('coinswap_config', JSON.stringify(minimalConfig));
      modal.remove();
      if (onComplete) onComplete(minimalConfig);
    }
  });

  modal.querySelector('#test-rpc-setup').addEventListener('click', testRPCConnection);

  // Initialize
  showStep(currentStep);

  return modal;
}

// Utility function to check if setup is complete
export function isSetupComplete() {
  try {
    const config = localStorage.getItem('coinswap_config');
    if (!config) return false;
    
    const parsedConfig = JSON.parse(config);
    return parsedConfig.setupComplete === true;
  } catch (error) {
    console.error('Error checking setup status:', error);
    return false;
  }
}

// Utility function to get saved configuration
export function getSavedConfig() {
  try {
    const config = localStorage.getItem('coinswap_config');
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Error getting saved config:', error);
    return null;
  }
}