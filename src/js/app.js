import { NavComponent } from '../components/Nav.js';
import { WalletComponent } from '../components/wallet/Wallet.js';
import { Market } from '../components/market/Market.js';
import { SendComponent } from '../components/send/Send.js';
import { ReceiveComponent } from '../components/receive/Receive.js';
import { SwapComponent } from '../components/swap/Swap.js';
import { RecoveryComponent } from '../components/recovery/Recovery.js';
import { LogComponent } from '../components/log/Log.js';


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

// Render component
function renderComponent(name) {
    const contentContainer = document.querySelector('#content-area');
    if (!contentContainer) return;

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

    // Load wallet by default
    renderComponent('wallet');
    console.log('Wallet loaded');
});