export function SwapComponent(container) {
  const content = document.createElement('div');
  content.id = 'swap-content';

  // STATE
  let swapAmount = 0;
  let amountUnit = 'sats';
  let numberOfHops = 3;
  let selectionMode = 'auto';
  let selectedUtxos = [];
  let selectedMakers = [];
  let networkFeeRate = 5; // sats/vB

  const availableUtxos = [
    { txid: 'a1b2c3d4e5f6', vout: 0, amount: 5000000, type: 'Regular' },
    { txid: '7g8h9i0j1k2l', vout: 1, amount: 10000000, type: 'Regular' },
    { txid: 'm3n4o5p6q7r8', vout: 0, amount: 5000000, type: 'Swap' },
    { txid: 'u1v2w3x4y5z6', vout: 2, amount: 3000000, type: 'Regular' },
  ];

  const availableMakers = [
    {
      address: 'ewaexd2es2uzr34wp26c',
      fee: 10.0,
      minSize: 10000,
      maxSize: 49890356,
      bond: 50000,
    },
    {
      address: 'h2cxriyylj7uefzd65rf',
      fee: 10.0,
      minSize: 10000,
      maxSize: 49908736,
      bond: 50000,
    },
    {
      address: 'abc123xyz789d6gh8ijk',
      fee: 12.5,
      minSize: 5000,
      maxSize: 30000000,
      bond: 35000,
    },
    {
      address: 'def456uvw012e3fg9klm',
      fee: 9.0,
      minSize: 15000,
      maxSize: 60000000,
      bond: 75000,
    },
  ];

  const totalBalance = 23000000;
  const btcPrice = 30000;

  // FUNCTIONS

  async function fetchNetworkFees() {
    try {
      const response = await fetch(
        'https://mempool.space/api/v1/fees/recommended'
      );
      const data = await response.json();
      networkFeeRate = data.halfHourFee;
      updateSummary();
    } catch (error) {
      console.error('Failed to fetch network fees:', error);
    }
  }

  function getNumberOfMakers() {
    if (selectionMode === 'auto') {
      return numberOfHops - 1;
    } else {
      return selectedMakers.length;
    }
  }

  function getNumberOfHops() {
    if (selectionMode === 'auto') {
      return numberOfHops;
    } else {
      return selectedMakers.length + 1;
    }
  }

  function getSelectedUtxosTotal() {
    return selectedUtxos.reduce(
      (sum, index) => sum + availableUtxos[index].amount,
      0
    );
  }

  function getAmountInSats() {
    const input = content.querySelector('#swap-amount-input');
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

  function calculateSwapDetails() {
    const hops = getNumberOfHops();
    const makers = getNumberOfMakers();

    const baseTime = 5;
    const baseFeePercent = 0.1;

    // Network fees: estimate ~250 vBytes per hop
    const txSize = 250;
    const networkFee = networkFeeRate * txSize * hops;

    const estimatedTime = hops * baseTime;
    const makerFeePercent = baseFeePercent * makers;
    const makerFee = (swapAmount * makerFeePercent) / 100;
    const totalFee = makerFee + networkFee;

    return {
      hops: hops,
      makers: makers,
      time: estimatedTime,
      makerFeePercent: makerFeePercent.toFixed(2),
      makerFeeSats: Math.floor(makerFee),
      networkFeeSats: Math.floor(networkFee),
      totalFeeSats: Math.floor(totalFee),
      totalSats: swapAmount + Math.floor(totalFee),
    };
  }

  function updateSummary() {
    const details = calculateSwapDetails();

    swapAmount = getAmountInSats();

    content.querySelector('#swap-amount-display').textContent =
      swapAmount.toLocaleString() + ' sats';

    const swapBtc = swapAmount / 100000000;
    const swapUsd = swapBtc * btcPrice;
    content.querySelector('#swap-amount-conversions').textContent =
      '≈ ' + swapBtc.toFixed(8) + ' BTC • $' + swapUsd.toFixed(2) + ' USD';

    content.querySelector('#num-makers-display').textContent =
      details.makers + ' maker' + (details.makers !== 1 ? 's' : '');
    content.querySelector('#num-hops-display').textContent =
      details.hops + ' hop' + (details.hops !== 1 ? 's' : '');
    content.querySelector('#estimated-time').textContent =
      details.time + ' min';
    content.querySelector('#maker-fee-percent').textContent =
      details.makerFeePercent + '%';
    content.querySelector('#maker-fee-sats').textContent =
      '~' + details.makerFeeSats.toLocaleString() + ' sats';
    content.querySelector('#network-fee-sats').textContent =
      '~' + details.networkFeeSats.toLocaleString() + ' sats';
    content.querySelector('#network-fee-rate').textContent =
      networkFeeRate + ' sat/vB';
    content.querySelector('#total-fee-sats').textContent =
      '~' + details.totalFeeSats.toLocaleString() + ' sats';
    content.querySelector('#total-amount').textContent =
      details.totalSats.toLocaleString() + ' sats';

    const totalBtc = details.totalSats / 100000000;
    content.querySelector('#total-btc').textContent =
      totalBtc.toFixed(8) + ' BTC';
  }

  function switchUnit(unit) {
    amountUnit = unit;

    content.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.className =
        'unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold transition-colors';
    });
    content.querySelector('#unit-' + unit).className =
      'unit-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-xs font-semibold';

    const input = content.querySelector('#swap-amount-input');
    if (unit === 'sats') input.placeholder = '0';
    else if (unit === 'btc') input.placeholder = '0.00000000';
    else input.placeholder = '0.00';

    updateSummary();
  }

  function setHopCount(count) {
    numberOfHops = count;

    content.querySelectorAll('.hop-count-btn').forEach((btn) => {
      btn.className =
        'hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors';
    });
    content.querySelector('#hop-' + count).className =
      'hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold';

    updateSummary();
  }

  function toggleSelectionMode(mode) {
    selectionMode = mode;

    content.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.className =
        'mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors';
    });
    content.querySelector('#mode-' + mode).className =
      'mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold';

    const autoSection = content.querySelector('#auto-selection-section');
    const manualSection = content.querySelector('#manual-selection-section');

    if (mode === 'manual') {
      autoSection.classList.add('hidden');
      manualSection.classList.remove('hidden');
    } else {
      autoSection.classList.remove('hidden');
      manualSection.classList.add('hidden');
    }

    updateSummary();
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

  function toggleUtxoSelection(index) {
    const utxoIndex = selectedUtxos.indexOf(index);
    if (utxoIndex > -1) {
      selectedUtxos.splice(utxoIndex, 1);
    } else {
      selectedUtxos.push(index);
    }

    const checkbox = content.querySelector('#utxo-' + index);
    checkbox.checked = selectedUtxos.includes(index);

    content.querySelector('#selected-utxos-count').textContent =
      selectedUtxos.length;

    checkUtxoTypeWarning();

    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      swapAmount = getSelectedUtxosTotal();
      content.querySelector('#swap-amount-input').value = swapAmount;
      updateSummary();
    }
  }

  function toggleMakerSelection(index) {
    const makerIndex = selectedMakers.indexOf(index);
    if (makerIndex > -1) {
      selectedMakers.splice(makerIndex, 1);
    } else {
      selectedMakers.push(index);
    }

    const checkbox = content.querySelector('#maker-checkbox-' + index);
    checkbox.checked = selectedMakers.includes(index);

    content.querySelector('#selected-makers-count').textContent =
      selectedMakers.length;

    const hops = selectedMakers.length + 1;
    content.querySelector('#calculated-hops').textContent = hops;

    updateSummary();
  }

  function setMaxAmount() {
    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      swapAmount = getSelectedUtxosTotal();
    } else {
      swapAmount = totalBalance;
    }

    const input = content.querySelector('#swap-amount-input');
    if (amountUnit === 'sats') {
      input.value = swapAmount;
    } else if (amountUnit === 'btc') {
      input.value = (swapAmount / 100000000).toFixed(8);
    } else if (amountUnit === 'usd') {
      input.value = ((swapAmount / 100000000) * btcPrice).toFixed(2);
    }

    updateSummary();
  }

  // UI

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap</h2>
        <p class="text-gray-400 mb-8">Perform private Bitcoin swaps through multiple makers</p>

        <div class="grid grid-cols-3 gap-6">
            <div class="col-span-2 space-y-6">
                <!-- Swap Form -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-300 mb-6">Initiate Swap</h3>

                    <!-- Amount to Swap -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-sm text-gray-400">Amount to Swap</label>
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
                                id="swap-amount-input"
                                type="text" 
                                placeholder="0" 
                                class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 pr-20 text-white font-mono text-lg focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <button id="max-swap-btn" class="absolute right-2 top-1/2 -translate-y-1/2 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-1 rounded text-sm font-semibold transition-colors">
                                Max
                            </button>
                        </div>
                        <p id="swap-amount-conversions" class="text-xs text-gray-400 mt-2">≈ 0.00000000 BTC • $0.00 USD</p>
                    </div>

                    <!-- Selection Mode -->
                    <div class="mb-6">
                        <label class="block text-sm text-gray-400 mb-2">Selection Mode</label>
                        <div class="flex gap-2">
                            <button id="mode-auto" class="mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                                Auto Select
                            </button>
                            <button id="mode-manual" class="mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                                Manual Select
                            </button>
                        </div>
                    </div>

                    <!-- Auto Selection: Number of Hops -->
                    <div id="auto-selection-section" class="mb-6">
                        <label class="block text-sm text-gray-400 mb-2">Number of Hops</label>
                        <div class="grid grid-cols-4 gap-2">
                            <button id="hop-2" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                                <div>2 hops</div>
                                <div class="text-xs text-gray-400 mt-1">1 maker</div>
                            </button>
                            <button id="hop-3" class="hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                                <div>3 hops</div>
                                <div class="text-xs text-white/80 mt-1">2 makers</div>
                            </button>
                            <button id="hop-4" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                                <div>4 hops</div>
                                <div class="text-xs text-gray-400 mt-1">3 makers</div>
                            </button>
                            <button id="hop-5" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                                <div>5 hops</div>
                                <div class="text-xs text-gray-400 mt-1">4 makers</div>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">More hops = better privacy, higher fees</p>
                    </div>
                </div>

                <!-- Manual Selection Section -->
                <div id="manual-selection-section" class="space-y-6 hidden">
                    <!-- UTXO Selection -->
                    <div class="bg-[#1a2332] rounded-lg p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-semibold text-gray-300">Select UTXOs</h3>
                            <span class="text-sm text-gray-400">Selected: <span id="selected-utxos-count">0</span></span>
                        </div>
                        
                        <!-- Warning Message -->
                        <div id="utxo-warning" class="hidden mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <p class="text-xs text-yellow-400">
                                ⚠ Warning: Mixing Regular and Swap UTXOs in the same transaction can compromise privacy. Use only one type per swap.
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
                                return `
                                <label class="flex items-center gap-3 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg p-3 cursor-pointer transition-colors">
                                    <input type="checkbox" id="utxo-${index}" class="w-4 h-4 accent-[#FF6B35]" />
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

                    <!-- Maker Selection -->
                    <div class="bg-[#1a2332] rounded-lg p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-semibold text-gray-300">Select Makers</h3>
                            <span class="text-sm text-gray-400">Selected: <span id="selected-makers-count">0</span> makers → <span id="calculated-hops">1</span> hops</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead>
                                    <tr class="border-b border-gray-700">
                                        <th class="text-left py-2 px-2 text-gray-400 font-semibold text-xs">Select</th>
                                        <th class="text-left py-2 px-2 text-gray-400 font-semibold text-xs">Address</th>
                                        <th class="text-left py-2 px-2 text-gray-400 font-semibold text-xs">Fee</th>
                                        <th class="text-left py-2 px-2 text-gray-400 font-semibold text-xs">Min/Max</th>
                                        <th class="text-left py-2 px-2 text-gray-400 font-semibold text-xs">Bond</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${availableMakers
                                      .map(
                                        (maker, index) => `
                                        <tr class="maker-row border-b border-gray-800 hover:bg-[#242d3d] cursor-pointer transition-colors" data-maker-index="${index}">
                                            <td class="py-3 px-2">
                                                <input type="checkbox" id="maker-checkbox-${index}" class="w-4 h-4 accent-[#FF6B35]" />
                                            </td>
                                            <td class="py-3 px-2 font-mono text-xs text-gray-300">${maker.address}...</td>
                                            <td class="py-3 px-2 text-xs text-blue-400">${maker.fee}%</td>
                                            <td class="py-3 px-2 text-xs text-yellow-400">${maker.minSize.toLocaleString()} / ${(maker.maxSize / 1000000).toFixed(1)}M</td>
                                            <td class="py-3 px-2 text-xs text-purple-400">${maker.bond.toLocaleString()}</td>
                                        </tr>
                                    `
                                      )
                                      .join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Start Swap Button -->
               <button id="start-coinswap-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-colors text-lg">
    Start Coinswap
</button>
            </div>

            <!-- Right: Summary -->
            <div class="col-span-1">
                <div class="bg-[#1a2332] rounded-lg p-6 sticky top-8">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Swap Summary</h3>
                    
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Available Balance</p>
                            <p class="text-xl font-mono text-green-400">23,000,000 sats</p>
                            <p class="text-xs text-gray-500">0.23000000 BTC</p>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Swap Amount</span>
                                <span id="swap-amount-display" class="text-sm font-mono text-white">0 sats</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Makers</span>
                                <span id="num-makers-display" class="text-sm text-white">2 makers</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Hops</span>
                                <span id="num-hops-display" class="text-sm text-cyan-400">3 hops</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Estimated Time</span>
                                <span id="estimated-time" class="text-sm text-cyan-400">15 min</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Maker Fee</span>
                                <div class="text-right">
                                    <div id="maker-fee-percent" class="text-sm text-yellow-400">0.20%</div>
                                    <div id="maker-fee-sats" class="text-xs text-gray-500">~0 sats</div>
                                </div>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Network Fee</span>
                                <div class="text-right">
                                    <div id="network-fee-sats" class="text-sm text-yellow-400">~0 sats</div>
                                    <div id="network-fee-rate" class="text-xs text-gray-500">5 sat/vB</div>
                                </div>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Total Fee</span>
                                <span id="total-fee-sats" class="text-sm font-mono text-yellow-400">~0 sats</span>
                            </div>
                            <div class="flex justify-between pt-2 border-t border-gray-700">
                                <span class="text-sm font-semibold text-gray-300">Total Cost</span>
                                <div class="text-right">
                                    <div id="total-amount" class="text-sm font-mono font-semibold text-[#FF6B35]">0 sats</div>
                                    <div id="total-btc" class="text-xs text-gray-500">0.00000000 BTC</div>
                                </div>
                            </div>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                                <p class="text-xs text-purple-400 mb-2">
                                    <strong>Privacy Benefits:</strong>
                                </p>
                                <ul class="text-xs text-purple-400 space-y-1">
                                    <li>• Breaks transaction links</li>
                                    <li>• Multiple mixing hops</li>
                                    <li>• Enhanced anonymity</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

  container.appendChild(content);

  // EVENT LISTENERS

  content
    .querySelector('#swap-amount-input')
    .addEventListener('input', updateSummary);

  content
    .querySelector('#max-swap-btn')
    .addEventListener('click', setMaxAmount);

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
    .querySelector('#hop-2')
    .addEventListener('click', () => setHopCount(2));
  content
    .querySelector('#hop-3')
    .addEventListener('click', () => setHopCount(3));
  content
    .querySelector('#hop-4')
    .addEventListener('click', () => setHopCount(4));
  content
    .querySelector('#hop-5')
    .addEventListener('click', () => setHopCount(5));

  content
    .querySelector('#mode-auto')
    .addEventListener('click', () => toggleSelectionMode('auto'));
  content
    .querySelector('#mode-manual')
    .addEventListener('click', () => toggleSelectionMode('manual'));
  content.querySelector('#start-coinswap-btn').addEventListener('click', () => {
    const swapConfig = {
      amount: swapAmount,
      makers: getNumberOfMakers(),
      hops: getNumberOfHops(),
      selectedMakers:
        selectionMode === 'manual'
          ? selectedMakers.map((i) => availableMakers[i])
          : null,
    };

    import('./Coinswap.js').then((module) => {
      container.innerHTML = '';
      module.CoinswapComponent(container, swapConfig);
    });
  });

  // UTXO selection listeners
  availableUtxos.forEach((_, index) => {
    content
      .querySelector('#utxo-' + index)
      .addEventListener('change', () => toggleUtxoSelection(index));
  });

  // Maker row click listeners
  content.querySelectorAll('.maker-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const index = parseInt(row.dataset.makerIndex);
        toggleMakerSelection(index);
      }
    });
  });

  // Maker checkbox listeners
  availableMakers.forEach((_, index) => {
    content
      .querySelector('#maker-checkbox-' + index)
      .addEventListener('change', () => toggleMakerSelection(index));
  });

  // INITIALIZE
  fetchNetworkFees();
  updateSummary();
}
