export function FirstTimeSetupModal(container, onComplete) {
  const defaultWalletName = `taker-wallet-${Math.floor(100000 + Math.random() * 900000)}`;
  const iconClass = 'w-5 h-5 flex-shrink-0';
  const iconWarning = `
    <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86l-7.55 13.09A1 1 0 003.61 18h16.78a1 1 0 00.87-1.5L13.71 3.86a1 1 0 00-1.74 0z"/>
    </svg>
  `;
  const iconInfo = `
    <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  `;
  const iconShield = `
    <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l7 4v5c0 5-3.5 7.74-7 9-3.5-1.26-7-4-7-9V7l7-4z"/>
    </svg>
  `;
  const modal = document.createElement('div');
  modal.id = 'setup-modal';
  modal.className =
    'fixed inset-0 bg-black/70 flex items-center justify-center z-50';

  let currentStep = 1;
  const totalSteps = 3;
  let walletAction = null; // 'create', 'load', or 'restore'
  let walletData = {};
  let protocolVersion = 'v2'; // Fixed app-local default until the rest of the flow stops expecting v1/v2.

  modal.innerHTML = `
    <div class="bg-[#1a2332] rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="bg-[#FF6B35] rounded-t-lg p-6">
        <h2 class="text-2xl font-bold text-white mb-2">Coinswap Client GUI</h2>
        <p class="text-white/90 text-sm">Wallet and Other Setups.</p>
        <div class="mt-4 flex items-center">
          <div id="progress-bar" class="bg-white/20 rounded-full h-2 flex-1">
            <div id="progress-fill" class="bg-white rounded-full h-2 transition-all duration-300" style="width: 33%"></div>
          </div>
          <span id="step-indicator" class="ml-3 inline-flex items-center self-center rounded-full bg-white px-3 py-1 text-sm font-bold leading-none text-[#FF6B35]">Step 1 of 3</span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Step 1: Bitcoin Endpoints -->
        <div id="step-1" class="setup-step">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Bitcoin Endpoints</h3>
            <p class="text-gray-400 text-sm">Connect to a running bitcoind RPC+REST & ZMQ Ports. This is needed to sync the wallet and market data.</p>
          </div>

          <div class="space-y-4">
            <!-- RPC Settings -->
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold text-lg mb-3">RPC Connection</h4>
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
  <div class="relative">
    <input 
      type="password" 
      id="setup-rpc-password"
      value="password"
      class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
    />
    <button
      type="button"
      id="toggle-rpc-password"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
</div>
              </div>
            </div>

            <!-- ZMQ Settings -->
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <h4 class="text-white font-semibold text-lg mb-3">ZMQ Notifications</h4>
              <div>
                <div>
                  <label class="block text-sm text-gray-400 mb-2">ZMQ Port</label>
                  <input 
                    type="number"
                    id="setup-zmq-port"
                    value="28332"
                    min="1"
                    max="65535"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                </div>
              </div>
            </div>

            <button id="test-rpc-setup" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg py-3 px-4 rounded-lg transition-colors">
              Test Node Connection
            </button>

            <div id="rpc-test-result" class="hidden"></div>

            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
  <div class="flex items-start gap-3 text-sm text-yellow-400">
    ${iconInfo}
    <p>
      <strong>Info:</strong> Don't have a running Bitcoin Node? Follow these instructions to setup your own node.
      <a href="https://github.com/citadel-tech/coinswap/blob/master/docs/bitcoind.md" class="text-bitcoin-orange hover:underline" target="_blank" rel="noreferrer">
        Node setup instructions
      </a>
    </p>
  </div>
</div>
          </div>
        </div>

        <!-- Step 3A: Wallet Action Choice -->
        <div id="step-3a" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Choose A Wallet. Or Create a New One.</h3>
          </div>

          <div class="space-y-4">
            <!-- Choice Cards -->
            <div class="grid grid-cols-3 gap-4">
              <!-- Create New Wallet -->
              <div id="choice-create" class="wallet-choice bg-[#0f1419] rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors text-center">
                <div class="text-4xl mb-3">🆕</div>
                <h4 class="text-white font-semibold text-lg mb-2">Create New</h4>
                <p class="text-xs text-gray-400">Start fresh with a new wallet</p>
              </div>

              <!-- Load Existing Wallet -->
              <div id="choice-load" class="wallet-choice bg-[#0f1419] rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors text-center">
                <div class="text-4xl mb-3">📂</div>
                <h4 class="text-white font-semibold text-lg mb-2">Load Existing</h4>
                <p class="text-xs text-gray-400">Load a wallet from file</p>
              </div>

              <!-- Restore Wallet -->
              <div id="choice-restore" class="wallet-choice bg-[#0f1419] rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-[#FF6B35] transition-colors text-center">
                <div class="text-4xl mb-3">♻️</div>
                <h4 class="text-white font-semibold text-lg mb-2">Restore</h4>
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

        <!-- Step 4B: Create New Wallet -->
         
        <div id="step-3b-create" class="setup-step hidden">
          <div class="space-y-4">
            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div class="flex items-start gap-3 text-xs text-yellow-400">
                ${iconWarning}
                <p>
                  <strong>Important:</strong> This password encrypts your wallet. If you forget it, you won't be able to access your funds. Make sure to store it safely!
                </p>
              </div>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <div class="space-y-4">
                <!-- NEW: Wallet Name Input -->
                <div>
                  <label class="block text-sm text-gray-400 mb-2">Wallet Name</label>
                  <input
                    type="text"
                    id="create-wallet-name"
                    value="${defaultWalletName}"
                    placeholder="my-wallet"
                    class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                  />
                  <p class="text-xs text-gray-500 mt-1">Choose a unique name for your wallet</p>
                </div>

                <div>
  <label class="block text-sm text-gray-400 mb-2">Wallet Password</label>
  <p class="text-xs text-gray-500 mb-1">Leaving it empty will create unencrypted wallet file</p>
  <div class="relative">
    <input 
      type="password" 
      id="create-password"
      placeholder="Enter a strong password"
      class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
    />
    <button
      type="button"
      id="toggle-create-password"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
</div>
<div>
  <label class="block text-sm text-gray-400 mb-2">Confirm Password</label>
  <div class="relative">
    <input 
      type="password" 
      id="create-password-confirm"
      placeholder="Re-enter your password"
      class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
    />
    <button
      type="button"
      id="toggle-create-password-confirm"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
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

        <!-- Step 4B: Load Existing Wallet -->
        <div id="step-3b-load" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Load Existing Wallet</h3>
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
                  class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-2 px-6 rounded-lg transition-colors"
                >
                  Browse
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">Default location: ~/.coinswap/taker/wallets/</p>
            </div>

            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
  <label class="block text-sm text-gray-400 mb-2">Wallet Password (if encrypted)</label>
  <div class="relative">
    <input 
      type="password" 
      id="load-password"
      placeholder="Enter wallet password"
      class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
    />
    <button
      type="button"
      id="toggle-load-password"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
  <p class="text-xs text-gray-500 mt-2">Leave empty if wallet is not encrypted</p>
</div>

            <div id="load-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p class="text-xs text-red-400"></p>
            </div>
          </div>
        </div>

        <!-- Step 4B: Restore from Backup -->
        <div id="step-3b-restore" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Restore from Backup</h3>
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
                  class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-2 px-6 rounded-lg transition-colors"
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
            </div>

            <div id="restore-status" class="hidden">
              <!-- Status will be shown here -->
            </div>

            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div class="flex items-start gap-3 text-xs text-purple-400">
                ${iconInfo}
                <p>
                  <strong>Note:</strong> Restoring will re-sync the wallet from wallet-birthday. This can take some time.
                </p>
              </div>
            </div>
          </div>
        </div>

  <!-- Step 2: Tor Configuration -->
  <div id="step-2" class="setup-step hidden">
    <div class="mb-6">
      <h3 class="text-xl font-semibold text-lg text-white mb-2">Tor Configuration</h3>
      <p class="text-gray-400 text-sm">Connect with the Tor Proxy. This is needed for all network communications.</p>
    </div>

    <div class="space-y-4">
      <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
        <h4 class="text-white font-semibold text-lg mb-3">Tor Ports</h4>
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
          </div>
        </div>
      </div>

      <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
        <label class="block text-sm text-gray-400 mb-2">Tor Auth Password (optional)</label>
        <div class="relative">
          <input 
            type="password" 
            id="setup-tor-auth-password"
            placeholder="Leave empty if no password required"
            class="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
          />
          <button
            type="button"
            id="toggle-setup-tor-password"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle password visibility"
          >
            <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
            </svg>
          </button>
        </div>
      </div>

      <button id="test-tor-setup" class="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold text-lg py-3 px-4 rounded-lg transition-colors">
        🧅 Test Tor Connection
      </button>

      <div id="tor-test-result" class="hidden"></div>

      <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div class="flex items-start gap-3 text-xs text-blue-400">
          ${iconInfo}
          <p>
            <strong>Info:</strong> Don't have a running Tor instance? Use these instructions to set up.
            <a href="https://github.com/citadel-tech/coinswap/blob/master/docs/tor.md" class="text-blue-300 hover:underline" target="_blank" rel="noreferrer">
              Tor setup instructions
            </a>
          </p>
        </div>
      </div>

      <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <div class="flex items-start gap-3 text-xs text-green-400">
          ${iconShield}
          <p>
            <strong>Ready to complete!</strong> Click "Complete Setup" to finish configuration and start using Coinswap.
          </p>
        </div>
      </div>
    </div>
  </div>

      <!-- Footer -->
      <div class="bg-[#0f1419] rounded-b-lg p-6 flex justify-between">
        <button id="setup-back-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold text-lg py-3 px-6 rounded-lg transition-colors border border-gray-700 hidden">
          Back
        </button>
        <div class="flex space-x-3 ml-auto">
          <button id="setup-next-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-3 px-6 rounded-lg transition-colors">
            Next
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

  function getRpcUrl(host, port) {
    return `http://${host}:${port}`;
  }

  function getRestUrl(host, port) {
    return `${getRpcUrl(host, port)}/rest/chaininfo.json`;
  }

  function getZmqAddress(port) {
    return `tcp://127.0.0.1:${port}`;
  }

  function renderConnectionResults(resultDiv, results) {
    const hasFailure = results.some((result) => !result.ok);
    resultDiv.className = hasFailure
      ? 'bg-red-500/10 border border-red-500/30 rounded-lg p-3'
      : 'bg-green-500/10 border border-green-500/30 rounded-lg p-3';
    resultDiv.innerHTML = `
      <div class="space-y-2">
        ${results
          .map(
            (result) => `
              <div class="flex items-start justify-between gap-3">
                <span class="text-sm ${result.ok ? 'text-green-400' : 'text-red-400'}">
                  ${result.ok ? '✅' : '❌'} ${result.label}
                </span>
                <span class="text-xs text-gray-400 text-right">${result.message}</span>
              </div>
            `
          )
          .join('')}
      </div>
    `;
    resultDiv.classList.remove('hidden');
  }

  function syncFormData() {
    walletData.rpc = {
      host: modal.querySelector('#setup-rpc-host')?.value || '127.0.0.1',
      port: modal.querySelector('#setup-rpc-port')?.value || '38332',
      username: modal.querySelector('#setup-rpc-username')?.value || 'user',
      password: modal.querySelector('#setup-rpc-password')?.value || 'password',
      zmqPort: modal.querySelector('#setup-zmq-port')?.value || '28332',
    };

    walletData.create = {
      walletName:
        modal.querySelector('#create-wallet-name')?.value || defaultWalletName,
      password: modal.querySelector('#create-password')?.value || '',
      confirmPassword:
        modal.querySelector('#create-password-confirm')?.value || '',
    };

    walletData.load = {
      walletPath: modal.querySelector('#load-wallet-path')?.value || '',
      password: modal.querySelector('#load-password')?.value || '',
    };

    walletData.restore = {
      walletName: modal.querySelector('#restore-wallet-name')?.value || '',
      backupPath: modal.querySelector('#restore-backup-path')?.value || '',
      password: modal.querySelector('#restore-password')?.value || '',
    };

    walletData.tor = {
      controlPort: modal.querySelector('#setup-tor-control-port')?.value || '9051',
      socksPort: modal.querySelector('#setup-tor-socks-port')?.value || '9050',
      authPassword:
        modal.querySelector('#setup-tor-auth-password')?.value || '',
    };
  }

  function restoreFormData() {
    const rpcData = walletData.rpc || {};
    const createData = walletData.create || {};
    const loadData = walletData.load || {};
    const restoreData = walletData.restore || {};
    const torData = walletData.tor || {};

    const setValue = (selector, value) => {
      const input = modal.querySelector(selector);
      if (input && value !== undefined) {
        input.value = value;
      }
    };

    const setChecked = (selector, checked) => {
      const input = modal.querySelector(selector);
      if (input) {
        input.checked = Boolean(checked);
      }
    };

    setValue('#setup-rpc-host', rpcData.host);
    setValue('#setup-rpc-port', rpcData.port);
    setValue('#setup-rpc-username', rpcData.username);
    setValue('#setup-rpc-password', rpcData.password);
    setValue('#setup-zmq-port', rpcData.zmqPort);

    setValue('#create-wallet-name', createData.walletName || defaultWalletName);
    setValue('#create-password', createData.password);
    setValue('#create-password-confirm', createData.confirmPassword);

    setValue('#load-wallet-path', loadData.walletPath);
    setValue('#load-password', loadData.password);

    setValue('#restore-wallet-name', restoreData.walletName);
    setValue('#restore-backup-path', restoreData.backupPath);
    setValue('#restore-password', restoreData.password);

    setValue('#setup-tor-control-port', torData.controlPort);
    setValue('#setup-tor-socks-port', torData.socksPort);
    setValue('#setup-tor-auth-password', torData.authPassword);
  }

  function showStep(step) {
    syncFormData();

    // Hide all steps
    modal
      .querySelectorAll('.setup-step')
      .forEach((el) => el.classList.add('hidden'));

    // Determine which screen to show for each wizard step.
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

    restoreFormData();

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

  async function validateWalletStep() {
    syncFormData();

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

      // Validate wallet name
      if (!walletName || walletName.trim() === '') {
        showError('password-error', 'Please enter a wallet name');
        return false;
      }

      if (password !== confirmPassword) {
        showError('password-error', 'Passwords do not match');
        return false;
      }

      if (password && password.length < 8) {
        showError('password-error', 'Password must be at least 8 characters');
        return false;
      }

      // Save wallet data (including wallet name)
      walletData.walletName = walletName.trim();
      walletData.password = password;
      walletData.create = {
        walletName: walletName.trim(),
        password,
        confirmPassword,
      };

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
      walletData.load = {
        walletPath,
        password,
      };

      return true;
    }

    if (walletAction === 'restore') {
      const backupPath =
        modal.querySelector('#restore-backup-path')?.value || '';
      const password = modal.querySelector('#restore-password')?.value || '';
      const walletName =
        modal.querySelector('#restore-wallet-name')?.value?.trim() || '';

      if (!backupPath) {
        showError('restore-status', 'Please select a backup file');
        return false;
      }

      if (!walletName) {
        showError(
          'restore-status',
          'Please enter a name for the restored wallet'
        );
        return false;
      }

      walletData.backupPath = backupPath;
      walletData.password = password || '';
      walletData.walletName = walletName;
      walletData.restore = {
        walletName,
        backupPath,
        password,
      };
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
    const zmqPort = modal.querySelector('#setup-zmq-port').value;
    const zmqAddress = getZmqAddress(zmqPort);

    const config = {
      protocol: protocolVersion, // 'v1' (P2WSH) or 'v2' (Taproot)
      rpc: {
        host: modal.querySelector('#setup-rpc-host').value,
        port: parseInt(modal.querySelector('#setup-rpc-port').value),
        username: modal.querySelector('#setup-rpc-username').value,
        password: modal.querySelector('#setup-rpc-password').value,
      },
      zmq: {
        rawblock: zmqAddress,
        rawtx: zmqAddress,
        address: zmqAddress,
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
    console.log(
      '📋 Protocol version:',
      protocolVersion === 'v1' ? 'P2WSH (V1)' : 'Taproot (V2)'
    );
    return config;
  }

  async function makeRpcCall(method, params = []) {
    const host = modal.querySelector('#setup-rpc-host').value;
    const port = modal.querySelector('#setup-rpc-port').value;
    const username = modal.querySelector('#setup-rpc-username').value;
    const password = modal.querySelector('#setup-rpc-password').value;

    if (!username || !password) {
      throw new Error('RPC username and password are required');
    }

    const response = await fetch(getRpcUrl(host, port), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - check RPC username/password');
      }
      if (response.status === 403) {
        throw new Error('Access forbidden - check rpcallowip in bitcoin.conf');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`);
    }

    return data.result;
  }

  // Real node connection test
  async function testRPCConnection() {
    const btn = modal.querySelector('#test-rpc-setup');
    const resultDiv = modal.querySelector('#rpc-test-result');

    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    const host = modal.querySelector('#setup-rpc-host').value;
    const port = modal.querySelector('#setup-rpc-port').value;
    const zmqPort = parseInt(modal.querySelector('#setup-zmq-port').value, 10);

    try {
      const [blockchainInfo, networkInfo, restResponse, zmqResult] =
        await Promise.allSettled([
          makeRpcCall('getblockchaininfo'),
          makeRpcCall('getnetworkinfo'),
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

      const results = [
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
          ok:
            zmqResult.status === 'fulfilled' &&
            Boolean(zmqResult.value?.success),
          message:
            zmqResult.status === 'fulfilled' && zmqResult.value?.success
              ? `Port ${zmqPort} reachable`
              : zmqResult.status === 'fulfilled'
                ? zmqResult.value?.error
                : zmqResult.reason?.message,
        },
      ];

      renderConnectionResults(resultDiv, results);
    } catch (error) {
      console.error('RPC test failed:', error);

      renderConnectionResults(resultDiv, [
        {
          label: 'Node Test',
          ok: false,
          message:
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')
              ? 'Cannot connect to Bitcoin Core. Is bitcoind running?'
              : error.message,
        },
      ]);
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

  // Test Tor connection
  async function testTorConnection() {
    const btn = modal.querySelector('#test-tor-setup');
    const resultDiv = modal.querySelector('#tor-test-result');

    if (!btn || !resultDiv) return;

    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    const socksPort = parseInt(
      modal.querySelector('#setup-tor-socks-port').value
    );
    const controlPort = parseInt(
      modal.querySelector('#setup-tor-control-port').value
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

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  console.log('🔧 Attaching event listeners...');

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

  // Reusable function to toggle password visibility
  function setupPasswordToggle(toggleButtonId, passwordInputId) {
    const toggleButton = modal.querySelector(toggleButtonId);
    if (!toggleButton) return;

    toggleButton.addEventListener('click', () => {
      const passwordInput = modal.querySelector(passwordInputId);
      const eyeIcon = toggleButton.querySelector('.eye-icon');
      const eyeSlashIcon = toggleButton.querySelector('.eye-slash-icon');

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
  }

  // Setup all password toggles
  setupPasswordToggle('#toggle-setup-tor-password', '#setup-tor-auth-password');
  setupPasswordToggle('#toggle-create-password', '#create-password');
  setupPasswordToggle(
    '#toggle-create-password-confirm',
    '#create-password-confirm'
  );
  setupPasswordToggle('#toggle-rpc-password', '#setup-rpc-password');
  setupPasswordToggle('#toggle-load-password', '#load-password');

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
        const valid = await validateWalletStep();
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

  // Test Tor button
  const testTorBtn = modal.querySelector('#test-tor-setup');
  if (testTorBtn) {
    testTorBtn.addEventListener('click', testTorConnection);
  }

  // Test RPC button
  modal
    .querySelector('#test-rpc-setup')
    .addEventListener('click', testRPCConnection);

  modal
    .querySelector('#test-tor-setup')
    .addEventListener('click', testTorConnection);

  // Initialize
  showStep(currentStep);

  return modal;
}
