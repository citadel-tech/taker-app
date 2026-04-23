export function UtxoListComponent(container) {
  // State for UTXO selection and filtering
  let selectedUtxos = [];
  let allUtxos = [];
  let filteredUtxos = [];
  let activeTypeFilter = 'all'; // 'all', 'regular', 'contract', 'swap', 'spendable'
  let currentSort = 'newest'; // 'newest', 'amount'

  // API Functions
  async function fetchUtxos() {
    try {
      // IPC call to get UTXOs
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

  async function syncWalletState() {
    const result = await window.api.taker.sync();
    if (!result?.success) {
      throw new Error(result?.error || 'Wallet sync failed');
    }
    console.log('✅ Wallet sync completed before UTXO refresh');
  }

  // Helper Functions
  function satsToBtc(sats) {
    return (sats / 100000000).toFixed(8);
  }

  function truncateTxid(txid) {
    if (typeof txid === 'object' && txid.value) {
      txid = txid.value;
    }
    return `${txid.substring(0, 12)}...${txid.substring(txid.length - 4)}`;
  }

  function getUtxoTypeColor(spendType = '') {
    const type = spendType.toLowerCase();
    if (type.includes('seed') || type.includes('regular')) return 'green';
    if (type.includes('swap')) return 'blue';
    if (type.includes('contract')) return 'yellow';
    if (type.includes('fidelity')) return 'purple';
    if (type.includes('swept')) return 'cyan';
    return 'gray';
  }

  function getSpendTypeDisplay(spendType = '') {
    const type = spendType.toLowerCase();
    if (type.includes('seed') || type.includes('regular')) return 'Regular';
    if (type.includes('swap')) return 'Swap';
    if (type.includes('contract')) return 'Contract';
    return spendType || 'Unknown';
  }

  // Determine script type from UTXO data
  function getScriptType(utxoData) {
    const utxo = utxoData.utxo;
    const spendInfo = utxoData.spendInfo;

    // Try to determine from scriptPubKey hex if available
    const scriptHex = utxo.script_pub_key?.hex || utxo.scriptPubKey?.hex || '';

    // P2WPKH: starts with 0014 (OP_0 + 20 bytes)
    if (scriptHex.startsWith('0014') && scriptHex.length === 44) {
      return 'p2wpkh';
    }

    // P2WSH: starts with 0020 (OP_0 + 32 bytes)
    if (scriptHex.startsWith('0020') && scriptHex.length === 68) {
      return 'p2wsh';
    }

    // P2TR: starts with 5120 (OP_1 + 32 bytes)
    if (scriptHex.startsWith('5120') && scriptHex.length === 68) {
      return 'p2tr';
    }

    // Fallback: try to determine from address prefix
    const address = utxo.address || '';
    if (address.startsWith('bc1q') && address.length === 42) return 'p2wpkh';
    if (address.startsWith('tb1q') && address.length === 42) return 'p2wpkh';
    if (address.startsWith('bc1q') && address.length === 62) return 'p2wsh';
    if (address.startsWith('tb1q') && address.length === 62) return 'p2wsh';
    if (address.startsWith('bc1p')) return 'p2tr';
    if (address.startsWith('tb1p')) return 'p2tr';

    // Fallback: infer from spendType
    const spendType = (spendInfo.spendType || '').toLowerCase();
    if (spendType.includes('seed') || spendType.includes('regular'))
      return 'p2wpkh';
    if (
      spendType.includes('swap') ||
      spendType.includes('contract') ||
      spendType.includes('fidelity')
    )
      return 'p2wsh';
    if (spendType.includes('swept')) return 'p2wsh';

    return 'unknown';
  }

  // Get display name for script type
  function getScriptTypeDisplay(scriptType) {
    switch (scriptType) {
      case 'p2wpkh':
        return 'Segwit Pubkey';
      case 'p2wsh':
        return 'SegWit Script';
      case 'p2tr':
        return 'Taproot'; // ✅ Already correct
      default:
        return 'Unknown';
    }
  }

  // Get color for script type badge
  function getScriptTypeColor(scriptType) {
    switch (scriptType) {
      case 'p2wpkh':
        return 'green';
      case 'p2wsh':
        return 'blue';
      case 'p2tr':
        return 'purple';
      default:
        return 'gray';
    }
  }

  function calculateStats() {
    const totalUtxos = filteredUtxos.length;
    const totalValue = filteredUtxos.reduce(
      (sum, utxo) => sum + utxo.utxo.amount,
      0
    );
    const confirmed = filteredUtxos.filter(
      (utxo) => utxo.utxo.confirmations > 0
    ).length;
    const unconfirmed = totalUtxos - confirmed;

    const regularCount = allUtxos.filter(
      (u) => getSpendTypeDisplay(u.spendInfo?.spendType) === 'Regular'
    ).length;
    const contractCount = allUtxos.filter(
      (u) => getSpendTypeDisplay(u.spendInfo?.spendType) === 'Contract'
    ).length;
    const swapCount = allUtxos.filter(
      (u) => getSpendTypeDisplay(u.spendInfo?.spendType) === 'Swap'
    ).length;
    const spendableCount = allUtxos.filter((u) =>
      ['Regular', 'Swap'].includes(getSpendTypeDisplay(u.spendInfo?.spendType))
    ).length;

    return {
      totalUtxos,
      totalValue,
      confirmed,
      unconfirmed,
      regularCount,
      contractCount,
      swapCount,
      spendableCount,
    };
  }

  function applyFilter(filterType) {
    activeTypeFilter = filterType;

    if (filterType === 'all') {
      filteredUtxos = [...allUtxos];
    } else if (filterType === 'spendable') {
      filteredUtxos = allUtxos.filter((utxo) =>
        ['Regular', 'Swap'].includes(
          getSpendTypeDisplay(utxo.spendInfo?.spendType)
        )
      );
    } else {
      filteredUtxos = allUtxos.filter(
        (utxo) =>
          getSpendTypeDisplay(utxo.spendInfo?.spendType).toLowerCase() ===
          filterType
      );
    }

    filteredUtxos.sort((a, b) => {
      if (currentSort === 'amount') {
        return b.utxo.amount - a.utxo.amount;
      }
      return (a.utxo.confirmations || 0) - (b.utxo.confirmations || 0);
    });

    // Clear selections when filter changes
    selectedUtxos = [];

    updateFilterButtons();
    updateStatsDisplay();
    updateUtxoTable();
    updateSelectionUI();
  }

  function updateFilterButtons() {
    const filters = ['all', 'regular', 'contract', 'swap', 'spendable'];
    filters.forEach((filter) => {
      const btn = content.querySelector(`#filter-${filter}`);
      if (btn) {
        if (filter === activeTypeFilter) {
          btn.className =
            'filter-btn bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors';
        } else {
          btn.className =
            'filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors';
        }
      }
    });
  }

  function updateSortButtons() {
    const sorts = ['newest', 'amount'];
    sorts.forEach((sort) => {
      const btn = content.querySelector(`#sort-${sort}`);
      if (btn) {
        if (sort === currentSort) {
          btn.className =
            'sort-btn bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors';
        } else {
          btn.className =
            'sort-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors';
        }
      }
    });
  }

  function setSort(sortType) {
    currentSort = sortType;
    applyFilter(activeTypeFilter);
    updateSortButtons();
  }

  function toggleUtxoSelection(index) {
    const utxoIndex = selectedUtxos.indexOf(index);
    if (utxoIndex > -1) {
      selectedUtxos.splice(utxoIndex, 1);
    } else {
      selectedUtxos.push(index);
    }

    updateSelectionUI();
  }

  function updateSelectionUI() {
    // Update checkboxes
    filteredUtxos.forEach((_, index) => {
      const checkbox = content.querySelector(`#utxo-checkbox-${index}`);
      if (checkbox) {
        checkbox.checked = selectedUtxos.includes(index);
      }
    });

    // Update master checkbox
    const selectAllCheckbox = content.querySelector('#select-all-utxos');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked =
        selectedUtxos.length === filteredUtxos.length &&
        filteredUtxos.length > 0;
      selectAllCheckbox.indeterminate =
        selectedUtxos.length > 0 && selectedUtxos.length < filteredUtxos.length;
    }

    // Update action buttons visibility
    const actionButtons = content.querySelector('#utxo-actions');
    const selectionCount = content.querySelector('#selection-count');
    const selectedValue = content.querySelector('#selected-value');

    if (selectedUtxos.length > 0) {
      actionButtons.classList.remove('hidden');
      selectionCount.textContent = selectedUtxos.length;

      // Calculate selected value
      const totalSelected = selectedUtxos.reduce(
        (sum, idx) => sum + filteredUtxos[idx].utxo.amount,
        0
      );
      selectedValue.textContent = satsToBtc(totalSelected);
    } else {
      actionButtons.classList.add('hidden');
    }
  }

  function selectAllUtxos() {
    if (selectedUtxos.length === filteredUtxos.length) {
      selectedUtxos = [];
    } else {
      selectedUtxos = Array.from({ length: filteredUtxos.length }, (_, i) => i);
    }
    updateSelectionUI();
  }

  function sendWithSelectedUtxos() {
    const selectedUtxoData = selectedUtxos.map((index) => filteredUtxos[index]);
    import('../send/Send.js').then((module) => {
      container.innerHTML = '';
      module.SendComponent(container, selectedUtxoData);
    });
  }

  function swapWithSelectedUtxos() {
    const selectedUtxoData = selectedUtxos.map((index) => filteredUtxos[index]);
    import('../swap/Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container, selectedUtxoData);
    });
  }

  async function refreshUtxos() {
    const refreshBtn = content.querySelector('#refresh-utxos-btn');
    const originalText = refreshBtn.textContent;

    refreshBtn.textContent = 'Refreshing...';
    refreshBtn.disabled = true;

    try {
      await syncWalletState();
      await loadUtxos();

      refreshBtn.textContent = 'Refreshed!';
      setTimeout(() => {
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
      }, 2000);

      console.log('✅ UTXOs refreshed');
    } catch (error) {
      refreshBtn.textContent = 'Refresh Failed';
      setTimeout(() => {
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
      }, 3000);
      console.error('❌ UTXO refresh failed:', error);
    }
  }

  async function loadUtxos() {
    try {
      allUtxos = await fetchUtxos();
      // Apply current filter
      applyFilter(activeTypeFilter);
      console.log('✅ UTXOs loaded:', allUtxos.length);
    } catch (error) {
      console.error('❌ Failed to load UTXOs:', error);
      // Show error in table
      const tableBody = content.querySelector('#utxo-table-body');
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="7" class="text-center py-8 text-red-400">Failed to load UTXOs. Please try refreshing.</td></tr>';
      }
    }
  }

  function updateStatsDisplay() {
    const stats = calculateStats();

    content.querySelector('#total-utxos').textContent = stats.totalUtxos;
    content.querySelector('#total-value').textContent = satsToBtc(
      stats.totalValue
    );
    content.querySelector('#confirmed-count').textContent = stats.confirmed;
    content.querySelector('#unconfirmed-count').textContent = stats.unconfirmed;

    // Update filter button counts
    const regularBtn = content.querySelector('#filter-regular');
    const contractBtn = content.querySelector('#filter-contract');
    const swapBtn = content.querySelector('#filter-swap');
    const spendableBtn = content.querySelector('#filter-spendable');

    if (regularBtn) {
      regularBtn.querySelector('.filter-count').textContent =
        `(${stats.regularCount})`;
    }
    if (contractBtn) {
      contractBtn.querySelector('.filter-count').textContent =
        `(${stats.contractCount})`;
    }
    if (swapBtn) {
      swapBtn.querySelector('.filter-count').textContent =
        `(${stats.swapCount})`;
    }
    if (spendableBtn) {
      spendableBtn.querySelector('.filter-count').textContent =
        `(${stats.spendableCount})`;
    }
  }

  function updateUtxoTable() {
    const tableBody = content.querySelector('#utxo-table-body');

    if (filteredUtxos.length === 0) {
      const message =
        activeTypeFilter === 'all'
          ? 'No UTXOs found'
          : `No ${activeTypeFilter} UTXOs found`;
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400">${message}</td></tr>`;
      return;
    }

    tableBody.innerHTML = filteredUtxos
      .map((utxoData, index) => {
        const utxo = utxoData.utxo;
        const spendInfo = utxoData.spendInfo;
        const txidShort = truncateTxid(utxo.txid);
        const typeColor = getUtxoTypeColor(spendInfo.spendType);
        const txid = typeof utxo.txid === 'object' ? utxo.txid.value : utxo.txid;
        const scriptType = getScriptType(utxoData);
        const scriptColor = getScriptTypeColor(scriptType);
        const spendTypeDisplay = getSpendTypeDisplay(spendInfo.spendType);

        return `
        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
          <td class="py-3 px-4">
            <input type="checkbox" id="utxo-checkbox-${index}" class="w-4 h-4 accent-[#FF6B35]" />
          </td>
          <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" 
              onclick="openTxOnMempool('${txid}')">${txidShort}:${utxo.vout}</td>
          <td class="py-3 px-4 text-green-400 font-mono">${satsToBtc(utxo.amount)}</td>
          <td class="py-3 px-4 text-gray-300 ${utxo.confirmations === 0 ? 'text-yellow-400' : ''}">${utxo.confirmations}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-1 rounded text-xs font-semibold text-lg bg-${scriptColor}-500/20 text-${scriptColor}-400 border border-${scriptColor}-500/30">
              ${getScriptTypeDisplay(scriptType)}
            </span>
          </td>
          <td class="py-3 px-4 text-${typeColor}-400">${spendTypeDisplay}</td>
          <td class="py-3 px-4 font-mono text-sm text-gray-300">${utxo.address ? utxo.address.substring(0, 8) + '...' + utxo.address.substring(utxo.address.length - 4) : '--'}</td>
        </tr>
      `;
      })
      .join('');

    // Add event listeners for new checkboxes
    filteredUtxos.forEach((_, index) => {
      const checkbox = content.querySelector(`#utxo-checkbox-${index}`);
      if (checkbox) {
        checkbox.addEventListener('change', () => toggleUtxoSelection(index));
      }
    });
  }

  // Create and populate content
  const content = document.createElement('div');
  content.id = 'utxo-list-content';

  content.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <div>
                <button id="back-to-wallet" class="text-gray-400 hover:text-white transition-colors mb-4">
                    ← Back to Wallet
                </button>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All UTXOs</h2>
                <p class="text-gray-400">Complete list of unspent transaction outputs with filtering and sorting</p>
            </div>
            <button id="refresh-utxos-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-2 px-4 rounded-lg transition-colors">
                Refresh UTXOs
            </button>
        </div>

        <!-- UTXO Stats -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total UTXOs</p>
                <p id="total-utxos" class="text-2xl font-mono text-[#FF6B35]">--</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Value</p>
                <p id="total-value" class="text-2xl font-mono text-green-400">-- BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Confirmed</p>
                <p id="confirmed-count" class="text-2xl font-mono text-blue-400">--</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Unconfirmed</p>
                <p id="unconfirmed-count" class="text-2xl font-mono text-yellow-400">--</p>
            </div>
        </div>

        <!-- UTXO Filters -->
        <div class="bg-[#1a2332] rounded-lg p-4 mb-6">
            <div class="flex items-center justify-between gap-4 flex-wrap">
                <div class="flex items-center gap-2 flex-wrap">
                    <button id="filter-all" class="filter-btn bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        All
                    </button>
                    <button id="filter-regular" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Regular UTXOs <span class="filter-count text-xs opacity-70">(0)</span>
                    </button>
                    <button id="filter-contract" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Contract UTXOs <span class="filter-count text-xs opacity-70">(0)</span>
                    </button>
                    <button id="filter-swap" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Swap UTXOs <span class="filter-count text-xs opacity-70">(0)</span>
                    </button>
                    <button id="filter-spendable" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Spendable UTXOs <span class="filter-count text-xs opacity-70">(0)</span>
                    </button>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <button id="sort-newest" class="sort-btn bg-[#FF6B35] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Newest
                    </button>
                    <button id="sort-amount" class="sort-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Amount
                    </button>
                </div>
            </div>
        </div>

        <!-- UTXO Table -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-lg text-gray-300">UTXO Details</h3>
                <!-- Selection Actions -->
                <div id="utxo-actions" class="hidden flex items-center gap-3">
                    <span class="text-sm text-gray-400">
                        <span id="selection-count">0</span> selected • <span id="selected-value">0</span> BTC
                    </span>
                    <button id="send-selected" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Send Selected
                    </button>
                    <button id="swap-selected" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold text-lg transition-colors">
                        Swap Selected
                    </button>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">
                                <input type="checkbox" id="select-all-utxos" class="w-4 h-4 accent-[#FF6B35]" />
                            </th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Txid:Vout</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Amount</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Confirmations</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Script Type</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Type</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold text-lg">Address</th>
                        </tr>
                    </thead>
                    <tbody id="utxo-table-body">
                        <tr><td colspan="7" class="text-center py-8 text-gray-400">Loading UTXOs...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Global function for opening transactions on mempool.space
  window.openTxOnMempool = (txid) => {
    const url = `http://170.75.166.88:8080/tx/${txid}`;
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
    .querySelector('#refresh-utxos-btn')
    .addEventListener('click', refreshUtxos);

  // Add filter button handlers
  content
    .querySelector('#filter-all')
    .addEventListener('click', () => applyFilter('all'));
  content
    .querySelector('#filter-regular')
    .addEventListener('click', () => applyFilter('regular'));
  content
    .querySelector('#filter-contract')
    .addEventListener('click', () => applyFilter('contract'));
  content
    .querySelector('#filter-swap')
    .addEventListener('click', () => applyFilter('swap'));
  content
    .querySelector('#filter-spendable')
    .addEventListener('click', () => applyFilter('spendable'));
  content
    .querySelector('#sort-newest')
    .addEventListener('click', () => setSort('newest'));
  content
    .querySelector('#sort-amount')
    .addEventListener('click', () => setSort('amount'));

  // Add select all handler
  const selectAllCheckbox = content.querySelector('#select-all-utxos');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', selectAllUtxos);
  }

  // Add action button handlers
  const sendButton = content.querySelector('#send-selected');
  if (sendButton) {
    sendButton.addEventListener('click', sendWithSelectedUtxos);
  }

  const swapButton = content.querySelector('#swap-selected');
  if (swapButton) {
    swapButton.addEventListener('click', swapWithSelectedUtxos);
  }

  // Add back button handler
  const backButton = content.querySelector('#back-to-wallet');
  backButton.addEventListener('click', () => {
    const walletModule = import('./Wallet.js');
    walletModule.then((module) => {
      container.innerHTML = '';
      module.WalletComponent(container);
    });
  });

  // Initialize data
  updateSortButtons();
  loadUtxos();
}
