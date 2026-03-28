import { SwapStateManager, formatRelativeTime } from './SwapStateManager.js';
import {
  buildSwapHistoryMarkup,
  loadSwapHistory,
  summarizeSwapHistory,
} from './SwapHistory.js';

// ✅ ADD CACHE CONSTANTS
const SWAP_DATA_CACHE_KEY = 'swap_data_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// ✅ ADD CACHE FUNCTIONS
function loadSwapDataFromCache() {
  try {
    const cached = localStorage.getItem(SWAP_DATA_CACHE_KEY);
    if (cached) {
      const { utxos, makers, balance, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      console.log(`📦 Swap data cache age: ${Math.floor(age / 1000)}s`);

      return {
        utxos,
        makers,
        balance,
        timestamp,
        isStale: age > CACHE_DURATION,
      };
    }
  } catch (err) {
    console.error('Failed to load swap data cache:', err);
  }
  return null;
}

function saveSwapDataToCache(utxos, makers, balance) {
  try {
    localStorage.setItem(
      SWAP_DATA_CACHE_KEY,
      JSON.stringify({
        utxos,
        makers,
        balance,
        timestamp: Date.now(),
      })
    );
    console.log('💾 Saved swap data to cache');
  } catch (err) {
    console.error('Failed to save swap data cache:', err);
  }
}

function formatTorEndpoint(address, start = 14, end = 16) {
  if (!address || typeof address !== 'string') return 'unknown';

  const separatorIndex = address.lastIndexOf(':');
  if (separatorIndex === -1) return address;

  const host = address.slice(0, separatorIndex);
  const port = address.slice(separatorIndex + 1);

  if (host.length <= start + end + 3) {
    return `${host}:${port}`;
  }

  return `${host.slice(0, start)}...${host.slice(-end)}:${port}`;
}

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
  if (activeSwap && hasActiveSwap) {
    if (activeSwap.status === 'configured') {
      const age = Date.now() - activeSwap.createdAt;
      if (age > 15 * 60 * 1000) {
        console.log('🧹 Clearing stale configured swap');
        await SwapStateManager.clearSwapData();
      } else {
        console.log('🔄 Configured swap detected, redirecting to progress view');
        import('./Coinswap.js').then((module) => {
          container.innerHTML = '';
          module.CoinswapComponent(container, activeSwap);
        });
        return; // Exit early, don't render the config page
      }
    } else if (activeSwap.status === 'in_progress') {
      console.log('🔄 In-progress swap detected, redirecting to progress view');
      import('./Coinswap.js').then((module) => {
        container.innerHTML = '';
        module.CoinswapComponent(container, activeSwap);
      });
      return; // Exit early, don't render the config page
    }
  }

  const cached = loadSwapDataFromCache();
  let shouldFetchFresh = !cached || cached.isStale;

  console.log(`🎯 Should fetch fresh swap data: ${shouldFetchFresh}`);

  // STATE
  let swapAmount = 0;
  let amountUnit = 'sats';
  let numberOfHops = 3;
  let selectionMode = 'auto';
  let selectedUtxos = [];
  let useCustomHops = false;
  let customHopCount = 6;
  let networkFeeRate = 2;
  let currentProtocol = 'v1';
  let currentNetwork = 'signet';
  let walletBalances = {
    spendable: 0,
    regular: 0,
    swap: 0,
    contract: 0,
    fidelity: 0,
  };
  let maxSwappableAmount = 0;
  let balanceLoadPromise = null;
  let balancesLoaded = false;

  try {
    const config = JSON.parse(localStorage.getItem('coinswap_config') || '{}');
    currentNetwork = config.network || currentNetwork;
  } catch (error) {
    console.error('Failed to load swap config context:', error);
  }

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

  let availableUtxos = [];
  let availableMakers = [];
  let totalBalance = 0;
  const btcPrice = 50000;

  function getMakerProtocol(makerOrItem, offer = makerOrItem?.offer) {
    return makerOrItem?.protocol || (offer?.tweakablePoint ? 'Taproot' : 'Legacy');
  }

  function filterMakersByProtocol(makers) {
    return makers.filter((maker) => {
      const makerProtocol = getMakerProtocol(maker);
      // Unified treated as compatible but not yet a user-selectable mode.
      if (makerProtocol === 'Unified') return true;
      return currentProtocol === 'v2'
        ? makerProtocol === 'Taproot'
        : makerProtocol === 'Legacy';
    });
  }

  function updateAvailableMakersCount() {
    const makersCountEl = content.querySelector('#available-makers-count');
    if (makersCountEl) {
      makersCountEl.textContent = availableMakers.length;
    }
  }

  try {
    const protocolResult = await window.api.taker.getProtocol();
    currentProtocol = protocolResult.protocol || currentProtocol;
  } catch (error) {
    console.error('Failed to get authoritative protocol:', error);
  }

  // ✅ LOAD FROM CACHE IMMEDIATELY IF AVAILABLE
  if (cached && !cached.isStale) {
    console.log('⚡ Using cached swap data (still fresh)');
    availableUtxos = cached.utxos || [];
    availableMakers = filterMakersByProtocol(cached.makers || []);
    totalBalance = cached.balance || 0;

    // Update makers count immediately since we have the data
    updateAvailableMakersCount();
  }

  // Fetch real UTXOs from API
  async function fetchUtxos(useCache = false) {
    // ✅ USE CACHE IF REQUESTED
    if (useCache && cached && cached.utxos) {
      availableUtxos = cached.utxos;
      console.log('✅ Loaded', availableUtxos.length, 'UTXOs from cache');
      return availableUtxos;
    }

    try {
      const data = await window.api.taker.getUtxos();

      if (data.success && data.utxos) {
        availableUtxos = data.utxos.map((item, index) => {
          const utxo = item.utxo || item;
          const spendInfo = item.spendInfo || {};
          const txid =
            typeof utxo.txid === 'object' ? utxo.txid.value : utxo.txid;

          return {
            txid: txid,
            vout: utxo.vout,
            amount: utxo.amount,
            type: spendInfo.spendType || 'SeedCoin',
            index: index,
          };
        });
        console.log('✅ Loaded', availableUtxos.length, 'UTXOs from API');
        return availableUtxos;
      }
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
    }
    return [];
  }

  // Fetch real makers from API (to check availability)
  async function fetchMakers(useCache = false) {
    // ✅ USE CACHE IF REQUESTED
    if (useCache && cached && cached.makers) {
      availableMakers = filterMakersByProtocol(cached.makers);
      console.log('✅ Loaded', availableMakers.length, 'makers from cache');
      updateAvailableMakersCount();
      return availableMakers;
    }

    try {
      const data = await window.api.taker.getOffers();

      if (data.success && data.offerbook) {
        const goodMakers = data.offerbook.goodMakers || [];

        availableMakers = filterMakersByProtocol(
          goodMakers
            .filter((item) => item.offer !== null)
            .map((item, index) => {
              const offer = item.offer;
              const addressObj = item.address || {};
              const onionAddr = addressObj.onion_addr || '';
              const port = addressObj.port || '6102';
              const makerAddress = `${onionAddr}:${port}`;
              return {
                address: makerAddress,
                minSize: offer.minSize || 0,
                maxSize: offer.maxSize || 0,
                baseFee: offer.baseFee || 0,
                volumeFeePct: offer.amountRelativeFeePct || 0,
                timeFeePct: offer.timeRelativeFeePct || 0,
                protocol: getMakerProtocol(item, offer),
                index: index,
              };
            })
        );

        console.log(
          '✅ Loaded',
          availableMakers.length,
          'good makers from API'
        );

        // Update UI count
        updateAvailableMakersCount();
        return availableMakers;
      }
    } catch (error) {
      console.error('Failed to fetch makers:', error);
      availableMakers = [];
    }
    return [];
  }

  // Fetch balance
  async function fetchBalance(useCache = false) {
    // ✅ USE CACHE IF REQUESTED
    if (useCache && cached && cached.balance) {
      totalBalance = cached.balance;
      balancesLoaded = true;
      console.log('✅ Loaded balance from cache:', totalBalance);

      // Update UI if function exists
      if (typeof updateBalanceUI === 'function') {
        updateBalanceUI();
      }
      return totalBalance;
    }

    try {
      const data = await window.api.taker.getBalance();

      if (data.success) {
        walletBalances = {
          spendable: data.balance.spendable || 0,
          regular: data.balance.regular || 0,
          swap: data.balance.swap || 0,
          contract: data.balance.contract || 0,
          fidelity: data.balance.fidelity || 0,
        };
        totalBalance = walletBalances.spendable;
        balancesLoaded = true;
        console.log('✅ Loaded balance from API:', totalBalance);

        // Update UI if function exists
        if (typeof updateBalanceUI === 'function') {
          updateBalanceUI();
        }
        return totalBalance;
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      balancesLoaded = true;
    }
    return 0;
  }

  async function ensureBalancesLoaded() {
    if (!balanceLoadPromise) {
      balanceLoadPromise = fetchBalance(false).finally(() => {
        balanceLoadPromise = null;
      });
    }

    await balanceLoadPromise;
    return walletBalances;
  }

  async function fetchSwapLiquidity() {
    try {
      const data = await window.api.taker.checkSwapLiquidity();
      if (data.success && data.liquidity) {
        maxSwappableAmount = data.liquidity.maxSwappable ?? 0;
        walletBalances = {
          ...walletBalances,
          spendable: data.liquidity.spendable ?? walletBalances.spendable,
          regular: data.liquidity.regular ?? walletBalances.regular,
          swap: data.liquidity.swap ?? walletBalances.swap,
        };
        return maxSwappableAmount;
      }
    } catch (error) {
      console.error('Failed to fetch swap liquidity:', error);
    }

    await ensureBalancesLoaded();

    maxSwappableAmount = Math.max(
      0,
      Math.max(walletBalances.regular || 0, walletBalances.swap || 0) - 3000
    );
    return maxSwappableAmount;
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

  async function renderSwapHistorySection() {
    const swapHistoryContainer = content.querySelector('#swap-history-container');
    const swapHistoryStats = content.querySelector('#swap-history-stats');
    if (!swapHistoryContainer || !swapHistoryStats) return;

    let swapHistory = [];
    try {
      swapHistory = await loadSwapHistory();
    } catch (error) {
      swapHistoryStats.innerHTML = '';
      swapHistoryContainer.innerHTML = `
        <div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p class="text-red-400 font-semibold mb-2">Unable to load swap history</p>
          <p class="text-sm text-gray-400">${error.message || 'Please try again.'}</p>
        </div>
      `;
      return;
    }
    const stats = summarizeSwapHistory(swapHistory);

    swapHistoryStats.innerHTML =
      stats.totalSwaps > 0
        ? `
      <div class="bg-[#0f1419] rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Total Swaps</p>
        <p class="text-2xl font-bold text-[#FF6B35]">${stats.totalSwaps}</p>
      </div>
      <div class="bg-[#0f1419] rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Total Amount</p>
        <p class="text-2xl font-bold text-green-400">${(
          stats.totalAmount / 100000000
        ).toFixed(8)} BTC</p>
      </div>
      <div class="bg-[#0f1419] rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Total Fees Paid</p>
        <p class="text-2xl font-bold text-yellow-400">${stats.totalFees.toLocaleString()} sats</p>
      </div>
      <div class="bg-[#0f1419] rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Avg Fee Paid</p>
        <p class="text-2xl font-bold text-cyan-400">${stats.avgFeePaid.toLocaleString()} sats</p>
      </div>
    `
        : '';

    swapHistoryContainer.innerHTML = buildSwapHistoryMarkup(swapHistory);
    swapHistoryContainer
      .querySelectorAll('.swap-history-row')
      .forEach((row) => {
        row.addEventListener('click', () => {
          const swapId = row.dataset.swapId;
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
          module.SwapReportComponent(container, {
            ...result.report,
            ...result.report.report,
            protocol: result.report.protocol ?? 'v1',
            isTaproot: result.report.isTaproot ?? false,
            protocolVersion: result.report.protocolVersion ?? 1,
          });
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

  function getTopCandidateMakers() {
    return availableMakers.slice(0, getNumberOfMakers());
  }

  function getBlockIntervalSeconds() {
    if (currentNetwork === 'mainnet' || currentNetwork === 'bitcoin') return 600;
    if (currentNetwork === 'regtest') return 0;
    return 30;
  }

  function formatEstimatedTime(seconds) {
    if (seconds <= 0) return 'Instant';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }

  // Estimate fees from the top candidate makers shown in the UI.
  function calculateFees(amount) {
    const hops = getNumberOfHops();
    const topCandidateMakers = getTopCandidateMakers();
    const avgFundingTxSize = 300;
    const fundingTxs = hops;
    const networkFee = fundingTxs * avgFundingTxSize * networkFeeRate;
    const makerFee = topCandidateMakers.reduce((sum, maker, index) => {
      const refundLocktime = 20 * (index + 1);
      const volumeFee = amount * ((maker.volumeFeePct || 0) / 100);
      const timeFee =
        refundLocktime * amount * ((maker.timeFeePct || 0) / 100);
      return sum + (maker.baseFee || 0) + volumeFee + timeFee;
    }, 0);
    const totalFee = makerFee + networkFee;

    return {
      makerFeeSats: Math.floor(makerFee),
      networkFeeSats: Math.floor(networkFee),
      totalFeeSats: Math.floor(totalFee),
      makerFeePercent:
        amount > 0 ? ((makerFee / amount) * 100).toFixed(2) : '0.00',
      fundingTxs,
      avgFundingTxSize,
    };
  }

  function calculateSwapDetails() {
    const hops = getNumberOfHops();
    const makers = getNumberOfMakers();
    const feeDetails = calculateFees(swapAmount);
    const estimatedTime = getBlockIntervalSeconds() * hops;

    return {
      hops,
      makers,
      timeSeconds: estimatedTime,
      makerFeePercent: feeDetails.makerFeePercent,
      makerFeeSats: feeDetails.makerFeeSats,
      networkFeeSats: feeDetails.networkFeeSats,
      totalFeeSats: feeDetails.totalFeeSats,
      fundingTxs: feeDetails.fundingTxs,
      avgFundingTxSize: feeDetails.avgFundingTxSize,
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

      const inputConversions = content.querySelector(
        '#amount-input-conversions'
      );
      if (inputConversions && selectionMode === 'auto') {
        const btcAmount = (swapAmount / 100000000).toFixed(8);
        const usdAmount = ((swapAmount / 100000000) * btcPrice).toFixed(2);
        inputConversions.textContent = `≈ ${btcAmount} BTC • $${usdAmount} USD`;
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
      formatEstimatedTime(details.timeSeconds);
    const selectedMakersText =
      getTopCandidateMakers()
        .map((maker) => formatTorEndpoint(maker.address))
        .join(', ') || 'None selected';
    const selectedMakersEl = content.querySelector('#selected-makers-display');
    selectedMakersEl.textContent = selectedMakersText;
    selectedMakersEl.title = selectedMakersText;
    content.querySelector('#maker-fee-percent').textContent =
      details.makerFeePercent + '%';
    content.querySelector('#maker-fee-sats').textContent =
      details.makerFeeSats.toLocaleString() + ' sats';
    content.querySelector('#network-fee-sats').textContent =
      details.networkFeeSats.toLocaleString() + ' sats';
    content.querySelector('#network-fee-rate').textContent =
      networkFeeRate + ' sat/vB';
    content.querySelector('#funding-txs-count').textContent =
      details.fundingTxs.toString();
    content.querySelector('#avg-funding-tx-size').textContent =
      `${details.avgFundingTxSize} vB`;
    content.querySelector('#total-fee-sats').textContent =
      details.totalFeeSats.toLocaleString() + ' sats';

    const maxSwapEl = content.querySelector('#max-swappable-amount');
    if (maxSwapEl) {
      maxSwapEl.textContent = `${maxSwappableAmount.toLocaleString()} sats`;
    }

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
      if (balancesLoaded && swapAmount > maxSwappableAmount) {
        warnings.push(
          `Swap amount (${swapAmount.toLocaleString()} sats) exceeds swappable balance`
        );
      }
    }

    if (!balancesLoaded) {
      warnings.push('Loading wallet balances...');
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
        'unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold text-lg transition-colors';
    });
    content.querySelector('#unit-' + unit).className =
      'unit-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-xs font-semibold text-lg';

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
        'hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold text-lg transition-colors';
    });

    if (useCustomHops) {
      content.querySelector('#hop-custom').className =
        'hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold text-lg';
      content
        .querySelector('#custom-hop-input-container')
        .classList.remove('hidden');
    } else {
      content.querySelector('#hop-' + count).className =
        'hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold text-lg';
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
        'mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold text-lg transition-colors';
    });
    content.querySelector('#mode-' + mode).className =
      'mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold text-lg';

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

    swapAmount = Math.max(0, maxSwappableAmount);

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

    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
      <div class="flex items-start gap-3">
        <span class="text-2xl text-yellow-400">⚠</span>
        <p class="text-sm text-yellow-300">
          Warning: If swap with only one maker, the maker can deanonymize you. Recommended minimum hop = 2.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2 space-y-6">
        <!-- Swap Form -->
        <div class="bg-[#1a2332] rounded-lg p-6">
          <h3 class="text-xl font-semibold text-lg text-gray-300 mb-6">Initiate Swap</h3>

          <!-- Select UTXOs -->
          <div class="mb-6">
            <label class="block text-sm text-gray-400 mb-2">Select UTXOs</label>
            <div class="flex gap-2">
              <button id="mode-auto" class="mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold text-lg">
                Auto Select UTXOs
              </button>
              <button id="mode-manual" class="mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold text-lg transition-colors">
                Manual Select UTXOs
              </button>
            </div>
          </div>

          <!-- Amount to Swap (Only in Auto mode) -->
          <div id="amount-input-section" class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm text-gray-400">Amount to Swap</label>
              <div class="flex gap-2">
                <button id="unit-sats" class="unit-btn bg-[#FF6B35] text-white px-3 py-1 rounded text-xs font-semibold text-lg">
                  Sats
                </button>
                <button id="unit-btc" class="unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold text-lg transition-colors">
                  BTC
                </button>
                <button id="unit-usd" class="unit-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-3 py-1 rounded text-xs font-semibold text-lg transition-colors">
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
              <button id="max-swap-btn" class="absolute right-2 top-1/2 -translate-y-1/2 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-1 rounded text-sm font-semibold text-lg transition-colors">
                Max
              </button>
            </div>
<p id="amount-input-conversions" class="text-xs text-gray-400 mt-2">≈ 0.00000000 BTC • $0.00 USD</p>
            <p class="text-xs text-gray-500 mt-1">Max swappable: <span id="max-swappable-amount" class="text-[#FF6B35] font-semibold">0 sats</span></p>
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

          </div>

          <!-- Number of Hops -->
          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm text-gray-400">Number of Hops</label>
              <span class="text-xs text-white font-bold text-2xl">Available Makers: <span id="available-makers-count" class="text-[#FF6B35]">${availableMakers.length}</span></span>
            </div>
            <div class="grid grid-cols-4 gap-2">
              <button id="hop-3" class="hop-count-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold text-lg">
                <div>3 hops</div>
                <div class="text-xs text-white/80 mt-1">2 makers</div>
              </button>
              <button id="hop-4" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold text-lg transition-colors">
                <div>4 hops</div>
                <div class="text-xs text-gray-400 mt-1">3 makers</div>
              </button>
              <button id="hop-5" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold text-lg transition-colors">
                <div>5 hops</div>
                <div class="text-xs text-gray-400 mt-1">4 makers</div>
              </button>
              <button id="hop-custom" class="hop-count-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold text-lg transition-colors">
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
                <span class="text-gray-400">hops = <span id="custom-makers-display" class="text-cyan-400 font-semibold text-lg">5</span> makers</span>
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
          <h3 class="text-lg font-semibold text-lg text-gray-300 mb-4">Swap Summary</h3>
          
          <div class="space-y-4">
            <div>
              <p class="text-sm text-gray-400 mb-1">Swappable Balance</p>
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
              <div class="flex justify-between mb-2 gap-3">
                <span class="text-sm text-gray-400">Top Maker Candidates</span>
                <span id="selected-makers-display" class="text-sm text-cyan-400 text-right whitespace-nowrap overflow-hidden text-ellipsis block max-w-[220px] md:max-w-[280px] lg:max-w-[340px]" title="None selected">None selected</span>
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
                <span class="text-sm text-gray-400">Estimated Maker Fee</span>
                <div class="text-right">
                  <div id="maker-fee-percent" class="text-sm text-yellow-400">0.20%</div>
                  <div id="maker-fee-sats" class="text-xs text-gray-500">~0 sats</div>
                </div>
              </div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Funding Txs</span>
                <span id="funding-txs-count" class="text-sm text-white">3</span>
              </div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Avg Funding Tx Size</span>
                <span id="avg-funding-tx-size" class="text-sm text-white">300 vB</span>
              </div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Network Fee</span>
                <div class="text-right">
                  <div id="network-fee-sats" class="text-sm text-yellow-400">0 sats</div>
                  <div id="network-fee-rate" class="text-xs text-gray-500">2 sat/vB</div>
                </div>
              </div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Estimated Total Fee</span>
                <span id="total-fee-sats" class="text-sm font-mono text-yellow-400">0 sats</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-gray-700">
                <span class="text-sm font-semibold text-lg text-gray-300">You Receive</span>
                <div class="text-right">
                  <div id="total-amount" class="text-sm font-mono font-semibold text-lg text-[#FF6B35]">0 sats</div>
                  <div id="total-btc" class="text-xs text-gray-500">0.00000000 BTC</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div class="bg-[#1a2332] rounded-lg p-6 mt-6">
      <h3 class="text-xl font-semibold text-lg text-gray-300 mb-4">Swap History</h3>
      <div id="swap-history-stats" class="grid grid-cols-4 gap-4 mb-4"></div>
      <div id="swap-history-container" class="space-y-3">
        <p class="text-gray-400 text-center py-4">Loading swap history...</p>
      </div>
    </div>
  `;

  container.appendChild(content);

  function updateBalanceUI() {
    const balanceEl = content.querySelector('#available-balance-sats');
    const balanceBtcEl = content.querySelector('#available-balance-btc');
    if (balanceEl) {
      balanceEl.textContent = maxSwappableAmount.toLocaleString() + ' sats';
    }
    if (balanceBtcEl) {
      balanceBtcEl.textContent = (maxSwappableAmount / 100000000).toFixed(8) + ' BTC';
    }
    const input = content.querySelector('#swap-amount-input');
    if (input) {
      input.max = String(maxSwappableAmount);
    }
  }

  if (cached && !cached.isStale && totalBalance > 0) {
    updateBalanceUI();
  }
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

      // ✅ ADD THIS PROTOCOL CHECK
      let protocol = 'v1';
      let protocolName = 'Legacy';

      try {
        const protocolResult = await window.api.taker.getProtocol();
        protocol = protocolResult.protocol || 'v1';
        protocolName = protocolResult.protocolName;

        // Check if we have compatible makers
        const data = await window.api.taker.getOffers();
        if (data.success && data.offerbook) {
          const goodMakers = data.offerbook.goodMakers || [];

          // Filter makers by protocol
          const compatibleMakers = goodMakers.filter((maker) => {
            const makerProtocol = getMakerProtocol(maker);
            // Unified treated as compatible but not yet a user-selectable mode.
            if (makerProtocol === 'Unified') return true;
            return protocol === 'v2'
              ? makerProtocol === 'Taproot'
              : makerProtocol === 'Legacy';
          });

          const makersNeeded = getNumberOfMakers();

          if (compatibleMakers.length < makersNeeded) {
            alert(
              `❌ Not enough ${protocolName} makers available!\n\nYour wallet: ${protocolName}\nCompatible makers available: ${compatibleMakers.length}\nMakers needed: ${makersNeeded}\n\nPlease sync market data or reduce number of hops.`
            );
            return;
          }

          console.log(
            `✅ Found ${compatibleMakers.length} compatible ${protocolName} makers`
          );
        }
      } catch (error) {
        console.error('Protocol check failed:', error);
        alert('Failed to verify maker compatibility: ' + error.message);
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
        protocol: protocol,
        isTaproot: protocol === 'v2',
        protocolVersion: protocol === 'v2' ? 2 : 1,
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
        await SwapStateManager.saveSwapConfig(swapConfig);

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

  if (shouldFetchFresh) {
    console.log('🔄 Fetching fresh swap data...');
    // Fetch fresh data
    Promise.all([
      fetchUtxos(false),
      fetchMakers(false),
      fetchBalance(false),
    ]).then(async ([utxos, makers, balance]) => {
      await fetchSwapLiquidity();

      // Save to cache
      saveSwapDataToCache(utxos, makers, balance);

      updateBalanceUI();

      updateAvailableMakersCount();
      renderUtxoList();
      await renderSwapHistorySection();

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

      // Restore amount input
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
  } else {
    console.log('⚡ Using cached swap data (still fresh)');
    // Just use cache - render immediately
    renderUtxoList();
    ensureBalancesLoaded().then(() => fetchSwapLiquidity()).then(() => {
      updateBalanceUI();
      updateSummary();
    });
    renderSwapHistorySection();

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

    // Restore amount input
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
  }

  fetchNetworkFees();
  (async () => {
    try {
      const protocolResult = await window.api.taker.getProtocol();
      const nextProtocol = protocolResult.protocol || 'v1';
      if (nextProtocol !== currentProtocol) {
        currentProtocol = nextProtocol;
        await fetchMakers(false);
        updateSummary();
      }
    } catch (error) {
      console.error('Failed to get protocol:', error);
    }
  })();

  (async () => {
    try {
      await ensureBalancesLoaded();
    } catch (error) {
      console.error('Failed to prime wallet balances:', error);
    }
  })();
}
