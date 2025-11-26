import { NavComponent } from '../components/Nav.js';
import { WalletComponent } from '../components/wallet/Wallet.js';
import { Market } from '../components/market/Market.js';
import { SendComponent } from '../components/send/Send.js';
import { ReceiveComponent } from '../components/receive/Receive.js';
import { SwapComponent } from '../components/swap/Swap.js';
import { RecoveryComponent } from '../components/recovery/Recovery.js';
import { LogComponent } from '../components/log/Log.js';
import { SettingsComponent } from '../components/settings/Settings.js';
import {
  FirstTimeSetupModal,
  isSetupComplete,
  getSavedConfig,
} from '../components/settings/FirstTimeSetup.js';
import { SwapStateManager } from '../components/swap/SwapStateManager.js';
import { ConnectionStatusComponent } from '../components/connection/ConnectionStatus.js';
import { bitcoindConnection } from '../components/connection/BitcoindConnection.js';
import { TakerInitializationComponent } from '../components/taker/TakerInitialization.js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

function startBackgroundSwapManager() {
  if (backgroundSwapManager) return; // Already running

  backgroundSwapManager = setInterval(() => {
    const activeSwap = SwapStateManager.getActiveSwap();

    if (!activeSwap) {
      stopBackgroundSwapManager();
      return;
    }

    if (activeSwap.status === 'completed' || activeSwap.status === 'failed') {
      stopBackgroundSwapManager();
      // Refresh navigation to remove active indicators
      const navContainer = document.querySelector('#nav-container');
      if (navContainer) {
        navContainer.innerHTML = '';
        NavComponent(navContainer);
        setupNavigation();
      }
      return;
    }

    // Continue swap progression in background
    if (activeSwap.status === 'in_progress') {
      // This keeps the swap logic running even when not on the coinswap page
      // The actual swap logic will be handled by the coinswap component
      // when the user returns to it
    }
  }, 1000);
}

function stopBackgroundSwapManager() {
  if (backgroundSwapManager) {
    clearInterval(backgroundSwapManager);
    backgroundSwapManager = null;
  }
}

// Render component
function renderComponent(name) {
  const contentContainer = document.querySelector('#content-area');
  if (!contentContainer) return;

  // Check if user is trying to navigate away from an active swap
  const activeSwap = SwapStateManager.getActiveSwap();
  if (activeSwap && activeSwap.status === 'in_progress' && name === 'swap') {
    // If navigating to swap with active swap, go directly to coinswap progress
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
    item.addEventListener('click', (e) => {
      e.preventDefault();

      navItems.forEach((nav) => {
        nav.classList.remove('bg-[#FF6B35]', 'text-white');
        nav.classList.add('bg-[#242d3d]', 'text-gray-400');
      });

      item.classList.remove('bg-[#242d3d]', 'text-gray-400');
      item.classList.add('bg-[#FF6B35]', 'text-white');

      const navName = item.getAttribute('data-nav');
      renderComponent(navName);
    });
  });
}

// Show first-time setup modal if needed
function checkFirstTimeSetup() {
  const config = getSavedConfig();

  // Show setup if:
  // 1. No config exists at all, OR
  // 2. RPC username or password is empty/missing
  const needsSetup =
    !config ||
    !config.setupComplete ||
    !config.rpc ||
    !config.rpc.username ||
    !config.rpc.password ||
    config.rpc.username.trim() === '' ||
    config.rpc.password.trim() === '';

  if (needsSetup) {
    console.log(
      '🔧 Setup required (missing RPC credentials), showing setup modal...'
    );
    const appContainer = document.querySelector('body');

    FirstTimeSetupModal(appContainer, (config) => {
      console.log('Setup completed:', config);

      // Show success message
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

      // After setup, immediately try to connect to bitcoind
      initiateAppStart();
    });
    return true; // Setup modal shown
  } else {
    console.log('✅ Setup already complete with valid credentials:', config);
    return false; // Setup not needed
  }
}

// Check bitcoind connection and show connection status
async function checkBitcoindConnection() {
  console.log('🔌 Checking Bitcoin Core connection...');

  // Update the connection manager with latest config
  const config = getSavedConfig();
  if (config) {
    bitcoindConnection.updateConfig(config);
  }

  // Show connection status component
  const appContainer = document.querySelector('body');
  ConnectionStatusComponent(appContainer, (connectionInfo) => {
    console.log('✅ Bitcoin Core connected, starting app...', connectionInfo);
    checkTakerInitialization();
  });
}

