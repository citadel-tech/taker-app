import { NavComponent } from '../components/Nav.js';
import { WalletComponent } from '../components/wallet/Wallet.js';
import { Market } from '../components/market/Market.js';
import { SendComponent } from '../components/send/Send.js';
import { ReceiveComponent } from '../components/receive/Receive.js';
import { SwapComponent } from '../components/swap/Swap.js';
import { RecoveryComponent } from '../components/recovery/Recovery.js';
import { LogComponent } from '../components/log/Log.js';
import { SwapStateManager } from '../components/swap/SwapStateManager.js';


// Component map
const components = {
    'wallet': WalletComponent,
    'market': Market,
    'send': SendComponent,
    'receive': ReceiveComponent,
    'swap': SwapComponent,
    'recovery': RecoveryComponent,
    'log': LogComponent,
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

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            navItems.forEach(nav => {
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
                document.querySelectorAll('.nav-item').forEach(nav => {
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
});

// Export functions for components to use
window.appManager = {
    startBackgroundSwapManager,
    stopBackgroundSwapManager,
    renderComponent
};