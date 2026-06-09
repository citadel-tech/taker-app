import { icons } from '../../js/icons.js';
import { formatSats, SATS_SYMBOL } from '../../js/price.js';

export function Market(container) {
  const content = document.createElement('div');
  content.id = 'market-content';

  let makers = [];
  let isLoading = true;
  let syncProgress = null;
  let currentMakerStatus = 'good';
  let syncCheckInterval = null;
  let periodicRefreshInterval = null;
  let relayCount = null;

  function refreshButtonContent(label = 'Refresh', spinning = false) {
    return `${icons.refreshCw(16, spinning ? 'animate-spin' : '')} ${label}`;
  }

  function formatTorEndpoint(address, start = 8, end = 6) {
    if (!address || typeof address !== 'string') return 'unknown';

    const separatorIndex = address.lastIndexOf(':');
    const host = (
      separatorIndex !== -1 ? address.slice(0, separatorIndex) : address
    ).replace(/\.onion$/i, '');

    if (host.length <= start + end + 3) return host;
    return `${host.slice(0, start)}...${host.slice(-end)}`;
  }

  function formatSatsNumber(sats) {
    return Math.round(Number(sats || 0)).toLocaleString();
  }

  function parseSatsInput(value) {
    const parsed = Number.parseFloat(String(value || '').replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed);
  }

  function calculateMakerFee(maker, amountSats, makerPosition, totalMakers) {
    const liquidityRate = Number(maker.volumeFee || 0);
    const timeRate = Number(maker.timeFee || 0);
    const refundLocktime = 20 * (totalMakers - makerPosition + 1);
    const baseFee = Number(maker.baseFee || 0);
    const liquidityFee = amountSats * liquidityRate;
    const timeFee = refundLocktime * amountSats * timeRate;

    return {
      baseFee,
      liquidityFee,
      timeFee,
      totalFee: baseFee + liquidityFee + timeFee,
      refundLocktime,
      liquidityRate,
      timeRate,
    };
  }

  function startSyncStateMonitor() {
    if (syncCheckInterval) return;

    syncCheckInterval = setInterval(async () => {
      const state = await window.api.taker.getCurrentSyncState();

      if (!state.success) return;

      const refreshBtn = content.querySelector('#refresh-market-btn');
      if (!refreshBtn) return;

      if (state.isRunning) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = refreshButtonContent('Refreshing...', true);

        if (state.currentSyncId && !localStorage.getItem('active_sync_id')) {
          localStorage.setItem('active_sync_id', state.currentSyncId);
        }
      } else if (refreshBtn.disabled) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = refreshButtonContent();
      }
    }, 1000);
  }

  function transformMaker(item, index) {
    const offer = item.offer;
    const addr = item.address;
    let fullAddress;

    if (typeof addr === 'string') {
      fullAddress = addr;
    } else {
      const host = addr?.onion_addr || '';
      const portSuffix = addr?.port ? `:${addr.port}` : '';
      fullAddress = host || portSuffix ? `${host}${portSuffix}` : '';
    }

    if (!offer) {
      return {
        address: fullAddress,
        baseFee: 0,
        volumeFee: '0.000',
        timeFee: '0.0000',
        minSize: 0,
        maxSize: 0,
        bond: 0,
        bondTxid: '',
        bondLocktime: 0,
        bondIsSpent: false,
        index,
      };
    }

    const fidelity = offer.fidelity || {};
    const bond = fidelity.bond || {};
    const outpoint = bond.outpoint || '';

    return {
      address: fullAddress,
      baseFee: offer.baseFee || 0,
      volumeFee: (offer.amountRelativeFeePct || 0).toFixed(3),
      timeFee: (offer.timeRelativeFeePct || 0).toFixed(4),
      minSize: offer.minSize || 0,
      maxSize: offer.maxSize || 0,
      bond: bond.amount || 0,
      bondTxid: outpoint.split(':')[0] || '',
      bondLocktime: bond.lock_time || 0,
      bondIsSpent: bond.is_spent || false,
      index,
    };
  }

  async function fetchMakers() {
    try {
      console.log('[market] Fetching makers from API...');
      const isInitialLoad = makers.length === 0;
      if (isInitialLoad) {
        isLoading = true;
        updateUI();
      }

      const data = await window.api.taker.getOffers();
      console.log('[market] Raw getOffers response', {
        success: data.success,
        cached: data.cached,
        message: data.message,
        error: data.error,
      });

      if (!data.success || !data.offerbook) {
        throw new Error(data.error || 'Failed to fetch offers');
      }

      const goodMakers = data.offerbook.goodMakers || [];
      const badMakers = data.offerbook.badMakers || [];
      const unresponsiveMakers = data.offerbook.unresponsiveMakers || [];
      relayCount = Array.isArray(data.relays)
        ? data.relays.length
        : typeof data.relayCount === 'number'
          ? data.relayCount
          : relayCount;

      makers = [
        ...goodMakers.map((item, index) => ({
          ...transformMaker(item, index),
          status: 'good',
        })),
        ...badMakers.map((item, index) => ({
          ...transformMaker(item, index + goodMakers.length),
          status: 'bad',
        })),
        ...unresponsiveMakers.map((item, index) => ({
          ...transformMaker(item, index + goodMakers.length + badMakers.length),
          status: 'unresponsive',
        })),
      ];

      isLoading = false;
      updateUI();
    } catch (error) {
      console.error('Failed to fetch makers:', error);
      isLoading = false;
      showError('Failed to load makers: ' + error.message);
      updateUI();
    }
  }

  async function handleRefresh() {
    const refreshBtn = content.querySelector('#refresh-market-btn');
    const stateCheck = await window.api.taker.getCurrentSyncState();

    if (stateCheck.success && stateCheck.isRunning) {
      showError('Sync already in progress');
      return;
    }

    refreshBtn.disabled = true;
    refreshBtn.innerHTML = refreshButtonContent('Refreshing...', true);

    syncProgress = {
      percent: 50,
      status: 'syncing',
      message: 'Syncing market data...',
    };
    updateUI();

    try {
      const result = await window.api.taker.syncOfferbookAndWait();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start sync');
      }

      const syncId = result.syncId;
      localStorage.setItem('active_sync_id', syncId);

      let tickFetchInFlight = false;
      await new Promise((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const status = await window.api.taker.getSyncStatus(syncId);

            if (!status.success) {
              clearInterval(poll);
              reject(new Error('Failed to get sync status'));
              return;
            }

            if (status.sync.status === 'syncing' && !tickFetchInFlight) {
              tickFetchInFlight = true;
              fetchMakers()
                .then(() => updateUI())
                .catch((e) =>
                  console.warn('Incremental fetchMakers failed:', e)
                )
                .finally(() => {
                  tickFetchInFlight = false;
                });
            }

            if (status.sync.status === 'completed') {
              clearInterval(poll);
              resolve();
            } else if (status.sync.status === 'failed') {
              clearInterval(poll);
              reject(new Error(status.sync.error || 'Sync failed'));
            }
          } catch (err) {
            clearInterval(poll);
            reject(err);
          }
        }, 1000);
      });

      localStorage.removeItem('active_sync_id');
      syncProgress = null;
      await fetchMakers();

      refreshBtn.innerHTML = refreshButtonContent('Refreshed!');
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = refreshButtonContent();
      }, 2000);
    } catch (error) {
      console.error('[market] Refresh failed', error);
      localStorage.removeItem('active_sync_id');
      syncProgress = null;
      updateUI();
      refreshBtn.innerHTML = refreshButtonContent('Refresh Failed');
      showError(error.message);
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = refreshButtonContent();
      }, 3000);
    }
  }

  async function initialize() {
    await window.api.taker.getProtocol();

    await fetchMakers();
    isLoading = false;

    try {
      const syncingResult = await window.api.taker.getCurrentSyncState();

      if (syncingResult.success && syncingResult.isRunning) {
        syncProgress = {
          percent: 50,
          status: 'syncing',
          message: 'Syncing market data...',
        };
        updateUI();
        await monitorExistingSync();
        return;
      }
    } catch (err) {
      console.error('Failed to check if syncing:', err);
    }

    const activeSyncId = localStorage.getItem('active_sync_id');
    if (activeSyncId) {
      try {
        const status = await window.api.taker.getSyncStatus(activeSyncId);
        if (
          status.success &&
          (status.sync.status === 'syncing' ||
            status.sync.status === 'starting')
        ) {
          syncProgress = {
            percent: 50,
            status: 'syncing',
            message: 'Syncing market data...',
          };
          updateUI();
          await monitorExistingSync();
          return;
        }

        localStorage.removeItem('active_sync_id');
      } catch (err) {
        localStorage.removeItem('active_sync_id');
      }
    }

    updateUI();

    periodicRefreshInterval = setInterval(
      async () => {
        const syncState = await window.api.taker.getCurrentSyncState();
        if (!syncState.isRunning) {
          await fetchMakers();
        }
      },
      15 * 60 * 1000
    );

    const observer = new MutationObserver(() => {
      if (!document.body.contains(content)) {
        clearInterval(periodicRefreshInterval);
        periodicRefreshInterval = null;
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function monitorExistingSync() {
    let tickFetchInFlight = false;
    let isSyncing = true;
    while (isSyncing) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const result = await window.api.taker.getCurrentSyncState();
        if (result.success) {
          isSyncing = result.isRunning;

          if (isSyncing && !tickFetchInFlight) {
            tickFetchInFlight = true;
            fetchMakers()
              .then(() => updateUI())
              .catch((e) => console.warn('Incremental fetchMakers failed:', e))
              .finally(() => {
                tickFetchInFlight = false;
              });
          } else if (isSyncing) {
            console.log('Still syncing (prior tick fetch in flight)...');
          }
        }
      } catch (error) {
        console.error('Error checking sync status:', error);
        break;
      }
    }

    syncProgress = null;
    await fetchMakers();
    updateUI();
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'market-toast-error';
    errorDiv.innerHTML = `
      <div>
        ${icons.xCircle(20)}
        <div>
          <strong>Error</strong>
          <span>${message}</span>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  function showSuccess(message) {
    const div = document.createElement('div');
    div.className = 'market-toast-success';
    div.innerHTML = `
      <div>
        ${icons.checkCircle(20)}
        <div>
          <strong>Success</strong>
          <span>${message}</span>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  function calculateStats() {
    const goodMakers = makers.filter((m) => m.status === 'good');
    const totalLiquidity = goodMakers.reduce((sum, m) => sum + (Number.isFinite(m.maxSize) ? m.maxSize : 0), 0);
    const totalFidelity = goodMakers.reduce((sum, m) => sum + (Number.isFinite(m.bond) ? m.bond : 0), 0);
    const counts = {
      good: goodMakers.length,
      bad: makers.filter((m) => m.status === 'bad').length,
      unresponsive: makers.filter((m) => m.status === 'unresponsive').length,
    };

    return {
      totalLiquidity,
      totalFidelity,
      counts,
      nostrRelays: relayCount ?? 0,
    };
  }

  window.viewFidelityBond = (makerAddress) => {
    const maker = makers.find((m) => m.address === makerAddress);
    if (!maker || !maker.bondTxid) {
      alert('No fidelity bond data available');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'market-modal-backdrop';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    const locktimeDays = maker.bondLocktime
      ? Math.floor(maker.bondLocktime / 144)
      : 0;

    modal.innerHTML = `
      <div class="market-modal" onclick="event.stopPropagation()">
        <div class="market-modal-head">
          <h3>Fidelity Bond Details</h3>
          <button onclick="this.closest('.market-modal-backdrop').remove()">&times;</button>
        </div>
        <div class="market-modal-grid">
          <div>
            <span>Tor Address</span>
            <strong>${maker.address}</strong>
          </div>
          <div>
            <span>Bond Amount</span>
            <strong>${formatSats(maker.bond)}</strong>
          </div>
          <div>
            <span>Bond Status</span>
            <strong class="${maker.bondIsSpent ? 'negative' : 'positive'}">${maker.bondIsSpent ? 'Spent' : 'Active'}</strong>
          </div>
          <div>
            <span>Expires In</span>
            <strong>~${locktimeDays} days</strong>
          </div>
          <div class="wide">
            <span>Bond Txid</span>
            <button onclick="window.open('http://170.75.166.88:8080/tx/${maker.bondTxid}', '_blank')">
              ${maker.bondTxid}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  window.openMakerFeeCalculator = (makerIndex) => {
    const maker = makers.find((m) => m.index === makerIndex);
    if (!maker) {
      showError('Maker data is not available');
      return;
    }

    const defaultAmountSats =
      maker.minSize > 0
        ? maker.minSize
        : Math.min(10000000, maker.maxSize || 10000000);
    const modal = document.createElement('div');
    modal.className = 'market-modal-backdrop';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="market-modal market-fee-modal" onclick="event.stopPropagation()">
        <div class="market-fee-head">
          <div>
            <span>Fee Calculator</span>
            <h3>Estimate swap cost</h3>
            <p title="${maker.address}">${formatTorEndpoint(maker.address, 22, 12)}</p>
          </div>
          <button class="market-modal-close" type="button" aria-label="Close">&times;</button>
        </div>

        <div class="market-fee-body">
          <label class="market-fee-field">
            <span>Swap Amount</span>
            <input id="market-fee-amount" type="number" min="0" step="1" value="${Math.round(defaultAmountSats)}">
          </label>
          <div class="market-fee-range">
            <span>Maker range</span>
            <strong>${formatSats(maker.minSize)} - ${formatSats(maker.maxSize)}</strong>
          </div>

          <label class="market-fee-field">
            <span>Maker Position in Circuit (n)</span>
            <div class="market-fee-index-field">
              <input id="market-fee-position" type="number" min="1" step="1" value="1">
              <strong>Position</strong>
            </div>
          </label>
          <label class="market-fee-field">
            <span>Total Makers in Swap (m)</span>
            <div class="market-fee-index-field">
              <input id="market-fee-total-makers" type="number" min="1" step="1" value="2">
              <strong>Makers</strong>
            </div>
          </label>
          <div class="market-fee-range">
            <span>Refund locktime = 20 x (m - n + 1)</span>
            <strong id="market-fee-locktime">Enter position</strong>
          </div>
          <p id="market-fee-position-error" class="market-fee-validation">Enter positive maker counts where n is not greater than m.</p>

          <div class="market-fee-formula">
            <span>Formula</span>
            <strong>Total Fee</strong> = Base Fee + (Swap Amount x Liquidity Fee) +<br>
            (Refund Locktime x Swap Amount x Time Rate)
          </div>

          <div class="market-fee-results">
            <div>
              <span>Base Fee</span>
              <strong><span id="market-fee-base">0</span> ${SATS_SYMBOL}</strong>
              <small>Fixed maker fee</small>
            </div>
            <div>
              <span>Liquidity Fee</span>
              <strong><span id="market-fee-liquidity">0</span> ${SATS_SYMBOL}</strong>
              <small id="market-fee-liquidity-detail">0 ${SATS_SYMBOL} x 0 fee rate</small>
            </div>
            <div>
              <span>Time Fee</span>
              <strong><span id="market-fee-time">0</span> ${SATS_SYMBOL}</strong>
              <small id="market-fee-time-detail">20 x 0 ${SATS_SYMBOL} x 0 time rate</small>
            </div>
            <div class="total">
              <span>Total Fee</span>
              <strong><span id="market-fee-total">0</span> ${SATS_SYMBOL}</strong>
              <small id="market-fee-percent">0.0000% of swap amount</small>
            </div>
          </div>

          <p class="market-fee-note">Estimates exclude on-chain miner fees.</p>
        </div>
      </div>
    `;

    const amountInput = modal.querySelector('#market-fee-amount');
    const positionInput = modal.querySelector('#market-fee-position');
    const totalMakersInput = modal.querySelector('#market-fee-total-makers');
    const closeBtn = modal.querySelector('.market-modal-close');

    const updateEstimate = () => {
      const amountSats = parseSatsInput(amountInput.value);
      const rawMakerPosition = Number.parseFloat(positionInput.value);
      const makerPosition =
        Number.isInteger(rawMakerPosition) && rawMakerPosition > 0
          ? rawMakerPosition
          : null;
      const rawTotalMakers = Number.parseFloat(totalMakersInput.value);
      const totalMakers =
        Number.isInteger(rawTotalMakers) && rawTotalMakers > 0
          ? rawTotalMakers
          : null;

      if (makerPosition === null || totalMakers === null || makerPosition > totalMakers) {
        modal.querySelector('#market-fee-locktime').textContent =
          'Enter position';
        modal.querySelector('#market-fee-base').textContent = '0';
        modal.querySelector('#market-fee-liquidity').textContent = '0';
        modal.querySelector('#market-fee-liquidity-detail').textContent =
          `${formatSats(amountSats)} x ${Number(maker.volumeFee || 0).toFixed(4)} fee rate`;
        modal.querySelector('#market-fee-time').textContent = '0';
        modal.querySelector('#market-fee-time-detail').textContent =
          'Enter position to calculate time fee';
        modal.querySelector('#market-fee-total').textContent = '0';
        modal.querySelector('#market-fee-percent').textContent =
          'Enter position to calculate total fee';
        modal
          .querySelector('#market-fee-position-error')
          .classList.remove('hidden');
        return;
      }

      modal.querySelector('#market-fee-position-error').classList.add('hidden');

      const estimate = calculateMakerFee(maker, amountSats, makerPosition, totalMakers);
      const totalPercent =
        amountSats > 0 ? (estimate.totalFee / amountSats) * 100 : 0;

      modal.querySelector('#market-fee-locktime').textContent =
        `${estimate.refundLocktime} blocks`;
      modal.querySelector('#market-fee-base').textContent = formatSatsNumber(
        estimate.baseFee
      );
      modal.querySelector('#market-fee-liquidity').textContent =
        formatSatsNumber(estimate.liquidityFee);
      modal.querySelector('#market-fee-liquidity-detail').textContent =
        `${formatSats(amountSats)} x ${estimate.liquidityRate.toFixed(4)} fee rate`;
      modal.querySelector('#market-fee-time').textContent = formatSatsNumber(
        estimate.timeFee
      );
      modal.querySelector('#market-fee-time-detail').textContent =
        `${estimate.refundLocktime} x ${formatSats(amountSats)} x ${estimate.timeRate.toFixed(6)} time rate`;
      modal.querySelector('#market-fee-total').textContent = formatSatsNumber(
        estimate.totalFee
      );
      modal.querySelector('#market-fee-percent').textContent =
        `${totalPercent.toFixed(4)}% of swap amount`;
    };

    amountInput.addEventListener('input', updateEstimate);
    positionInput.addEventListener('input', updateEstimate);
    totalMakersInput.addEventListener('input', updateEstimate);
    closeBtn.addEventListener('click', () => modal.remove());
    updateEstimate();

    document.body.appendChild(modal);
    positionInput.focus();
  };

  function updateUI() {
    const stats = calculateStats();
    const tableBody = content.querySelector('#maker-table-body');
    const statsContainer = content.querySelector('#market-stats');
    const syncStatusDiv = content.querySelector('#sync-status');
    const progressContainer = content.querySelector('#sync-progress-container');
    const activeSummary = content.querySelector('#market-active-summary');

    if (syncStatusDiv) {
      syncStatusDiv.innerHTML = `
        <span class="market-sync-dot"></span>
        <span>${makers.length} makers available</span>
        ${stats.nostrRelays ? `<span>${stats.nostrRelays} relays</span>` : ''}
      `;
    }

    if (progressContainer) {
      if (isLoading || syncProgress) {
        progressContainer.classList.remove('hidden');
        progressContainer.innerHTML = `
          <div class="market-progress-card">
            <div class="market-progress-head">
              <span>${icons.refreshCw(16, 'animate-spin')} ${syncProgress?.message || 'Syncing market data...'}</span>
              <span>Please wait</span>
            </div>
            <div class="market-progress-bar"><span></span></div>
            <div class="market-progress-copy">${icons.search(14)} Discovering makers over Tor network...</div>
          </div>
        `;
      } else {
        progressContainer.classList.add('hidden');
      }
    }

    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="market-stat-card fidelity">
          <span class="app-accent"></span>
          <div class="app-card-label">Fidelity Locked</div>
          <div class="app-card-value"><span>${formatSats(stats.totalFidelity)}</span></div>
          <p>Across ${stats.counts.good} active makers.</p>
        </div>
        <div class="market-stat-card liquidity">
          <span class="app-accent"></span>
          <div class="app-card-label">Total Liquidity</div>
          <div class="app-card-value"><span>${formatSats(stats.totalLiquidity)}</span></div>
          <p>Spendable maker depth.</p>
        </div>
        <div class="market-stat-card makers">
          <span class="app-accent"></span>
          <div class="app-card-label">Active Makers</div>
          <div class="app-card-value"><span>${stats.counts.good}</span><small>responding</small></div>
          <p>${stats.counts.good} good &middot; ${stats.counts.bad} bad &middot; ${stats.counts.unresponsive} unresponsive in this window.</p>
        </div>
      `;
    }

    const goodCount = content.querySelector('#good-count');
    const badCount = content.querySelector('#bad-count');
    const unresponsiveCount = content.querySelector('#unresponsive-count');

    if (goodCount) goodCount.textContent = stats.counts.good;
    if (badCount) badCount.textContent = stats.counts.bad;
    if (unresponsiveCount)
      unresponsiveCount.textContent = stats.counts.unresponsive;

    const displayedMakers = makers.filter(
      (m) => m.status === currentMakerStatus
    );
    if (activeSummary) {
      activeSummary.textContent = `${displayedMakers.length} ${currentMakerStatus} offers`;
    }

    if (tableBody) {
      if (isLoading) {
        tableBody.innerHTML = `
          <div class="market-empty-state">
            ${icons.loader(42, 'animate-spin')}
            <strong>Syncing market data...</strong>
            <span>Fetching makers over Tor network</span>
          </div>
        `;
      } else if (makers.length === 0) {
        tableBody.innerHTML = `
          <div class="market-empty-state">
            ${icons.inbox(42)}
            <strong>No makers found</strong>
            <button onclick="document.querySelector('#refresh-market-btn').click()" class="app-button primary sm">
              ${icons.refreshCw(14)} Refresh
            </button>
          </div>
        `;
      } else if (displayedMakers.length === 0) {
        tableBody.innerHTML = `
          <div class="market-empty-state">
            ${icons.inbox(42)}
            <strong>No ${currentMakerStatus} makers found</strong>
          </div>
        `;
      } else {
        tableBody.innerHTML = displayedMakers
          .map((maker) => {
            return `
              <div class="market-row">
                <div class="market-address" title="${maker.address}">${formatTorEndpoint(maker.address)}</div>
                <div class="market-number primary">${formatSats(maker.baseFee)}</div>
                <div class="market-number">${maker.volumeFee}</div>
                <div class="market-number">${maker.timeFee}</div>
                <div class="market-number muted">${formatSats(maker.minSize)}</div>
                <div class="market-number muted">${formatSats(maker.maxSize)}</div>
                <div class="market-bond">
                  <span>${maker.bond > 0 ? formatSats(maker.bond) : 'N/A'}</span>
                  <button onclick="window.viewFidelityBond('${maker.address}')" class="market-bond-action" title="View fidelity bond">
                    ${icons.externalLink(12)}
                  </button>
                </div>
                <div class="market-actions">
                  <button class="market-action-btn" onclick="window.openMakerFeeCalculator(${maker.index})" data-tooltip="Calculate the estimated maker fee for this maker using your amount and hop position.">Calculate</button>
                  <button class="market-action-btn" data-maker-poll="${maker.address}" data-tooltip="Ask this maker for a fresh offer now and update its availability and fee data.">Poll</button>
                  <button class="market-action-btn danger" data-maker-remove="${maker.address}" data-tooltip="Remove this maker from your local offerbook so it no longer appears in market results.">Remove</button>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    const footer = content.querySelector('#market-footer');
    if (footer) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      footer.innerHTML = `
        <span>Showing ${displayedMakers.length} ${currentMakerStatus} offers &middot; ${timeStr}</span>
      `;
    }
  }

  content.innerHTML = `
    <div class="app-page market-page">
      <div class="app-head">
        <div>
          <h2>Market</h2>
          <p class="market-subtitle">Live view of coinswap makers routing through your Tor circuit.</p>
          <div id="sync-status" class="market-sync-shell"></div>
        </div>
        <button id="refresh-market-btn" class="app-button primary">
          ${refreshButtonContent()}
        </button>
      </div>

      <div id="sync-progress-container" class="hidden"></div>
      <div id="market-stats" class="market-stats"></div>

      <section class="market-panel">
        <div class="market-panel-head">
          <div class="app-tabs market-tabs">
            <button id="tab-good" class="active">Good Makers <span id="good-count">0</span></button>
            <button id="tab-bad">Bad Makers <span id="bad-count">0</span></button>
            <button id="tab-unresponsive">Unresponsive <span id="unresponsive-count">0</span></button>
          </div>
          <div id="market-active-summary" class="app-meta">0 good offers</div>
        </div>

        <div class="market-table-scroll">
          <div class="market-table-header">
            <div>Tor Address</div>
            <div>Base Fee</div>
            <div>Liquidity Fee</div>
            <div>Time Rate</div>
            <div>Min Swap</div>
            <div>Max Swap</div>
            <div>Fidelity Bond</div>
            <div>Actions</div>
          </div>

          <div id="maker-table-body" class="market-table-body">
            <div class="market-empty-state">
              ${icons.loader(42, 'animate-spin')}
              <strong>Loading makers...</strong>
            </div>
          </div>
        </div>

        <div id="market-footer" class="market-footer">Loading...</div>
      </section>
    </div>
  `;

  container.appendChild(content);

  content
    .querySelector('#refresh-market-btn')
    .addEventListener('click', handleRefresh);

  function switchTab(status) {
    currentMakerStatus = status;

    ['good', 'bad', 'unresponsive'].forEach((s) => {
      const tab = content.querySelector(`#tab-${s}`);
      tab.classList.toggle('active', s === status);
    });

    updateUI();
  }

  content
    .querySelector('#tab-good')
    .addEventListener('click', () => switchTab('good'));
  content
    .querySelector('#tab-bad')
    .addEventListener('click', () => switchTab('bad'));
  content
    .querySelector('#tab-unresponsive')
    .addEventListener('click', () => switchTab('unresponsive'));

  content.addEventListener('click', async (event) => {
    const pollBtn = event.target.closest('[data-maker-poll]');
    const removeBtn = event.target.closest('[data-maker-remove]');

    if (pollBtn) {
      const address = pollBtn.dataset.makerPoll;
      pollBtn.disabled = true;
      pollBtn.innerHTML = 'Polling...';
      try {
        const res = await window.api.taker.pollMaker(address);
        if (!res.success) throw new Error(res.error || 'Poll failed');

        // pollMakerAsync never writes offerbook.json, so re-reading from disk
        // would return stale data. Merge the normalized maker directly into the
        // in-memory array so the UI reflects the fresh poll result immediately.
        if (res.maker) {
          const rawType = (res.maker.stateType || 'Good').toLowerCase();
          const newStatus = rawType.includes('bad') ? 'bad'
            : rawType.includes('unresponsive') ? 'unresponsive'
            : 'good';
          const existingIdx = makers.findIndex((m) => m.address === address);
          if (existingIdx >= 0) {
            const fresh = {
              ...transformMaker(res.maker, makers[existingIdx].index),
              status: newStatus,
            };
            makers[existingIdx] = fresh;
          } else {
            makers.push({ ...transformMaker(res.maker, makers.length), status: newStatus });
          }
        }

        updateUI();
        showSuccess(`Maker responded with a fresh offer. Offerbook updated.`);
      } catch (err) {
        console.error('Poll failed:', err);
        showError(`Poll failed: ${err.message}`);
        pollBtn.disabled = false;
        pollBtn.innerHTML = 'Poll';
      }
      return;
    }

    if (removeBtn) {
      const address = removeBtn.dataset.makerRemove;
      if (!confirm(`Remove maker ${address} from the offerbook?`)) return;
      const original = removeBtn.innerHTML;
      removeBtn.disabled = true;
      removeBtn.innerHTML = 'Removing...';
      try {
        const res = await window.api.taker.removeMaker(address);
        if (!res.success) throw new Error(res.error || 'Remove failed');
        if (!res.removed) console.warn(`Maker ${address} not found in offerbook`);
        await fetchMakers();
        updateUI();
      } catch (err) {
        console.error('Remove failed:', err);
        showError(`Remove failed: ${err.message}`);
        removeBtn.disabled = false;
        removeBtn.innerHTML = original;
      }
    }
  });

  initialize();
  startSyncStateMonitor();

  window.addEventListener('beforeunload', () => {
    if (syncCheckInterval) {
      clearInterval(syncCheckInterval);
      syncCheckInterval = null;
    }
  });
}