async function checkTakerInitialization() {
  console.log('🔄 Checking Taker initialization...');

  const config = getSavedConfig();

  if (!config || !config.rpc) {
    console.log('⚠️ RPC configuration missing, skipping taker initialization');
    startMainApp();
    return;
  }

  // Check BOTH localStorage hash AND actual wallet file
  const hasPasswordHash = localStorage.getItem('wallet_password_hash');

  // Also check if wallet file exists and is encrypted
  let walletIsEncrypted = false;
  try {
    walletIsEncrypted = await window.api.taker.isWalletEncrypted();
  } catch (error) {
    console.log('Could not check wallet encryption:', error);
  }

  console.log('🔐 Password hash in storage:', !!hasPasswordHash);
  console.log('🔐 Wallet file encrypted:', walletIsEncrypted);

  // Show prompt if EITHER condition is true
  if (hasPasswordHash || walletIsEncrypted) {
    console.log('🔐 Encrypted wallet detected - showing password prompt');

    showPasswordPrompt((password) => {
      const configWithPassword = {
        ...config,
        wallet: { ...config.wallet, password },
      };

      // Store hash for future use if not already stored
      if (!hasPasswordHash && password) {
        hashPassword(password).then((hash) => {
          localStorage.setItem('wallet_password_hash', hash);
          console.log('🔐 Password hash stored after successful unlock');
        });
      }

      startTakerInitWithConfig(configWithPassword);
    });

    return;
  }

  console.log('🔓 Wallet is not encrypted');
  startTakerInitWithConfig(config);
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

function showPasswordPrompt(onPasswordSubmit) {
  const promptDiv = document.createElement('div');
  promptDiv.className =
    'fixed inset-0 bg-black/70 flex items-center justify-center z-50';

  promptDiv.innerHTML = `
        <div class="bg-[#1a2332] rounded-lg max-w-md w-full mx-4 p-8">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-3xl">🔐</span>
                </div>
                <h2 class="text-xl font-bold text-white mb-2">Unlock Wallet</h2>
                <p class="text-gray-400 text-sm">Enter your wallet password</p>
            </div>
            
            <input 
                type="password" 
                id="wallet-password-input"
                placeholder="Password"
                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] mb-4"
                autofocus
            />
            
            <div id="password-error" class="hidden mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400"></div>
            
            <button id="unlock-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 rounded-lg transition-colors">
                Unlock
            </button>
            
            <button id="delete-wallet-btn" class="w-full mt-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-2 rounded-lg transition-colors text-sm">
                Delete Wallet & Start Fresh
            </button>
        </div>
    `;

  document.body.appendChild(promptDiv);

  const input = document.getElementById('wallet-password-input');
  const btn = document.getElementById('unlock-btn');
  const deleteBtn = document.getElementById('delete-wallet-btn');
  const errorDiv = document.getElementById('password-error');

  async function tryUnlock() {
    const password = input.value;
    if (!password) {
      errorDiv.textContent = 'Please enter a password';
      errorDiv.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Validating...';

    // Check password hash BEFORE calling Rust
    const storedHash = localStorage.getItem('wallet_password_hash');
    if (storedHash) {
      const inputHash = await hashPassword(password);
      if (inputHash !== storedHash) {
        // Wrong password - show error WITHOUT crashing
        errorDiv.textContent = 'Incorrect password. Please try again.';
        errorDiv.classList.remove('hidden');
        input.value = '';
        input.focus();
        btn.disabled = false;
        btn.textContent = 'Unlock';
        return;
      }
    }

    // Password is correct, proceed
    promptDiv.remove();
    onPasswordSubmit(password);
  }

  deleteBtn.addEventListener('click', () => {
    if (
      confirm(
        'Delete wallet? This will permanently delete your wallet. Make sure you have a backup!'
      )
    ) {
      localStorage.removeItem('wallet_password_hash');
      localStorage.removeItem('coinswap_config');
      location.reload();
    }
  });

  btn.addEventListener('click', tryUnlock);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });

  setTimeout(() => input.focus(), 100);
}

// Start the main app after bitcoind connection is established
function startMainApp() {
  // Check for active swap on app start
  const activeSwap = SwapStateManager.getActiveSwap();
  if (activeSwap && activeSwap.status === 'in_progress') {
    console.log('Found active swap, redirecting to coinswap progress');
    // Start background manager
    startBackgroundSwapManager();
    // Load coinswap progress directly
    import('../components/swap/Coinswap.js').then((module) => {
      const contentContainer = document.querySelector('#content-area');
      if (contentContainer) {
        module.CoinswapComponent(contentContainer, activeSwap);
      }
    });
    // Update nav to show swap as active
    setTimeout(() => {
      const swapNavItem = document.querySelector('[data-nav="swap"]');
      if (swapNavItem) {
        document.querySelectorAll('.nav-item').forEach((nav) => {
          nav.classList.remove('bg-[#FF6B35]', 'text-white');
          nav.classList.add('bg-[#242d3d]', 'text-gray-400');
        });
        // Don't override the orange active swap styling
        if (!swapNavItem.classList.contains('bg-orange-500')) {
          swapNavItem.classList.remove('bg-[#242d3d]', 'text-gray-400');
          swapNavItem.classList.add('bg-[#FF6B35]', 'text-white');
        }
      }
    }, 100);
  } else {
    // Load wallet by default
    renderComponent('wallet');
    console.log('Wallet loaded');
  }

  // Start background manager if there's any active swap
  if (SwapStateManager.hasActiveSwap()) {
    startBackgroundSwapManager();
  }
}

// Initiate the app start process (after setup completion)
function initiateAppStart() {
  // Small delay to let setup success message show
  setTimeout(() => {
    checkBitcoindConnection();
  }, 1500);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('App initializing...');

  const navContainer = document.querySelector('#nav-container');
  if (navContainer) {
    NavComponent(navContainer);
    console.log('Nav rendered');
  } else {
    console.error('Nav container not found!');
  }

  setupNavigation();

  // Check for first-time setup first
  const setupShown = checkFirstTimeSetup();

  if (!setupShown) {
    // If setup wasn't shown, proceed to check bitcoind connection
    checkBitcoindConnection();
  }
});

// Export functions for components to use
window.appManager = {
  startBackgroundSwapManager,
  stopBackgroundSwapManager,
  renderComponent,
};
