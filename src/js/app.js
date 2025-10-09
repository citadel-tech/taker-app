import { NavComponent } from '../components/Nav.js';
import { WalletComponent } from '../components/wallet/Wallet.js';

// Component map
const components = {
    'wallet': WalletComponent,
    // Add more as we create them
};

// Render component
function renderComponent(name) {
    const contentContainer = document.querySelector('#content-area');
    if (!contentContainer) return;
    
    // Clear existing content
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
            
            // Remove active class from all items
            navItems.forEach(nav => {
                nav.classList.remove('bg-[#FF6B35]', 'text-white');
                nav.classList.add('bg-[#242d3d]', 'text-gray-400');
            });
            
            // Add active class to clicked item
            item.classList.remove('bg-[#242d3d]', 'text-gray-400');
            item.classList.add('bg-[#FF6B35]', 'text-white');
            
            // Render the component
            const navName = item.getAttribute('data-nav');
            renderComponent(navName);
        });
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    
    // Render nav
    const navContainer = document.querySelector('#nav-container');
    if (navContainer) {
        NavComponent(navContainer);
        console.log('Nav rendered');
    } else {
        console.error('Nav container not found!');
    }
    
    // Setup navigation
    setupNavigation();
    
    // Load wallet by default
    renderComponent('wallet');
    console.log('Wallet loaded');
});