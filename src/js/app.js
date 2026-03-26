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
  if (!existing) return; // ❗ DO NOT START MANAGER

  backgroundSwapManager = setInterval(async () => {
    const activeSwap = await SwapStateManager.getActiveSwap();
    if (!activeSwap) {
      stopBackgroundSwapManager();
      return;
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
async function renderComponent(name) {
  const contentContainer = document.querySelector('#content-area');
  
  if (!contentContainer) {
    console.error('❌ Content container not found');
    return;
  }

  const parentNode = contentContainer.parentNode;
  
  if (!parentNode) {
    console.error('❌ Content container has no parent');
    return;
  }

  const activeSwap = await SwapStateManager.getActiveSwap();
  if (activeSwap && activeSwap.status === 'in_progress' && name === 'swap') {
    const newContainer = contentContainer.cloneNode(false);
    newContainer.id = 'content-area';
    
    try {
      parentNode.replaceChild(newContainer, contentContainer);
    } catch (e) {
      console.error('Failed to replace container:', e);
      return;
    }

    import('../components/swap/Coinswap.js').then((module) => {
      module.CoinswapComponent(newContainer, activeSwap);
    });
    return;
  }

  const newContainer = contentContainer.cloneNode(false);
  newContainer.id = 'content-area';
  
  try {
    parentNode.replaceChild(newContainer, contentContainer);
  } catch (e) {
    console.error('Failed to replace container:', e);
    return;
  }

  const component = components[name];
  if (component) {
    component(newContainer);
  }
}

let navigationSetup = false;

// Setup navigation handlers
function setupNavigation() {
  if (navigationSetup) return;
  navigationSetup = true;
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach((item) => {
    item.addEventListener('click', async (e) => {
      // ✅ Add async
      e.preventDefault();

      navItems.forEach((nav) => {
        nav.classList.remove('bg-[#FF6B35]', 'text-white');
        nav.classList.add('bg-[#242d3d]', 'text-gray-400');
      });

      item.classList.remove('bg-[#242d3d]', 'text-gray-400');
      item.classList.add('bg-[#FF6B35]', 'text-white');

      const navName = item.getAttribute('data-nav');
      await renderComponent(navName);
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
    const walletName =
      config.wallet?.name || config.wallet?.fileName || 'taker-wallet';

    console.log('🔍 Checking wallet:', walletName);

    // Store it in config so showPasswordPrompt can use it
    if (!config.wallet.name && !config.wallet.fileName) {
      config.wallet.name = walletName;
    }

    // Check if wallet file is encrypted
    const isEncrypted = await window.api.taker.isWalletEncrypted(
      null,
      walletName
    );
    console.log('🔐 Wallet file encrypted:', isEncrypted);

    if (isEncrypted) {
      console.log('🔓 Wallet is encrypted, showing password prompt...');
      await showPasswordPrompt(config); // ✅ Config has correct wallet name
    } else {
      console.log('🔓 Wallet is not encrypted');

      const result = await window.api.taker.initialize(config);

      if (result.success) {
        console.log('✅ Taker initialized');
        await performLaunchSync(startMainApp);
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
  const walletName =
    config.wallet?.name || config.wallet?.fileName || 'taker-wallet';

  const modal = document.createElement('div');
  modal.className =
    'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
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
          await performLaunchSync(startMainApp);
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

/**
 * Show an offerbook sync overlay, wait for sync to complete, then call onComplete.
 * Used on launch so the user sees makers as soon as the app opens.
 */
async function performLaunchSync(onComplete) {
  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };

  const parseLogLine = (line) => {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2}T[\d:.]+)[^\s]*\s+(INFO|WARN|ERROR|DEBUG|TRACE)\s+(.+)$/
    );
    if (!match) {
      return {
        timestamp: Date.now(),
        type: 'info',
        message: line,
      };
    }

    return {
      timestamp: new Date(match[1]).getTime(),
      type: match[2].toLowerCase(),
      message: match[3],
    };
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'debug':
        return 'text-blue-400';
      case 'trace':
        return 'text-purple-400';
      default:
        return 'text-green-400';
    }
  };

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });

  const overlay = document.createElement('div');
  overlay.id = 'launch-sync-overlay';
  overlay.className = 'fixed inset-0 bg-[#0f1419] flex items-center justify-center z-50';
  overlay.innerHTML = `
    <div class="bg-[#1a2332] rounded-lg max-w-3xl w-full mx-4 p-8 border border-[#FF6B35]/10 shadow-2xl">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <span class="text-3xl animate-spin inline-block">⏳</span>
        </div>
        <h2 class="text-xl font-bold text-white mb-2">Syncing Market Data</h2>
        <p class="text-gray-400 text-sm mb-4">Discovering available makers via Tor. This may take a minute...</p>
        <p id="launch-sync-status" class="text-xs uppercase tracking-[0.2em] text-[#FF6B35]">Starting offerbook sync...</p>
      </div>

      <div class="bg-gray-700 rounded-full h-2 overflow-hidden">
        <div id="launch-sync-progress" class="bg-[#FF6B35] h-2 rounded-full transition-all duration-500" style="width: 18%"></div>
      </div>

      <div class="mt-6 bg-[#0f1419] rounded-xl border border-white/5 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div>
            <p class="text-sm font-semibold text-white">Live sync logs</p>
            <p class="text-xs text-gray-500">Latest coinswap and backend activity during startup</p>
          </div>
          <span id="launch-sync-log-count" class="text-xs text-gray-500">0 lines</span>
        </div>
        <div id="launch-sync-log-output" class="h-64 overflow-y-auto px-4 py-3 font-mono text-xs text-left"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const logOutput = overlay.querySelector('#launch-sync-log-output');
  const logCount = overlay.querySelector('#launch-sync-log-count');
  const statusLabel = overlay.querySelector('#launch-sync-status');
  const progressBar = overlay.querySelector('#launch-sync-progress');
  const syncStartedAt = Date.now();
  let logPoll = null;

  function renderLogs(logs) {
    if (!logOutput) return;

    if (logCount) {
      logCount.textContent = `${logs.length} ${logs.length === 1 ? 'line' : 'lines'}`;
    }

    if (logs.length === 0) {
      logOutput.innerHTML =
        '<div class="text-gray-500 text-center py-12">Waiting for startup logs...</div>';
      return;
    }

    logOutput.innerHTML = logs
      .map((log) => {
        return `
          <div class="mb-1 rounded px-2 py-1 hover:bg-white/5">
            <span class="text-gray-500">[${formatTime(log.timestamp)}]</span>
            <span class="${getTypeColor(log.type)}">[${log.type.toUpperCase()}]</span>
            <span class="text-gray-300">${escapeHtml(log.message)}</span>
          </div>
        `;
      })
      .join('');
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  async function refreshLaunchLogs() {
    try {
      const data = await window.api.logs.get(120);
      if (!data.success || !Array.isArray(data.logs)) return;

      const recentLogs = data.logs
        .map(parseLogLine)
        .filter((log) => log.timestamp >= syncStartedAt - 5000)
        .slice(-50);

      renderLogs(recentLogs);
    } catch (error) {
      console.error('Failed to refresh launch sync logs:', error);
    }
  }

  try {
    await refreshLaunchLogs();
    logPoll = setInterval(refreshLaunchLogs, 1500);

    const syncResult = await window.api.taker.syncOfferbookAndWait();
    if (syncResult.success) {
      if (statusLabel) statusLabel.textContent = 'Offerbook sync in progress...';
      if (progressBar) progressBar.style.width = '52%';

      const syncId = syncResult.syncId;
      await new Promise((resolve) => {
        const poll = setInterval(async () => {
          try {
            const status = await window.api.taker.getSyncStatus(syncId);
            const sync = status.sync || {};
            const syncStatus = sync.status || 'syncing';
            const syncMessage =
              sync.message ||
              (syncStatus === 'completed'
                ? 'Offerbook ready'
                : syncStatus === 'failed'
                  ? 'Sync failed'
                  : 'Syncing offerbook...');

            if (statusLabel) statusLabel.textContent = syncMessage;
            if (progressBar) {
              const nextWidth =
                typeof sync.progress === 'number'
                  ? Math.max(18, Math.min(100, sync.progress))
                  : syncStatus === 'completed'
                    ? 100
                    : syncStatus === 'failed'
                      ? 100
                      : 76;
              progressBar.style.width = `${nextWidth}%`;
            }

            const done =
              !status.success ||
              syncStatus === 'completed' ||
              syncStatus === 'failed';
            if (done) {
              clearInterval(poll);
              resolve();
            }
          } catch (err) {
            console.error('Sync polling error:', err);
            clearInterval(poll);
            resolve();
          }
        }, 1000);
      });
    } else {
      if (statusLabel) {
        statusLabel.textContent =
          syncResult.error || 'Unable to start offerbook sync';
      }
      if (progressBar) progressBar.style.width = '100%';
    }
  } catch (err) {
    console.warn('⚠️ Launch offerbook sync error:', err.message);
    if (statusLabel) statusLabel.textContent = 'Offerbook sync hit an issue';
    if (progressBar) progressBar.style.width = '100%';
  } finally {
    if (logPoll) clearInterval(logPoll);
    await refreshLaunchLogs();
  }

  overlay.remove();
  onComplete();
}

// Start the main app after bitcoind connection is established
async function startMainApp() {
  const activeSwap = await SwapStateManager.getActiveSwap();
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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App initializing...');

  const navContainer = document.querySelector('#nav-container');
  if (navContainer) {
    await NavComponent(navContainer);
    console.log('Nav rendered');
  } else {
    console.error('Nav container not found!');
  }

  setupNavigation();

  const appContainer = document.querySelector('body');

  // Load config if exists
  const saved = localStorage.getItem('coinswap_config');

  if (!saved) {
    // First-time setup ONLY ONCE
    console.log('🔧 Showing setup modal...');
    FirstTimeSetupModal(appContainer, (config) => {
      console.log('Setup completed:', config);

      // save config
      localStorage.setItem('coinswap_config', JSON.stringify(config));

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
