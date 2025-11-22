export function SendComponent(container, preSelectedUtxos = null) {
  const content = document.createElement('div');
  content.id = 'send-content';

  // State
  let amountUnit = 'sats';
  let selectedFeeRate = 7;
  let feeRates = { low: 3, medium: 7, high: 15 };
  let selectionMode = preSelectedUtxos && preSelectedUtxos.length > 0 ? 'manual' : 'auto';
  let selectedUtxos = preSelectedUtxos || [];
  const btcPrice = 30000;
  const txSize = 140; // vBytes

  // Available UTXOs for manual selection
  let availableUtxos = [
    { txid: 'a1b2c3d4e5f6', vout: 0, amount: 5000000, type: 'Regular' },
    { txid: '7g8h9i0j1k2l', vout: 1, amount: 10000000, type: 'Regular' },
    { txid: 'm3n4o5p6q7r8', vout: 0, amount: 5000000, type: 'Swap' },
    { txid: 'u1v2w3x4y5z6', vout: 2, amount: 3000000, type: 'Regular' },
  ];

  // Calculate total available balance from UTXOs
  let availableBalance = availableUtxos.reduce((sum, utxo) => sum + utxo.amount, 0); // 23,000,000 sats

  // Fetch real UTXOs from API (using IPC)
  async function fetchUtxosFromAPI() {
    try {
      const data = await window.api.taker.getUtxos();

      if (data.success && data.utxos) {
        availableUtxos = data.utxos.map((item, index) => {
          const utxo = item.utxo || item;
          const spendInfo = item.spendInfo || {};
          const txid = typeof utxo.txid === 'object' ? utxo.txid.hex : utxo.txid;

          return {
            txid: txid,
            vout: utxo.vout,
            amount: utxo.amount,
            type: spendInfo.spendType || 'Regular',
            index: index
          };
        });

        availableBalance = availableUtxos.reduce((sum, utxo) => sum + utxo.amount, 0);
        console.log('✅ Loaded', availableUtxos.length, 'UTXOs');
      }
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
    }
  }

  // FUNCTIONS

  // Manual UTXO selection functions
  function toggleSelectionMode(mode) {
    selectionMode = mode;

    // Update mode button styles
    content.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.className = 'mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors';
    });
    content.querySelector('#mode-' + mode).className = 'mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold';

    // Show/hide sections based on mode
    const amountSection = content.querySelector('#amount-section');
    const manualSection = content.querySelector('#manual-selection-section');
    
    if (mode === 'manual') {
      // Hide amount section in manual mode
      amountSection.classList.add('hidden');
      manualSection.classList.remove('hidden');
    } else {
      // Show amount section in auto mode
      amountSection.classList.remove('hidden');
      manualSection.classList.add('hidden');
      selectedUtxos = [];
      updateSelectedUtxosDisplay();
    }

    updateSummary();
  }

  function toggleUtxoSelection(index) {
    const utxoIndex = selectedUtxos.indexOf(index);
    if (utxoIndex > -1) {
      selectedUtxos.splice(utxoIndex, 1);
    } else {
      selectedUtxos.push(index);
    }

    const checkbox = content.querySelector('#utxo-' + index);
    checkbox.checked = selectedUtxos.includes(index);

    updateSelectedUtxosDisplay();
    checkUtxoTypeWarning();
    updateSummary();
  }

  function updateSelectedUtxosDisplay() {
    content.querySelector('#selected-utxos-count').textContent = selectedUtxos.length;
    
    const totalValue = selectedUtxos.reduce((sum, index) => sum + availableUtxos[index].amount, 0);
    content.querySelector('#selected-utxos-value').textContent = (totalValue / 100000000).toFixed(8) + ' BTC';
  }

  function getSelectedUtxosTotal() {
    return selectedUtxos.reduce((sum, index) => sum + availableUtxos[index].amount, 0);
  }

  function checkUtxoTypeWarning() {
    if (selectedUtxos.length < 2) {
      content.querySelector('#utxo-warning').classList.add('hidden');
      return;
    }

    const types = selectedUtxos.map((index) => availableUtxos[index].type);
    const hasRegular = types.includes('Regular');
    const hasSwap = types.includes('Swap');

    if (hasRegular && hasSwap) {
      content.querySelector('#utxo-warning').classList.remove('hidden');
    } else {
      content.querySelector('#utxo-warning').classList.add('hidden');
    }
  }

  async function fetchFeeRates() {
    try {
      const response = await fetch(
        'https://mempool.space/api/v1/fees/recommended'
      );
      const data = await response.json();

      feeRates = {
        low: data.hourFee,
        medium: data.halfHourFee,
        high: data.fastestFee,
      };

      selectedFeeRate = feeRates.medium;

      content.querySelector('#fee-low-rate').textContent =
        feeRates.low + ' sat/vB';
      content.querySelector('#fee-medium-rate').textContent =
        feeRates.medium + ' sat/vB';
      content.querySelector('#fee-high-rate').textContent =
        feeRates.high + ' sat/vB';

      content.querySelector('#fee-low-cost').textContent =
        '~$' + ((feeRates.low * txSize * btcPrice) / 100000000).toFixed(2);
      content.querySelector('#fee-medium-cost').textContent =
        '~$' + ((feeRates.medium * txSize * btcPrice) / 100000000).toFixed(2);
      content.querySelector('#fee-high-cost').textContent =
        '~$' + ((feeRates.high * txSize * btcPrice) / 100000000).toFixed(2);

      content.querySelector('#fee-update-time').textContent =
        'Updated just now';

      updateSummary();
    } catch (error) {
      console.error('Failed to fetch fee rates:', error);
      content.querySelector('#fee-update-time').textContent =
        'Failed to update';
    }
  }

  function switchUnit(unit) {
    amountUnit = unit;

    content.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.className =
        'unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold transition-colors';
    });
    content.querySelector('#unit-' + unit).className =
      'unit-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-xs font-semibold';

    const input = content.querySelector('#amount-input');
    if (unit === 'sats') input.placeholder = '0';
    else if (unit === 'btc') input.placeholder = '0.00000000';
    else input.placeholder = '0.00';

    updateSummary();
  }

  function selectFee(level) {
    selectedFeeRate = feeRates[level];

    content.querySelectorAll('.fee-btn').forEach((btn) => {
      btn.className = btn.className.replace(
        'bg-[#FF6B35] border-2 border-[#FF6B35]',
        'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'
      );
    });

    const selectedBtn = content.querySelector('#fee-' + level);
    selectedBtn.className = selectedBtn.className.replace(
      'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700',
      'bg-[#FF6B35] border-2 border-[#FF6B35]'
    );

    updateSummary();
  }

  function getAmountInSats() {
    // In manual mode, amount is determined by selected UTXOs
    if (selectionMode === 'manual') {
      return getSelectedUtxosTotal();
    }
    
    // In auto mode, use input field
    const input = content.querySelector('#amount-input');
    const value = parseFloat(input.value) || 0;

    if (amountUnit === 'sats') {
      return value;
    } else if (amountUnit === 'btc') {
      return value * 100000000;
    } else if (amountUnit === 'usd') {
      return (value / btcPrice) * 100000000;
    }
    return 0;
  }

  function updateSummary() {
    const amountSats = getAmountInSats();
    const fee = selectedFeeRate * txSize;
    const total = amountSats + fee;
    
    // Use selected UTXOs total if in manual mode, otherwise use full balance
    let availableForSpending = availableBalance;
    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      availableForSpending = getSelectedUtxosTotal();
    }
    
    const remaining = Math.max(0, availableForSpending - total); // Ensure remaining is never negative

    // Calculate technical details
    const numInputs = selectionMode === 'manual' ? Math.max(1, selectedUtxos.length) : 1;
    const actualTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * 2); // P2WPKH estimation
    const changeAmount = remaining;
    const confTime = selectedFeeRate >= 15 ? '~10 min' : selectedFeeRate >= 7 ? '~20 min' : '~60+ min';
    const priority = selectedFeeRate >= 15 ? 'High' : selectedFeeRate >= 7 ? 'Medium' : 'Low';

    // Update amount conversions
    const amountBtc = amountSats / 100000000;
    const amountUsd = (amountSats / 100000000) * btcPrice;

    // Only update amount display if in auto mode (manual mode doesn't have these elements)
    if (selectionMode === 'auto') {
      const amountBtcEl = content.querySelector('#amount-btc');
      const amountUsdEl = content.querySelector('#amount-usd');
      if (amountBtcEl && amountUsdEl) {
        amountBtcEl.textContent = 'â‰ˆ ' + amountBtc.toFixed(8) + ' BTC';
        amountUsdEl.textContent = 'â‰ˆ $' + amountUsd.toFixed(2) + ' USD';
      }
    }

    // Update summary section
    content.querySelector('#summary-amount').textContent = Math.floor(amountSats).toLocaleString() + ' sats';
    content.querySelector('#summary-fee-rate').textContent = selectedFeeRate;
    content.querySelector('#summary-fee').textContent = '~' + fee.toLocaleString() + ' sats';
    content.querySelector('#summary-total').textContent = Math.floor(total).toLocaleString() + ' sats';
    content.querySelector('#summary-total-usd').textContent = 'â‰ˆ $' + ((total * btcPrice) / 100000000).toFixed(2);

    // Update technical details
    content.querySelector('#tx-size').textContent = actualTxSize + ' vB';
    content.querySelector('#tx-inputs').textContent = numInputs;
    content.querySelector('#change-amount').textContent = changeAmount.toLocaleString() + ' sats';
    content.querySelector('#conf-time').textContent = confTime;
    content.querySelector('#priority-level').textContent = priority;

    content.querySelector('#summary-remaining').textContent = Math.floor(remaining).toLocaleString() + ' sats';
    const remainingBtc = remaining / 100000000;
    const remainingUsd = remainingBtc * btcPrice;
    content.querySelector('#summary-remaining-detail').textContent = remainingBtc.toFixed(8) + ' BTC â‰ˆ $' + remainingUsd.toFixed(2);

    // Update available balance display based on selection mode
    const availableBalanceEl = content.querySelector('#available-balance-sats');
    const availableBalanceBtcEl = content.querySelector('#available-balance-btc');
    if (availableBalanceEl && availableBalanceBtcEl) {
      availableBalanceEl.textContent = availableForSpending.toLocaleString() + ' sats';
      availableBalanceBtcEl.textContent = (availableForSpending / 100000000).toFixed(8);
    }
  }

  function setMaxAmount() {
    const fee = selectedFeeRate * txSize;
    
    let availableForSpending = availableBalance;
    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      availableForSpending = getSelectedUtxosTotal();
    }
    
    const maxAmount = availableForSpending - fee;

    const input = content.querySelector('#amount-input');
    if (amountUnit === 'sats') {
      input.value = maxAmount;
    } else if (amountUnit === 'btc') {
      input.value = (maxAmount / 100000000).toFixed(8);
    } else if (amountUnit === 'usd') {
      input.value = ((maxAmount / 100000000) * btcPrice).toFixed(2);
    }

    updateSummary();
  }

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Send Bitcoin</h2>
        <p class="text-gray-400 mb-8">Send BTC to any Bitcoin address</p>

        <div class="grid grid-cols-3 gap-6">
            <!-- Left: Send Form -->
            <div class="col-span-2 space-y-6">
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <!-- Recipient Address -->
                    <div class="mb-6">
                        <label class="block text-sm text-gray-400 mb-2">Recipient Address</label>
                        <input 
                            id="recipient-address"
                            type="text" 
                            placeholder="bc1q..." 
                            class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                        />
                        <p class="text-xs text-gray-500 mt-2">Enter a valid Bitcoin address</p>
                    </div>

                    <!-- Selection Mode -->
                    <div class="mb-6">
                        <label class="block text-sm text-gray-400 mb-2">UTXO Selection</label>
                        <div class="flex gap-2">
                            <button id="mode-auto" class="mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                                Auto Select
                            </button>
                            <button id="mode-manual" class="mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                                Manual Select
                            </button>
                        </div>
                    </div>

                    <!-- Amount Toggle -->
                    <div id="amount-section" class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-sm text-gray-400">Amount</label>
                            <div class="flex gap-2">
                                <button id="unit-sats" class="unit-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-xs font-semibold">
                                    Sats
                                </button>
                                <button id="unit-btc" class="unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold transition-colors">
                                    BTC
                                </button>
                                <button id="unit-usd" class="unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold transition-colors">
                                    USD
                                </button>
                            </div>
                        </div>
                        <div class="relative">
                            <input 
                                id="amount-input"
                                type="text" 
                                placeholder="0" 
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 pr-20 text-white font-mono text-lg focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <button id="max-btn" class="absolute right-2 top-1/2 -translate-y-1/2 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-1 rounded text-sm font-semibold transition-colors">
                                Max
                            </button>
                        </div>
                        <div class="flex justify-between mt-2">
                            <p id="amount-btc" class="text-xs text-gray-400">â‰ˆ 0.00000000 BTC</p>
                            <p id="amount-usd" class="text-xs text-gray-400">â‰ˆ $0.00 USD</p>
                        </div>
                    </div>

                    <!-- Fee Rate -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-sm text-gray-400">Fee Rate</label>
                            <div class="flex items-center gap-2">
                                <span id="fee-update-time" class="text-xs text-gray-500">Loading...</span>
                                <button id="refresh-fees" class="text-[#FF6B35] hover:text-[#ff7d4d] text-xs">Refresh</button>
                            </div>
                        </div>
                        
                        <!-- Fee Presets -->
                        <div class="grid grid-cols-3 gap-2 mb-4">
                            <button id="fee-low" class="fee-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-center transition-colors">
                                <div class="text-white font-semibold">Low Priority</div>
                                <div id="fee-low-rate" class="text-xs text-gray-400 mt-1">... sat/vB</div>
                                <div class="text-xs text-gray-500">~60 min</div>
                                <div id="fee-low-cost" class="text-xs text-green-400 mt-1">~$...</div>
                            </button>
                            <button id="fee-medium" class="fee-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg p-3 text-center">
                                <div class="text-white font-semibold">Medium</div>
                                <div id="fee-medium-rate" class="text-xs text-white/80 mt-1">... sat/vB</div>
                                <div class="text-xs text-white/60">~20 min</div>
                                <div id="fee-medium-cost" class="text-xs text-white/90 mt-1">~$...</div>
                            </button>
                            <button id="fee-high" class="fee-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-center transition-colors">
                                <div class="text-white font-semibold">High Priority</div>
                                <div id="fee-high-rate" class="text-xs text-gray-400 mt-1">... sat/vB</div>
                                <div class="text-xs text-gray-500">~10 min</div>
                                <div id="fee-high-cost" class="text-xs text-yellow-400 mt-1">~$...</div>
                            </button>
                        </div>

                        <!-- Custom Fee -->
                        <div class="flex items-center gap-2">
                            <input 
                                id="custom-fee"
                                type="number" 
                                placeholder="Custom" 
                                class="flex-1 bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <span class="text-sm text-gray-400">sats/vByte</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Estimated transaction size: ~140 vBytes</p>
                    </div>
                </div>

                <!-- Manual Selection Section -->
                <div id="manual-selection-section" class="hidden">
                    <!-- UTXO Selection -->
                    <div class="bg-[#1a2332] rounded-lg p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-semibold text-gray-300">Select UTXOs</h3>
                            <div class="text-sm text-gray-400">
                                Selected: <span id="selected-utxos-count">0</span> UTXOs 
                                (<span id="selected-utxos-value">0.00000000 BTC</span>)
                            </div>
                        </div>
                        
                        <!-- Warning Message -->
                        <div id="utxo-warning" class="hidden mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <p class="text-xs text-yellow-400">
                                âš  Warning: Mixing Regular and Swap UTXOs in the same transaction can compromise privacy. Use only one type per send.
                            </p>
                        </div>
                        
                        <div class="space-y-2">
                            ${availableUtxos
                              .map((utxo, index) => {
                                const btcAmount = (
                                  utxo.amount / 100000000
                                ).toFixed(8);
                                const usdAmount = (
                                  (utxo.amount / 100000000) *
                                  btcPrice
                                ).toFixed(2);
                                const isSelected = selectedUtxos.includes(index);
                                return `
                                <label class="flex items-center gap-3 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg p-3 cursor-pointer transition-colors">
                                    <input type="checkbox" id="utxo-${index}" ${isSelected ? 'checked' : ''} class="w-4 h-4 accent-[#FF6B35]" />
                                    <div class="flex-1">
                                        <div class="flex justify-between items-center">
                                            <span class="font-mono text-sm text-gray-300">${utxo.txid}:${utxo.vout}</span>
                                            <div class="text-right">
                                                <div class="text-sm font-mono text-green-400">${btcAmount} BTC</div>
                                                <div class="text-xs text-gray-500">${usdAmount} USD</div>
                                            </div>
                                        </div>
                                        <div class="flex justify-between items-center mt-1">
                                            <span class="text-xs text-gray-500">${utxo.amount.toLocaleString()} sats</span>
                                            <span class="text-xs ${utxo.type === 'Swap' ? 'text-blue-400' : 'text-green-400'}">${utxo.type}</span>
                                        </div>
                                    </div>
                                </label>
                            `;
                              })
                              .join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Send Button (moved to bottom) -->
                <div class="mt-6">
                    <button id="send-bitcoin-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-colors text-lg">
                        Send Bitcoin
                    </button>
                </div>
            </div>

            <!-- Right: Summary -->
            <div class="col-span-1">
                <div class="bg-[#1a2332] rounded-lg p-6 sticky top-8">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Transaction Summary</h3>
                    
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Available Balance</p>
                            <p id="available-balance-sats" class="text-xl font-mono text-green-400">23,000,000 sats</p>
                            <p class="text-xs text-gray-500">
                                <span id="available-balance-btc">0.23000000</span> BTC â‰ˆ $6,900
                            </p>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Amount</span>
                                <span id="summary-amount" class="text-sm font-mono text-white">0 sats</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Network Fee (<span id="summary-fee-rate">7</span> sat/vB)</span>
                                <span id="summary-fee" class="text-sm font-mono text-yellow-400">~980 sats</span>
                            </div>
                            <div class="flex justify-between pt-2 border-t border-gray-700">
                                <span class="text-sm font-semibold text-gray-300">Total Sent</span>
                                <span id="summary-total" class="text-sm font-mono font-semibold text-[#FF6B35]">980 sats</span>
                            </div>
                            <p id="summary-total-usd" class="text-xs text-gray-500 text-right mt-1">â‰ˆ $0.29</p>
                        </div>

                        <!-- Essential Technical Details -->
                        <div class="border-t border-gray-700 pt-4">
                            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                <div class="flex justify-between">
                                    <span class="text-gray-400">TX Size:</span>
                                    <span id="tx-size" class="text-white font-mono">140 vB</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Inputs:</span>
                                    <span id="tx-inputs" class="text-cyan-400 font-mono">1</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Change:</span>
                                    <span id="change-amount" class="text-purple-400 font-mono">0 sats</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Est. Time:</span>
                                    <span id="conf-time" class="text-green-400">~20 min</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">Priority:</span>
                                    <span id="priority-level" class="text-yellow-400">Medium</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-400">RBF:</span>
                                    <span class="text-blue-400">âœ“ Enabled</span>
                                </div>
                            </div>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <p class="text-sm text-gray-400 mb-1">Remaining Balance</p>
                            <p id="summary-remaining" class="text-lg font-mono text-blue-400">22,999,020 sats</p>
                            <p id="summary-remaining-detail" class="text-xs text-gray-500">0.22999020 BTC â‰ˆ $6,899.71</p>
                        </div>
                    </div>

                    <div class="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-xs text-blue-400">
                            â“˜ Transactions are irreversible. Double-check the address before sending.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

  container.appendChild(content);

  // EVENT LISTENERS

  content
    .querySelector('#unit-sats')
    .addEventListener('click', () => switchUnit('sats'));
  content
    .querySelector('#unit-btc')
    .addEventListener('click', () => switchUnit('btc'));
  content
    .querySelector('#unit-usd')
    .addEventListener('click', () => switchUnit('usd'));

  content
    .querySelector('#mode-auto')
    .addEventListener('click', () => toggleSelectionMode('auto'));
  content
    .querySelector('#mode-manual')
    .addEventListener('click', () => toggleSelectionMode('manual'));

  content
    .querySelector('#fee-low')
    .addEventListener('click', () => selectFee('low'));
  content
    .querySelector('#fee-medium')
    .addEventListener('click', () => selectFee('medium'));
  content
    .querySelector('#fee-high')
    .addEventListener('click', () => selectFee('high'));

  content
    .querySelector('#refresh-fees')
    .addEventListener('click', fetchFeeRates);

  content.querySelector('#max-btn').addEventListener('click', setMaxAmount);

  content
    .querySelector('#amount-input')
    .addEventListener('input', updateSummary);

  content.querySelector('#custom-fee').addEventListener('input', (e) => {
    const customRate = parseInt(e.target.value);
    if (customRate > 0) {
      selectedFeeRate = customRate;

      content.querySelectorAll('.fee-btn').forEach((btn) => {
        btn.className = btn.className.replace(
          'bg-[#FF6B35] border-2 border-[#FF6B35]',
          'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'
        );
      });

      updateSummary();
    }
  });

  // SEND TRANSACTION FUNCTION
  async function handleSendBitcoin() {
    const recipientAddress = content.querySelector('#recipient-address').value.trim();
    const amountSats = getAmountInSats();
    
    if (!recipientAddress) {
      alert('Please enter a recipient address');
      return;
    }
    
    if (amountSats <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    const fee = selectedFeeRate * txSize;
    const total = amountSats + fee;
    
    if (total > availableBalance) {
      alert(`Insufficient balance. Total required: ${(total / 100000000).toFixed(8)} BTC`);
      return;
    }
    
    const confirmed = confirm(
      `Send ${(amountSats / 100000000).toFixed(8)} BTC to:\n${recipientAddress}\n\n` +
      `Network Fee: ${fee} sats\n` +
      `Total: ${(total / 100000000).toFixed(8)} BTC\n\n` +
      `⚠️ This transaction is irreversible. Continue?`
    );
    
    if (!confirmed) return;
    
    const sendBtn = content.querySelector('#send-bitcoin-btn');
    const originalText = sendBtn.textContent;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    
    try {
      const data = await window.api.taker.sendToAddress(recipientAddress, amountSats);

      if (data.success) {
        const txid = typeof data.txid === 'object' ? data.txid.hex : data.txid;
        alert(`✅ Transaction sent successfully!\n\nTXID: ${txid}`);

        // Reset form
        content.querySelector('#recipient-address').value = '';
        content.querySelector('#amount-input').value = '';

        // Refresh UTXOs
        await fetchUtxosFromAPI();
        updateSummary();
      } else {
        throw new Error(data.error || 'Failed to send transaction');
      }
    } catch (error) {
      console.error('Send failed:', error);
      alert(`❌ Failed to send: ${error.message}`);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = originalText;
    }
  }

  // UTXO selection listeners
  setTimeout(() => {
    availableUtxos.forEach((_, index) => {
      const checkbox = content.querySelector('#utxo-' + index);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          toggleUtxoSelection(index);
        });
      }
    });
  }, 100);

  // Send button listener
  const sendBtn = content.querySelector('#send-bitcoin-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendBitcoin);
  }

  // INITIALIZE PRE-SELECTED UTXOs
  if (preSelectedUtxos && preSelectedUtxos.length > 0) {
    // Switch to manual mode automatically
    toggleSelectionMode('manual');
    
    // Update checkboxes to match pre-selected UTXOs
    selectedUtxos.forEach(index => {
      const checkbox = content.querySelector('#utxo-' + index);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
    
    // Update selection display
    updateSelectedUtxosDisplay();
    checkUtxoTypeWarning();
  }
  
  // Fetch real data
  fetchUtxosFromAPI();
  fetchFeeRates();
}