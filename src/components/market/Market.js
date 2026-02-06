export function Market(container) {
  const content = document.createElement('div');
  content.id = 'market-content';

  // STATE
  let makers = [];
  let isLoading = true;
  let syncProgress = null;
  let currentMakerStatus = 'good'; // 'good', 'bad', or 'unresponsive'
  let syncCheckInterval = null;

  // Check sync state every second
  function startSyncStateMonitor() {
    if (syncCheckInterval) return;

    syncCheckInterval = setInterval(async () => {
      const state = await window.api.taker.getCurrentSyncState();

      if (state.success) {
        const refreshBtn = content.querySelector('#refresh-market-btn');

        if (state.isRunning) {
          // Sync is running - disable button
          if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML =
              '<span class="animate-pulse">⏳ Syncing...</span>';
          }

          // Monitor the current sync
          if (state.currentSyncId && !localStorage.getItem('active_sync_id')) {
            localStorage.setItem('active_sync_id', state.currentSyncId);
          }
        } else {
          // No sync running - enable button
          if (refreshBtn && refreshBtn.disabled) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '🔄 Sync Market Data';
          }
        }
      }
    }, 1000); // Check every second
  }

  function transformMaker(item, index) {
    const offer = item.offer;
    const addressObj = item.address || {};
    const onionAddr = addressObj.onion_addr || '';
    const port = addressObj.port || '6102';
    const fullAddress = `${onionAddr}:${port}`;

    // Handle null offers (unresponsive makers)
    if (!offer) {
      return {
        address: fullAddress,
        protocol: 'Unknown',
        baseFee: 0,
        volumeFee: '0.00',
        timeFee: '0.00',
        minSize: 0,
        maxSize: 0,
        bond: 0,
        bondTxid: '',
        bondVout: '0',
        bondOutpoint: '',
        bondLocktime: 0,
        bondPubkey: '',
        bondConfHeight: null,
        bondCertExpiry: null,
        bondIsSpent: false,
        requiredConfirms: 0,
        minimumLocktime: 0,
        index: index,
      };
    }

    const fidelity = offer.fidelity || {};
    const bond = fidelity.bond || {};
    const outpoint = bond.outpoint || '';

    return {
      address: fullAddress,
      protocol:
        item.protocol || (offer.tweakablePoint ? 'Taproot' : 'Legacy P2WSH'),
      baseFee: offer.baseFee || 0,
      volumeFee: (offer.amountRelativeFeePct || 0).toFixed(2),
      timeFee: (offer.timeRelativeFeePct || 0).toFixed(2),
      minSize: offer.minSize || 0,
      maxSize: offer.maxSize || 0,
      bond: bond.amount || 0,
      bondTxid: outpoint.split(':')[0] || '',
      bondVout: outpoint.split(':')[1] || '0',
      bondOutpoint: outpoint,
      bondLocktime: bond.lock_time || 0,
      bondPubkey: bond.pubkey || '',
      bondConfHeight: bond.conf_height || null,
      bondCertExpiry: bond.cert_expiry || null,
      bondIsSpent: bond.is_spent || false,
      requiredConfirms: offer.requiredConfirms || 0,
      minimumLocktime: offer.minimumLocktime || 0,
      index: index,
    };
  }

  // API FUNCTIONS
  async function fetchMakers() {
    try {
      console.log('📡 Fetching makers from API...');
      isLoading = true;
      updateUI();

      const data = await window.api.taker.getOffers();

      if (data.success && data.offerbook) {
        const goodMakers = data.offerbook.goodMakers || [];
        const badMakers = data.offerbook.badMakers || [];
        const unresponsiveMakers = data.offerbook.unresponsiveMakers || [];

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
            ...transformMaker(
              item,
              index + goodMakers.length + badMakers.length
            ),
            status: 'unresponsive',
          })),
        ];

        console.log('✅ Loaded', makers.length, 'makers:', {
          good: goodMakers.length,
          bad: badMakers.length,
          unresponsive: unresponsiveMakers.length,
        });
        isLoading = false;
        updateUI();
      } else {
        throw new Error(data.error || 'Failed to fetch offers');
      }
    } catch (error) {
      console.error('❌ Failed to fetch makers:', error);
      isLoading = false;
      showError('Failed to load makers: ' + error.message);
      updateUI();
    }
  }

  async function syncOfferbook() {
    try {
      // Check if sync is already running
      const activeSyncId = localStorage.getItem('active_sync_id');
      if (activeSyncId) {
        const status = await window.api.taker.getSyncStatus(activeSyncId);
        if (
          status.success &&
          (status.sync.status === 'syncing' ||
            status.sync.status === 'starting')
        ) {
          throw new Error('Sync already in progress');
        }
      }

      console.log('🔄 Starting offerbook sync...');

      const result = await window.api.taker.syncOfferbook();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start sync');
      }

      const syncId = result.syncId;
      console.log('📡 Sync started:', syncId);

      // Store sync ID in localStorage
      localStorage.setItem('active_sync_id', syncId);

      // Poll for completion and update progress
      return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          try {
            const status = await window.api.taker.getSyncStatus(syncId);

            if (!status.success) {
              clearInterval(pollInterval);
              localStorage.removeItem('active_sync_id');
              syncProgress = null;
              updateUI();
              reject(new Error('Failed to get sync status'));
              return;
            }

            const sync = status.sync;
            console.log('📊 Sync status:', sync.status);

            // Update progress data - simplified version
            syncProgress = {
              percent: 50,
              status: sync.status,
              message:
                sync.status === 'syncing'
                  ? 'Discovering makers...'
                  : 'Starting...',
            };

            if (sync.progress !== undefined) {
              syncProgress.percent = sync.progress;
            }
            if (sync.message) {
              syncProgress.message = sync.message;
            }

            updateUI();

            if (sync.status === 'completed') {
              clearInterval(pollInterval);
              localStorage.removeItem('active_sync_id');
              syncProgress = null;
              console.log('✅ Offerbook synced');
              await new Promise((r) => setTimeout(r, 1000));
              await fetchMakers();
              updateUI();
              resolve();
            } else if (sync.status === 'failed') {
              clearInterval(pollInterval);
              localStorage.removeItem('active_sync_id');
              syncProgress = null;
              updateUI();
              reject(new Error(sync.error || 'Sync failed'));
            }
          } catch (error) {
            clearInterval(pollInterval);
            localStorage.removeItem('active_sync_id');
            syncProgress = null;
            updateUI();
            reject(error);
          }
        }, 1000);
      });
    } catch (error) {
      console.error('❌ Sync failed:', error);
      syncProgress = null;
      updateUI();
      throw error;
    }
  }

  async function handleRefresh() {
    const refreshBtn = content.querySelector('#refresh-market-btn');

    // Check if sync is already running
    const activeSyncId = localStorage.getItem('active_sync_id');
    if (activeSyncId) {
      try {
        const status = await window.api.taker.getSyncStatus(activeSyncId);
        if (
          status.success &&
          (status.sync.status === 'syncing' ||
            status.sync.status === 'starting')
        ) {
          showError('Sync already in progress');
          return;
        }
      } catch (err) {
        localStorage.removeItem('active_sync_id');
      }
    }

    const originalText = refreshBtn.innerHTML;

    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="animate-pulse">Syncing...</span>';

    // ✅ Show sync progress bar ONLY
    syncProgress = {
      percent: 50,
      status: 'syncing',
      message: 'Syncing market data...',
    };
    updateUI();

    try {
      const result = await window.api.taker.syncOfferbook();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start sync');
      }

      const syncId = result.syncId;
      console.log('📡 Sync started:', syncId);
      localStorage.setItem('active_sync_id', syncId);

      // Poll until sync completes
      let isSyncing = true;
      while (isSyncing) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResult = await window.api.taker.isOfferbookSyncing();
        if (statusResult.success) {
          isSyncing = statusResult.isSyncing;
          if (isSyncing) {
            console.log('⏳ Still syncing...');
          }
        }
      }

      // Sync is done - wait for file write
      console.log('✅ Offerbook synced - waiting for file write...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Clear sync progress
      syncProgress = null;

      // NOW fetch fresh makers
      console.log('✅ Now fetching fresh makers...');
      localStorage.removeItem('active_sync_id');
      await fetchMakers(); // This sets isLoading = false and updates UI

      refreshBtn.innerHTML = '✅ Synced!';
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalText;
      }, 2000);
    } catch (error) {
      syncProgress = null; 
      updateUI();
      refreshBtn.innerHTML = '❌ Failed';
      showError(error.message);
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalText;
      }, 3000);
    }
  }

  async function initialize() {
    // Get protocol version
    const protocolResult = await window.api.taker.getProtocol();
    const protocol = protocolResult.protocol;
    const protocolName = protocolResult.protocolName;

    // Show protocol warning banner
    const banner = content.querySelector('#protocol-banner');
    const title = content.querySelector('#protocol-warning-title');
    const text = content.querySelector('#protocol-warning-text');

    if (protocol === 'v2') {
      title.textContent = '⚡ You Can Only Swap With Taproot Makers';
      text.textContent =
        'Your wallet is configured for Taproot swaps. Legacy makers will be filtered out.';
    } else {
      title.textContent = '🔒 You Can Only Swap With Legacy Makers';
      text.textContent =
        'Your wallet is configured for Legacy swaps. Taproot makers will be filtered out.';
    }
    banner.classList.remove('hidden');

    // ✅ CHECK: Is offerbook currently syncing?
    try {
      const syncingResult = await window.api.taker.isOfferbookSyncing();

      if (syncingResult.success && syncingResult.isSyncing) {
        console.log('⏳ Background sync in progress, waiting...');
        isLoading = true;
        updateUI();
        await monitorExistingSync();
        return; // Exit - monitorExistingSync will fetch when done
      }
    } catch (err) {
      console.error('Failed to check if syncing:', err);
    }

    // Check localStorage for active sync
    const activeSyncId = localStorage.getItem('active_sync_id');
    if (activeSyncId) {
      try {
        const status = await window.api.taker.getSyncStatus(activeSyncId);
        if (
          status.success &&
          (status.sync.status === 'syncing' ||
            status.sync.status === 'starting')
        ) {
          const refreshBtn = content.querySelector('#refresh-market-btn');
          if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML =
              '<span class="animate-pulse">⏳ Syncing...</span>';
          }

          isLoading = true;
          updateUI();
          await monitorExistingSync();
          return;
        } else {
          localStorage.removeItem('active_sync_id');
        }
      } catch (err) {
        localStorage.removeItem('active_sync_id');
      }
    }

    // ✅ Safe to fetch - no sync running
    await fetchMakers();
    isLoading = false;
    updateUI();
  }

  async function monitorExistingSync() {
    console.log('🔍 Monitoring existing offerbook sync...');

    // Show loading state
    isLoading = true;
    updateUI();

    // ✅ SIMPLE: Just poll until sync is done
    let isSyncing = true;
    while (isSyncing) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const result = await window.api.taker.isOfferbookSyncing();
        if (result.success) {
          isSyncing = result.isSyncing;
          if (isSyncing) {
            console.log('⏳ Still syncing...');
          }
        }
      } catch (error) {
        console.error('Error checking sync status:', error);
        break; // Exit on error
      }
    }

    // ✅ CHANGE THIS: Wait 10 seconds (same as handleRefresh)
    console.log('✅ Offerbook sync completed - waiting for file write...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ✅ NOW fetch makers
    console.log('✅ Now fetching makers...');
    await fetchMakers(); // This sets isLoading = false
    updateUI();
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className =
      'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
    errorDiv.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="text-xl">❌</span>
        <div class="flex-1">
          <div class="font-semibold text-lg mb-1">Error</div>
          <div class="text-sm">${message}</div>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  function calculateStats() {
    const displayedMakers = makers.filter(
      (m) => m.status === currentMakerStatus
    );
    const totalLiquidity = displayedMakers.reduce(
      (sum, m) => sum + m.maxSize,
      0
    );
    const avgFee =
      displayedMakers.length > 0
        ? displayedMakers.reduce((sum, m) => sum + parseFloat(m.volumeFee), 0) /
          displayedMakers.length
        : 0;

    return {
      totalLiquidity: (totalLiquidity / 100000000).toFixed(2),
      avgFee: avgFee.toFixed(1),
      onlineMakers: displayedMakers.length,
    };
  }

  window.viewFidelityBond = (makerAddress) => {
    const maker = makers.find((m) => m.address === makerAddress);
    if (!maker || !maker.bondTxid) {
      alert('No fidelity bond data available');
      return;
    }

    const modal = document.createElement('div');
    modal.className =
      'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    const locktimeDays = maker.bondLocktime
      ? Math.floor(maker.bondLocktime / 144)
      : 0;

    const certExpiryDays = maker.bondCertExpiry
      ? Math.floor((maker.bondCertExpiry * 2016) / 144)
      : null;

    modal.innerHTML = `
      <div class="bg-[#1a2332] rounded-lg p-6 max-w-3xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="flex justify-between items-start mb-6">
          <h3 class="text-2xl font-bold text-[#FF6B35]">Fidelity Bond Details</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div class="space-y-4">
          <div class="bg-[#0f1419] p-4 rounded-lg">
            <p class="text-sm text-gray-400 mb-1">Maker Address</p>
            <p class="text-white font-mono text-sm break-all">${maker.address}</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-[#0f1419] p-4 rounded-lg">
              <p class="text-sm text-gray-400 mb-1">Bond Amount</p>
              <p class="text-2xl font-mono text-purple-400">${maker.bond.toLocaleString()} sats</p>
              <p class="text-xs text-gray-500 mt-1">${(maker.bond / 100000000).toFixed(8)} BTC</p>
            </div>

            <div class="bg-[#0f1419] p-4 rounded-lg">
              <p class="text-sm text-gray-400 mb-1">Bond Status</p>
              <p class="text-2xl font-mono ${maker.bondIsSpent ? 'text-red-400' : 'text-green-400'}">
                ${maker.bondIsSpent ? '❌ Spent' : '✅ Active'}
              </p>
            </div>
          </div>

          <div class="bg-[#0f1419] p-4 rounded-lg">
            <p class="text-sm text-gray-400 mb-1">Bond Outpoint (UTXO)</p>
            <p class="text-white font-mono text-sm break-all">${maker.bondOutpoint}</p>
            <div class="flex gap-2 mt-2 text-xs">
              <span class="text-gray-400">Txid: <span class="text-cyan-400">${maker.bondTxid}</span></span>
              <span class="text-gray-400">Vout: <span class="text-cyan-400">${maker.bondVout}</span></span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-[#0f1419] p-4 rounded-lg">
              <p class="text-sm text-gray-400 mb-1">Bond Locktime</p>
              <p class="text-lg font-mono text-yellow-400">${maker.bondLocktime.toLocaleString()} blocks</p>
              <p class="text-xs text-gray-500 mt-1">~${locktimeDays} days</p>
            </div>

            <div class="bg-[#0f1419] p-4 rounded-lg">
              <p class="text-sm text-gray-400 mb-1">Confirmation Height</p>
              <p class="text-lg font-mono text-blue-400">
                ${maker.bondConfHeight !== null ? maker.bondConfHeight.toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          ${
            maker.bondCertExpiry !== null
              ? `
          <div class="bg-[#0f1419] p-4 rounded-lg">
            <p class="text-sm text-gray-400 mb-1">Certificate Expiry</p>
            <p class="text-lg font-mono text-orange-400">${maker.bondCertExpiry} difficulty periods</p>
            <p class="text-xs text-gray-500 mt-1">${maker.bondCertExpiry * 2016} blocks (~${certExpiryDays} days)</p>
          </div>
          `
              : ''
          }

          ${
            maker.bondPubkey
              ? `
          <div class="bg-[#0f1419] p-4 rounded-lg">
            <p class="text-sm text-gray-400 mb-1">Bond Public Key</p>
            <p class="text-white font-mono text-xs break-all">${maker.bondPubkey}</p>
          </div>
          `
              : ''
          }

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-[#0f1419] p-4 rounded-lg">
              <p class="text-sm text-gray-400 mb-1">Required Confirmations</p>
              <p class="text-lg font-mono text-blue-400">${maker.requiredConfirms}</p>
            </div>

            <div class="bg-[#0f1419] p-4 rounded-lg">
              <p class="text-sm text-gray-400 mb-1">Minimum Locktime</p>
              <p class="text-lg font-mono text-yellow-400">${maker.minimumLocktime} blocks</p>
              <p class="text-xs text-gray-500 mt-1">~${Math.floor(maker.minimumLocktime / 144)} days</p>
            </div>
          </div>

          <div class="bg-[#0f1419] p-4 rounded-lg">
            <p class="text-sm text-gray-400 mb-2">Transaction Details</p>
            <button 
              onclick="window.open('https://mutinynet.com/tx/${maker.bondTxid}', '_blank')"
              class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded-lg font-semibold text-lg transition-colors">
              View on Block Explorer →
            </button>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button onclick="this.closest('.fixed').remove()" 
            class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold text-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  function updateUI() {
    const stats = calculateStats();
    const tableBody = content.querySelector('#maker-table-body');
    const statsContainer = content.querySelector('#market-stats');

    // Update sync status display
    const syncStatusDiv = content.querySelector('#sync-status');
    if (syncStatusDiv) {
      syncStatusDiv.innerHTML = `
      <div class="text-sm text-gray-400">
        <span class="text-gray-400">Market Data:</span>
        <span class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold text-lg ml-2">
          ${makers.length} makers available
        </span>
      </div>
    `;
    }

    // Update progress bar - SHOW WHILE LOADING
    const progressContainer = content.querySelector('#sync-progress-container');
    if (progressContainer) {
      if (isLoading) {
        // ✅ SHOW LOADING ANIMATION
        progressContainer.classList.remove('hidden');
        progressContainer.innerHTML = `
        <div class="bg-[#0f1419] rounded-lg p-6 border border-blue-500/30">
          <div class="flex items-center justify-between mb-4">
            <span class="text-lg font-semibold text-lg text-blue-400">
              🔄 Syncing Market Data...
            </span>
            <span class="text-sm text-gray-400">
              Please wait
            </span>
          </div>
          
          <div class="bg-gray-700 rounded-full h-4 overflow-hidden mb-4">
            <div class="bg-gradient-to-r from-[#FF6B35] via-[#ff7d4d] to-[#FF6B35] h-4 rounded-full animate-pulse"
                 style="width: 100%; animation: shimmer 2s infinite linear;">
            </div>
          </div>
          
          <div class="flex items-center justify-center text-sm text-cyan-400">
            <svg class="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Discovering makers over Tor network...
          </div>
        </div>
      `;
      } else if (
        syncProgress &&
        (syncProgress.status === 'syncing' ||
          syncProgress.status === 'starting')
      ) {
        progressContainer.classList.remove('hidden');
        progressContainer.innerHTML = `
        <div class="bg-[#0f1419] rounded-lg p-4 border border-blue-500/30">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold text-lg text-blue-400">
              ${syncProgress.message || 'Syncing market data...'}
            </span>
            <span class="text-sm text-gray-400">
              Please wait...
            </span>
          </div>
          
          <div class="bg-gray-700 rounded-full h-3 overflow-hidden">
            <div class="bg-gradient-to-r from-[#FF6B35] to-[#ff7d4d] h-3 rounded-full transition-all duration-500 relative animate-pulse"
                 style="width: 100%">
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          
          <div class="flex items-center justify-center text-xs text-gray-400 mt-2">
            <div class="text-cyan-400">
              🔍 Discovering makers over Tor network...
            </div>
          </div>
        </div>
      `;
      } else {
        progressContainer.classList.add('hidden');
      }
    }

    if (statsContainer) {
      statsContainer.innerHTML = `
      <div class="bg-[#1a2332] rounded-lg p-6">
        <p class="text-sm text-gray-400 mb-2">Total Liquidity</p>
        <p class="text-2xl font-mono text-[#FF6B35]">${stats.totalLiquidity} BTC</p>
      </div>
      <div class="bg-[#1a2332] rounded-lg p-6">
        <p class="text-sm text-gray-400 mb-2">Average Fee</p>
        <p class="text-2xl font-mono text-green-400">${stats.avgFee}%</p>
      </div>
      <div class="bg-[#1a2332] rounded-lg p-6">
        <p class="text-sm text-gray-400 mb-2">Online Makers</p>
        <p class="text-2xl font-mono text-blue-400">${stats.onlineMakers}</p>
      </div>
    `;
    }

    // Update tab counts
    const goodCount = content.querySelector('#good-count');
    const badCount = content.querySelector('#bad-count');
    const unresponsiveCount = content.querySelector('#unresponsive-count');

    if (goodCount)
      goodCount.textContent = makers.filter((m) => m.status === 'good').length;
    if (badCount)
      badCount.textContent = makers.filter((m) => m.status === 'bad').length;
    if (unresponsiveCount)
      unresponsiveCount.textContent = makers.filter(
        (m) => m.status === 'unresponsive'
      ).length;

    if (tableBody) {
      if (isLoading) {
        // ✅ SHOW BIG LOADING SPINNER IN TABLE
        tableBody.innerHTML = `
        <div class="col-span-9 text-center py-16">
          <div class="inline-block">
            <svg class="animate-spin h-16 w-16 text-[#FF6B35] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p class="text-gray-400 text-lg font-semibold text-lg mb-2">Syncing Market Data...</p>
          <p class="text-gray-500 text-sm">Fetching makers over Tor network</p>
        </div>
      `;
      } else if (makers.length === 0) {
        tableBody.innerHTML = `
        <div class="col-span-9 text-center py-12">
          <p class="text-gray-400 mb-4">No makers found</p>
          <button onclick="document.querySelector('#refresh-market-btn').click()" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded-lg">
            Sync Market Data
          </button>
        </div>
      `;
      } else {
        const displayedMakers = makers.filter(
          (m) => m.status === currentMakerStatus
        );

        if (displayedMakers.length === 0) {
          tableBody.innerHTML = `
          <div class="col-span-9 text-center py-12">
            <p class="text-gray-400">No ${currentMakerStatus} makers found</p>
          </div>
        `;
        } else {
          tableBody.innerHTML = displayedMakers
            .map(
              (maker) => `
          <div class="grid grid-cols-9 gap-4 p-4 hover:bg-[#242d3d] transition-colors">
            
            <div class="text-sm">
              <span class="px-2 py-1 ${
                maker.protocol === 'Taproot'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-blue-500/20 text-blue-400'
              } rounded text-xs font-semibold text-lg">
                ${maker.protocol === 'Taproot' ? '⚡ Taproot' : '🔒 Legacy'}
              </span>
            </div>
            <div class="text-gray-300 font-mono text-sm truncate" title="${maker.address}">${maker.address.substring(0, 18)}...</div>
            <div class="text-green-400">${maker.baseFee}</div>
            <div class="text-blue-400">${maker.volumeFee}%</div>
            <div class="text-cyan-400">${maker.timeFee}%</div>
            <div class="text-yellow-400">${maker.minSize.toLocaleString()}</div>
<div class="text-yellow-400">${maker.maxSize < 1000000 ? maker.maxSize.toLocaleString() : (maker.maxSize / 1000000).toFixed(1) + 'M'}</div>
            <div onclick="window.viewFidelityBond('${maker.address}')" class="text-purple-400 cursor-pointer hover:text-purple-300 hover:underline transition-colors">
              ${maker.bond > 0 ? maker.bond.toLocaleString() : 'N/A'}
            </div>
          </div>
        `
            )
            .join('');
        }
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
      const displayedCount = makers.filter(
        (m) => m.status === currentMakerStatus
      ).length;
      footer.innerHTML = `Showing ${displayedCount} ${currentMakerStatus} offers • ${timeStr}`;
    }
  }

  content.innerHTML = `
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap Market</h2>
        <p class="text-gray-400">Live view of the current coinswap market</p>
      </div>
      <button id="refresh-market-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-6 py-3 rounded-lg font-semibold text-lg transition-colors">
        🔄 Sync Market Data
      </button>
    </div>

     <div id="protocol-banner" class="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-lg p-4 mb-6 hidden">
      <div class="flex items-center gap-3">
        <span class="text-3xl">⚠️</span>
        <div>
          <h3 class="text-lg font-bold text-yellow-400 mb-1" id="protocol-warning-title"></h3>
          <p class="text-sm text-gray-300" id="protocol-warning-text"></p>
        </div>
      </div>
    </div>


    <!-- Sync Status Display -->
    <div class="bg-[#1a2332] rounded-lg p-4 mb-4">
      <div id="sync-status"></div>
    </div>

    <!-- Progress Bar -->
    <div id="sync-progress-container" class="mb-4 hidden"></div>

    <div class="bg-[#1a2332] rounded-lg p-6 mb-6">
      <div class="flex items-start gap-3">
        <span class="text-2xl">ℹ️</span>
        <div>
          <h3 class="text-lg font-semibold text-lg text-[#FF6B35] mb-2">Fee Calculation</h3>
          <p class="text-gray-300 mb-2">Total fee for a swap is calculated as:</p>
          <code class="block bg-[#0f1419] p-3 rounded text-green-400 font-mono text-sm">
            Total Fee = Base Fee + (Swap Amount × % Fee Rate) + (Refund Lock Time × Swap Amount × % Time Rate)
          </code>
          <p class="text-gray-400 text-sm mt-2">
            Lower fees mean cheaper swaps, but may indicate lower liquidity or reputation.
          </p>
        </div>
      </div>
    </div>

    <div id="market-stats" class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-[#1a2332] rounded-lg p-6">
        <p class="text-sm text-gray-400 mb-2">Total Liquidity</p>
        <p class="text-2xl font-mono text-[#FF6B35]">0.00 BTC</p>
      </div>
      <div class="bg-[#1a2332] rounded-lg p-6">
        <p class="text-sm text-gray-400 mb-2">Average Fee</p>
        <p class="text-2xl font-mono text-green-400">0.0%</p>
      </div>
      <div class="bg-[#1a2332] rounded-lg p-6">
        <p class="text-sm text-gray-400 mb-2">Online Makers</p>
        <p class="text-2xl font-mono text-blue-400">0</p>
      </div>
    </div>

    <div class="bg-[#1a2332] rounded-lg overflow-hidden">
      <!-- Maker Status Tabs -->
      <div class="flex border-b-2 border-[#FF6B35]">
  <button id="tab-good" class="flex-1 px-6 py-4 font-semibold text-lg bg-[#FF6B35] text-white border-b-4 border-[#FF6B35] transition-all">
    ✅ Good Makers (<span id="good-count">0</span>)
  </button>
  <button id="tab-bad" class="flex-1 px-6 py-4 font-semibold text-lg bg-[#1a2332] text-gray-400 border-b-4 border-transparent hover:text-white hover:border-gray-600 transition-all">
    ❌ Bad Makers (<span id="bad-count">0</span>)
  </button>
  <button id="tab-unresponsive" class="flex-1 px-6 py-4 font-semibold text-lg bg-[#1a2332] text-gray-400 border-b-4 border-transparent hover:text-white hover:border-gray-600 transition-all">
    ⏸️ Unresponsive (<span id="unresponsive-count">0</span>)
  </button>
</div>

      

      <div class="grid grid-cols-9 gap-4 bg-[#FF6B35] p-4">
        <div class="font-semibold text-lg">Protocol</div>
        <div class="font-semibold text-lg">Maker Address</div>
        <div class="font-semibold text-lg">Base Fee</div>
        <div class="font-semibold text-lg">% Fee Rate</div>
        <div class="font-semibold text-lg">% Time Rate</div>
        <div class="font-semibold text-lg">Min Swap Size</div>
        <div class="font-semibold text-lg">Max Swap Size</div>
        <div class="font-semibold text-lg">Fidelity Bond</div>
      </div>

      <div id="maker-table-body" class="divide-y divide-gray-700">
        <div class="col-span-9 text-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B35] mx-auto mb-4"></div>
          <p class="text-gray-400">Loading makers...</p>
        </div>
      </div>

      <div id="market-footer" class="p-4 text-center text-gray-400 text-sm border-t border-gray-700">
        Loading...
      </div>
    </div>
  `;

  container.appendChild(content);

  // Event listeners
  content
    .querySelector('#refresh-market-btn')
    .addEventListener('click', handleRefresh);
  // Tab switching
  function switchTab(status) {
    currentMakerStatus = status;

    // Update tab styling
    ['good', 'bad', 'unresponsive'].forEach((s) => {
      const tab = content.querySelector(`#tab-${s}`);
      if (s === status) {
        tab.classList.add('bg-[#FF6B35]', 'text-white', 'border-[#FF6B35]');
        tab.classList.remove(
          'bg-[#1a2332]',
          'text-gray-400',
          'border-transparent'
        );
      } else {
        tab.classList.remove('bg-[#FF6B35]', 'text-white', 'border-[#FF6B35]');
        tab.classList.add(
          'bg-[#1a2332]',
          'text-gray-400',
          'border-transparent'
        );
      }
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

  initialize();
  startSyncStateMonitor();

  // Clean up
  window.addEventListener('beforeunload', () => {
    if (syncCheckInterval) {
      clearInterval(syncCheckInterval);
      syncCheckInterval = null;
    }
  });
}
