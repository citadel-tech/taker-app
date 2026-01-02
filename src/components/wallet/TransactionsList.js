export function TransactionsListComponent(container) {
  // State
  let currentFilter = 'all';
  let allTransactions = [];
  let currentPage = 0;
  const transactionsPerPage = 20;

  // API Functions (using IPC)
  async function fetchTransactions(count = 50, skip = 0) {
    try {
      const data = await window.api.taker.getTransactions(count, skip);

      if (data.success) {
        return data.transactions || [];
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  }

  // Helper Functions
  function satsToBtc(sats) {
    return (sats / 100000000).toFixed(8);
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60)
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7)
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
  }
  function formatFullDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  // Improved swap detection
  function getTransactionType(transaction) {
    const category = (transaction.detail.category || '').toLowerCase();
    const amount = transaction.detail.amount.sats;
    const label = (transaction.detail.label || '').toLowerCase();

    // Check various indicators for swap transactions
    // 1. Label contains swap-related keywords
    if (
      label.includes('swap') ||
      label.includes('swapcoin') ||
      label.includes('coinswap') ||
      label.includes('watchonly_swapcoin')
    ) {
      return 'swap';
    }

    // 2. Check if it's a contract transaction (often part of swaps)
    if (label.includes('contract') || label.includes('htlc')) {
      return 'swap';
    }

    // 3. Check category for swap indicators
    if (category.includes('swap')) {
      return 'swap';
    }

    // 4. Standard receive/send detection
    if (category === 'receive' || category === '"receive"') return 'received';
    if (category === 'send' || category === '"send"') return 'sent';

    // 5. Fallback to amount-based detection
    return amount > 0 ? 'received' : 'sent';
  }

  // Sort transactions by time (newest first)
  function sortTransactionsByTime(transactions) {
    return [...transactions].sort((a, b) => {
      const timeA = a.info.time || a.info.timereceived || 0;
      const timeB = b.info.time || b.info.timereceived || 0;
      return timeB - timeA; // Descending order (newest first)
    });
  }

  function getFilteredTransactions() {
    // First sort all transactions
    const sorted = sortTransactionsByTime(allTransactions);

    if (currentFilter === 'all') {
      return sorted;
    } else if (currentFilter === 'received') {
      return sorted.filter((tx) => getTransactionType(tx) === 'received');
    } else if (currentFilter === 'sent') {
      return sorted.filter((tx) => getTransactionType(tx) === 'sent');
    } else if (currentFilter === 'swaps') {
      return sorted.filter((tx) => getTransactionType(tx) === 'swap');
    }
    return sorted;
  }

  function updateFilterButtons() {
    const buttons = content.querySelectorAll('.filter-btn');
    buttons.forEach((btn) => {
      const filter = btn.dataset.filter;
      if (filter === currentFilter) {
        btn.className =
          'filter-btn bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors';
      } else {
        btn.className =
          'filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors';
      }
    });
  }

  function setFilter(filter) {
    currentFilter = filter;
    updateFilterButtons();
    renderTransactions();
  }

  function getTransactionIcon(type) {
    switch (type) {
      case 'received':
        return { icon: '↓', color: 'green', bg: 'green' };
      case 'sent':
        return { icon: '↑', color: 'red', bg: 'red' };
      case 'swap':
        return { icon: '⇄', color: 'blue', bg: 'blue' };
      case 'pending':
        return { icon: '⏳', color: 'yellow', bg: 'yellow' };
      default:
        return { icon: '?', color: 'gray', bg: 'gray' };
    }
  }

  function formatAmount(sats) {
    const btc = satsToBtc(Math.abs(sats));
    const prefix = sats >= 0 ? '+' : '';
    const colorClass = sats >= 0 ? 'text-green-400' : 'text-red-400';
    return { text: `${prefix}${btc} BTC`, colorClass };
  }

  function getStatusBadge(confirmations) {
    if (confirmations === 0) {
      return {
        text: 'Unconfirmed',
        class: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      };
    } else if (confirmations >= 6) {
      return {
        text: 'Confirmed',
        class: 'bg-green-500/20 text-green-400 border border-green-500/30',
      };
    } else {
      return {
        text: `${confirmations}/6 conf`,
        class: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      };
    }
  }

  function renderTransactions() {
    const filteredTransactions = getFilteredTransactions();
    const transactionContainer = content.querySelector(
      '#transaction-container'
    );

    if (filteredTransactions.length === 0) {
      transactionContainer.innerHTML = `
        <div class="text-center py-12">
          <div class="text-4xl mb-4">📭</div>
          <p class="text-gray-400">No transactions found for the selected filter.</p>
          <p class="text-gray-500 text-sm mt-2">Try selecting a different filter or refresh.</p>
        </div>
      `;
      return;
    }

    transactionContainer.innerHTML = filteredTransactions
      .map((tx, index) => {
        const type = getTransactionType(tx);
        const iconData = getTransactionIcon(type);
        const amountData = formatAmount(tx.detail.amount.sats);
        const statusBadge = getStatusBadge(tx.info.confirmations);
        const txid =
          typeof tx.info.txid === 'object' ? tx.info.txid.value : tx.info.txid;
        const timestamp = tx.info.time || tx.info.timereceived;
        const label = tx.detail.label || '';

        return `
        <div class="flex items-center justify-between p-4 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg transition-colors group">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 bg-${iconData.bg}-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="text-${iconData.color}-400 text-xl">${iconData.icon}</span>
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <p class="text-white font-semibold text-lg capitalize">
                          ${type === 'swap' ? '🔄 Coinswap' : type === 'received' ? '📥 Received' : '📤 Sent'}
                        </p>
                        <span class="text-xs px-2 py-0.5 rounded ${statusBadge.class}">${statusBadge.text}</span>
                        ${label ? `<span class="text-xs text-gray-500 truncate max-w-[150px]" title="${label}">${label}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        <span class="cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors font-mono" 
                              onclick="openTxOnMempool('${txid}')" 
                              title="${txid}">
                            ${txid.substring(0, 16)}...${txid.substring(txid.length - 8)}
                        </span>
                        <span title="${formatFullDate(timestamp)}">${formatDate(timestamp)}</span>
                    </div>
                </div>
            </div>
            <div class="text-right flex-shrink-0">
                <p class="${amountData.colorClass} font-mono text-lg font-semibold text-lg">${amountData.text}</p>
                ${tx.detail.fee ? `<p class="text-gray-500 text-xs">Fee: ${satsToBtc(Math.abs(tx.detail.fee.sats))} BTC</p>` : ''}
            </div>
        </div>
      `;
      })
      .join('');
  }

  function getFilterStats() {
    const received = allTransactions.filter(
      (tx) => getTransactionType(tx) === 'received'
    );
    const sent = allTransactions.filter(
      (tx) => getTransactionType(tx) === 'sent'
    );
    const swaps = allTransactions.filter(
      (tx) => getTransactionType(tx) === 'swap'
    );

    return {
      all: allTransactions.length,
      received: received.length,
      sent: sent.length,
      swaps: swaps.length,
    };
  }

  function calculateTotals() {
    const totalReceived = allTransactions
      .filter((tx) => tx.detail.amount.sats > 0)
      .reduce((sum, tx) => sum + tx.detail.amount.sats, 0);

    const totalSent = Math.abs(
      allTransactions
        .filter((tx) => tx.detail.amount.sats < 0)
        .reduce((sum, tx) => sum + tx.detail.amount.sats, 0)
    );

    const netBalance = totalReceived - totalSent;

    return {
      totalReceived: satsToBtc(totalReceived),
      totalSent: satsToBtc(totalSent),
      netBalance: satsToBtc(netBalance),
    };
  }

  async function loadTransactions() {
    const refreshBtn = content.querySelector('#refresh-transactions-btn');
    const transactionContainer = content.querySelector(
      '#transaction-container'
    );

    // Show loading state
    transactionContainer.innerHTML = `
      <div class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B35] mx-auto mb-4"></div>
        <p class="text-gray-400">Loading transactions...</p>
      </div>
    `;

    if (refreshBtn) {
      refreshBtn.textContent = 'Loading...';
      refreshBtn.disabled = true;
    }

    try {
      allTransactions = await fetchTransactions(100); // Load more transactions

      // Debug: log transaction types to help identify swap detection
      console.log('📊 Transaction breakdown:');
      allTransactions.forEach((tx, i) => {
        const type = getTransactionType(tx);
        const label = tx.detail.label || 'no label';
        const category = tx.detail.category;
        if (i < 10) {
          // Log first 10 for debugging
          console.log(
            `  ${i}: type=${type}, category=${category}, label=${label}`
          );
        }
      });

      updateStats();
      renderTransactions();
      console.log('✅ Transactions loaded:', allTransactions.length);

      if (refreshBtn) {
        refreshBtn.textContent = 'Refreshed!';
        setTimeout(() => {
          refreshBtn.textContent = 'Refresh';
          refreshBtn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Failed to load transactions:', error);
      transactionContainer.innerHTML = `
        <div class="text-center py-12">
          <div class="text-4xl mb-4">❌</div>
          <p class="text-red-400">Failed to load transactions</p>
          <p class="text-gray-500 text-sm mt-2">${error.message}</p>
          <button onclick="location.reload()" class="mt-4 bg-[#FF6B35] text-white px-4 py-2 rounded-lg">Retry</button>
        </div>
      `;
      if (refreshBtn) {
        refreshBtn.textContent = 'Retry';
        refreshBtn.disabled = false;
      }
    }
  }

  function updateStats() {
    const stats = getFilterStats();
    const totals = calculateTotals();

    // Update filter button counts
    content.querySelector('#filter-all-count').textContent = stats.all;
    content.querySelector('#filter-received-count').textContent =
      stats.received;
    content.querySelector('#filter-sent-count').textContent = stats.sent;
    content.querySelector('#filter-swaps-count').textContent = stats.swaps;

    // Update stats cards
    content.querySelector('#total-transactions').textContent = stats.all;
    content.querySelector('#total-received').textContent =
      totals.totalReceived + ' BTC';
    content.querySelector('#total-sent').textContent =
      totals.totalSent + ' BTC';

    const netEl = content.querySelector('#net-balance');
    const netValue = parseFloat(totals.netBalance);
    netEl.textContent = (netValue >= 0 ? '+' : '') + totals.netBalance + ' BTC';
    netEl.className = `text-2xl font-mono ${netValue >= 0 ? 'text-green-400' : 'text-red-400'}`;
  }

  // Create content
  const content = document.createElement('div');
  content.id = 'transactions-list-content';

  content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div>
                <button id="back-to-wallet" class="text-gray-400 hover:text-white transition-colors mb-4 flex items-center gap-2">
                    <span>←</span> Back to Wallet
                </button>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All Transactions</h2>
                <p class="text-gray-400">Complete transaction history (newest first)</p>
            </div>
            <button id="refresh-transactions-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-2 px-6 rounded-lg transition-colors">
                Refresh
            </button>
        </div>

        <!-- Transaction Stats -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Transactions</p>
                <p id="total-transactions" class="text-2xl font-mono text-[#FF6B35]">--</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Received</p>
                <p id="total-received" class="text-2xl font-mono text-green-400">-- BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Sent</p>
                <p id="total-sent" class="text-2xl font-mono text-red-400">-- BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Net Balance</p>
                <p id="net-balance" class="text-2xl font-mono text-green-400">-- BTC</p>
            </div>
        </div>

        <!-- Transactions List -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-lg text-gray-300">Transaction History</h3>
                <!-- Filter buttons -->
                <div class="flex gap-2">
                    <button data-filter="all" class="filter-btn bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        All (<span id="filter-all-count">--</span>)
                    </button>
                    <button data-filter="received" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        📥 Received (<span id="filter-received-count">--</span>)
                    </button>
                    <button data-filter="sent" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        📤 Sent (<span id="filter-sent-count">--</span>)
                    </button>
                    <button data-filter="swaps" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        🔄 Swaps (<span id="filter-swaps-count">--</span>)
                    </button>
                </div>
            </div>

            <!-- Transaction Items Container -->
            <div id="transaction-container" class="space-y-3">
                <!-- Transactions will be rendered here -->
            </div>

            <!-- Load More Button -->
            <div class="mt-6 text-center">
                <button id="load-more-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-6 py-3 rounded-lg font-semibold text-lg transition-colors">
                    Load More Transactions
                </button>
            </div>
        </div>
        
        <!-- Debug Info (can be removed in production) -->
        <div class="mt-4 p-4 bg-[#0f1419] rounded-lg text-xs text-gray-500">
            <p>💡 Tip: Check browser console for transaction type breakdown to debug swap detection</p>
        </div>
    `;

  container.appendChild(content);

  // Global function for opening transactions on mempool.space
  window.openTxOnMempool = (txid) => {
    const url = `https://mempool.space/signet/tx/${txid}`;
    if (typeof require !== 'undefined') {
      try {
        const { shell } = require('electron');
        shell.openExternal(url);
      } catch (error) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  // Event handlers
  content
    .querySelector('#refresh-transactions-btn')
    .addEventListener('click', loadTransactions);

  // Load more handler
  content
    .querySelector('#load-more-btn')
    .addEventListener('click', async () => {
      const btn = content.querySelector('#load-more-btn');
      btn.textContent = 'Loading...';
      btn.disabled = true;

      try {
        const moreTransactions = await fetchTransactions(
          50,
          allTransactions.length
        );
        if (moreTransactions.length > 0) {
          allTransactions = [...allTransactions, ...moreTransactions];
          updateStats();
          renderTransactions();
          btn.textContent = 'Load More Transactions';
        } else {
          btn.textContent = 'No More Transactions';
        }
      } catch (error) {
        btn.textContent = 'Load Failed - Retry';
      }
      btn.disabled = false;
    });

  // Add filter button event listeners
  const filterButtons = content.querySelectorAll('.filter-btn');
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      setFilter(filter);
    });
  });

  // Add back button handler
  const backButton = content.querySelector('#back-to-wallet');
  backButton.addEventListener('click', () => {
    import('./Wallet.js').then((module) => {
      container.innerHTML = '';
      module.WalletComponent(container);
    });
  });

  // Initialize data
  loadTransactions();
}
