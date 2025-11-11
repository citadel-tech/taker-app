export function TransactionsListComponent(container) {
  const content = document.createElement('div');
  content.id = 'transactions-list-content';

  // State for filtering
  let currentFilter = 'all';

  // Transaction data
  const transactions = [
    {
      txid: 'a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234',
      type: 'received',
      amount: 0.05000000,
      timestamp: '2 hours ago',
      confirmations: 6,
      status: 'confirmed'
    },
    {
      txid: '7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l',
      type: 'sent',
      amount: -0.02000000,
      timestamp: '1 day ago',
      confirmations: 142,
      status: 'confirmed'
    },
    {
      txid: 'm3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4',
      type: 'swap',
      amount: 0.05000000,
      timestamp: '3 days ago',
      confirmations: 432,
      status: 'confirmed'
    },
    {
      txid: 'u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2',
      type: 'received',
      amount: 0.10000000,
      timestamp: '1 week ago',
      confirmations: 1008,
      status: 'confirmed'
    },
    {
      txid: 'c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0',
      type: 'sent',
      amount: -0.03500000,
      timestamp: '1 week ago',
      confirmations: 1152,
      status: 'confirmed'
    },
    {
      txid: 'k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8',
      type: 'received',
      amount: 0.08000000,
      timestamp: '2 weeks ago',
      confirmations: 2016,
      status: 'confirmed'
    },
    {
      txid: 'f1e2d3c4b5a6978869574635241398765432109876543210abcdef0123456789',
      type: 'swap',
      amount: 0.04000000,
      timestamp: '2 weeks ago',
      confirmations: 2187,
      status: 'confirmed'
    },
    {
      txid: '9876543210fedcba0987654321098765432109876543210fedcba098765432109',
      type: 'sent',
      amount: -0.01500000,
      timestamp: '3 weeks ago',
      confirmations: 3024,
      status: 'confirmed'
    },
    {
      txid: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab',
      type: 'pending',
      amount: 0.02000000,
      timestamp: '10 minutes ago',
      confirmations: 0,
      status: 'unconfirmed'
    },
    {
      txid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fe',
      type: 'received',
      amount: 0.06000000,
      timestamp: '1 month ago',
      confirmations: 4320,
      status: 'confirmed'
    }
  ];

  function getFilteredTransactions() {
    if (currentFilter === 'all') {
      return transactions;
    } else if (currentFilter === 'received') {
      return transactions.filter(tx => tx.type === 'received');
    } else if (currentFilter === 'sent') {
      return transactions.filter(tx => tx.type === 'sent');
    } else if (currentFilter === 'swaps') {
      return transactions.filter(tx => tx.type === 'swap');
    }
    return transactions;
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

  function formatAmount(amount, type) {
    const prefix = amount >= 0 ? '+' : '';
    const colorClass = amount >= 0 ? 'text-green-400' : 'text-red-400';
    return { text: `${prefix}${amount.toFixed(8)} BTC`, colorClass };
  }

  function getStatusBadge(status, confirmations) {
    if (status === 'unconfirmed') {
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
      const iconData = getTransactionIcon(tx.type);
      const amountData = formatAmount(tx.amount, tx.type);
      const statusBadge = getStatusBadge(tx.status, tx.confirmations);
      
      return `
        <div class="flex items-center justify-between p-4 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg transition-colors">
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 bg-${iconData.color}-500/20 rounded-full flex items-center justify-center">
                    <span class="text-${iconData.color}-400 text-lg">${iconData.icon}</span>
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <p class="text-white font-semibold text-sm capitalize">${tx.type === 'pending' ? 'Pending Transaction' : tx.type}</p>
                        <span class="text-xs px-2 py-1 rounded ${statusBadge.class}">${statusBadge.text}</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                        <span class="cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors font-mono" onclick="openTxOnMempool('${tx.txid}')">
                            ${tx.txid.substring(0, 16)}...
                        </span>
                        <span>${tx.timestamp}</span>
                        <span>${tx.confirmations} confirmations</span>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <p class="${amountData.colorClass} font-mono text-lg font-semibold">${amountData.text}</p>
                <p class="text-gray-400 text-xs">≈ $${Math.abs(tx.amount * 30000).toFixed(2)}</p>
            </div>
        </div>
      `;
    }).join('');
  }

  function getFilterStats() {
    const received = transactions.filter(tx => tx.type === 'received');
    const sent = transactions.filter(tx => tx.type === 'sent');
    const swaps = transactions.filter(tx => tx.type === 'swap');
    
    return {
      all: transactions.length,
      received: received.length,
      sent: sent.length, 
      swaps: swaps.length
    };
  }

  content.innerHTML = `
        <div class="mb-6">
            <button id="back-to-wallet" class="text-gray-400 hover:text-white transition-colors mb-4">
                ← Back to Wallet
            </button>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All Transactions</h2>
            <p class="text-gray-400">Complete transaction history</p>
        </div>

        <!-- Transaction Stats -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Transactions</p>
                <p class="text-2xl font-mono text-[#FF6B35]">${transactions.length}</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Received</p>
                <p class="text-2xl font-mono text-green-400">0.35 BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Sent</p>
                <p class="text-2xl font-mono text-red-400">0.07 BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Net Balance</p>
                <p class="text-2xl font-mono text-blue-400">+0.28 BTC</p>
            </div>
        </div>

        <!-- Transactions List -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-gray-300">Transaction History</h3>
                <!-- Filter buttons -->
                <div class="flex gap-2">
                    <button data-filter="all" class="filter-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-sm font-semibold">
                        All (${getFilterStats().all})
                    </button>
                    <button data-filter="received" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Received (${getFilterStats().received})
                    </button>
                    <button data-filter="sent" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Sent (${getFilterStats().sent})
                    </button>
                    <button data-filter="swaps" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Swaps (${getFilterStats().swaps})
                    </button>
                </div>
            </div>

            <!-- Transaction Items Container -->
            <div id="transaction-container" class="space-y-3">
                <!-- Transactions will be rendered here -->
            </div>

            <!-- Load More Button -->
            <div class="mt-6 text-center">
                <button class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                    Load More Transactions
                </button>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Global function for opening transactions on mempool.space (if not already defined)
  if (!window.openTxOnMempool) {
    window.openTxOnMempool = (txid) => {
      const url = `https://mempool.space/tx/${txid}`;
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
  }

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

  // Initial render
  renderTransactions();
}