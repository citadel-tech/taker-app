export function SendComponent(container) {
  const content = document.createElement('div');
  content.id = 'send-content';

  // State
  let amountUnit = 'sats';
  let selectedFeeRate = 7;
  let feeRates = { low: 3, medium: 7, high: 15 };
  const btcPrice = 30000;
  const availableBalance = 20000000; // in sats
  const txSize = 140; // vBytes

  // FUNCTIONS

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
    const remaining = availableBalance - total;

    // Update amount conversions
    const amountBtc = amountSats / 100000000;
    const amountUsd = (amountSats / 100000000) * btcPrice;

    content.querySelector('#amount-btc').textContent =
      '≈ ' + amountBtc.toFixed(8) + ' BTC';
    content.querySelector('#amount-usd').textContent =
      '≈ $' + amountUsd.toFixed(2) + ' USD';

    // Update summary section
    content.querySelector('#summary-amount').textContent =
      Math.floor(amountSats).toLocaleString() + ' sats';
    content.querySelector('#summary-fee-rate').textContent = selectedFeeRate;
    content.querySelector('#summary-fee').textContent =
      '~' + fee.toLocaleString() + ' sats';
    content.querySelector('#summary-total').textContent =
      Math.floor(total).toLocaleString() + ' sats';
    content.querySelector('#summary-total-usd').textContent =
      '≈ $' + ((total * btcPrice) / 100000000).toFixed(2);

    content.querySelector('#summary-remaining').textContent =
      Math.floor(remaining).toLocaleString() + ' sats';
    const remainingBtc = remaining / 100000000;
    const remainingUsd = remainingBtc * btcPrice;
    content.querySelector('#summary-remaining-detail').textContent =
      remainingBtc.toFixed(8) + ' BTC ≈ $' + remainingUsd.toFixed(2);
  }

  function setMaxAmount() {
    const fee = selectedFeeRate * txSize;
    const maxAmount = availableBalance - fee;

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

  // UI

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Send Bitcoin</h2>
        <p class="text-gray-400 mb-8">Send BTC to any Bitcoin address</p>

        <div class="grid grid-cols-3 gap-6">
            <!-- Left: Send Form -->
            <div class="col-span-2">
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

                    <!-- Amount Toggle -->
                    <div class="mb-6">
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
                            <p id="amount-btc" class="text-xs text-gray-400">≈ 0.00000000 BTC</p>
                            <p id="amount-usd" class="text-xs text-gray-400">≈ $0.00 USD</p>
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

                    <!-- Send Button -->
                    <button class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-colors text-lg">
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
                            <p class="text-xl font-mono text-green-400">20,000,000 sats</p>
                            <p class="text-xs text-gray-500">0.20000000 BTC ≈ $6,000</p>
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
                                <span class="text-sm font-semibold text-gray-300">Total</span>
                                <span id="summary-total" class="text-sm font-mono font-semibold text-[#FF6B35]">980 sats</span>
                            </div>
                            <p id="summary-total-usd" class="text-xs text-gray-500 text-right mt-1">≈ $0.29</p>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <p class="text-sm text-gray-400 mb-1">Remaining Balance</p>
                            <p id="summary-remaining" class="text-lg font-mono text-blue-400">19,999,020 sats</p>
                            <p id="summary-remaining-detail" class="text-xs text-gray-500">0.19999020 BTC ≈ $5,999.71</p>
                        </div>
                    </div>

                    <div class="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-xs text-blue-400">
                            ⓘ Transactions are irreversible. Double-check the address before sending.
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

  // INITIALIZE
  fetchFeeRates();
}
