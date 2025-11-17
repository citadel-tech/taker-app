export function UtxoListComponent(container) {
  // State for UTXO selection
  let selectedUtxos = [];
  let allUtxos = [];

  // API Functions
  async function fetchUtxos() {
    try {
      const response = await fetch('http://localhost:3001/api/taker/utxos');
      const data = await response.json();
      
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

  function truncateTxid(txid) {
    if (typeof txid === 'object' && txid.hex) {
      txid = txid.hex;
    }
    return `${txid.substring(0, 12)}...${txid.substring(-4)}`;
  }

  function getUtxoTypeColor(spendType) {
    switch (spendType.toLowerCase()) {
      case 'regular': return 'green';
      case 'swap': return 'blue';
      case 'contract': return 'yellow';
      case 'fidelity': return 'purple';
      default: return 'gray';
    }
  }

  function calculateStats() {
    const totalUtxos = allUtxos.length;
    const totalValue = allUtxos.reduce((sum, utxo) => sum + utxo.utxo.amount, 0);
    const confirmed = allUtxos.filter(utxo => utxo.utxo.confirmations > 0).length;
    const unconfirmed = totalUtxos - confirmed;

    return { totalUtxos, totalValue, confirmed, unconfirmed };
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
    allUtxos.forEach((_, index) => {
      const checkbox = content.querySelector(`#utxo-checkbox-${index}`);
      if (checkbox) {
        checkbox.checked = selectedUtxos.includes(index);
      }
    });

    // Update master checkbox
    const selectAllCheckbox = content.querySelector('#select-all-utxos');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = selectedUtxos.length === allUtxos.length;
      selectAllCheckbox.indeterminate = selectedUtxos.length > 0 && selectedUtxos.length < allUtxos.length;
    }

    // Update action buttons visibility
    const actionButtons = content.querySelector('#utxo-actions');
    const selectionCount = content.querySelector('#selection-count');
    
    if (selectedUtxos.length > 0) {
      actionButtons.classList.remove('hidden');
      selectionCount.textContent = selectedUtxos.length;
    } else {
      actionButtons.classList.add('hidden');
    }
  }

  function selectAllUtxos() {
    if (selectedUtxos.length === allUtxos.length) {
      selectedUtxos = [];
    } else {
      selectedUtxos = Array.from({length: allUtxos.length}, (_, i) => i);
    }
    updateSelectionUI();
  }

  function sendWithSelectedUtxos() {
    const selectedUtxoData = selectedUtxos.map(index => allUtxos[index]);
    import('../send/Send.js').then((module) => {
      container.innerHTML = '';
      module.SendComponent(container, selectedUtxoData);
    });
  }

  function swapWithSelectedUtxos() {
    const selectedUtxoData = selectedUtxos.map(index => allUtxos[index]);
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
      updateStatsDisplay();
      updateUtxoTable();
      console.log('✅ UTXOs loaded:', allUtxos.length);
    } catch (error) {
      console.error('❌ Failed to load UTXOs:', error);
      // Show error in table
      const tableBody = content.querySelector('#utxo-table-body');
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-red-400">Failed to load UTXOs. Please try refreshing.</td></tr>';
      }
    }
  }

  function updateStatsDisplay() {
    const stats = calculateStats();
    
    content.querySelector('#total-utxos').textContent = stats.totalUtxos;
    content.querySelector('#total-value').textContent = satsToBtc(stats.totalValue);
    content.querySelector('#confirmed-count').textContent = stats.confirmed;
    content.querySelector('#unconfirmed-count').textContent = stats.unconfirmed;
  }

  function updateUtxoTable() {
    const tableBody = content.querySelector('#utxo-table-body');
    
    if (allUtxos.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">No UTXOs found</td></tr>';
      return;
    }

    tableBody.innerHTML = allUtxos.map((utxoData, index) => {
      const utxo = utxoData.utxo;
      const spendInfo = utxoData.spendInfo;
      const txidShort = truncateTxid(utxo.txid);
      const color = getUtxoTypeColor(spendInfo.spendType);
      const txid = typeof utxo.txid === 'object' ? utxo.txid.hex : utxo.txid;
      
      return `
        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
          <td class="py-3 px-4">
            <input type="checkbox" id="utxo-checkbox-${index}" class="w-4 h-4 accent-[#FF6B35]" />
          </td>
          <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" 
              onclick="openTxOnMempool('${txid}')">${txidShort}:${utxo.vout}</td>
          <td class="py-3 px-4 text-${color}-400 font-mono">${satsToBtc(utxo.amount)}</td>
          <td class="py-3 px-4 text-gray-300 ${utxo.confirmations === 0 ? 'text-yellow-400' : ''}">${utxo.confirmations}</td>
          <td class="py-3 px-4 font-mono text-sm text-gray-300">${utxo.address ? utxo.address.substring(0, 8) + '...' + utxo.address.substring(-3) : '--'}</td>
          <td class="py-3 px-4 text-${color}-400">${spendInfo.spendType}</td>
        </tr>
      `;
    }).join('');

    // Add event listeners for new checkboxes
    allUtxos.forEach((_, index) => {
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
                <p class="text-gray-400">Complete list of unspent transaction outputs</p>
            </div>
            <button id="refresh-utxos-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-2 px-4 rounded-lg transition-colors">
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

        <!-- UTXO Table -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-gray-300">UTXO Details</h3>
                <!-- Selection Actions -->
                <div id="utxo-actions" class="hidden flex gap-2">
                    <span class="text-sm text-gray-400">
                        <span id="selection-count">0</span> selected
                    </span>
                    <button id="send-selected" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Send
                    </button>
                    <button id="swap-selected" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold transition-colors">
                        Swap
                    </button>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">
                                <input type="checkbox" id="select-all-utxos" class="w-4 h-4 accent-[#FF6B35]" />
                            </th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Txid:Vout</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Confirmations</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Address</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                        </tr>
                    </thead>
                    <tbody id="utxo-table-body">
                        <!-- UTXOs will be populated here -->
                    </tbody>
                </table>
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
  content.querySelector('#refresh-utxos-btn').addEventListener('click', refreshUtxos);

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
  loadUtxos();
}