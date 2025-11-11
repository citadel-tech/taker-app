export function UtxoListComponent(container) {
  const content = document.createElement('div');
  content.id = 'utxo-list-content';

  // State for UTXO selection
  let selectedUtxos = [];

  // UTXO data matching the table rows
  const utxos = [
    { txid: 'a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234', vout: 0, amount: 5000000, type: 'Regular' },
    { txid: '7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l', vout: 1, amount: 10000000, type: 'Regular' },
    { txid: 'm3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4', vout: 0, amount: 5000000, type: 'Swap' },
    { txid: 'u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2', vout: 2, amount: 3000000, type: 'Regular' },
    { txid: 'c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0', vout: 1, amount: 2000000, type: 'Regular' },
    { txid: 'k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8', vout: 0, amount: 1500000, type: 'Regular' },
  ];

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
    utxos.forEach((_, index) => {
      const checkbox = content.querySelector(`#utxo-checkbox-${index}`);
      if (checkbox) {
        checkbox.checked = selectedUtxos.includes(index);
      }
    });

    // Update master checkbox
    const selectAllCheckbox = content.querySelector('#select-all-utxos');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = selectedUtxos.length === utxos.length;
      selectAllCheckbox.indeterminate = selectedUtxos.length > 0 && selectedUtxos.length < utxos.length;
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
    if (selectedUtxos.length === utxos.length) {
      selectedUtxos = [];
    } else {
      selectedUtxos = Array.from({length: utxos.length}, (_, i) => i);
    }
    updateSelectionUI();
  }

  function sendWithSelectedUtxos() {
    import('../send/Send.js').then((module) => {
      container.innerHTML = '';
      module.SendComponent(container, selectedUtxos);
    });
  }

  function swapWithSelectedUtxos() {
    import('../swap/Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container, selectedUtxos);
    });
  }

  content.innerHTML = `
        <div class="mb-6">
            <button id="back-to-wallet" class="text-gray-400 hover:text-white transition-colors mb-4">
                ← Back to Wallet
            </button>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All UTXOs</h2>
            <p class="text-gray-400">Complete list of unspent transaction outputs</p>
        </div>

        <!-- UTXO Stats -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total UTXOs</p>
                <p class="text-2xl font-mono text-[#FF6B35]">12</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Value</p>
                <p class="text-2xl font-mono text-green-400">0.20 BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Confirmed</p>
                <p class="text-2xl font-mono text-blue-400">10</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Unconfirmed</p>
                <p class="text-2xl font-mono text-yellow-400">2</p>
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
                    <tbody>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4">
                                <input type="checkbox" id="utxo-checkbox-0" class="w-4 h-4 accent-[#FF6B35]" />
                            </td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" onclick="openTxOnMempool('${utxos[0].txid}')">a1b2c3d4e5f6...7890:0</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.05000000</td>
                            <td class="py-3 px-4 text-gray-300">142</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qxy2...wlh</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4">
                                <input type="checkbox" id="utxo-checkbox-1" class="w-4 h-4 accent-[#FF6B35]" />
                            </td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" onclick="openTxOnMempool('${utxos[1].txid}')">7g8h9i0j1k2l...3m4n:1</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.10000000</td>
                            <td class="py-3 px-4 text-gray-300">89</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qar0...8zt</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4">
                                <input type="checkbox" id="utxo-checkbox-2" class="w-4 h-4 accent-[#FF6B35]" />
                            </td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" onclick="openTxOnMempool('${utxos[2].txid}')">m3n4o5p6q7r8...s9t0:0</td>
                            <td class="py-3 px-4 text-blue-400 font-mono">0.05000000</td>
                            <td class="py-3 px-4 text-gray-300">23</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qw50...3yn</td>
                            <td class="py-3 px-4 text-blue-400">Swap</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4">
                                <input type="checkbox" id="utxo-checkbox-3" class="w-4 h-4 accent-[#FF6B35]" />
                            </td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" onclick="openTxOnMempool('${utxos[3].txid}')">u1v2w3x4y5z6...a7b8:2</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.03000000</td>
                            <td class="py-3 px-4 text-gray-300">67</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qm3n...5op</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4">
                                <input type="checkbox" id="utxo-checkbox-4" class="w-4 h-4 accent-[#FF6B35]" />
                            </td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" onclick="openTxOnMempool('${utxos[4].txid}')">c9d0e1f2g3h4...i5j6:1</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.02000000</td>
                            <td class="py-3 px-4 text-gray-300">156</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qrs7...9tu</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4">
                                <input type="checkbox" id="utxo-checkbox-5" class="w-4 h-4 accent-[#FF6B35]" />
                            </td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300 cursor-pointer hover:text-[#FF6B35] hover:underline transition-colors" onclick="openTxOnMempool('${utxos[5].txid}')">k7l8m9n0o1p2...q3r4:0</td>
                            <td class="py-3 px-4 text-yellow-400 font-mono">0.01500000</td>
                            <td class="py-3 px-4 text-yellow-400">2</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qvwx...1yz</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Global function for opening transactions on mempool.space
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

  // Add individual UTXO selection handlers
  utxos.forEach((_, index) => {
    const checkbox = content.querySelector(`#utxo-checkbox-${index}`);
    if (checkbox) {
      checkbox.addEventListener('change', () => toggleUtxoSelection(index));
    }
  });

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
}