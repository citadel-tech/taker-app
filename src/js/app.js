import { NavComponent } from '../components/Nav.js';
import { WalletComponent } from '../components/wallet/Wallet.js';
import { Market } from '../components/market/Market.js';
import { SendComponent } from '../components/send/Send.js';
import { ReceiveComponent } from '../components/receive/Receive.js';
import { SwapComponent } from '../components/swap/Swap.js';
import { RecoveryComponent } from '../components/recovery/Recovery.js';
import { LogComponent } from '../components/log/Log.js';
import { SettingsComponent } from '../components/settings/Settings.js';
import { FirstTimeSetupModal } from '../components/settings/FirstTimeSetup.js';
import { SwapStateManager } from '../components/swap/SwapStateManager.js';
import { ConnectionStatusComponent } from '../components/connection/ConnectionStatus.js';
import { bitcoindConnection } from '../components/connection/BitcoindConnection.js';
import { TakerInitializationComponent } from '../components/taker/TakerInitialization.js';

// Component map
const components = {
  wallet: WalletComponent,
  market: Market,
  send: SendComponent,
  receive: ReceiveComponent,
  swap: SwapComponent,
  recovery: RecoveryComponent,
  log: LogComponent,
  settings: SettingsComponent,
};

// Background swap manager - runs independently of UI components
let backgroundSwapManager = null;

async function startBackgroundSwapManager() {
  // Prevent duplicate intervals
  if (backgroundSwapManager) return;

  // Only start if swap actually exists
  const existing = await SwapStateManager.getActiveSwap();
  if (!existing) return;   // ❗ DO NOT START MANAGER

  backgroundSwapManager = setInterval(async () => {
    const activeSwap = await SwapStateManager.getActiveSwap();
    if (!activeSwap) {
      stopBackgroundSwapManager();
      return;
    }

    eventBus.emit('swap:poll', activeSwap);
  }, 1000);
}


function stopBackgroundSwapManager() {
  if (backgroundSwapManager) {
    clearInterval(backgroundSwapManager);
    backgroundSwapManager = null;
  }
}

// Render component
async function renderComponent(name) {  // ✅ Make async
  const contentContainer = document.querySelector('#content-area');
  if (!contentContainer) return;

  const activeSwap = await SwapStateManager.getActiveSwap();  // ✅ Add await
  if (activeSwap && activeSwap.status === 'in_progress' && name === 'swap') {
    contentContainer.innerHTML = '';
    import('../components/swap/Coinswap.js').then((module) => {
      module.CoinswapComponent(contentContainer, activeSwap);
    });
    return;
  }

  contentContainer.innerHTML = '';
  const component = components[name];
  if (component) {
    component(contentContainer);
  }
}

// Setup navigation handlers
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach((item) => {
    item.addEventListener('click', async (e) => {  // ✅ Add async
      e.preventDefault();

      navItems.forEach((nav) => {
        nav.classList.remove('bg-[#FF6B35]', 'text-white');
        nav.classList.add('bg-[#242d3d]', 'text-gray-400');
      });

      item.classList.remove('bg-[#242d3d]', 'text-gray-400');
      item.classList.add('bg-[#FF6B35]', 'text-white');

      const navName = item.getAttribute('data-nav');
      await renderComponent(navName);  // ✅ Add await
    });
  });
}

// Check bitcoind connection and show connection status
async function checkBitcoindConnection(config) {
  console.log('🔌 Checking Bitcoin Core connection...');

  // Update the connection manager with config from setup
  if (config) {
    bitcoindConnection.updateConfig(config);
  }

  // Show connection status component
  const appContainer = document.querySelector('body');
  ConnectionStatusComponent(appContainer, (connectionInfo) => {
    console.log('✅ Bitcoin Core connected, starting app...', connectionInfo);
    checkTakerInitialization(config);
  });
}

async function checkTakerInitialization(config) {
  console.log('🔄 Checking Taker initialization...');

  if (!config || !config.rpc) {
    console.log('⚠️ RPC configuration missing, skipping taker initialization');
    startMainApp();
    return;
  }

  try {
    // Extract wallet name from config
    const walletName = config.wallet?.name || config.wallet?.fileName || 'taker-wallet';
    
    console.log('🔍 Checking wallet:', walletName);

    // Store it in config so showPasswordPrompt can use it
    if (!config.wallet.name && !config.wallet.fileName) {
      config.wallet.name = walletName;
    }

    // Check if wallet file is encrypted
    const isEncrypted = await window.api.taker.isWalletEncrypted(null, walletName);
    console.log('🔐 Wallet file encrypted:', isEncrypted);

    if (isEncrypted) {
      console.log('🔓 Wallet is encrypted, showing password prompt...');
      await showPasswordPrompt(config);  // ✅ Config has correct wallet name
    } else {
      console.log('🔓 Wallet is not encrypted');
      
      const result = await window.api.taker.initialize(config);

      if (result.success) {
        console.log('✅ Taker initialized');
        startMainApp();
      } else {
        console.error('❌ Taker initialization failed:', result.error);
        alert('Failed to initialize: ' + result.error);
      }
    }
  } catch (error) {
    console.error('❌ Initialization check failed:', error);
    alert('Initialization failed: ' + error.message);
  }
}

function startTakerInitWithConfig(config) {
  const appContainer = document.querySelector('body');
  TakerInitializationComponent(appContainer, config, (result) => {
    if (result && result.skipped) {
      console.log('⏭️ Taker initialization skipped');
    } else {
      console.log('✅ Taker initialized');
    }
    startMainApp();
  });
}

