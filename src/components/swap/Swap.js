import { SwapStateManager, formatRelativeTime } from './SwapStateManager.js';

export async function SwapComponent(container) {
  const existingContent = container.querySelector('#swap-content');
  if (existingContent) {
    console.log(
      '⚠️ Swap component already rendered, clearing and re-rendering'
    );
    container.innerHTML = '';
  }
  console.log('🔧 SwapComponent loading...');

  const content = document.createElement('div');
  content.id = 'swap-content';

  // Check for active swap on component load
  const activeSwap = await SwapStateManager.getActiveSwap();
  const hasActiveSwap = await SwapStateManager.hasActiveSwap();

  console.log('📊 Active swap check:', { activeSwap, hasActiveSwap });

  // If there's an active swap in progress, redirect to coinswap progress
  if (activeSwap && activeSwap.status === 'configured') {
    const age = Date.now() - activeSwap.createdAt;
    if (age > 5 * 60 * 1000) {
      console.log('🧹 Clearing stale configured swap');
      await SwapStateManager.clearSwapData();
    } else {
      console.log('🔄 Active swap detected, redirecting to progress view');
      import('./Coinswap.js').then((module) => {
        container.innerHTML = '';
        module.CoinswapComponent(container, activeSwap);
      });
      return; // Exit early, don't render the config page
    }
  }

  // STATE
  let swapAmount = 0;
  let amountUnit = 'sats';
  let numberOfHops = 3;
  let selectionMode = 'auto'; // 'auto' or 'manual'
  let selectedUtxos = [];
  let useCustomHops = false;
  let customHopCount = 6;
  let networkFeeRate = 2; // sats/vB

  // Restore user selections from saved state if available
  const savedSelections = await SwapStateManager.getUserSelections();
  console.log('📂 Attempting to restore selections:', savedSelections);

  if (savedSelections) {
    console.log('🔄 Restoring saved user selections:', savedSelections);
    swapAmount = savedSelections.swapAmount || 0;
    amountUnit = savedSelections.amountUnit || 'sats';
    numberOfHops = savedSelections.numberOfHops || 3;
    selectionMode = savedSelections.selectionMode || 'auto';
    selectedUtxos = savedSelections.selectedUtxos || [];
    useCustomHops = savedSelections.useCustomHops || false;
    customHopCount = savedSelections.customHopCount || 6;
    networkFeeRate = savedSelections.networkFeeRate || 5;
  } else {
    console.log('⚠️ No saved selections found, using defaults');
  }

  // Initialize as empty - will be populated by API
  let availableUtxos = [];
  let availableMakers = [];
  let totalBalance = 0;
  const btcPrice = 50000;

  // Fetch real UTXOs from API
  async function fetchUtxos() {
    try {
      // IPC call to get UTXOs
      const data = await window.api.taker.getUtxos();

      if (data.success && data.utxos) {
        availableUtxos = data.utxos.map((item, index) => {
          const utxo = item.utxo || item;
          const spendInfo = item.spendInfo || {};
          const txid =
            typeof utxo.txid === 'object' ? utxo.txid.hex : utxo.txid;

          return {
            txid: txid,
            vout: utxo.vout,
            amount: utxo.amount,
            type: spendInfo.spendType || 'SeedCoin',
            index: index,
          };
        });
        console.log('✅ Loaded', availableUtxos.length, 'UTXOs for swap');
      }
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
    }
  }

  // Fetch real makers from API (to check availability)
  async function fetchMakers() {
    try {
      // IPC call to get offers
      const data = await window.api.taker.getOffers();

      if (data.success && data.offerbook && data.offerbook.goodMakers) {
        availableMakers = data.offerbook.goodMakers.map((item, index) => {
          const offer = item.offer;
          return {
            minSize: offer.minSize || 0,
            maxSize: offer.maxSize || 0,
            fee: (offer.amountRelativeFeePct || 0).toFixed(1),
            index: index,
          };
        });
        console.log('✅ Loaded', availableMakers.length, 'makers for swap');

        // Update available makers count
        const makersCountEl = content.querySelector('#available-makers-count');
        if (makersCountEl) {
          makersCountEl.textContent = availableMakers.length;
        }
      }
    } catch (error) {
      console.error('Failed to fetch makers:', error);
    }
  }

  // Fetch balance
  async function fetchBalance() {
    try {
      // IPC call to get balance
      const data = await window.api.taker.getBalance();

      if (data.success) {
        totalBalance = data.balance.spendable;
        console.log('✅ Balance:', totalBalance);

        // Update balance display
        const balanceEl = content.querySelector('#available-balance-sats');
        const balanceBtcEl = content.querySelector('#available-balance-btc');
        if (balanceEl) {
          balanceEl.textContent = totalBalance.toLocaleString() + ' sats';
        }
        if (balanceBtcEl) {
          balanceBtcEl.textContent =
            (totalBalance / 100000000).toFixed(8) + ' BTC';
        }
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }

  // Render UTXO list dynamically
  function renderUtxoList() {
    const utxoListContainer = content.querySelector('#utxo-list');
    if (!utxoListContainer) return;

    if (availableUtxos.length === 0) {
      utxoListContainer.innerHTML =
        '<p class="text-gray-400 text-center py-4">No UTXOs available</p>';
      return;
    }

    utxoListContainer.innerHTML = availableUtxos
      .map((utxo, index) => {
        const btcAmount = (utxo.amount / 100000000).toFixed(8);
        const usdAmount = ((utxo.amount / 100000000) * btcPrice).toFixed(2);
        const timestamps = [
          '2 hours ago',
          '1 day ago',
          '3 days ago',
          '1 week ago',
        ];
        const timestamp = timestamps[index] || '1 month ago';

        return `
        <label class="flex items-center gap-3 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg p-3 cursor-pointer transition-colors">
          <input type="checkbox" id="utxo-${index}" class="w-4 h-4 accent-[#FF6B35]" />
          <div class="flex-1">
            <div class="flex justify-between items-center">
              <span class="font-mono text-sm text-gray-300">${utxo.txid.substring(0, 12)}...${utxo.txid.substring(utxo.txid.length - 4)}:${utxo.vout}</span>
              <div class="text-right">
                <div class="text-sm font-mono text-green-400">${btcAmount} BTC</div>
                <div class="text-xs text-gray-500">${usdAmount} USD</div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-xs text-gray-500">${timestamp}</span>
              <span class="text-xs ${utxo.type.includes('Swap') ? 'text-blue-400' : 'text-green-400'}">${utxo.type}</span>
            </div>
          </div>
        </label>
      `;
      })
      .join('');

    // Re-attach event listeners
    availableUtxos.forEach((_, index) => {
      const checkbox = content.querySelector('#utxo-' + index);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          toggleUtxoSelection(index);
          saveCurrentSelections();
        });
      }
    });
  }

  // Render Recent Swaps section
  // Render Recent Swaps section
  async function renderRecentSwaps() {
    const recentSwapsContainer = content.querySelector(
      '#recent-swaps-container'
    );
    if (!recentSwapsContainer) return;

    let recentSwaps = [];
    try {
      const result = await window.api.swapReports.getAll();
      if (result.success && result.reports) {
        recentSwaps = result.reports
          .filter((report) => report.status === 'completed')
          .slice(0, 5)
          .map((report) => ({
            id: report.swapId || `swap_${Date.now()}`,
            completedAt: report.completedAt || Date.now(),
            amount: report.amount || 0,
            hops: (report.report?.makersCount || 0) + 1,
          }));
      }
    } catch (error) {
      console.error('Failed to load recent swaps:', error);
    }

    if (recentSwaps.length === 0) {
      recentSwapsContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <p class="text-4xl mb-2">🔄</p>
        <p>No swaps yet</p>
        <p class="text-xs mt-1">Your completed swaps will appear here</p>
      </div>
    `;
      return;
    }

    recentSwapsContainer.innerHTML = recentSwaps
      .map((swap) => {
        const btcAmount = (swap.amount / 100000000).toFixed(8);
        const timeAgo = formatRelativeTime(swap.completedAt);

        return `
        <div class="swap-history-item flex items-center gap-4 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg p-4 cursor-pointer transition-colors" data-swap-id="${swap.id}">
          <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span class="text-green-400">✓</span>
          </div>
          <div class="flex-1">
            <div class="flex justify-between items-center">
              <span class="text-white font-medium">Coinswap</span>
              <span class="text-green-400 font-mono">${btcAmount} BTC</span>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-xs text-gray-500">${timeAgo}</span>
              <span class="text-xs text-cyan-400">${swap.hops} hops</span>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Add click handlers for swap history items
    content.querySelectorAll('.swap-history-item').forEach((item) => {
      item.addEventListener('click', () => {
        const swapId = item.dataset.swapId;
        viewSwapReport(swapId);
      });
    });
  }

  // View swap report from history
  async function viewSwapReport(swapId) {
    try {
      const result = await window.api.swapReports.get(swapId);
      if (result.success && result.report) {
        import('./SwapReport.js').then((module) => {
          container.innerHTML = '';
          module.SwapReportComponent(container, result.report.report);
        });
      } else {
        console.error('Swap report not found for ID:', swapId);
      }
    } catch (error) {
      console.error('Failed to load swap report:', error);
    }
  }

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

  function getNumberOfHops() {
    if (useCustomHops) {
      return customHopCount;
    }
    return numberOfHops;
  }

  function getNumberOfMakers() {
    return getNumberOfHops() - 1;
  }

  function getSelectedUtxosTotal() {
    if (selectedUtxos.length === 0 || availableUtxos.length === 0) return 0;
    return selectedUtxos.reduce((sum, index) => {
      const utxo = availableUtxos[index];
      return sum + (utxo ? utxo.amount : 0);
    }, 0);
  }

  // Calculate fees based on hops/makers
  function calculateFees(amount) {
    const hops = getNumberOfHops();
    const makers = getNumberOfMakers();

    const baseFeePercent = 0.1;

    // Network fees: estimate ~250 vBytes per hop
    const txSize = 250;
    const networkFee = networkFeeRate * txSize * hops;

    const makerFeePercent = baseFeePercent * makers;
    const makerFee = (amount * makerFeePercent) / 100;
    const totalFee = makerFee + networkFee;

    return {
      makerFeeSats: Math.floor(makerFee),
      networkFeeSats: Math.floor(networkFee),
      totalFeeSats: Math.floor(totalFee),
      makerFeePercent: makerFeePercent.toFixed(2),
    };
  }

  function calculateSwapDetails() {
    const hops = getNumberOfHops();
    const makers = getNumberOfMakers();

    const baseTime = 10;
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
    };
  }

  function updateSummary() {
    const selectedTotal = getSelectedUtxosTotal();

    // In manual mode, calculate swap amount from UTXOs
    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      const inputAmount = selectedTotal;

      // Calculate what we can actually swap after fees
      const estimatedFees = calculateFees(inputAmount);

      // Available swap amount = UTXOs - fees - small buffer for fee variance
      swapAmount = Math.max(0, inputAmount - estimatedFees.totalFeeSats - 1000);
    } else if (selectionMode === 'auto') {
      // In auto mode, read from input
      const input = content.querySelector('#swap-amount-input');
      const value = parseFloat(input?.value) || 0;

      if (amountUnit === 'sats') {
        swapAmount = value;
      } else if (amountUnit === 'btc') {
        swapAmount = Math.floor(value * 100000000);
      } else if (amountUnit === 'usd') {
        swapAmount = Math.floor((value / btcPrice) * 100000000);
      }
    }

    const details = calculateSwapDetails();

    // Calculate what user actually receives (amount - fees)
    const receiveAmount = Math.max(0, swapAmount - details.totalFeeSats);

    // Update swap amount display (what user is sending)
    content.querySelector('#swap-amount-display').textContent =
      swapAmount.toLocaleString() + ' sats';

    const swapBtc = swapAmount / 100000000;
    const swapUsd = swapBtc * btcPrice;
    content.querySelector('#swap-amount-conversions').textContent =
      '≈ ' + swapBtc.toFixed(8) + ' BTC • $' + swapUsd.toFixed(2) + ' USD';

    // Update selected UTXOs display (manual mode)
    const selectedUtxosDisplay = content.querySelector('#selected-utxos-total');
    if (selectedUtxosDisplay) {
      if (selectionMode === 'manual' && selectedUtxos.length > 0) {
        selectedUtxosDisplay.textContent =
          selectedTotal.toLocaleString() + ' sats';
        selectedUtxosDisplay.parentElement.classList.remove('hidden');
      } else {
        selectedUtxosDisplay.parentElement.classList.add('hidden');
      }
    }

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

    // Total = Amount - Fees (what user receives)
    content.querySelector('#total-amount').textContent =
      receiveAmount.toLocaleString() + ' sats';
    const totalBtc = receiveAmount / 100000000;
    content.querySelector('#total-btc').textContent =
      totalBtc.toFixed(8) + ' BTC';

    // Validate and show warning if needed
    validateSwapConfig();
  }

  function validateSwapConfig() {
    const warningEl = content.querySelector('#validation-warning');
    const startBtn = content.querySelector('#start-coinswap-btn');
    if (!warningEl || !startBtn) return;

    let warnings = [];
    const makersNeeded = getNumberOfMakers();

    // Check swap amount
    if (selectionMode === 'manual') {
      if (selectedUtxos.length === 0) {
        warnings.push('Select at least one UTXO');
      }

      // Check if receive amount is too small after fees
      const details = calculateSwapDetails();
      const receiveAmount = swapAmount - details.totalFeeSats;
      if (selectedUtxos.length > 0 && receiveAmount < 10000) {
        warnings.push(
          'Receive amount too small after fees. Select more UTXOs or fewer hops.'
        );
      }
    } else {
      // Auto mode validations
      if (swapAmount <= 0) {
        warnings.push('Enter a swap amount');
      }

      // Check if amount exceeds balance
      if (swapAmount > totalBalance && totalBalance > 0) {
        warnings.push(
          `Swap amount (${swapAmount.toLocaleString()} sats) exceeds available balance`
        );
      }
    }

    // Check if enough makers available
    if (availableMakers.length > 0 && makersNeeded > availableMakers.length) {
      warnings.push(
        `Need ${makersNeeded} makers for ${getNumberOfHops()} hops, but only ${availableMakers.length} available`
      );
    }

    // Check custom hops validity
    if (useCustomHops && customHopCount < 2) {
      warnings.push('Minimum 2 hops required (1 maker)');
    }

    // Check maker liquidity limits
    if (availableMakers.length > 0 && swapAmount > 0) {
      const maxMakerSize = Math.max(...availableMakers.map((m) => m.maxSize));
      if (swapAmount > maxMakerSize) {
        warnings.push(
          `Swap amount exceeds maker max size (${maxMakerSize.toLocaleString()} sats)`
        );
      }

      const minMakerSize = Math.min(...availableMakers.map((m) => m.minSize));
      if (swapAmount < minMakerSize) {
        warnings.push(
          `Swap amount below maker minimum (${minMakerSize.toLocaleString()} sats)`
        );
      }
    }

    if (warnings.length > 0) {
      warningEl.innerHTML = warnings
        .map((w) => `<p class="text-xs text-yellow-400">⚠️ ${w}</p>`)
        .join('');
      warningEl.classList.remove('hidden');
      startBtn.disabled = true;
      startBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      warningEl.classList.add('hidden');
      startBtn.disabled = false;
      startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
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

    const input = content.querySelector('#swap-amount-input');
    if (unit === 'sats') input.placeholder = '0';
    else if (unit === 'btc') input.placeholder = '0.00000000';
    else input.placeholder = '0.00';

    updateSummary();
  }

  function setHopCount(count) {
    if (count === 'custom') {
      useCustomHops = true;
    } else {
      useCustomHops = false;
      numberOfHops = count;
    }

    // Update button styles
    content.querySelectorAll('.hop-count-btn').forEach((btn) => {
      btn.className =
        'hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors';
    });

    if (useCustomHops) {
      content.querySelector('#hop-custom').className =
        'hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold';
      content
        .querySelector('#custom-hop-input-container')
        .classList.remove('hidden');
    } else {
      content.querySelector('#hop-' + count).className =
        'hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold';
      content
        .querySelector('#custom-hop-input-container')
        .classList.add('hidden');
    }

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

    const amountInputSection = content.querySelector('#amount-input-section');
    const utxoSection = content.querySelector('#utxo-selection-section');

    if (mode === 'manual') {
      amountInputSection.classList.add('hidden');
      utxoSection.classList.remove('hidden');
    } else {
      amountInputSection.classList.remove('hidden');
      utxoSection.classList.add('hidden');
    }

    updateSummary();
  }

  function checkUtxoTypeWarning() {
    const warningEl = content.querySelector('#utxo-warning');
    if (!warningEl) return;

    if (selectedUtxos.length < 2) {
      warningEl.classList.add('hidden');
      return;
    }

    const types = selectedUtxos.map(
      (index) => availableUtxos[index]?.type || ''
    );
    const hasRegular = types.some((t) => !t.includes('Swap'));
    const hasSwap = types.some((t) => t.includes('Swap'));

    if (hasRegular && hasSwap) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
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
    if (checkbox) {
      checkbox.checked = selectedUtxos.includes(index);
    }

    content.querySelector('#selected-utxos-count').textContent =
      selectedUtxos.length;

    checkUtxoTypeWarning();
    updateSummary();
  }

  function setMaxAmount() {
    if (selectionMode === 'manual') {
      return; // In manual mode, amount is from UTXOs
    }

    const details = calculateSwapDetails();
    const estimatedFees = details.totalFeeSats || 1500;

    swapAmount = Math.max(0, totalBalance - estimatedFees - 500);

    // Also check maker max size
    if (availableMakers.length > 0) {
      const maxMakerSize = Math.max(...availableMakers.map((m) => m.maxSize));
      swapAmount = Math.min(swapAmount, maxMakerSize);
    }

    const input = content.querySelector('#swap-amount-input');
    if (amountUnit === 'sats') {
      input.value = Math.floor(swapAmount);
    } else if (amountUnit === 'btc') {
      input.value = (swapAmount / 100000000).toFixed(8);
    } else if (amountUnit === 'usd') {
      input.value = ((swapAmount / 100000000) * btcPrice).toFixed(2);
    }

    updateSummary();
  }

  // Save current user selections to localStorage
  async function saveCurrentSelections() {
    const selections = {
      swapAmount,
      amountUnit,
      numberOfHops,
      selectionMode,
      selectedUtxos,
      useCustomHops,
      customHopCount,
      networkFeeRate,
    };
    console.log('💾 Saving current selections:', selections);
    await SwapStateManager.saveUserSelections(selections);
  }

  // UI - Render the HTML template
  content.innerHTML = `
    <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap</h2>
    <p class="text-gray-400 mb-8">Perform private Bitcoin swaps through multiple makers</p>

    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2 space-y-6">
        <!-- Swap Form -->
        <div class="bg-[#1a2332] rounded-lg p-6">
          <h3 class="text-xl font-semibold text-gray-300 mb-6">Initiate Swap</h3>

          <!-- Selection Mode -->
          <div class="mb-6">
            <label class="block text-sm text-gray-400 mb-2">Selection Mode</label>
            <div class="flex gap-2">
              <button id="mode-auto" class="mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                Auto Select UTXOs
              </button>
              <button id="mode-manual" class="mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                Manual Select UTXOs
              </button>
            </div>
          </div>

          <!-- Amount to Swap (Only in Auto mode) -->
          <div id="amount-input-section" class="mb-6">
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
            <p class="text-xs text-gray-400 mt-2">≈ 0.00000000 BTC • $0.00 USD</p>
          </div>

          <!-- UTXO Selection (Only in Manual mode) -->
          <div id="utxo-selection-section" class="mb-6 hidden">
            <div class="flex justify-between items-center mb-4">
              <label class="block text-sm text-gray-400">Select UTXOs</label>
              <span class="text-sm text-gray-400">Selected: <span id="selected-utxos-count">0</span></span>
            </div>
            
            <!-- Warning Message -->
            <div id="utxo-warning" class="hidden mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p class="text-xs text-yellow-400">
                ⚠ Warning: Mixing Regular and Swap UTXOs in the same transaction can compromise privacy. Use only one type per swap.
              </p>
            </div>
            
            <div id="utxo-list" class="space-y-2 max-h-60 overflow-y-auto">
              <p class="text-gray-400 text-center py-4">Loading UTXOs...</p>
            </div>

            <div class="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p class="text-xs text-blue-400">
                💡 Swap amount will be calculated from selected UTXOs minus fees.
              </p>
            </div>
          </div>

          <!-- Number of Hops -->
          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm text-gray-400">Number of Hops</label>
              <span class="text-xs text-gray-500">Available makers: <span id="available-makers-count">0</span></span>
            </div>
            <div class="grid grid-cols-4 gap-2">
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
              <button id="hop-custom" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                <div>Custom</div>
                <div class="text-xs text-gray-400 mt-1">6+ hops</div>
              </button>
            </div>
            
            <!-- Custom hop input -->
            <div id="custom-hop-input-container" class="hidden mt-3">
              <div class="flex items-center gap-4">
                <input 
                  id="custom-hop-input"
                  type="number" 
                  min="2" 
                  max="20"
                  value="6"
                  class="w-24 bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
                <span class="text-gray-400">hops = <span id="custom-makers-display" class="text-cyan-400 font-semibold">5</span> makers</span>
              </div>
            </div>

            <p class="text-xs text-gray-500 mt-2">More hops = better privacy, higher fees</p>
          </div>
        </div>

        <!-- Validation Warning -->
        <div id="validation-warning" class="hidden p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-1">
        </div>

        <!-- Start Swap Button -->
        <button id="start-coinswap-btn" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed">
          Start Coinswap
        </button>
      </div>

      <!-- Right: Summary -->
      <div class="col-span-1">
        <div class="bg-[#1a2332] rounded-lg p-6 top-8">
          <h3 class="text-lg font-semibold text-gray-300 mb-4">Swap Summary</h3>
          
          <div class="space-y-4">
            <div>
              <p class="text-sm text-gray-400 mb-1">Available Balance</p>
              <p id="available-balance-sats" class="text-xl font-mono text-green-400">0 sats</p>
              <p id="available-balance-btc" class="text-xs text-gray-500">0.00000000 BTC</p>
            </div>

            <!-- Selected UTXOs Total (Manual Mode) -->
            <div class="hidden border-t border-gray-700 pt-4">
              <p class="text-sm text-gray-400 mb-1">Selected UTXOs</p>
              <p id="selected-utxos-total" class="text-lg font-mono text-blue-400">0 sats</p>
            </div>

            <div class="border-t border-gray-700 pt-4">
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Swap Amount</span>
                <span id="swap-amount-display" class="text-sm font-mono text-white">0 sats</span>
              </div>
              <p id="swap-amount-conversions" class="text-xs text-gray-500 text-right mb-3">≈ 0.00000000 BTC • $0.00 USD</p>
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
                  <div id="network-fee-rate" class="text-xs text-gray-500">2 sat/vB</div>
                </div>
              </div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Total Fee</span>
                <span id="total-fee-sats" class="text-sm font-mono text-yellow-400">~0 sats</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-gray-700">
                <span class="text-sm font-semibold text-gray-300">You Receive</span>
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

        <!-- Recent Swaps Section -->
        <div class="bg-[#1a2332] rounded-lg p-6 mt-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-semibold text-gray-300">Recent Swaps</h3>
            <button id="view-all-swaps" class="text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold transition-colors">
              View All Swaps →
            </button>
          </div>
          <div id="recent-swaps-container" class="space-y-3">
            <p class="text-gray-400 text-center py-4">Loading swap history...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(content);

  // EVENT LISTENERS

  content
    .querySelector('#swap-amount-input')
    .addEventListener('input', async () => {
      updateSummary();
      await saveCurrentSelections();
    });

  content
    .querySelector('#max-swap-btn')
    .addEventListener('click', setMaxAmount);

  content.querySelector('#unit-sats').addEventListener('click', async () => {
    switchUnit('sats');
    await saveCurrentSelections();
  });
  content.querySelector('#unit-btc').addEventListener('click', () => {
    switchUnit('btc');
    saveCurrentSelections();
  });
  content.querySelector('#unit-usd').addEventListener('click', () => {
    switchUnit('usd');
    saveCurrentSelections();
  });

  content.querySelector('#hop-3').addEventListener('click', () => {
    setHopCount(3);
    saveCurrentSelections();
  });
  content.querySelector('#hop-4').addEventListener('click', () => {
    setHopCount(4);
    saveCurrentSelections();
  });
  content.querySelector('#hop-5').addEventListener('click', () => {
    setHopCount(5);
    saveCurrentSelections();
  });
  content.querySelector('#hop-custom').addEventListener('click', () => {
    setHopCount('custom');
    saveCurrentSelections();
  });

  // Custom hop input
  content.querySelector('#custom-hop-input').addEventListener('input', (e) => {
    let value = parseInt(e.target.value) || 2;
    value = Math.max(2, Math.min(20, value));
    customHopCount = value;
    content.querySelector('#custom-makers-display').textContent = value - 1;
    updateSummary();
    saveCurrentSelections();
  });

  content.querySelector('#mode-auto').addEventListener('click', () => {
    toggleSelectionMode('auto');
    saveCurrentSelections();
  });
  content.querySelector('#mode-manual').addEventListener('click', () => {
    toggleSelectionMode('manual');
    saveCurrentSelections();
  });

  // View All Swaps button
  content.querySelector('#view-all-swaps').addEventListener('click', () => {
    import('./SwapHistory.js').then((module) => {
      container.innerHTML = '';
      module.SwapHistoryComponent(container);
    });
  });

  content
    .querySelector('#start-coinswap-btn')
    .addEventListener('click', async () => {
      console.log('🚀 Start Coinswap button clicked');

      // Final validation
      if (swapAmount <= 0) {
        alert('Please enter a valid swap amount or select UTXOs');
        return;
      }

      if (selectionMode === 'manual' && selectedUtxos.length === 0) {
        alert('Please select at least one UTXO');
        return;
      }

      const swapConfig = {
        amount: swapAmount,
        makers: getNumberOfMakers(),
        hops: getNumberOfHops(),
        selectionMode: selectionMode,
        selectedUtxos: selectedUtxos,
        amountUnit: amountUnit,
        numberOfHops: numberOfHops,
        useCustomHops: useCustomHops,
        customHopCount: customHopCount,
        networkFeeRate: networkFeeRate,
        startTime: Date.now(),
      };

      console.log('💾 Saving swap configuration:', swapConfig);

      const startBtn = content.querySelector('#start-coinswap-btn');
      startBtn.disabled = true;
      startBtn.textContent = 'Starting...';
      startBtn.classList.add('opacity-50', 'cursor-not-allowed');

      try {
        // IPC call to start coinswap
        const result = await window.api.coinswap.start({
          amount: swapAmount,
          makerCount: swapConfig.makers,
          outpoints:
            selectionMode === 'manual' && selectedUtxos.length > 0
              ? selectedUtxos.map((i) => ({
                  txid: availableUtxos[i].txid,
                  vout: availableUtxos[i].vout,
                }))
              : undefined,
          password: localStorage.getItem('coinswap_config')
            ? JSON.parse(localStorage.getItem('coinswap_config')).wallet
                ?.password || ''
            : '', // ← ADD THIS
        });
        if (!result.success) {
          alert('Failed to start swap: ' + result.error);
          startBtn.disabled = false;
          startBtn.textContent = 'Start Coinswap';
          startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          return;
        }

        console.log('✅ Swap started with ID:', result.swapId);

        swapConfig.swapId = result.swapId;
        SwapStateManager.saveSwapConfig(swapConfig);

        if (window.appManager) {
          console.log('🔄 Starting background swap manager');
          window.appManager.startBackgroundSwapManager();
        }

        console.log('🔀 Navigating to Coinswap component');
        import('./Coinswap.js').then((module) => {
          container.innerHTML = '';
          module.CoinswapComponent(container, swapConfig);
        });
      } catch (error) {
        console.error('❌ Failed to start coinswap:', error);
        alert('Failed to start coinswap: ' + error.message);
        startBtn.disabled = false;
        startBtn.textContent = 'Start Coinswap';
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });

  // INITIALIZE

  // Restore selection mode
  if (selectionMode === 'manual') {
    toggleSelectionMode('manual');
  }

  if (amountUnit !== 'sats') {
    switchUnit(amountUnit);
  }

  // Restore hop selection
  if (useCustomHops) {
    setHopCount('custom');
    const customInput = content.querySelector('#custom-hop-input');
    if (customInput) {
      customInput.value = customHopCount;
      content.querySelector('#custom-makers-display').textContent =
        customHopCount - 1;
    }
  } else if (numberOfHops !== 3) {
    setHopCount(numberOfHops);
  }

  // Fetch real data
  Promise.all([fetchUtxos(), fetchMakers(), fetchBalance()]).then(async () => {
    renderUtxoList();
    await renderRecentSwaps();

    // Restore UTXO selections
    if (selectedUtxos.length > 0) {
      selectedUtxos.forEach((index) => {
        const checkbox = content.querySelector('#utxo-' + index);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
      content.querySelector('#selected-utxos-count').textContent =
        selectedUtxos.length;
      checkUtxoTypeWarning();
    }

    // Restore amount input (only in auto mode)
    if (swapAmount > 0 && selectionMode === 'auto') {
      const input = content.querySelector('#swap-amount-input');
      if (amountUnit === 'sats') {
        input.value = swapAmount;
      } else if (amountUnit === 'btc') {
        input.value = (swapAmount / 100000000).toFixed(8);
      } else if (amountUnit === 'usd') {
        input.value = ((swapAmount / 100000000) * btcPrice).toFixed(2);
      }
    }

    updateSummary();
  });

  fetchNetworkFees();
}
