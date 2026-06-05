import {
  SwapStateManager,
  formatElapsedTime,
} from './swap/SwapStateManager.js';

function navIcon(name) {
  const paths = {
    wallet:
      '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 14h2"/>',
    market: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V8"/>',
    send: '<path d="M7 17L17 7M9 7h8v8"/>',
    receive: '<path d="M17 7L7 17M7 9v8h8"/>',
    swap: '<path d="M17 4l4 4-4 4M21 8H8M7 20l-4-4 4-4M3 16h13"/>',
    recovery:
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M9 12l2 2 4-4"/>',
    log: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 0 1 3.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2"/>',
  };

  return `<svg class="app-sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

export async function NavComponent(container) {
  const nav = document.createElement('aside');
  nav.className = 'app-sidebar';

  const hasActiveSwap = await SwapStateManager.hasActiveSwap();
  const elapsed = hasActiveSwap
    ? formatElapsedTime(await SwapStateManager.getElapsedTime())
    : '';

  const items = [
    ['wallet', 'Wallet'],
    ['market', 'Market'],
    ['send', 'Send'],
    ['receive', 'Receive'],
    ['swap', 'Swap'],
    ['recovery', 'Recovery'],
    ['log', 'Log'],
    ['settings', 'Settings'],
  ];

  nav.innerHTML = `
    <div class="app-sidebar-brand">
      <div class="app-sidebar-logo">C</div>
      <div class="app-sidebar-title">
        <h1>Coinswap</h1>
        <p>Taker app</p>
      </div>
    </div>

    <nav class="app-sidebar-nav" aria-label="Main navigation">
      ${items
        .map(
          ([id, label]) => `
            <a href="#${id}" data-nav="${id}" class="nav-item app-sidebar-item ${id === 'wallet' ? 'active' : ''} ${id === 'swap' && hasActiveSwap ? 'has-activity' : ''}">
              ${navIcon(id)}
              <span>${label}</span>
              ${
                id === 'swap' && hasActiveSwap
                  ? `<span class="swap-elapsed-time">${elapsed}</span>`
                  : ''
              }
            </a>
          `
        )
        .join('')}
    </nav>
  `;

  container.appendChild(nav);

  if (hasActiveSwap) {
    const updateInterval = setInterval(async () => {
      const currentSwap = await SwapStateManager.getActiveSwap();
      if (
        !currentSwap ||
        currentSwap.status === 'completed' ||
        currentSwap.status === 'failed'
      ) {
        clearInterval(updateInterval);

        const swapItem = nav.querySelector('[data-nav="swap"]');
        if (swapItem) {
          swapItem.classList.remove('has-activity');
          swapItem.querySelector('.swap-elapsed-time')?.remove();
        }

        return;
      }

      const elapsedTimeEl = nav.querySelector('.swap-elapsed-time');
      if (elapsedTimeEl) {
        elapsedTimeEl.textContent = formatElapsedTime(
          await SwapStateManager.getElapsedTime()
        );
      }
    }, 1000);
  }
}
