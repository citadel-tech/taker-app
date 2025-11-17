export function TransactionsListComponent(container) {
  // State
  let currentFilter = 'all';
  let allTransactions = [];
  let currentPage = 0;
  const transactionsPerPage = 20;

  // API Functions
  async function fetchTransactions(count = 50, skip = 0) {
    try {
      const response = await fetch(`http://localhost:3001/api/taker/transactions?count=${count}&skip=${skip}`);
      const data = await response.json();
      
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
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  function getTransactionType(transaction) {
    const category = transaction.detail.category.toLowerCase();
    const amount = transaction.detail.amount.sats;
    
    if (category === 'receive') return 'received';
    if (category === 'send') return 'sent';
    if (transaction.detail.label === 'watchonly_swapcoin_label') return 'swap';
    return amount > 0 ? 'received' : 'sent';
  }

  function getFilteredTransactions() {
    if (currentFilter === 'all') {
      return allTransactions;
    } else if (currentFilter === 'received') {
      return allTransactions.filter(tx => getTransactionType(tx) === 'received');
    } else if (currentFilter === 'sent') {
      return allTransactions.filter(tx => getTransactionType(tx) === 'sent');
    } else if (currentFilter === 'swaps') {
      return allTransactions.filter(tx => getTransactionType(tx) === 'swap');
    }
    return allTransactions;
  }

  function updateFilterButtons() {
    const buttons = content.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      const filter = btn.dataset.filter;
      if (filter === currentFilter) {
        btn.className = 'filter-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-sm font-semibold';
      } else {
        btn.className = 'filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors';
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
        return { icon: '↓', color: 'green' };
      case 'sent':
        return { icon: '↑', color: 'red' };
      case 'swap':
        return { icon: '⇄', color: 'blue' };
      case 'pending':
        return { icon: '⏳', color: 'yellow' };
      default:
        return { icon: '?', color: 'gray' };
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
      return { text: 'Unconfirmed', class: 'bg-yellow-500/20 text-yellow-400' };
    } else if (confirmations >= 6) {
      return { text: 'Confirmed', class: 'bg-green-500/20 text-green-400' };
    } else {
      return { text: `${confirmations}/6`, class: 'bg-blue-500/20 text-blue-400' };
    }
  }

  function renderTransactions() {
    const filteredTransactions = getFilteredTransactions();
    const transactionContainer = content.querySelector('#transaction-container');
    
    if (filteredTransactions.length === 0) {
      transactionContainer.innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-400">No transactions found for the selected filter.</p>
        </div>
      `;
      return;
    }

    transactionContainer.innerHTML = filteredTransactions.map(tx => {
      const type = getTransactionType(tx);
      const iconData = getTransactionIcon(type);
      const amountData = formatAmount(tx.detail.amount.sats);
      const statusBadge = getStatusBadge(tx.info.confirmations);
      const txid = typeof tx.info.txid === 'object' ? tx.info.txid.hex : tx.info.txid;
      
      return `
        <div class="flex items-center justify-between p-4 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg transition-colors">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 bg-${iconData.color}-500/20 rounded-full flex items-center justify-center">
                    <span class="text-${iconData.color}-400 text-lg">${iconData.icon}</span>
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <p class="text-white font-semibold text-sm capitalize">${type === 'swap' ? 'Coinswap' : type}</p>
                        <span class="text-xs px-2 py-1 rounded ${statusBadge.class}">${statusBadge.text}</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                        <span class="cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors font-mono" onclick="openTxOnMempool('${txid}')">
                            ${txid.substring(0, 16)}...
                        </span>
                        <span>${formatDate(tx.info.time)}</span>
                        <span>${tx.info.confirmations} confirmations</span>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <p class="${amountData.colorClass} font-mono text-lg font-semibold">${amountData.text}</p>
                <p class="text-gray-400 text-xs">Fee: ${tx.detail.fee ? satsToBtc(Math.abs(tx.detail.fee.sats)) + ' BTC' : 'N/A'}</p>
            </div>
        </div>
      `;
    }).join('');
  }

  function getFilterStats() {
    const received = allTransactions.filter(tx => getTransactionType(tx) === 'received');
    const sent = allTransactions.filter(tx => getTransactionType(tx) === 'sent');
    const swaps = allTransactions.filter(tx => getTransactionType(tx) === 'swap');
    
    return {
      all: allTransactions.length,
      received: received.length,
      sent: sent.length,
      swaps: swaps.length
    };
  }

  function calculateTotals() {
    const totalReceived = allTransactions
      .filter(tx => tx.detail.amount.sats > 0)
      .reduce((sum, tx) => sum + tx.detail.amount.sats, 0);
    
    const totalSent = Math.abs(allTransactions
      .filter(tx => tx.detail.amount.sats < 0)
      .reduce((sum, tx) => sum + tx.detail.amount.sats, 0));
    
    const netBalance = totalReceived - totalSent;
    
    return {
      totalReceived: satsToBtc(totalReceived),
      totalSent: satsToBtc(totalSent),
      netBalance: satsToBtc(netBalance)
    };
  }

  async function loadTransactions() {
    const refreshBtn = content.querySelector('#refresh-transactions-btn');
    const loadMoreBtn = content.querySelector('#load-more-btn');
    
    if (refreshBtn) {
      refreshBtn.textContent = 'Loading...';
      refreshBtn.disabled = true;
    }
    
    try {
      allTransactions = await fetchTransactions(100); // Load more transactions
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
      if (refreshBtn) {
        refreshBtn.textContent = 'Load Failed';
        setTimeout(() => {
          refreshBtn.textContent = 'Refresh';
          refreshBtn.disabled = false;
        }, 3000);
      }
    }
  }

  function updateStats() {
    const stats = getFilterStats();
    const totals = calculateTotals();
    
    // Update filter button counts
    const filterButtons = content.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      const filter = btn.dataset.filter;
      const count = stats[filter] || 0;
      const text = btn.textContent.split('(')[0].trim();
      btn.textContent = `${text} (${count})`;
    });
    
    // Update stats cards
    content.querySelector('#total-transactions').textContent = stats.all;
    content.querySelector('#total-received').textContent = totals.totalReceived + ' BTC';
    content.querySelector('#total-sent').textContent = totals.totalSent + ' BTC';
    content.querySelector('#net-balance').textContent = 
      (totals.netBalance.startsWith('-') ? '' : '+') + totals.netBalance + ' BTC';
  }

  // Create content
  const content = document.createElement('div');
  content.id = 'transactions-list-content';

  content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div>
                <button id="back-to-wallet" class="text-gray-400 hover:text-white transition-colors mb-4">
                    ← Back to Wallet
                </button>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All Transactions</h2>
                <p class="text-gray-400">Complete transaction history</p>
            </div>
            <button id="refresh-transactions-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-2 px-4 rounded-lg transition-colors">
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
                <p id="net-balance" class="text-2xl font-mono text-blue-400">-- BTC</p>
            </div>
        </div>

        <!-- Transactions List -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-gray-300">Transaction History</h3>
                <!-- Filter buttons -->
                <div class="flex gap-2">
                    <button data-filter="all" class="filter-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-sm font-semibold">
                        All (--)
                    </button>
                    <button data-filter="received" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Received (--)
                    </button>
                    <button data-filter="sent" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Sent (--)
                    </button>
                    <button data-filter="swaps" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Swaps (--)
                    </button>
                </div>
            </div>

            <!-- Transaction Items Container -->
            <div id="transaction-container" class="space-y-3">
                <!-- Transactions will be rendered here -->
            </div>

            <!-- Load More Button -->
            <div class="mt-6 text-center">
                <button id="load-more-btn" class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                    Load More Transactions
                </button>
            </div>
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
  content.querySelector('#refresh-transactions-btn').addEventListener('click', loadTransactions);

  // Add filter button event listeners
  const filterButtons = content.querySelectorAll('.filter-btn');
  filterButtons.forEach(button => {
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