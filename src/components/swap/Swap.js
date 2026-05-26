import { icons } from '../../js/icons.js';
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTorEndpoint(address, start = 14, end = 16) {
  if (!address || typeof address !== 'string') return 'unknown';

  const separatorIndex = address.lastIndexOf(':');
  const host = separatorIndex !== -1 ? address.slice(0, separatorIndex) : address;

  if (host.length <= start + end + 3) return host;
  return `${host.slice(0, start)}...${host.slice(-end)}`;
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
  let makerSelectionMode = 'auto'; // 'auto' | 'manual'
  let selectedMakerAddresses = []; // array of maker address strings
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
    makerSelectionMode = savedSelections.makerSelectionMode || 'auto';
    selectedMakerAddresses = savedSelections.selectedMakerAddresses || [];
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
              const makerAddress = typeof item.address === 'string'
                ? item.address
                : `${item.address?.onion_addr || ''}:${item.address?.port || ''}`;

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
        '<p class="swap-empty-row">No UTXOs available</p>';
      return;
    }

    utxoListContainer.innerHTML = availableUtxos
      .map((utxo, index) => {
        const typeLabel = utxo.type.includes('Taproot')
          ? 'Taproot'
          : utxo.type.includes('Swap')
            ? 'Swap'
            : 'Segwit';

        return `
        <label class="swap-pick-row">
          <input type="checkbox" id="utxo-${index}" />
          <span class="swap-row-id">${utxo.txid.substring(0, 8)}...${utxo.txid.substring(utxo.txid.length - 6)}</span>
          <span class="swap-pill ${typeLabel.toLowerCase()}">${typeLabel}</span>
          <strong>${utxo.amount.toLocaleString()}<small>SATS</small></strong>
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

  function renderMakerList() {
    const makerListContainer = content.querySelector('#maker-list');
    if (!makerListContainer) return;

    const availableAddrs = new Set(availableMakers.map((m) => m.address));
    selectedMakerAddresses = selectedMakerAddresses.filter((a) => availableAddrs.has(a));

    if (availableMakers.length === 0) {
      makerListContainer.innerHTML =
        '<p class="swap-empty-row">No makers available</p>';
      return;
    }

    makerListContainer.innerHTML = availableMakers
      .map((maker, index) => {
        return `
        <label class="swap-pick-row">
          <input type="checkbox" id="maker-addr-${index}" />
          <span class="swap-row-id">${escapeHtml(formatTorEndpoint(maker.address, 8, 13))}</span>
          <span class="swap-maker-fee">Fee ${escapeHtml(maker.volumeFeePct.toFixed(3))}</span>
          <strong>${escapeHtml(((maker.maxSize || 0) / 100000000).toFixed(3))}<small>BOND</small></strong>
        </label>
      `;
      })
      .join('');

    // Restore checked state from selectedMakerAddresses
    availableMakers.forEach((maker, index) => {
      const checkbox = content.querySelector('#maker-addr-' + index);
      if (checkbox) {
        checkbox.checked = selectedMakerAddresses.includes(maker.address);
      }
    });

    // Update count display
    const countEl = content.querySelector('#selected-makers-count');
    if (countEl) countEl.textContent = selectedMakerAddresses.length;

    // Attach change listeners
    availableMakers.forEach((maker, index) => {
      const checkbox = content.querySelector('#maker-addr-' + index);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          toggleMakerSelection(maker.address);
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
      <div class="bg-app-bg rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Total Swaps</p>
        <p class="text-2xl font-bold text-primary">${stats.totalSwaps}</p>
      </div>
      <div class="bg-app-bg rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Total Amount</p>
        <p class="text-2xl font-bold text-green-400">${(
          stats.totalAmount / 100000000
        ).toFixed(8)} BTC</p>
      </div>
      <div class="bg-app-bg rounded-lg p-4">
        <p class="text-sm text-gray-400 mb-1">Total Fees Paid</p>
        <p class="text-2xl font-bold text-yellow-400">${stats.totalFees.toLocaleString()} sats</p>
      </div>
      <div class="bg-app-bg rounded-lg p-4">
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
        'http://170.75.166.88:8080/api/v1/fees/recommended'
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
    return 600;
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
      const value = parseFloat(String(input?.value || '').replace(/,/g, '')) || 0;

      if (amountUnit === 'sats') {
        swapAmount = Math.floor(value);
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
      } else {
        selectedUtxosDisplay.textContent =
          `${selectedUtxos.length || getNumberOfHops()} UTXOs · ${Math.max(selectedTotal, swapAmount).toLocaleString()} sats`;
      }
    }
    const utxoPickerTotal = content.querySelector('#utxo-picker-total');
    if (utxoPickerTotal) {
      utxoPickerTotal.textContent = `${selectedTotal.toLocaleString()} sats`;
    }

    content.querySelector('#num-makers-display').textContent =
      details.makers + ' maker' + (details.makers !== 1 ? 's' : '');
    const makerCountSummary = content.querySelector('#maker-count-summary');
    if (makerCountSummary) {
      makerCountSummary.textContent =
        `${makerSelectionMode === 'manual' ? selectedMakerAddresses.length : details.makers} selected`;
    }
    content.querySelector('#num-hops-display').textContent =
      details.hops + ' hop' + (details.hops !== 1 ? 's' : '');
    content.querySelector('#estimated-time').textContent =
      formatEstimatedTime(details.timeSeconds);

    // Update required-makers-count in the maker selection section
    const requiredMakersCountEl = content.querySelector('#required-makers-count');
    if (requiredMakersCountEl) requiredMakersCountEl.textContent = getNumberOfMakers();

    // Update makers label and display based on selection mode
    const makersLabelEl = content.querySelector('#makers-label');
    let selectedMakersText;
    if (makerSelectionMode === 'manual' && selectedMakerAddresses.length > 0) {
      selectedMakersText =
        selectedMakerAddresses.map((addr) => formatTorEndpoint(addr)).join(', ');
      if (makersLabelEl) makersLabelEl.textContent = 'Selected Makers';
    } else {
      selectedMakersText =
        getTopCandidateMakers()
          .map((maker) => formatTorEndpoint(maker.address))
          .join(', ') || 'None selected';
      if (makersLabelEl) makersLabelEl.textContent = 'Top Maker Candidates';
    }
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

    // Manual maker mode: check enough makers selected
    if (makerSelectionMode === 'manual' && selectedMakerAddresses.length < makersNeeded) {
      warnings.push(
        `Need ${makersNeeded} maker${makersNeeded !== 1 ? 's' : ''} for this swap, but only ${selectedMakerAddresses.length} selected`
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
        .map((w) => `<p class="text-xs text-yellow-400">${icons.alertTriangle(12, 'mr-1')} ${w}</p>`)
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
      btn.classList.toggle('is-active', btn.id === 'unit-' + unit);
    });

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
      btn.classList.remove('is-active');
    });

    if (useCustomHops) {
      content.querySelector('#hop-custom').classList.add('is-active');
      content
        .querySelector('#custom-hop-input-container')
        .classList.remove('hidden');
    } else {
      content.querySelector('#hop-' + count)?.classList.add('is-active');
      content
        .querySelector('#custom-hop-input-container')
        .classList.add('hidden');
    }

    updateSummary();
  }

  function toggleSelectionMode(mode) {
    selectionMode = mode;

    content.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'mode-' + mode);
    });

    updateSummary();
  }

  function toggleMakerSelectionMode(mode) {
    makerSelectionMode = mode;

    content.querySelectorAll('.maker-mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'maker-mode-' + mode);
    });

    updateSummary();
  }

  function toggleMakerSelection(address) {
    const addrIndex = selectedMakerAddresses.indexOf(address);
    if (addrIndex > -1) {
      selectedMakerAddresses.splice(addrIndex, 1);
    } else {
      selectedMakerAddresses.push(address);
    }

    // Update checkbox state
    const makerIndex = availableMakers.findIndex((m) => m.address === address);
    if (makerIndex > -1) {
      const checkbox = content.querySelector('#maker-addr-' + makerIndex);
      if (checkbox) {
        checkbox.checked = selectedMakerAddresses.includes(address);
      }
    }

    // Update count display
    const countEl = content.querySelector('#selected-makers-count');
    if (countEl) countEl.textContent = selectedMakerAddresses.length;

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
      makerSelectionMode,
      selectedMakerAddresses,
      useCustomHops,
      customHopCount,
      networkFeeRate,
    };
    console.log('💾 Saving current selections:', selections);
    await SwapStateManager.saveUserSelections(selections);
  }

  // UI - Render the HTML template
  content.innerHTML = `
    <div class="swap-config-page">
      <header class="swap-config-head">
        <h2>Initiate Swap</h2>
        <p>Route a private Bitcoin swap through multiple makers over Tor.</p>
      </header>

      <div class="swap-config-layout">
        <section class="swap-config-card">
          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Amount To Swap</h3>
            </div>
            <p class="swap-help">Enter the amount you want to send through the swap.</p>
            <div id="amount-input-section">
              <div class="swap-amount-box">
                <input id="swap-amount-input" type="text" placeholder="0" />
                <div class="swap-unit-toggle">
                  <button id="unit-sats" class="unit-btn is-active">Sats</button>
                  <button id="unit-btc" class="unit-btn">BTC</button>
                  <button id="unit-usd" class="unit-btn">USD</button>
                </div>
              </div>
              <div class="swap-amount-meta">
                <span id="amount-input-conversions">= 0.00000000 BTC</span>
                <button id="max-swap-btn">Use Max Swappable: <span id="max-swappable-amount">0 sats</span></button>
              </div>
            </div>
          </div>

          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Select UTXOs</h3>
              <span>Auto · <strong id="selected-utxos-count">0</strong> selected</span>
            </div>
            <div class="swap-segment">
              <button id="mode-auto" class="mode-btn is-active">Select UTXOs <small>auto</small></button>
              <button id="mode-manual" class="mode-btn">Select UTXOs <small>manual</small></button>
            </div>
            <div class="swap-mode-row">
              <button class="swap-inline-tab is-active" type="button">Auto select</button>
              <span></span>
              <button class="swap-inline-tab muted" type="button">Manual select</button>
            </div>
            <div class="swap-auto-note">
              <span>Wallet picks UTXOs to minimize change</span>
              <strong><span id="selected-utxos-total">0 sats</span></strong>
            </div>
            <div id="utxo-warning" class="hidden swap-warning-note">
              ${icons.alertTriangle(15)} <span>Mixing Regular and Swap UTXOs in the same transaction can compromise privacy.</span>
            </div>
            <div id="utxo-selection-section" class="swap-picker">
              <div class="swap-picker-head">
                <span>Pick UTXOs to fund the swap</span>
                <strong>Total <span id="utxo-picker-total">0 sats</span></strong>
              </div>
              <div id="utxo-list" class="swap-list">
                <p class="swap-empty-row">Loading UTXOs...</p>
              </div>
            </div>
          </div>

          <div class="swap-section">
            <div class="swap-mode-row">
              <button class="swap-inline-tab is-active" type="button">Auto select</button>
              <span></span>
              <button class="swap-inline-tab muted" type="button">Manual select</button>
            </div>
            <div class="swap-auto-note">
              <span>Wallet picks good makers from the market</span>
              <strong><span id="required-makers-count">2</span> makers from <span id="available-makers-count">${availableMakers.length}</span> candidates</strong>
            </div>
            <div class="swap-segment maker">
              <button id="maker-mode-auto" class="maker-mode-btn is-active">Select Makers <small>auto</small></button>
              <button id="maker-mode-manual" class="maker-mode-btn">Select Makers <small>manual</small></button>
            </div>
            <div id="maker-selection-section" class="swap-picker">
              <div class="swap-picker-head">
                <span>Pick makers to route the swap</span>
                <strong>Selected <span id="selected-makers-count">0</span> makers</strong>
              </div>
              <div id="maker-list" class="swap-list maker-list">
                <p class="swap-empty-row">Loading makers...</p>
              </div>
            </div>
          </div>

          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Number Of Hops</h3>
              <span><strong id="num-makers-display">2 makers</strong> required</span>
            </div>
            <div class="swap-warning-note">
              ${icons.alertTriangle(16)} <span>Warning: If swap with only one maker, the maker can deanonymize you. Recommended minimum hop = 2.</span>
            </div>
            <div class="swap-hop-grid">
              <button id="hop-2" class="hop-count-btn"><strong>2</strong><span>Hops</span></button>
              <button id="hop-3" class="hop-count-btn is-active"><strong>3</strong><span>Hops</span></button>
              <button id="hop-4" class="hop-count-btn"><strong>4</strong><span>Hops</span></button>
              <button id="hop-5" class="hop-count-btn"><strong>5</strong><span>Hops</span></button>
              <button id="hop-custom" class="hop-count-btn"><strong>6+</strong><span>Custom</span></button>
            </div>
            <div id="custom-hop-input-container" class="hidden swap-custom-hop">
              <input id="custom-hop-input" type="number" min="2" max="20" value="6" />
              <span>hops = <strong id="custom-makers-display">5</strong> makers</span>
            </div>
            <p class="swap-help">More hops = better privacy, higher fees.</p>
          </div>

          <div id="validation-warning" class="hidden swap-validation"></div>
          <button id="start-coinswap-btn" class="swap-start-btn">Start Swap</button>
        </section>

        <aside class="swap-summary-stack">
          <section class="swap-balance-card">
            <span>Swappable Balance</span>
            <strong id="available-balance-sats">0 sats</strong>
            <small id="available-balance-btc">0.00000000 BTC</small>
          </section>

          <section class="swap-summary-card">
            <h3>Swap Summary</h3>
            <div class="swap-time-pill">Estimated Time <strong id="estimated-time">2m 00s</strong></div>
            <div class="swap-summary-lines">
              <div><span>Swap amount</span><strong id="swap-amount-display">0 sats</strong></div>
              <p id="swap-amount-conversions">0.00000000 BTC</p>
              <div><span>Number of hops</span><strong id="num-hops-display">3 hops</strong></div>
              <div><span>Makers</span><strong id="maker-count-summary">0 selected</strong></div>
              <div class="maker-candidates"><span id="makers-label">Top maker candidates</span><strong id="selected-makers-display" title="None selected">None selected</strong></div>
              <div><span>Funding transactions</span><strong id="funding-txs-count">3</strong></div>
              <div><span>Avg funding tx size</span><strong id="avg-funding-tx-size">300 vB</strong></div>
            </div>
            <div class="swap-fee-box">
              <div><span>Estimated maker fee</span><strong><span id="maker-fee-sats">0 sats</span></strong></div>
              <span id="maker-fee-percent" class="swap-hidden-percent">0.00%</span>
              <div><span>Network fee</span><strong><span id="network-fee-sats">0 sats</span><small id="network-fee-rate">2 sat/vB</small></strong></div>
              <div class="total"><span>Total estimated fee</span><strong id="total-fee-sats">0 sats</strong></div>
            </div>
            <div class="swap-you-receive">
              <span>You receive</span>
              <strong id="total-amount">0 sats</strong>
              <small id="total-btc">0.00000000 BTC</small>
            </div>
          </section>
        </aside>
      </div>

      <section class="swap-history-panel">
        <h3>Swap History</h3>
        <div id="swap-history-stats" class="swap-history-stats"></div>
        <div id="swap-history-container" class="space-y-3">
          <p class="swap-empty-row">Loading swap history...</p>
        </div>
      </section>
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
      if (selectionMode !== 'auto') {
        toggleSelectionMode('auto');
      }
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

  content.querySelector('#hop-2').addEventListener('click', () => {
    setHopCount(2);
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

  content.querySelector('#maker-mode-auto').addEventListener('click', () => {
    toggleMakerSelectionMode('auto');
    saveCurrentSelections();
  });
  content.querySelector('#maker-mode-manual').addEventListener('click', () => {
    toggleMakerSelectionMode('manual');
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
          selectedMakerAddresses:
            makerSelectionMode === 'manual' && selectedMakerAddresses.length > 0
              ? selectedMakerAddresses
              : undefined,
          password: localStorage.getItem('coinswap_config')
            ? JSON.parse(localStorage.getItem('coinswap_config')).wallet
                ?.password || ''
            : '',
        });
        if (!result.success) {
          alert('Failed to start swap: ' + result.error);
          startBtn.disabled = false;
          startBtn.textContent = 'Start Swap';
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
        startBtn.textContent = 'Start Swap';
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });

  // INITIALIZE

  // Restore selection mode
  if (selectionMode === 'manual') {
    toggleSelectionMode('manual');
  }

  // Restore maker selection mode
  if (makerSelectionMode === 'manual') {
    toggleMakerSelectionMode('manual');
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
      renderMakerList();
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
    renderMakerList();
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