async function showPasswordPrompt(config) {
  // Extract wallet name for display
  const walletName = config.wallet?.name || config.wallet?.fileName || 'taker-wallet';
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-[#1a2332] rounded-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-xl font-bold text-white mb-4">🔐 Wallet Password Required</h3>
      <p class="text-gray-400 text-sm mb-4">
        Your wallet "<span class="font-mono text-[#FF6B35]">${walletName}</span>" is encrypted. 
        Please enter your password to unlock it.
      </p>
      
      <input 
        type="password" 
        id="wallet-password-input"
        placeholder="Enter wallet password"
        class="w-full bg-[#0f1419] border border-gray-600 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-[#FF6B35]"
      />
      
      <div id="password-error" class="hidden bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
        <p class="text-sm text-red-400"></p>
      </div>
      
      <div class="flex gap-3">
        <button id="cancel-password-btn" class="flex-1 bg-[#242d3d] hover:bg-[#2d3748] text-white py-3 rounded-lg">
          Cancel
        </button>
        <button id="submit-password-btn" class="flex-1 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-3 rounded-lg">
          Unlock Wallet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const passwordInput = modal.querySelector('#wallet-password-input');
  const submitBtn = modal.querySelector('#submit-password-btn');
  const cancelBtn = modal.querySelector('#cancel-password-btn');
  const errorDiv = modal.querySelector('#password-error');

  passwordInput.focus();

  return new Promise((resolve) => {
    async function tryPassword() {
      const password = passwordInput.value;

      if (!password) {
        errorDiv.classList.remove('hidden');
        errorDiv.querySelector('p').textContent = 'Please enter a password';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Unlocking...';

      try {
        // Add password to config
        const configWithPassword = {
          ...config,
          wallet: {
            ...config.wallet,
            password: password,
          },
        };

        const result = await window.api.taker.initialize(configWithPassword);

        if (result.success) {
          modal.remove();
          resolve(true);
          startMainApp();
        } else if (result.wrongPassword) {
          errorDiv.classList.remove('hidden');
          errorDiv.querySelector('p').textContent =
            'Incorrect password. Please try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Unlock Wallet';
          passwordInput.value = '';
          passwordInput.focus();
        } else {
          throw new Error(result.error || 'Initialization failed');
        }
      } catch (error) {
        console.error('Password verification failed:', error);
        errorDiv.classList.remove('hidden');
        errorDiv.querySelector('p').textContent =
          'Failed to unlock: ' + error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Unlock Wallet';
      }
    }

    submitBtn.addEventListener('click', tryPassword);
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') tryPassword();
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
  });
}

// Start the main app after bitcoind connection is established
async function startMainApp() {  // ✅ Make async
  const activeSwap = await SwapStateManager.getActiveSwap();  // ✅ Add await
  if (activeSwap && activeSwap.status === 'in_progress') {
    console.log('Found active swap, redirecting to coinswap progress');
    startBackgroundSwapManager();
    import('../components/swap/Coinswap.js').then((module) => {
      const contentContainer = document.querySelector('#content-area');
      if (contentContainer) {
        module.CoinswapComponent(contentContainer, activeSwap);
      }
    });
    setTimeout(() => {
      const swapNavItem = document.querySelector('[data-nav="swap"]');
      if (swapNavItem) {
        document.querySelectorAll('.nav-item').forEach((nav) => {
          nav.classList.remove('bg-[#FF6B35]', 'text-white');
          nav.classList.add('bg-[#242d3d]', 'text-gray-400');
        });
        if (!swapNavItem.classList.contains('bg-orange-500')) {
          swapNavItem.classList.remove('bg-[#242d3d]', 'text-gray-400');
          swapNavItem.classList.add('bg-[#FF6B35]', 'text-white');
        }
      }
    }, 100);
  } else {
    renderComponent('wallet');
    console.log('Wallet loaded');
  }

  // ✅ Fix this too
  if (await SwapStateManager.hasActiveSwap()) {
    startBackgroundSwapManager();
  }
}
// Initiate the app start process (after setup completion)
function initiateAppStart(config) {
  // Small delay to let setup success message show
  setTimeout(() => {
    checkBitcoindConnection(config);
  }, 1500);
}

// Initialize app
// Initialize app
document.addEventListener('DOMContentLoaded', async () => {  // ✅ Make async
  console.log('App initializing...');

  const navContainer = document.querySelector('#nav-container');
  if (navContainer) {
    await NavComponent(navContainer);  // ✅ Add await
    console.log('Nav rendered');
  } else {
    console.error('Nav container not found!');
  }

  setupNavigation();  // ✅ This now runs AFTER nav is fully rendered

  const appContainer = document.querySelector('body');

  // Load config if exists
  const saved = localStorage.getItem("coinswap_config");

  if (!saved) {
    // First-time setup ONLY ONCE
    console.log('🔧 Showing setup modal...');
    FirstTimeSetupModal(appContainer, (config) => {

      console.log("Setup completed:", config);

      // save config
      localStorage.setItem("coinswap_config", JSON.stringify(config));

      initiateAppStart(config);
      showSetupSuccess();
    });
  } else {
    // Config exists → skip setup
    const config = JSON.parse(saved);
    initiateAppStart(config);
  }
});

function showSetupSuccess() {
  const successDiv = document.createElement('div');
  successDiv.className =
    'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300';
  successDiv.innerHTML = `
      <div class="flex items-center">
        <span class="mr-2">✔</span>
        <span>Setup completed successfully!</span>
      </div>
    `;
  document.body.appendChild(successDiv);

  setTimeout(() => {
    successDiv.style.opacity = '0';
    setTimeout(() => successDiv.remove(), 300);
  }, 3000);
}


// Export functions for components to use
window.appManager = {
  startBackgroundSwapManager,
  stopBackgroundSwapManager,
  renderComponent,
};
