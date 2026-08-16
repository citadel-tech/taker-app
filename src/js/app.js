import { NavComponent } from '../components/Nav.js';
import { WalletComponent } from '../components/wallet/Wallet.js';
import { Market } from '../components/market/Market.js';
import { SendComponent } from '../components/send/Send.js';
import { ReceiveComponent } from '../components/receive/Receive.js';
import { SwapComponent } from '../components/swap/Swap.js';
import { SwapHistoryComponent } from '../components/swap/SwapHistory.js';
import { RecoveryComponent } from '../components/recovery/Recovery.js';
import { LogComponent } from '../components/log/Log.js';
import { SettingsComponent } from '../components/settings/Settings.js';
import { AboutComponent } from '../components/about/About.js';
import { FirstTimeSetupModal } from '../components/settings/FirstTimeSetup.js';
import { SwapStateManager } from '../components/swap/SwapStateManager.js';
import { ConnectionStatusComponent } from '../components/connection/ConnectionStatus.js';
import { bitcoindConnection } from '../components/connection/BitcoindConnection.js';
import { showToast } from './openswapHelpers.js';
import { TakerInitializationComponent } from '../components/taker/TakerInitialization.js';
import { refreshBtcPriceUsd } from './price.js';

// Component map
const components = {
  wallet: WalletComponent,
  market: Market,
  send: SendComponent,
  receive: ReceiveComponent,
  swap: SwapComponent,
  swapReports: SwapHistoryComponent,
  recovery: RecoveryComponent,
  log: LogComponent,
  settings: SettingsComponent,
  about: AboutComponent,
};

// Background swap manager - runs independently of UI components.
// This is the single canonical 1s active-swap poller; other components
// (e.g. Nav.js) listen for its 'swap-state-tick' event instead of polling
// SwapStateManager themselves.
let backgroundSwapManager = null;

async function startBackgroundSwapManager() {
  // Prevent duplicate intervals
  if (backgroundSwapManager) return;

  // Only start if swap actually exists
  const existing = await SwapStateManager.getActiveSwap();
  if (!existing) return; // ❗ DO NOT START MANAGER

  backgroundSwapManager = setInterval(async () => {
    const activeSwap = await SwapStateManager.getActiveSwap();
    window.dispatchEvent(
      new CustomEvent('swap-state-tick', { detail: { activeSwap } })
    );
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

    import('../components/swap/Openswap.js').then((module) => {
      module.OpenswapComponent(newContainer, activeSwap);
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
        nav.classList.remove('active');
      });

      item.classList.add('active');

      const navName = item.getAttribute('data-nav');
      await renderComponent(navName);
    });
  });
}

// Check bitcoind connection and show connection status
async function checkBitcoindConnection(config) {
  console.log('🔌 Checking Bitcoin Core connection...');

  if (config) {
    bitcoindConnection.updateConfig(config);
  }

  const appContainer = document.querySelector('body');
  ConnectionStatusComponent(appContainer, (connectionInfo) => {
    console.log('✅ Bitcoin Core connected, starting app...', connectionInfo);
    startTakerInitWithConfig(config);
  });
}

function startTakerInitWithConfig(config) {
  const appContainer = document.querySelector('body');
  TakerInitializationComponent(appContainer, config, (result) => {
    if (result && result.resetSetup) {
      console.warn(
        'Wallet initialization failed, returning to setup:',
        result.error
      );
      localStorage.removeItem('openswap_config');
      showSetupModal();
      return;
    }

    if (result && result.skipped) {
      console.log('⏭️ Taker initialization skipped');
    } else {
      console.log('✅ Taker initialized');
      // Fire-and-forget: Market.js's sync monitor picks this up whenever the
      // user visits the Market page, whether it's still running or already done.
      window.api.taker.syncOfferbookAndWait().then((result) => {
        if (!result.success) {
          console.warn('⚠️ Background offerbook sync failed to start:', result.error);
        }
      });
    }
    startMainApp();
  });
}

// Start the main app after bitcoind connection is established
async function startMainApp() {
  const activeSwap = await SwapStateManager.getActiveSwap();
  if (activeSwap && activeSwap.status === 'in_progress') {
    console.log('Found active swap, redirecting to openswap progress');
    startBackgroundSwapManager();
    import('../components/swap/Openswap.js').then((module) => {
      const contentContainer = document.querySelector('#content-area');
      if (contentContainer) {
        module.OpenswapComponent(contentContainer, activeSwap);
      }
    });
    setTimeout(() => {
      const swapNavItem = document.querySelector('[data-nav="swap"]');
      if (swapNavItem) {
        document.querySelectorAll('.nav-item').forEach((nav) => {
          nav.classList.remove('active');
        });
        swapNavItem.classList.add('active');
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

function showSetupModal() {
  const appContainer = document.querySelector('body');
  FirstTimeSetupModal(appContainer, (config) => {
    console.log('Setup completed:', config);

    localStorage.setItem('openswap_config', JSON.stringify(config));

    initiateAppStart(config);
    showSetupSuccess();
  });
}

// Initialize app
// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App initializing...');
  await refreshBtcPriceUsd();

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
  const saved = localStorage.getItem('openswap_config');

  if (!saved) {
    // First-time setup ONLY ONCE
    console.log('🔧 Showing setup modal...');
    showSetupModal();
  } else {
    // Config exists → skip setup
    const config = JSON.parse(saved);
    initiateAppStart(config);
  }
});

function showSetupSuccess() {
  showToast(
    `<div class="flex items-center">
        <span class="mr-2">✔</span>
        <span>Setup completed successfully!</span>
      </div>`,
    { className: 'app-toast top transition-opacity duration-300', duration: 3000, html: true }
  );
}

// Export functions for components to use
window.appManager = {
  startBackgroundSwapManager,
  stopBackgroundSwapManager,
  renderComponent,
};
