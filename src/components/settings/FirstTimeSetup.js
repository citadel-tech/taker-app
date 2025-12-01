export function FirstTimeSetupModal(container, onComplete) {
  const modal = document.createElement('div');
  modal.id = 'setup-modal';
  modal.className =
    'fixed inset-0 bg-black/70 flex items-center justify-center z-50';

  let currentStep = 1;
  const totalSteps = 4;
  let walletAction = null; // 'create', 'load', or 'restore'
  let walletData = {};
  let protocolVersion = 'v1'; // 'v1' (P2WSH) or 'v2' (Taproot)

  modal.innerHTML = `
    <div class="bg-[#1a2332] rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="bg-[#FF6B35] rounded-t-lg p-6">
        <h2 class="text-2xl font-bold text-white mb-2">Welcome to Coinswap Taker!</h2>
        <p class="text-white/90 text-sm">Let's set up your wallet for private Bitcoin swaps</p>
        <div class="flex mt-4">
          <div id="progress-bar" class="bg-white/20 rounded-full h-2 flex-1">
            <div id="progress-fill" class="bg-white rounded-full h-2 transition-all duration-300" style="width: 25%"></div>
          </div>
          <span id="step-indicator" class="text-white/90 text-sm ml-3">Step 1 of 4</span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Step 1: Introduction & Protocol Selection -->
        <div id="step-1" class="setup-step">
          <div class="text-center mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Getting Started</h3>
            <p class="text-gray-400 text-sm">Choose your swap protocol and we'll configure your wallet for private Bitcoin swaps.</p>
          </div>

          <div class="space-y-4">
            <!-- Protocol Selection -->
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold mb-3">Select Swap Protocol</h4>
              <div class="grid grid-cols-2 gap-4">
                <!-- P2WSH (V1) -->
                <div id="protocol-v1" class="protocol-choice bg-[#1a2332] rounded-lg p-4 border-2 border-[#FF6B35] cursor-pointer hover:border-[#FF6B35] transition-colors">
                  <div class="flex items-center mb-2">
                    <span class="text-2xl mr-2">🔐</span>
                    <h5 class="text-white font-semibold">P2WSH (Stable)</h5>
                  </div>
                  <p class="text-xs text-gray-400 mb-2">ECDSA-based 2-of-2 multisig contracts</p>
                  <ul class="text-xs text-gray-500 space-y-1">
                    <li>• Battle-tested protocol</li>
                    <li>• Wider maker support</li>
                    <li>• Recommended for most users</li>
                  </ul>
                  <div class="mt-2">
                    <span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Recommended</span>
                  </div>
                </div>

                <!-- Taproot (V2) -->
                <div id="protocol-v2" class="protocol-choice bg-[#1a2332] rounded-lg p-4 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors">
                  <div class="flex items-center mb-2">
                    <span class="text-2xl mr-2">⚡</span>
                    <h5 class="text-white font-semibold">Taproot (Beta)</h5>
                  </div>
                  <p class="text-xs text-gray-400 mb-2">MuSig2-based scriptless scripts</p>
                  <ul class="text-xs text-gray-500 space-y-1">
                    <li>• Enhanced privacy</li>
                    <li>• Lower fees</li>
                    <li>• Experimental - limited makers</li>
                  </ul>
                  <div class="mt-2">
                    <span class="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Experimental</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold mb-2">What we'll set up:</h4>
              <ul class="text-sm text-gray-400 space-y-2">
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  Bitcoin Core RPC connection
                </li>
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  ZMQ notifications for real-time updates
                </li>
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  Wallet setup (create, load, or restore)
                </li>
                <li class="flex items-center">
                  <span class="w-2 h-2 bg-[#FF6B35] rounded-full mr-3"></span>
                  Tor configuration for privacy
                </li>
              </ul>
            </div>

            <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p class="text-xs text-blue-400">
               <strong>Prerequisites:</strong> Make sure Bitcoin Core is running with RPC and ZMQ enabled, and Tor is installed on your system.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 2: Bitcoin Core RPC + ZMQ -->
        <div id="step-2" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Bitcoin Core Configuration</h3>
            <p class="text-gray-400 text-sm">Connect to your Bitcoin Core node for transactions and real-time notifications.</p>
          </div>

          <div class="space-y-4">
            <!-- RPC Settings -->
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold mb-3">RPC Connection</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-2">RPC Host</label>
                  <input 
                    type="text" 
                    id="setup-rpc-host"
                    value="127.0.0.1"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
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
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label class="block text-sm text-gray-400 mb-2">RPC Username</label>
                  <input 
                    type="text" 
                    id="setup-rpc-username"
                    value="user"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-2">RPC Password</label>
                  <input 
                    type="password" 
                    id="setup-rpc-password"
                    value="password"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
              </div>
            </div>

            <!-- ZMQ Settings -->
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold mb-3">ZMQ Notifications</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-2">ZMQ Raw Block</label>
                  <input 
                    type="text" 
                    id="setup-zmq-rawblock"
                    value="tcp://127.0.0.1:28332"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-2">ZMQ Raw Transaction</label>
                  <input 
                    type="text" 
                    id="setup-zmq-rawtx"
                    value="tcp://127.0.0.1:28332"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
              </div>
            </div>

            <button id="test-rpc-setup" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
              Test RPC Connection
            </button>

            <div id="rpc-test-result" class="hidden"></div>

            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p class="text-xs text-yellow-400 mb-2">
                <strong>Required bitcoin.conf settings:</strong>
              </p>
              <div class="bg-[#0f1419] rounded mt-2 p-2 font-mono text-xs text-gray-300">
                server=1<br/>
                rpcuser=user<br/>
                rpcpassword=password<br/>
                rpcport=38332<br/>
                rpcallowip=127.0.0.1<br/>
                zmqpubrawblock=tcp://127.0.0.1:28332<br/>
                zmqpubrawtx=tcp://127.0.0.1:28332
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3A: Wallet Action Choice -->
        <div id="step-3a" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Wallet Setup</h3>
            <p class="text-gray-400 text-sm">Choose how you want to set up your wallet.</p>
          </div>

          <div class="space-y-4">
            <!-- Choice Cards -->
            <div class="grid grid-cols-3 gap-4">
              <!-- Create New Wallet -->
              <div id="choice-create" class="wallet-choice bg-[#0f1419] rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors text-center">
                <div class="text-4xl mb-3">🆕</div>
                <h4 class="text-white font-semibold mb-2">Create New</h4>
                <p class="text-xs text-gray-400">Start fresh with a new wallet</p>
              </div>

              <!-- Load Existing Wallet -->
              <div id="choice-load" class="wallet-choice bg-[#0f1419] rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors text-center">
                <div class="text-4xl mb-3">📂</div>
                <h4 class="text-white font-semibold mb-2">Load Existing</h4>
                <p class="text-xs text-gray-400">Load a wallet from file</p>
              </div>

              <!-- Restore Wallet -->
              <div id="choice-restore" class="wallet-choice bg-[#0f1419] rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors text-center">
                <div class="text-4xl mb-3">♻️</div>
                <h4 class="text-white font-semibold mb-2">Restore</h4>
                <p class="text-xs text-gray-400">Restore from backup JSON</p>
              </div>
            </div>

            <div id="choice-message" class="hidden bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p class="text-xs text-blue-400 text-center">
                Please select an option above to continue
              </p>
            </div>
          </div>
        </div>

        <!-- Step 3B: Create New Wallet -->
         
        <div id="step-3b-create" class="setup-step hidden">
          <div class="space-y-4">
            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p class="text-xs text-yellow-400">
                <strong>⚠️ Important:</strong> This password encrypts your wallet. If you forget it, you won't be able to access your funds. Make sure to store it safely!
              </p>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <div class="space-y-4">
                <!-- NEW: Wallet Name Input -->
                <div>
                  <label class="block text-sm text-gray-400 mb-2">Wallet Name</label>
                  <input
                    type="text"
                    id="create-wallet-name"
                    value="taker-wallet-${Math.floor(100000 + Math.random() * 900000)}"
                    placeholder="my-wallet"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                  <p class="text-xs text-gray-500 mt-1">Choose a unique name for your wallet</p>
                </div>

                <div>
                  <label class="block text-sm text-gray-400 mb-2">Wallet Password</label>
                  <input 
                    type="password" 
                    id="create-password"
                    placeholder="Enter a strong password"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-2">Confirm Password</label>
                  <input 
                    type="password" 
                    id="create-password-confirm"
                    placeholder="Re-enter your password"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>

                <div class="flex items-center">
                  <input 
                    type="checkbox" 
                    id="skip-encryption"
                    class="mr-2"
                  />
                  <label for="skip-encryption" class="text-xs text-gray-400">
                    Skip encryption (not recommended)
                  </label>
                </div>
              </div>
            </div>

            <div id="password-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p class="text-xs text-red-400"></p>
            </div>

            <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p class="text-xs text-green-400">
                <strong>✓ Password Tips:</strong>
              </p>
              <ul class="text-xs text-green-400 mt-2 space-y-1">
                <li>• Use at least 12 characters</li>
                <li>• Mix uppercase, lowercase, numbers, and symbols</li>
                <li>• Avoid common words or phrases</li>
                <li>• Store it in a password manager</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Step 3B: Load Existing Wallet -->
        <div id="step-3b-load" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Load Existing Wallet</h3>
            <p class="text-gray-400 text-sm">Browse for your wallet file and enter the password if encrypted.</p>
          </div>

          <div class="space-y-4">
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Wallet File</label>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  id="load-wallet-path"
                  placeholder="No file selected"
                  readonly
                  class="flex-1 bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none"
                />
                <button 
                  id="browse-wallet-file"
                  class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Browse
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">Default location: ~/.coinswap/taker/wallets/</p>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Wallet Password (if encrypted)</label>
              <input 
                type="password" 
                id="load-password"
                placeholder="Enter wallet password"
                class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
              <p class="text-xs text-gray-500 mt-2">Leave empty if wallet is not encrypted</p>
            </div>

            <div id="load-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p class="text-xs text-red-400"></p>
            </div>
          </div>
        </div>

        <!-- Step 3B: Restore from Backup -->
        <div id="step-3b-restore" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Restore from Backup</h3>
            <p class="text-gray-400 text-sm">Select your backup JSON file and enter the password if it was encrypted.</p>
          </div>

          <div class="space-y-4">
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Wallet Name (for restored wallet)</label>
              <input 
                type="text" 
                id="restore-wallet-name"
                placeholder="my-restored-wallet"
                class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
              <p class="text-xs text-gray-500 mt-1">Choose a name for the restored wallet</p>
            </div>
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Backup File (JSON)</label>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  id="restore-backup-path"
                  placeholder="No file selected"
                  readonly
                  class="flex-1 bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none"
                />
                <button 
                  id="browse-backup-file"
                  class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Backup Password (if encrypted)</label>
              <input 
                type="password" 
                id="restore-password"
                placeholder="Enter backup password"
                class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
              />

              <div class="flex items-center mt-2">
                <input 
                  type="checkbox" 
                  id="restore-no-password"
                  class="mr-2"
                />
                <label for="restore-no-password" class="text-xs text-gray-400">
                  Backup has no password
                </label>
              </div>
            </div>

            <div id="restore-status" class="hidden">
              <!-- Status will be shown here -->
            </div>

            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p class="text-xs text-purple-400">
                <strong>📋 Note:</strong> Restoring will recreate your wallet from the backup. This may take a moment.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 4: Tor Configuration -->
        <div id="step-4" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-white mb-2">Tor Configuration</h3>
            <p class="text-gray-400 text-sm">Configure Tor for private maker discovery and communication.</p>
          </div>

          <div class="space-y-4">
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold mb-3">Tor Ports</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-2">Tor Control Port</label>
                  <input 
                    type="number" 
                    id="setup-tor-control-port"
                    value="9051"
                    min="1024"
                    max="65535"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                  <p class="text-xs text-gray-500 mt-1">Control port for Tor interface</p>
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-2">Tor SOCKS Port</label>
                  <input 
                    type="number" 
                    id="setup-tor-socks-port"
                    value="9050"
                    min="1024"
                    max="65535"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                  <p class="text-xs text-gray-500 mt-1">SOCKS port for Tor proxy</p>
                </div>
              </div>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Tor Auth Password (optional)</label>
              <input 
                type="password" 
                id="setup-tor-auth-password"
                placeholder="Leave empty if no password required"
                class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
              />
              <p class="text-xs text-gray-500 mt-1">Authentication password for Tor control interface</p>
            </div>

            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p class="text-xs text-purple-400 mb-2">
                <strong>🧅 Privacy Notice:</strong>
              </p>
              <ul class="text-xs text-purple-400 space-y-1">
                <li>• All maker connections go through Tor</li>
                <li>• Maker discovery is anonymous</li>
                <li>• Your IP address stays hidden</li>
              </ul>
            </div>

            <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p class="text-xs text-green-400">
                <strong>✓ Ready to complete!</strong> Click "Complete Setup" to finish configuration and start using Coinswap.
              </p>
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
          <button id="setup-next-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(modal);

  // ============================================================================
  // FUNCTIONS
  // ============================================================================

  function updateProgress() {
    const progressFill = modal.querySelector('#progress-fill');
    const stepIndicator = modal.querySelector('#step-indicator');

    const progressPercent = (currentStep / totalSteps) * 100;
    progressFill.style.width = progressPercent + '%';
    stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
  }

  function showStep(step) {
    // Hide all steps
    modal
      .querySelectorAll('.setup-step')
      .forEach((el) => el.classList.add('hidden'));

    // Determine which substep to show for step 3
    let stepToShow = `step-${step}`;
    if (step === 3) {
      if (!walletAction) {
        stepToShow = 'step-3a'; // Show choice screen
      } else if (walletAction === 'create') {
        stepToShow = 'step-3b-create';
      } else if (walletAction === 'load') {
        stepToShow = 'step-3b-load';
      } else if (walletAction === 'restore') {
        stepToShow = 'step-3b-restore';
      }
    }

    // Show the appropriate step
    const stepElement = modal.querySelector(`#${stepToShow}`);
    if (stepElement) {
      stepElement.classList.remove('hidden');
    }

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

  async function validateStep3() {
    // If no wallet action selected, show message
    if (!walletAction) {
      showMessage('choice-message');
      return false;
    }

    // Validate the actual input in Step 3B substeps
    if (walletAction === 'create') {
      const walletName =
        modal.querySelector('#create-wallet-name')?.value || defaultWalletName;
      const password = modal.querySelector('#create-password')?.value || '';
      const confirmPassword =
        modal.querySelector('#create-password-confirm')?.value || '';
      const skipEncryption =
        modal.querySelector('#skip-encryption')?.checked || false;

      // Validate wallet name
      if (!walletName || walletName.trim() === '') {
        showError('password-error', 'Please enter a wallet name');
        return false;
      }

      // Validate password
      if (!skipEncryption && !password) {
        showError(
          'password-error',
          'Please enter a password or check "Skip encryption"'
        );
        return false;
      }

      if (!skipEncryption && password !== confirmPassword) {
        showError('password-error', 'Passwords do not match');
        return false;
      }

      if (!skipEncryption && password.length < 8) {
        showError('password-error', 'Password must be at least 8 characters');
        return false;
      }

      // Save wallet data (including wallet name)
      walletData.walletName = walletName.trim();
      walletData.password = skipEncryption ? '' : password;

      return true;
    }

    if (walletAction === 'load') {
      const walletPath = modal.querySelector('#load-wallet-path')?.value || '';
      const password = modal.querySelector('#load-password')?.value || '';

      if (!walletPath) {
        showError('load-error', 'Please select a wallet file');
        return false;
      }

      // Extract filename from path
      const walletFileName = walletPath.split('/').pop();
      walletData.walletFileName = walletFileName;
      walletData.password = password || undefined;

      return true;
    }

  if (walletAction === 'restore') {
  const backupPath = modal.querySelector('#restore-backup-path')?.value || '';
  const password = modal.querySelector('#restore-password')?.value || '';
  const noPassword = modal.querySelector('#restore-no-password')?.checked || false;
  const walletName = modal.querySelector('#restore-wallet-name')?.value?.trim() || '';

  if (!backupPath) {
    showError('restore-status', 'Please select a backup file');
    return false;
  }

  if (!walletName) {
    showError('restore-status', 'Please enter a name for the restored wallet');
    return false;
  }

  walletData.backupPath = backupPath;
  walletData.password = noPassword ? '' : password || '';
  walletData.walletName = walletName;  // ✅ Save wallet name
  return true;
}

    return false;
  }

  function showError(elementId, message) {
    const errorDiv = modal.querySelector(`#${elementId}`);
    if (errorDiv) {
      // Check if there's a <p> tag, if not create the error content
      const pTag = errorDiv.querySelector('p');
      if (pTag) {
        pTag.textContent = message;
      } else {
        errorDiv.innerHTML = `
          <div class="flex items-center">
            <span class="text-sm text-red-400">❌ ${message}</span>
          </div>
        `;
      }
      errorDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      errorDiv.classList.remove('hidden');
    }
  }

  function showMessage(elementId) {
    const messageDiv = modal.querySelector(`#${elementId}`);
    if (messageDiv) {
      messageDiv.classList.remove('hidden');
    }
  }

  function buildConfiguration() {
    const config = {
      protocol: protocolVersion, // 'v1' (P2WSH) or 'v2' (Taproot)
      rpc: {
        host: modal.querySelector('#setup-rpc-host').value,
        port: parseInt(modal.querySelector('#setup-rpc-port').value),
        username: modal.querySelector('#setup-rpc-username').value,
        password: modal.querySelector('#setup-rpc-password').value,
      },
      zmq: {
        rawblock: modal.querySelector('#setup-zmq-rawblock').value,
        rawtx: modal.querySelector('#setup-zmq-rawtx').value,
        address: modal.querySelector('#setup-zmq-rawblock').value,
      },
      taker: {
        control_port: parseInt(
          modal.querySelector('#setup-tor-control-port').value
        ),
        socks_port: parseInt(
          modal.querySelector('#setup-tor-socks-port').value
        ),
        tor_auth_password:
          modal.querySelector('#setup-tor-auth-password').value || undefined,
      },
      wallet: {
        action: walletAction,
        name: walletData.walletName,
        fileName: walletData.walletFileName,
        password: walletData.password === undefined ? '' : walletData.password,
        backupPath: walletData.backupPath,
      },
    };

    console.log('✅ Configuration built:', config);
    console.log('📋 Protocol version:', protocolVersion === 'v1' ? 'P2WSH (V1)' : 'Taproot (V2)');
    return config;
  }

  // Real RPC connection test
  async function testRPCConnection() {
    const btn = modal.querySelector('#test-rpc-setup');
    const resultDiv = modal.querySelector('#rpc-test-result');

    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    const host = modal.querySelector('#setup-rpc-host').value;
    const port = modal.querySelector('#setup-rpc-port').value;
    const username = modal.querySelector('#setup-rpc-username').value;
    const password = modal.querySelector('#setup-rpc-password').value;

    if (!username || !password) {
      resultDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      resultDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-red-400">❌ RPC username and password are required</span>
        </div>
      `;
      resultDiv.classList.remove('hidden');
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    try {
      const url = `http://${host}:${port}`;
      const auth = btoa(`${username}:${password}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: Date.now(),
          method: 'getblockchaininfo',
          params: [],
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            'Authentication failed - check RPC username/password'
          );
        } else if (response.status === 403) {
          throw new Error(
            'Access forbidden - check rpcallowip in bitcoin.conf'
          );
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }

      // Success - get network info too
      const networkResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: Date.now(),
          method: 'getnetworkinfo',
          params: [],
        }),
      });

      const networkData = await networkResponse.json();
      const version = networkData.result?.subversion || 'Unknown';
      const chain = data.result?.chain || 'unknown';
      const blocks = data.result?.blocks || 0;

      resultDiv.className =
        'bg-green-500/10 border border-green-500/30 rounded-lg p-3';
      resultDiv.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center">
            <span class="text-sm text-green-400">✅ Connection successful!</span>
          </div>
          <div class="text-xs text-gray-400">
            <span>Version: ${version}</span> • 
            <span>Network: ${chain}</span> • 
            <span>Blocks: ${blocks.toLocaleString()}</span>
          </div>
        </div>
      `;
      resultDiv.classList.remove('hidden');
    } catch (error) {
      console.error('RPC test failed:', error);

      let errorMessage = error.message;
      if (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError')
      ) {
        errorMessage = 'Cannot connect to Bitcoin Core. Is bitcoind running?';
      }

      resultDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      resultDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-red-400">❌ ${errorMessage}</span>
        </div>
      `;
      resultDiv.classList.remove('hidden');
    }

    btn.textContent = originalText;
    btn.disabled = false;
  }

  // Handle restore wallet
  async function handleRestore() {
    const backupPath = modal.querySelector('#restore-backup-path').value;
    const password = modal.querySelector('#restore-password').value;
    const statusDiv = modal.querySelector('#restore-status');

    if (!backupPath) {
      statusDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      statusDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-red-400">❌ Please select a backup file</span>
        </div>
      `;
      statusDiv.classList.remove('hidden');
      return false;
    }

    try {
      statusDiv.className =
        'bg-blue-500/10 border border-blue-500/30 rounded-lg p-3';
      statusDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-blue-400">🔄 Restoring wallet from backup...</span>
        </div>
      `;
      statusDiv.classList.remove('hidden');

      // Call Electron API to restore wallet
      const result = await window.api.restoreWallet({
        backupFilePath: backupPath,
        password: password || '',
      });

      if (result.success) {
        statusDiv.className =
          'bg-green-500/10 border border-green-500/30 rounded-lg p-3';
        statusDiv.innerHTML = `
          <div class="flex items-center">
            <span class="text-sm text-green-400">✅ Wallet restored successfully!</span>
          </div>
        `;
        return true;
      } else {
        throw new Error(result.error || 'Restore failed');
      }
    } catch (error) {
      console.error('Restore error:', error);
      statusDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      statusDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-red-400">❌ ${error.message}</span>
        </div>
      `;
      statusDiv.classList.remove('hidden');
      return false;
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  console.log('🔧 Attaching event listeners...');

  // Protocol selection
  const protocolV1 = modal.querySelector('#protocol-v1');
  const protocolV2 = modal.querySelector('#protocol-v2');

  if (protocolV1) {
    protocolV1.addEventListener('click', () => {
      protocolVersion = 'v1';
      modal.querySelectorAll('.protocol-choice').forEach((el) => {
        el.classList.remove('border-[#FF6B35]');
        el.classList.add('border-gray-700');
      });
      protocolV1.classList.remove('border-gray-700');
      protocolV1.classList.add('border-[#FF6B35]');
      console.log('Protocol selected: V1 (P2WSH)');
    });
  }

  if (protocolV2) {
    protocolV2.addEventListener('click', () => {
      protocolVersion = 'v2';
      modal.querySelectorAll('.protocol-choice').forEach((el) => {
        el.classList.remove('border-[#FF6B35]');
        el.classList.add('border-gray-700');
      });
      protocolV2.classList.remove('border-gray-700');
      protocolV2.classList.add('border-[#FF6B35]');
      console.log('Protocol selected: V2 (Taproot)');
    });
  }

  // Wallet action choice
  const choiceCreate = modal.querySelector('#choice-create');
  if (choiceCreate) {
    choiceCreate.addEventListener('click', () => {
      console.log('Create clicked!');
      walletAction = 'create';
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-[#FF6B35]');
        el.classList.add('border-gray-700');
      });
      choiceCreate.classList.remove('border-gray-700');
      choiceCreate.classList.add('border-[#FF6B35]');
      const msg = modal.querySelector('#choice-message');
      if (msg) msg.classList.add('hidden');
      showStep(currentStep);
    });
  }

  const choiceLoad = modal.querySelector('#choice-load');
  if (choiceLoad) {
    choiceLoad.addEventListener('click', () => {
      console.log('Load clicked!');
      walletAction = 'load';
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-[#FF6B35]');
        el.classList.add('border-gray-700');
      });
      choiceLoad.classList.remove('border-gray-700');
      choiceLoad.classList.add('border-[#FF6B35]');
      const msg = modal.querySelector('#choice-message');
      if (msg) msg.classList.add('hidden');
      showStep(currentStep);
    });
  }

  const choiceRestore = modal.querySelector('#choice-restore');
  if (choiceRestore) {
    choiceRestore.addEventListener('click', () => {
      console.log('Restore clicked!');
      walletAction = 'restore';
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-[#FF6B35]');
        el.classList.add('border-gray-700');
      });
      choiceRestore.classList.remove('border-gray-700');
      choiceRestore.classList.add('border-[#FF6B35]');
      const msg = modal.querySelector('#choice-message');
      if (msg) msg.classList.add('hidden');
      showStep(currentStep);
    });
  }

  // Skip encryption checkbox
  const skipEncryption = modal.querySelector('#skip-encryption');
  if (skipEncryption) {
    skipEncryption.addEventListener('change', (e) => {
      const passwordInputs = modal.querySelectorAll(
        '#create-password, #create-password-confirm'
      );
      passwordInputs.forEach((input) => {
        input.disabled = e.target.checked;
        if (e.target.checked) {
          input.value = '';
        }
      });
    });
  }

  // Browse wallet file
  const browseWalletBtn = modal.querySelector('#browse-wallet-file');
  if (browseWalletBtn) {
    browseWalletBtn.addEventListener('click', async () => {
      try {
        const result = await window.api.openFile({
          filters: [{ name: 'All Files', extensions: ['*'] }],
        });

        if (result.success && result.filePath) {
          modal.querySelector('#load-wallet-path').value = result.filePath;
          modal.querySelector('#load-error').classList.add('hidden');
        }
      } catch (error) {
        console.error('File picker error:', error);
        showError('load-error', 'Failed to open file picker');
      }
    });
  }

  // Browse backup file
  const browseBackupBtn = modal.querySelector('#browse-backup-file');
  if (browseBackupBtn) {
    browseBackupBtn.addEventListener('click', async () => {
      try {
        const result = await window.api.openFile({
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.success && result.filePath) {
          modal.querySelector('#restore-backup-path').value = result.filePath;
          modal.querySelector('#restore-status').classList.add('hidden');
        }
      } catch (error) {
        console.error('File picker error:', error);
      }
    });
  }

  const restoreNoPassword = modal.querySelector('#restore-no-password');
  if (restoreNoPassword) {
    restoreNoPassword.addEventListener('change', (e) => {
      const passwordInput = modal.querySelector('#restore-password');
      if (passwordInput) {
        passwordInput.disabled = e.target.checked;
        if (e.target.checked) {
          passwordInput.value = '';
        }
      }
    });
  }

  // Next button
  const nextBtn = modal.querySelector('#setup-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      console.log(
        'Next clicked! Current step:',
        currentStep,
        'Wallet action:',
        walletAction
      );

      if (currentStep === 3) {
        const valid = await validateStep3();
        if (!valid) {
          console.log('Validation failed');
          return;
        }

        // If restore, perform restore before proceeding
        if (walletAction === 'restore') {
          const restored = await handleRestore();
          if (!restored) {
            return;
          }
        }
      }

      if (currentStep < totalSteps) {
        currentStep++;
        console.log('Moving to step:', currentStep);
        showStep(currentStep);
      } else {
        // Complete setup
        console.log('Completing setup...');
        const config = buildConfiguration();
        modal.remove();
        if (onComplete) onComplete(config);
      }
    });
  }

  // Back button
  modal.querySelector('#setup-back-btn').addEventListener('click', () => {
    if (currentStep === 3 && walletAction) {
      // If in step 3 substep, go back to step 3a (choice)
      walletAction = null;
      walletData = {};
      showStep(currentStep);
      // Reset choice borders
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-[#FF6B35]');
        el.classList.add('border-gray-700');
      });
    } else if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  // Test RPC button
  modal
    .querySelector('#test-rpc-setup')
    .addEventListener('click', testRPCConnection);

  // Initialize
  showStep(currentStep);

  return modal;
}
