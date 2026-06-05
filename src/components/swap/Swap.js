import { icons } from '../../js/icons.js';
import { SwapStateManager } from './SwapStateManager.js';
import { getBtcPriceUsd, formatSats } from '../../js/price.js';

// ✅ ADD CACHE CONSTANTS
const SWAP_DATA_CACHE_KEY = 'swap_data_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// ✅ ADD CACHE FUNCTIONS
function loadSwapDataFromCache() {
  try {
    const cached = localStorage.getItem(SWAP_DATA_CACHE_KEY);
    if (cached) {
      const { utxos, balance, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      console.log(`📦 Swap data cache age: ${Math.floor(age / 1000)}s`);

      return {
        utxos,
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

function saveSwapDataToCache(utxos, balance) {
  try {
    localStorage.setItem(
      SWAP_DATA_CACHE_KEY,
      JSON.stringify({
        utxos,
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
  let utxoFilter = 'regular';
  let makerSelectionMode = 'auto'; // 'auto' | 'manual'
  let selectedMakerAddresses = []; // array of maker address strings
  let useCustomHops = false;
  let customHopCount = 6;
  let networkFeeRate = 2;
  const networkFeeRates = { low: 1, medium: 2, high: 4 };
  let userSelectedNetworkFeeRate = false;
  let currentProtocol = 'v2';
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

  function getAmountUnitLabel(unit = amountUnit) {
    if (unit === 'sats') return '丰';
    return unit.toUpperCase();
  }

  function getAmountConversionLabels(amountSats, selectedUnit = amountUnit) {
    const labels = [];
    const btcAmount = amountSats / 100000000;

    if (selectedUnit !== 'sats') {
      labels.push(`= ${Math.round(amountSats || 0).toLocaleString()} 丰`);
    }
    if (selectedUnit !== 'btc') {
      labels.push(`= ${btcAmount.toFixed(8)} BTC`);
    }
    if (selectedUnit !== 'usd' && hasUsdPrice()) {
      labels.push(`$${(btcAmount * btcPrice).toFixed(2)} USD`);
    } else if (selectedUnit !== 'usd') {
      labels.push('USD price unavailable');
    }

    return labels;
  }

  function getUtxoKind(utxo) {
    return String(utxo?.type || '').toLowerCase().includes('swap')
      ? 'swap'
      : 'regular';
  }

  function getUtxoKindLabel(utxo) {
    return getUtxoKind(utxo) === 'swap' ? 'Swap' : 'Regular';
  }

  function getSelectedUtxoKinds() {
    return new Set(
      selectedUtxos
        .map((index) => availableUtxos[index])
        .filter(Boolean)
        .map(getUtxoKind)
    );
  }

  function hasMixedSelectedUtxos() {
    return getSelectedUtxoKinds().size > 1;
  }

  function normalizeProtocolValue(protocol) {
    return protocol === 'v1' || protocol === 'Legacy' ? 'v1' : 'v2';
  }

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
    utxoFilter = savedSelections.utxoFilter || 'regular';
    makerSelectionMode = savedSelections.makerSelectionMode || 'auto';
    selectedMakerAddresses = savedSelections.selectedMakerAddresses || [];
    currentProtocol = normalizeProtocolValue(
      savedSelections.protocol || savedSelections.currentProtocol || currentProtocol
    );
    useCustomHops = savedSelections.useCustomHops || false;
    customHopCount = savedSelections.customHopCount || 6;
    if (savedSelections.networkFeeRate) {
      networkFeeRate = savedSelections.networkFeeRate;
      userSelectedNetworkFeeRate = true;
    }
  } else {
    console.log('⚠️ No saved selections found, using defaults');
  }

  let availableUtxos = [];
  let availableMakers = [];
  let totalBalance = 0;
  const btcPrice = getBtcPriceUsd();

  function hasUsdPrice() {
    return Number.isFinite(Number(btcPrice)) && Number(btcPrice) > 0;
  }

  function getMakerProtocol(makerOrItem, offer = makerOrItem?.offer) {
    return makerOrItem?.protocol || (offer?.tweakablePoint ? 'Taproot' : 'Legacy');
  }

  function getProtocolName(protocol = currentProtocol) {
    return protocol === 'v2' ? 'Taproot' : 'Legacy';
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

  // ✅ LOAD FROM CACHE IMMEDIATELY IF AVAILABLE
  if (cached && !cached.isStale) {
    console.log('⚡ Using cached swap data (still fresh)');
    availableUtxos = cached.utxos || [];
    totalBalance = cached.balance || 0;
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

  // Read current good makers from the backend offerbook.
  async function fetchMakers() {
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
      updateAvailableMakersCount();
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

    const filteredUtxos = availableUtxos
      .map((utxo, index) => ({ utxo, index }))
      .filter(({ utxo }) => getUtxoKind(utxo) === utxoFilter);

    if (filteredUtxos.length === 0) {
      utxoListContainer.innerHTML =
        `<p class="swap-empty-row">No ${utxoFilter} UTXOs available</p>`;
      return;
    }

    utxoListContainer.innerHTML = filteredUtxos
      .map(({ utxo, index }) => {
        const typeLabel = getUtxoKindLabel(utxo);
        const isChecked = selectedUtxos.includes(index);

        return `
        <label class="swap-pick-row">
          <input type="checkbox" id="utxo-${index}" ${isChecked ? 'checked' : ''} />
          <span class="swap-row-id">${utxo.txid.substring(0, 8)}...${utxo.txid.substring(utxo.txid.length - 6)}</span>
          <span class="swap-pill ${typeLabel.toLowerCase()}">${typeLabel}</span>
          <strong>${utxo.amount.toLocaleString()}<small>丰</small></strong>
        </label>
      `;
      })
      .join('');

    // Re-attach event listeners
    filteredUtxos.forEach(({ index }) => {
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

  // FUNCTIONS

  async function fetchNetworkFees() {
    try {
      const response = await fetch(
        'http://170.75.166.88:8080/api/v1/fees/recommended'
      );
      const data = await response.json();
      if (!userSelectedNetworkFeeRate) {
        networkFeeRate = data.halfHourFee;
      }
      updateSummary();
    } catch (error) {
      console.error('Failed to fetch network fees:', error);
    }
  }

  function getNumberOfHops() {
    return getNumberOfMakers() + 1;
  }

  function getNumberOfMakers() {
    if (makerSelectionMode === 'manual') {
      return selectedMakerAddresses.length;
    }

    if (useCustomHops) {
      return Math.max(1, customHopCount - 1);
    }

    return Math.max(1, numberOfHops - 1);
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

  function renderMakerCandidates(addresses) {
    if (!addresses.length) return 'None selected';

    return addresses
      .map((address) => {
        const displayAddress = formatTorEndpoint(address, 10, 11);
        return `<span title="${escapeHtml(address)}">${escapeHtml(displayAddress)}</span>`;
      })
      .join('');
  }

  // Estimate fees from the top candidate makers shown in the UI.
  function calculateFees(amount) {
    const hops = getNumberOfHops();
    const totalMakers = getNumberOfMakers();
    const topCandidateMakers = getTopCandidateMakers();
    const avgFundingTxSize = 300;
    const fundingTxs = hops;
    const networkFee = fundingTxs * avgFundingTxSize * networkFeeRate;
    const makerFee = topCandidateMakers.reduce((sum, maker, index) => {
      const makerPosition = index + 1;
      const refundLocktime = 20 * (totalMakers - makerPosition + 1);
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

  function readSwapAmountInput() {
    const input = content.querySelector('#swap-amount-input');
    const value = parseFloat(String(input?.value || '').replace(/,/g, '')) || 0;

    if (amountUnit === 'sats') {
      return Math.floor(value);
    }

    if (amountUnit === 'btc') {
      return Math.floor(value * 100000000);
    }

    if (amountUnit === 'usd' && hasUsdPrice()) {
      return Math.floor((value / btcPrice) * 100000000);
    }

    return 0;
  }

  function writeSwapAmountInput(amountSats) {
    const input = content.querySelector('#swap-amount-input');
    if (!input) return;

    if (amountSats <= 0) {
      input.value = '';
      return;
    }

    if (amountUnit === 'sats') {
      input.value = amountSats;
    } else if (amountUnit === 'btc') {
      input.value = (amountSats / 100000000).toFixed(8);
    } else if (amountUnit === 'usd' && hasUsdPrice()) {
      input.value = ((amountSats / 100000000) * btcPrice).toFixed(2);
    } else if (amountUnit === 'usd') {
      input.value = '';
    }
  }


  function updateSummary() {
    const selectedTotal = getSelectedUtxosTotal();

    swapAmount = readSwapAmountInput();

    const inputConversions = content.querySelector(
      '#amount-input-conversions'
    );
    if (inputConversions) {
      inputConversions.innerHTML = getAmountConversionLabels(swapAmount)
        .map((label) => `<span>${label}</span>`)
        .join('');
    }

    const details = calculateSwapDetails();

    // Calculate what user actually receives (amount - fees)
    const receiveAmount = Math.max(0, swapAmount - details.totalFeeSats);

    // Update swap amount display (what user is sending)
    content.querySelector('#swap-amount-display').textContent =
      swapAmount.toLocaleString() + ' 丰';

    const swapBtc = swapAmount / 100000000;
    const swapUsd = hasUsdPrice() ? swapBtc * btcPrice : null;
    content.querySelector('#swap-amount-conversions').textContent =
      '≈ ' +
      swapBtc.toFixed(8) +
      ' BTC' +
      (swapUsd == null ? '' : ' • $' + swapUsd.toFixed(2) + ' USD');

    const utxoPickerTotal = content.querySelector('#utxo-picker-total');
    if (utxoPickerTotal) {
      utxoPickerTotal.textContent = `${selectedTotal.toLocaleString()} 丰`;
    }

    const numMakersSummary = content.querySelector('#num-hops-display');
    if (numMakersSummary) {
      const selectedMakers =
        makerSelectionMode === 'manual' ? selectedMakerAddresses.length : details.makers;
      numMakersSummary.textContent =
        selectedMakers + ' maker' + (selectedMakers !== 1 ? 's' : '');
    }
    content.querySelector('#estimated-time').textContent =
      formatEstimatedTime(details.timeSeconds);

    // Update required-makers-count in the maker selection section
    const requiredMakersCountEl = content.querySelector('#required-makers-count');
    if (requiredMakersCountEl) requiredMakersCountEl.textContent = getNumberOfMakers();

    content.querySelector('#maker-fee-percent').textContent =
      details.makerFeePercent + '%';
    content.querySelector('#maker-fee-sats').textContent =
      details.makerFeeSats.toLocaleString() + ' 丰';
    content.querySelector('#network-fee-sats').textContent =
      details.networkFeeSats.toLocaleString() + ' 丰';
    content.querySelector('#network-fee-rate').textContent =
      networkFeeRate + ' 丰/vB';
    content.querySelector('#funding-txs-count').textContent =
      details.fundingTxs.toString();
    content.querySelector('#avg-funding-tx-size').textContent =
      `${details.avgFundingTxSize} vB`;
    content.querySelector('#total-fee-sats').textContent =
      details.totalFeeSats.toLocaleString() + ' 丰';

    const maxSwapEl = content.querySelector('#max-swappable-amount');
    if (maxSwapEl) {
      maxSwapEl.textContent = `${maxSwappableAmount.toLocaleString()} 丰`;
    }

    // Total = Amount - Fees (what user receives)
    content.querySelector('#total-amount').textContent =
      receiveAmount.toLocaleString() + ' 丰';
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
    const selectedTotal = getSelectedUtxosTotal();

    // Check swap amount
    if (swapAmount <= 0) {
      warnings.push('Enter a swap amount');
    }

    if (selectionMode === 'manual') {
      if (selectedUtxos.length === 0) {
        warnings.push('Select at least one UTXO');
      }

      if (hasMixedSelectedUtxos()) {
        warnings.push('Select only Regular UTXOs or only Swap UTXOs');
      }

      if (selectedUtxos.length > 0 && selectedTotal < swapAmount) {
        warnings.push(
          `Selected UTXOs only cover ${selectedTotal.toLocaleString()} 丰`
        );
      }

      // Check if receive amount is too small after fees
      const details = calculateSwapDetails();
      const receiveAmount = swapAmount - details.totalFeeSats;
      if (selectedUtxos.length > 0 && receiveAmount < 10000) {
        warnings.push(
          'Receive amount too small after fees. Select more UTXOs or fewer makers.'
        );
      }
    } else {
      // Check if amount exceeds balance
      if (balancesLoaded && swapAmount > maxSwappableAmount) {
        warnings.push(
          `Swap amount (${swapAmount.toLocaleString()} 丰) exceeds swappable balance`
        );
      }
    }

    if (!balancesLoaded) {
      warnings.push('Loading wallet balances...');
    }

    // Check if enough makers available
    if (availableMakers.length > 0 && makersNeeded > availableMakers.length) {
      warnings.push(
        `Need ${makersNeeded} makers, but only ${availableMakers.length} available`
      );
    }

    // Manual maker mode: check enough makers selected
    if (makerSelectionMode === 'manual' && selectedMakerAddresses.length === 0) {
      warnings.push('Select at least one maker');
    }

    // Check maker liquidity limits
    if (availableMakers.length > 0 && swapAmount > 0) {
      const maxMakerSize = Math.max(...availableMakers.map((m) => m.maxSize));
      if (swapAmount > maxMakerSize) {
        warnings.push(
          `Swap amount exceeds maker max size (${maxMakerSize.toLocaleString()} 丰)`
        );
      }

      const minMakerSize = Math.min(...availableMakers.map((m) => m.minSize));
      if (swapAmount < minMakerSize) {
        warnings.push(
          `Swap amount below maker minimum (${minMakerSize.toLocaleString()} 丰)`
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
    const currentAmountSats = readSwapAmountInput();
    amountUnit = unit;

    content.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'unit-' + unit);
    });

    const input = content.querySelector('#swap-amount-input');
    if (unit === 'sats') input.placeholder = '0';
    else if (unit === 'btc') input.placeholder = '0.00000000';
    else input.placeholder = '0.00';

    const unitEl = content.querySelector('#swap-amount-unit');
    if (unitEl) unitEl.textContent = getAmountUnitLabel(unit);

    writeSwapAmountInput(currentAmountSats);
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
      const customInput = content.querySelector('#custom-hop-input');
      if (customInput) customInput.value = Math.max(1, customHopCount - 1);
    } else {
      content.querySelector('#hop-' + count)?.classList.add('is-active');
      content
        .querySelector('#custom-hop-input-container')
        .classList.add('hidden');
    }

    updateSummary();
  }

  function setMakerCount(count) {
    if (count === 'custom') {
      setHopCount('custom');
      return;
    }

    setHopCount(count + 1);
  }

  function updateSelectionModeUI() {
    const utxoSelectionSection = content.querySelector('#utxo-selection-section');
    const utxoWarning = content.querySelector('#utxo-warning');
    const makerCountHint = content.querySelector('#maker-count-hint');
    const makerAutoControls = content.querySelector('#maker-auto-controls');
    const makerSelectionSection = content.querySelector('#maker-selection-section');

    if (utxoSelectionSection) {
      utxoSelectionSection.classList.toggle('hidden', selectionMode !== 'manual');
    }

    if (utxoWarning && selectionMode !== 'manual') {
      utxoWarning.classList.add('hidden');
    }

    if (makerCountHint) {
      makerCountHint.classList.toggle('hidden', makerSelectionMode !== 'auto');
    }

    if (makerAutoControls) {
      makerAutoControls.classList.toggle('hidden', makerSelectionMode !== 'auto');
    }

    if (makerSelectionSection) {
      makerSelectionSection.classList.toggle('hidden', makerSelectionMode !== 'manual');
    }
  }

  function toggleSelectionMode(mode) {
    selectionMode = mode;

    content.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'mode-' + mode);
    });

    updateSelectionModeUI();
    updateSummary();
  }

  function setUtxoFilter(filter, { prune = true } = {}) {
    utxoFilter = filter;
    if (prune) {
      selectedUtxos = selectedUtxos.filter(
        (index) => getUtxoKind(availableUtxos[index]) === filter
      );
    }

    content.querySelectorAll('.utxo-filter-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'utxo-filter-' + filter);
    });

    renderUtxoList();
    const selectedCountEl = content.querySelector('#selected-utxos-count');
    if (selectedCountEl) selectedCountEl.textContent = selectedUtxos.length;
    checkUtxoTypeWarning();
    updateSummary();
  }

  function toggleMakerSelectionMode(mode) {
    makerSelectionMode = mode;

    content.querySelectorAll('.maker-mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'maker-mode-' + mode);
    });

    updateSelectionModeUI();
    updateSummary();
  }

  async function setSwapProtocol(protocol) {
    currentProtocol = normalizeProtocolValue(protocol);

    content.querySelectorAll('.protocol-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.id === 'protocol-' + currentProtocol);
    });

    const labelEl = content.querySelector('#swap-protocol-label');
    if (labelEl) labelEl.textContent = getProtocolName();

    await fetchMakers();
    renderMakerList();
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

    if (selectionMode !== 'manual') {
      warningEl.classList.add('hidden');
      return;
    }

    if (selectedUtxos.length < 2) {
      warningEl.classList.add('hidden');
      return;
    }

    if (hasMixedSelectedUtxos()) {
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
      const nextKind = getUtxoKind(availableUtxos[index]);
      selectedUtxos = selectedUtxos.filter(
        (selectedIndex) => getUtxoKind(availableUtxos[selectedIndex]) === nextKind
      );
      if (utxoFilter !== nextKind) {
        utxoFilter = nextKind;
      }
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
    const selectedTotal = getSelectedUtxosTotal();
    swapAmount =
      selectionMode === 'manual' && selectedTotal > 0
        ? selectedTotal
        : Math.max(0, maxSwappableAmount);

    // Also check maker max size
    if (availableMakers.length > 0) {
      const maxMakerSize = Math.max(...availableMakers.map((m) => m.maxSize));
      swapAmount = Math.min(swapAmount, maxMakerSize);
    }

    writeSwapAmountInput(swapAmount);

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
      utxoFilter,
      makerSelectionMode,
      selectedMakerAddresses,
      protocol: currentProtocol,
      useCustomHops,
      customHopCount,
      networkFeeRate,
    };
    console.log('💾 Saving current selections:', selections);
    await SwapStateManager.saveUserSelections(selections);
  }

  function setNetworkFeeRate(rate, level = null) {
    const normalizedRate = Math.max(1, Number.parseInt(rate, 10) || 1);
    networkFeeRate = normalizedRate;
    userSelectedNetworkFeeRate = true;

    content.querySelectorAll('.swap-fee-rate-btn').forEach((btn) => {
      btn.classList.toggle('active', level && btn.dataset.level === level);
    });

    const customInput = content.querySelector('#swap-custom-fee');
    if (customInput && level) customInput.value = '';

    updateSummary();
  }

  // UI - Render the HTML template
  content.innerHTML = `
    <div class="swap-config-page">
      <header class="swap-config-head">
        <div>
          <h2>Initiate Swap</h2>
          <p>Route a private Bitcoin swap through multiple makers over Tor.</p>
        </div>
        <button id="swap-reports-btn" class="swap-reports-link" type="button">
          ${icons.fileText(17)} Swap reports
        </button>
      </header>

      <div class="swap-config-layout">
        <section class="swap-config-card">
          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Amount To Swap</h3>
            </div>
            <p class="swap-help">Enter the amount to swap.</p>
            <div id="amount-input-section">
              <div class="swap-field-row">
                <label>Amount</label>
                <div class="swap-unit-toggle">
                  <button id="unit-sats" class="unit-btn is-active">丰</button>
                  <button id="unit-btc" class="unit-btn">BTC</button>
                  <button id="unit-usd" class="unit-btn">USD</button>
                </div>
              </div>
              <label class="swap-amount-box">
                <input id="swap-amount-input" type="number" min="0" step="any" placeholder="0" />
                <span id="swap-amount-unit" class="swap-amount-unit">${getAmountUnitLabel()}</span>
              </label>
              <div class="swap-amount-meta">
                <span id="amount-input-conversions"><span>= 0.00000000 BTC</span><span>$0.00 USD</span></span>
                <button id="max-swap-btn">Use Max Swappable: <span id="max-swappable-amount">0 丰</span></button>
              </div>
            </div>
          </div>

          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Select UTXOs</h3>
              <span><strong id="selected-utxos-count">0</strong> selected</span>
            </div>
            <div class="swap-segment">
              <button id="mode-auto" class="mode-btn is-active">Auto select</button>
              <button id="mode-manual" class="mode-btn">Manual select</button>
            </div>
            <div id="utxo-selection-section" class="hidden swap-picker">
              <div id="utxo-warning" class="hidden swap-warning-note">
                ${icons.alertTriangle(15)} <span>Regular and Swap UTXOs cannot be mixed together in a swap. You can only choose one type.</span>
              </div>
              <div class="swap-picker-head">
                <span>Pick UTXOs to fund the swap</span>
                <strong>Total <span id="utxo-picker-total">0 丰</span></strong>
              </div>
              <div class="utxo-filter-toggle">
                <button id="utxo-filter-regular" class="utxo-filter-btn is-active" type="button">Regular</button>
                <button id="utxo-filter-swap" class="utxo-filter-btn" type="button">Swap</button>
              </div>
              <div id="utxo-list" class="swap-list">
                <p class="swap-empty-row">Loading UTXOs...</p>
              </div>
            </div>
          </div>

          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Select Makers</h3>
              <span id="maker-count-hint"><strong id="required-makers-count">2</strong> from <strong id="available-makers-count">${availableMakers.length}</strong> available</span>
            </div>
            <div class="swap-segment maker">
              <button id="maker-mode-auto" class="maker-mode-btn is-active">Auto select</button>
              <button id="maker-mode-manual" class="maker-mode-btn">Manual select</button>
            </div>
            <div id="maker-auto-controls">
              <div class="swap-section-head swap-subsection-head">
                <h3>Number Of Makers</h3>
                <span>Recommended minimum 2</span>
              </div>
              <div class="swap-warning-note">
                ${icons.alertTriangle(16)} <span>Warning: Swapping with only one maker is not private, as they can deanonimize you. Recommended minimum makers is 2.</span>
              </div>
              <div class="swap-hop-grid">
                <button id="hop-2" class="hop-count-btn"><strong>1</strong><span>Maker</span></button>
                <button id="hop-3" class="hop-count-btn is-active"><strong>2</strong><span>Makers</span></button>
                <button id="hop-4" class="hop-count-btn"><strong>3</strong><span>Makers</span></button>
                <button id="hop-5" class="hop-count-btn"><strong>4</strong><span>Makers</span></button>
                <button id="hop-custom" class="hop-count-btn"><strong>5+</strong><span>Custom</span></button>
              </div>
              <div id="custom-hop-input-container" class="hidden swap-custom-hop">
                <input id="custom-hop-input" type="number" min="5" max="20" value="5" />
                <span>makers</span>
              </div>
            </div>
            <div id="maker-selection-section" class="hidden swap-picker">
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
            <div class="send-section-label">
              <span>Network Fee Rate</span>
              <small>Fee estimate</small>
            </div>
            <div class="send-fee-grid">
              <button id="swap-fee-low" class="fee-btn swap-fee-rate-btn ${networkFeeRate === networkFeeRates.low ? 'active' : ''}" data-level="low" type="button">
                <strong>Low</strong>
                <span>${networkFeeRates.low} 丰/vB - ~60 min</span>
              </button>
              <button id="swap-fee-medium" class="fee-btn swap-fee-rate-btn ${networkFeeRate === networkFeeRates.medium ? 'active' : ''}" data-level="medium" type="button">
                <strong>Medium</strong>
                <span>${networkFeeRates.medium} 丰/vB - ~20 min</span>
              </button>
              <button id="swap-fee-high" class="fee-btn swap-fee-rate-btn ${networkFeeRate === networkFeeRates.high ? 'active' : ''}" data-level="high" type="button">
                <strong>High</strong>
                <span>${networkFeeRates.high} 丰/vB - ~10 min</span>
              </button>
            </div>
            <label class="send-custom-fee">
              <input id="swap-custom-fee" type="number" min="1" placeholder="Custom" value="${Object.values(networkFeeRates).includes(networkFeeRate) ? '' : networkFeeRate}">
              <span>丰 / vbyte</span>
            </label>
          </div>

          <div class="swap-section">
            <div class="swap-section-head">
              <h3>Protocol</h3>
              <span id="swap-protocol-label">${getProtocolName()}</span>
            </div>
            <div class="swap-segment">
              <button id="protocol-v2" class="protocol-btn ${currentProtocol === 'v2' ? 'is-active' : ''}" type="button">Taproot</button>
              <button id="protocol-v1" class="protocol-btn ${currentProtocol === 'v1' ? 'is-active' : ''}" type="button">Legacy</button>
            </div>
            <p class="swap-help">Taproot uses the new Taproot+Musig2 based swap protocol. Legacy uses the old P2WSH based swap protocol.</p>
          </div>

          <div id="validation-warning" class="hidden swap-validation"></div>
          <button id="start-coinswap-btn" class="swap-start-btn">Start Swap</button>
        </section>

        <aside class="swap-summary-stack">
          <section class="swap-balance-card">
            <span>Swappable Balance</span>
            <strong id="available-balance-sats">0 丰</strong>
            <small id="available-balance-btc">0.00000000 BTC</small>
          </section>

          <section class="swap-summary-card">
            <h3>Swap Summary</h3>
            <div class="swap-time-pill">Estimated Time <strong id="estimated-time">2m 00s</strong></div>
            <div class="swap-summary-lines">
              <div><span>Swap amount</span><strong id="swap-amount-display">0 丰</strong></div>
              <p id="swap-amount-conversions">0.00000000 BTC</p>
              <div><span>Makers</span><strong id="num-hops-display">2 makers</strong></div>
              <div><span>Funding transactions</span><strong id="funding-txs-count">3</strong></div>
              <div><span>Avg funding tx size</span><strong id="avg-funding-tx-size">300 vB</strong></div>
            </div>
            <div class="swap-fee-box">
              <div><span>Estimated maker fee</span><strong><span id="maker-fee-sats">0 丰</span></strong></div>
              <span id="maker-fee-percent" class="swap-hidden-percent">0.00%</span>
              <div><span>Network fee</span><strong><span id="network-fee-sats">0 丰</span><small id="network-fee-rate">2 丰/vB</small></strong></div>
              <div class="total"><span>Total estimated fee</span><strong id="total-fee-sats">0 丰</strong></div>
            </div>
            <div class="swap-you-receive">
              <span>You receive</span>
              <strong id="total-amount">0 丰</strong>
              <small id="total-btc">0.00000000 BTC</small>
            </div>
          </section>
        </aside>
      </div>

    </div>
  `;

  container.appendChild(content);
  content.querySelector('#swap-reports-btn')?.addEventListener('click', () => {
    if (window.appManager) {
      window.appManager.renderComponent('swapReports');
    }
  });
  writeSwapAmountInput(swapAmount);
  setUtxoFilter(utxoFilter, { prune: false });
  updateSelectionModeUI();

  function updateBalanceUI() {
    const balanceEl = content.querySelector('#available-balance-sats');
    const balanceBtcEl = content.querySelector('#available-balance-btc');
    if (balanceEl) {
      balanceEl.textContent = maxSwappableAmount.toLocaleString() + ' 丰';
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

  content.querySelector('#hop-2').addEventListener('click', () => {
    setMakerCount(1);
    saveCurrentSelections();
  });
  content.querySelector('#hop-3').addEventListener('click', () => {
    setMakerCount(2);
    saveCurrentSelections();
  });
  content.querySelector('#hop-4').addEventListener('click', () => {
    setMakerCount(3);
    saveCurrentSelections();
  });
  content.querySelector('#hop-5').addEventListener('click', () => {
    setMakerCount(4);
    saveCurrentSelections();
  });
  content.querySelector('#hop-custom').addEventListener('click', () => {
    setHopCount('custom');
    saveCurrentSelections();
  });

  // Custom hop input
  content.querySelector('#custom-hop-input').addEventListener('input', (e) => {
    let value = parseInt(e.target.value) || 5;
    value = Math.max(5, Math.min(20, value));
    customHopCount = value + 1;
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
  content.querySelector('#protocol-v2').addEventListener('click', async () => {
    await setSwapProtocol('v2');
    await saveCurrentSelections();
  });
  content.querySelector('#protocol-v1').addEventListener('click', async () => {
    await setSwapProtocol('v1');
    await saveCurrentSelections();
  });
  content.querySelector('#utxo-filter-regular').addEventListener('click', () => {
    setUtxoFilter('regular');
    saveCurrentSelections();
  });
  content.querySelector('#utxo-filter-swap').addEventListener('click', () => {
    setUtxoFilter('swap');
    saveCurrentSelections();
  });

  content.querySelector('#swap-fee-low').addEventListener('click', () => {
    setNetworkFeeRate(networkFeeRates.low, 'low');
    saveCurrentSelections();
  });
  content.querySelector('#swap-fee-medium').addEventListener('click', () => {
    setNetworkFeeRate(networkFeeRates.medium, 'medium');
    saveCurrentSelections();
  });
  content.querySelector('#swap-fee-high').addEventListener('click', () => {
    setNetworkFeeRate(networkFeeRates.high, 'high');
    saveCurrentSelections();
  });
  content.querySelector('#swap-custom-fee').addEventListener('input', (e) => {
    const customRate = Number.parseInt(e.target.value, 10);
    if (customRate > 0) {
      setNetworkFeeRate(customRate);
      saveCurrentSelections();
    }
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

      if (selectionMode === 'manual' && hasMixedSelectedUtxos()) {
        alert('Select only Regular UTXOs or only Swap UTXOs');
        validateSwapConfig();
        return;
      }

      if (makerSelectionMode === 'manual' && selectedMakerAddresses.length === 0) {
        alert('Please select at least one maker');
        return;
      }

      const protocol = currentProtocol;
      const protocolName = getProtocolName(protocol);

      try {
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
              `❌ Not enough ${protocolName} makers available!\n\nSelected protocol: ${protocolName}\nCompatible makers available: ${compatibleMakers.length}\nMakers needed: ${makersNeeded}\n\nPlease sync market data or reduce the number of makers.`
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
          protocol: swapConfig.protocol,
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
      customInput.value = Math.max(1, customHopCount - 1);
    }
  } else if (numberOfHops !== 3) {
    setHopCount(numberOfHops);
  }

  if (shouldFetchFresh) {
    console.log('🔄 Fetching fresh swap data...');
    // Fetch fresh data
    Promise.all([
      fetchUtxos(false),
      fetchMakers(),
      fetchBalance(false),
    ]).then(async ([utxos, makers, balance]) => {
      await fetchSwapLiquidity();

      // Save to cache
      saveSwapDataToCache(utxos, balance);

      updateBalanceUI();

      updateAvailableMakersCount();
      renderUtxoList();
      setUtxoFilter(utxoFilter);
      renderMakerList();

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
      writeSwapAmountInput(swapAmount);

      updateSummary();
    });
  } else {
    console.log('⚡ Using cached swap data (still fresh)');
    // Just use cache - render immediately
    renderUtxoList();
    setUtxoFilter(utxoFilter);
    fetchMakers().then(() => {
      renderMakerList();
      updateSummary();
    });
    ensureBalancesLoaded().then(() => fetchSwapLiquidity()).then(() => {
      updateBalanceUI();
      updateSummary();
    });
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
    writeSwapAmountInput(swapAmount);

    updateSummary();
  }

  fetchNetworkFees();
  (async () => {
    try {
      await ensureBalancesLoaded();
    } catch (error) {
      console.error('Failed to prime wallet balances:', error);
    }
  })();
}
