const WALLET_CACHE_KEY = 'wallet_data_cache';
const CACHE_DURATION = 90 * 1000; // 90 seconds

function loadWalletFromCache() {
  try {
    const cached = localStorage.getItem(WALLET_CACHE_KEY);
    if (cached) {
      const { balance, transactions, utxos, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      console.log(`📦 Cache age: ${Math.floor(age / 1000)}s`);

      return {
        balance,
        transactions,
        utxos,
        timestamp,
        isStale: age > CACHE_DURATION,
      };
    }
  } catch (err) {
    console.error('Failed to load wallet cache:', err);
  }
  return null;
}

function saveWalletToCache(balance, transactions, utxos) {
  try {
    localStorage.setItem(
      WALLET_CACHE_KEY,
      JSON.stringify({
        balance,
        transactions,
        utxos,
        timestamp: Date.now(),
      })
    );
    console.log('💾 Saved wallet to cache');
  } catch (err) {
    console.error('Failed to save wallet cache:', err);
  }
}

export async function WalletComponent(container) {
  console.log('🔍 WalletComponent called at', new Date().toISOString());

  // ✅ LOAD FROM CACHE FIRST
  const cached = loadWalletFromCache();
  let shouldFetchFresh = !cached || cached.isStale;

  console.log(`🎯 Should fetch fresh: ${shouldFetchFresh}`);

  async function fetchBalance() {
    try {
      const data = await window.api.taker.getBalance();

      if (data.success) {
        return data.balance;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      throw error;
    }
  }

  async function fetchTransactions() {
    try {
      const data = await window.api.taker.getTransactions(5, 0);

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

  async function fetchUtxos() {
    try {
      const data = await window.api.taker.getUtxos();

      if (data.success) {
        return data.utxos || [];
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
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
  function truncateTxid(txid) {
    if (typeof txid === 'object' && txid.value) {
      txid = txid.value;
    }
    return `${txid.substring(0, 8)}...${txid.substring(txid.length - 4)}`;
  }

  function getUtxoTypeColor(spendType) {
    switch (spendType.toLowerCase()) {
      case 'regular':
        return 'green';
      case 'swap':
        return 'blue';
      case 'contract':
        return 'yellow';
      case 'fidelity':
        return 'purple';
      default:
        return 'gray';
    }
  }

  // Add this function after the other helper functions
  function getTransactionType(transaction) {
    const category = (transaction.detail.category || '').toLowerCase();
    const label = (transaction.detail.label || '').toLowerCase();

    // Check for swap indicators
    if (
      label.includes('swap') ||
      label.includes('swapcoin') ||
      label.includes('coinswap') ||
      label.includes('watchonly_swapcoin') ||
      label.includes('contract') ||
      label.includes('htlc')
    ) {
      return 'swap';
    }

    if (category.includes('swap')) {
      return 'swap';
    }

    // Standard transactions
    return 'regular';
  }

  // UI Update Functions
  async function updateBalance(useCache = false) {
    try {
      // Use cached data if requested
      if (useCache && cached && cached.balance) {
        content.querySelector('#regular-balance').textContent =
          satsToBtc(cached.balance.regular) + ' BTC';
        content.querySelector('#swap-balance').textContent =
          satsToBtc(cached.balance.swap) + ' BTC';
        content.querySelector('#contract-balance').textContent =
          satsToBtc(cached.balance.contract) + ' BTC';
        content.querySelector('#spendable-balance').textContent =
          satsToBtc(cached.balance.spendable) + ' BTC';
        console.log('✅ Balance loaded from cache');
        return;
      }

      // Fetch fresh data
      const balance = await fetchBalance();

      content.querySelector('#regular-balance').textContent =
        satsToBtc(balance.regular) + ' BTC';
      content.querySelector('#swap-balance').textContent =
        satsToBtc(balance.swap) + ' BTC';
      content.querySelector('#contract-balance').textContent =
        satsToBtc(balance.contract) + ' BTC';
      content.querySelector('#spendable-balance').textContent =
        satsToBtc(balance.spendable) + ' BTC';

      console.log('✅ Balance updated from API');
      return balance;
    } catch (error) {
      console.error('❌ Balance update failed:', error);
    }
  }

  async function updateTransactions(useCache = false) {
    const transactionsContainer = content.querySelector(
      '#transactions-container'
    );

    // Helper to render transactions
    const renderTransactions = (transactions) => {
      if (transactions.length === 0) {
        return '<div class="text-center py-4 text-gray-400">No transactions yet</div>';
      }

      const sortedTransactions = transactions.sort(
        (a, b) => b.info.time - a.info.time
      );

      return sortedTransactions
        .map((tx) => {
          const isReceive = tx.detail.amount.sats > 0;
          const txType = getTransactionType(tx);
          const txid =
            typeof tx.info.txid === 'object'
              ? tx.info.txid.value
              : tx.info.txid;
          const txidShort = `${txid.substring(0, 8)}...${txid.substring(txid.length - 4)}`;

          return `
    <div class="flex items-center justify-between p-3 bg-[#242d3d] rounded">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-${isReceive ? 'green' : 'red'}-500/20 rounded-full flex items-center justify-center">
          <span class="text-${isReceive ? 'green' : 'red'}-400">${isReceive ? '↓' : '↑'}</span>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <p class="text-white font-mono text-sm">${isReceive ? 'Received' : 'Sent'}</p>
            <span class="text-xs px-2 py-0.5 rounded ${txType === 'swap' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}">
              ${txType === 'swap' ? 'Swap' : 'Regular'}
            </span>
          </div>
          <p class="text-gray-400 text-xs cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" 
             onclick="openTxOnMempool('${txid}')"
             title="${txid}">
            ${txidShort} • ${formatDate(tx.info.time)}
          </p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-${isReceive ? 'green' : 'red'}-400 font-mono">${isReceive ? '+' : ''}${satsToBtc(Math.abs(tx.detail.amount.sats))} BTC</p>
        <p class="text-gray-400 text-xs">${tx.info.confirmations} confirmations</p>
      </div>
    </div>
          `;
        })
        .join('');
    };

    try {
      // Use cached data if requested
      if (useCache && cached && cached.transactions) {
        transactionsContainer.innerHTML = renderTransactions(
          cached.transactions
        );
        console.log('✅ Transactions loaded from cache');
        return;
      }

      // Fetch fresh data
      const transactions = await fetchTransactions();
      transactionsContainer.innerHTML = renderTransactions(transactions);
      console.log('✅ Transactions updated from API:', transactions.length);
      return transactions;
    } catch (error) {
      console.error('❌ Transactions update failed:', error);
      transactionsContainer.innerHTML =
        '<div class="text-center py-4 text-gray-400">Error loading transactions</div>';
    }
  }

  async function updateUtxos(useCache = false) {
    const utxoTableBody = content.querySelector('#utxo-table-body');

    // Helper to render UTXOs
    const renderUtxos = (utxos) => {
      if (utxos.length === 0) {
        return '<tr><td colspan="4" class="text-center py-4 text-gray-400">No UTXOs found</td></tr>';
      }

      return utxos
        .map((utxoData) => {
          const utxo = utxoData.utxo;
          const spendInfo = utxoData.spendInfo;
          const txidShort = truncateTxid(utxo.txid);
          const typeColor = getUtxoTypeColor(spendInfo.spendType);

          return `
        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
          <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" 
              onclick="openTxOnMempool('${typeof utxo.txid === 'object' ? utxo.txid.value : utxo.txid}')">${txidShort}:${utxo.vout}</td>
          <td class="py-3 px-4 text-green-400 font-mono">${satsToBtc(utxo.amount)}</td>
          <td class="py-3 px-4 ${utxo.confirmations === 0 ? 'text-yellow-400' : 'text-gray-300'}">${utxo.confirmations}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-1 rounded text-xs font-semibold bg-${typeColor}-500/20 text-${typeColor}-400 border border-${typeColor}-500/30">
              ${spendInfo.spendType}
            </span>
          </td>
        </tr>
      `;
        })
        .join('');
    };

    try {
      // Use cached data if requested
      if (useCache && cached && cached.utxos) {
        utxoTableBody.innerHTML = renderUtxos(cached.utxos);
        console.log('✅ UTXOs loaded from cache');
        return;
      }

      // Fetch fresh data
      const utxos = await fetchUtxos();
      utxoTableBody.innerHTML = renderUtxos(utxos);
      console.log('✅ UTXOs updated from API:', utxos.length);
      return utxos;
    } catch (error) {
      console.error('❌ UTXO update failed:', error);
      utxoTableBody.innerHTML = `
        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
          <td class="py-3 px-4 font-mono text-sm text-gray-300">No UTXOs</td>
          <td class="py-3 px-4 text-gray-400 font-mono">--</td>
          <td class="py-3 px-4 text-gray-400">--</td>
          <td class="py-3 px-4 text-gray-400">--</td>
        </tr>
      `;
    }
  }

  async function refreshAllData() {
    const refreshBtn = content.querySelector('#refresh-all-btn');
    const originalText = refreshBtn.textContent;

    refreshBtn.textContent = 'Refreshing...';
    refreshBtn.disabled = true;

    try {
      // ✅ FORCE FRESH FETCH
      const [balance, transactions, utxos] = await Promise.all([
        fetchBalance(),
        fetchTransactions(),
        fetchUtxos(),
      ]);

      // Save to cache
      saveWalletToCache(balance, transactions, utxos);

      // Update UI
      await Promise.all([
        updateBalance(false),
        updateTransactions(false),
        updateUtxos(false),
      ]);

      refreshBtn.textContent = 'Refreshed!';
      setTimeout(() => {
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
      }, 2000);

      console.log('✅ All data refreshed');
    } catch (error) {
      refreshBtn.textContent = 'Refresh Failed';
      setTimeout(() => {
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
      }, 3000);
      console.error('❌ Refresh failed:', error);
    }
  }

  // Create and populate content
  const content = document.createElement('div');
  content.id = 'wallet-content';

  let walletInfo = { walletName: 'Loading...', walletPath: '...' };
  try {
    const info = await window.api.taker.getWalletInfo();
    if (info.success) {
      walletInfo = info;
    }
  } catch (error) {
    console.error('Failed to get wallet info:', error);
  }

  content.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">${walletInfo.walletName}</h2>
                <p class="text-gray-400 font-mono text-sm">${walletInfo.walletPath}</p>
            </div>
            <button id="refresh-all-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-2 px-4 rounded-lg transition-colors">
                Refresh All Data
            </button>
        </div>

        <!-- Balance Card -->
        <div class="bg-[#1a2332] rounded-lg p-6 mb-6">
            <h3 class="text-xl font-semibold text-lg mb-4 text-gray-300">Balance</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p class="text-sm text-gray-400 mb-1">Regular</p>
                    <p id="regular-balance" class="text-2xl font-mono text-green-400">0.00000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">Regular wallet coins</p>
                </div>
                <div>
                    <p class="text-sm text-gray-400 mb-1">Swap</p>
                    <p id="swap-balance" class="text-2xl font-mono text-blue-400">0.00000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">Received in swaps</p>
                </div>
                <div>
                    <p class="text-sm text-gray-400 mb-1">Contract</p>
                    <p id="contract-balance" class="text-2xl font-mono text-yellow-400">0.00000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">In active contracts</p>
                </div>
                <div>
                    <p class="text-sm text-gray-400 mb-1">Spendable</p>
                    <p id="spendable-balance" class="text-2xl font-mono text-[#FF6B35]">0.00000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">Total available</p>
                </div>
            </div>
        </div>

       <!-- UTXOs Section -->
        <div class="bg-[#1a2332] rounded-lg p-6 mb-6">
            <h3 class="text-xl font-semibold text-lg mb-4 text-gray-300">UTXOs</h3>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Txid:Vout</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Amount</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Confirmations</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Type</th>
                        </tr>
                    </thead>
                    <tbody id="utxo-table-body">
                        <!-- UTXOs will be populated here -->
                    </tbody>
                </table>
                <button id="view-all-utxos" class="mt-4 text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold text-lg transition-colors">
                    View All UTXOs →
                </button>
            </div>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <h3 class="text-xl font-semibold text-lg mb-4 text-gray-300">Recent Transactions</h3>
            <div id="transactions-container" class="space-y-3">
                <!-- Transactions will be populated here -->
            </div>
            <button id="view-all-transactions" class="mt-4 text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold text-lg transition-colors">
                View All Transactions →
            </button>
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
    .querySelector('#refresh-all-btn')
    .addEventListener('click', refreshAllData);

  const viewAllButton = content.querySelector('#view-all-utxos');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      import('./UtxoList.js').then((module) => {
        container.innerHTML = '';
        module.UtxoListComponent(container);
      });
    });
  }

  const viewAllTransactionsButton = content.querySelector(
    '#view-all-transactions'
  );
  if (viewAllTransactionsButton) {
    viewAllTransactionsButton.addEventListener('click', () => {
      import('./TransactionsList.js').then((module) => {
        container.innerHTML = '';
        module.TransactionsListComponent(container);
      });
    });
  }

  // Initialize data
  updateBalance();
  updateTransactions();
  updateUtxos();

  // ✅ SMART INITIALIZATION
  if (shouldFetchFresh) {
    console.log('🔄 Fetching fresh data...');
    // Fetch fresh data
    const [balance, transactions, utxos] = await Promise.all([
      updateBalance(false),
      updateTransactions(false),
      updateUtxos(false),
    ]);

    // Save to cache
    if (balance && transactions && utxos) {
      saveWalletToCache(balance, transactions, utxos);
    }
  } else {
    console.log('⚡ Using cached data (still fresh)');
    // Just use cache
    await Promise.all([
      updateBalance(true),
      updateTransactions(true),
      updateUtxos(true),
    ]);
  }
}
