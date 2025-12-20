export function Market(container) {
  const content = document.createElement('div');
  content.id = 'market-content';

  // STATE
  let makers = [];
  let selectedMakers = [];
  let isLoading = true;
  let syncProgress = null;
  let lastSyncedHeight = null;
  let currentHeight = null;

  // API FUNCTIONS
  async function fetchMakers() {
    try {
      console.log('📡 Fetching makers from API...');
      isLoading = true;
      updateUI();

      const data = await window.api.taker.getOffers();

      if (data.success && data.offerbook) {
        const goodMakers = data.offerbook.goodMakers || [];

        makers = goodMakers.map((item, index) => {
          const offer = item.offer;
          const addressObj = item.address || {};
          const onionAddr = addressObj.onion_addr || '';
          const port = addressObj.port || '6102';
          const fullAddress = `${onionAddr}:${port}`;

          // Extract full fidelity bond data
          const fidelity = offer.fidelity || {};
          const bond = fidelity.bond || {};
          const outpoint = bond.outpoint || '';

          return {
            address: fullAddress,
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
        });

        console.log('✅ Loaded', makers.length, 'makers');
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

  async function makeRPCCall(method, params = []) {
    // Get RPC config from localStorage (same as Settings.js)
    const savedConfig = localStorage.getItem('coinswap_config');
    if (!savedConfig) {
      throw new Error('No RPC configuration found');
    }
    
    const config = JSON.parse(savedConfig);
    const host = config.rpc?.host || '127.0.0.1';
    const port = config.rpc?.port || 38332;
    const username = config.rpc?.username || 'user';
    const password = config.rpc?.password || 'password';

    if (!username || !password) {
      throw new Error('RPC username and password are required');
    }

    const url = `http://${host}:${port}`;
    const auth = btoa(`${username}:${password}`);

    const body = {
      jsonrpc: '1.0',
      id: Date.now(),
      method: method,
      params: params,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`);
    }

    return data.result;
  }

  async function updateSyncHeights() {
    try {
      // Get current blockchain height from Bitcoin Core via RPC (same as Settings.js)
      const blockchainInfo = await makeRPCCall('getblockchaininfo');
      
      if (blockchainInfo && blockchainInfo.blocks) {
        currentHeight = blockchainInfo.blocks;
      }

      // For lastSyncedHeight, we can check the offerbook file timestamp
      // or just assume it's current if recently synced
      lastSyncedHeight = currentHeight; // Will be updated after sync completes
      
    } catch (error) {
      console.error('Failed to update heights:', error);
      // Don't throw - just set nulls
      currentHeight = null;
      lastSyncedHeight = null;
    }
  }

  async function syncOfferbook() {
    try {
        // Check if sync is already running
        const activeSyncId = localStorage.getItem('active_sync_id');
        if (activeSyncId) {
            const status = await window.api.taker.getSyncStatus(activeSyncId);
            if (status.success && (status.sync.status === 'syncing' || status.sync.status === 'starting')) {
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
            const startTime = Date.now();
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
                        percent: 50, // Default to 50% during sync
                        status: sync.status,
                        message: sync.status === 'syncing' ? 'Discovering makers...' : 'Starting...'
                    };
                    
                    // If we have actual progress data from backend, use it
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
                        lastSyncedHeight = syncProgress?.targetHeight || currentHeight;
                        syncProgress = null;
                        console.log('✅ Offerbook synced');
                        await new Promise((r) => setTimeout(r, 1000));
                        await fetchMakers();
                        await updateSyncHeights();
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
            if (status.success && (status.sync.status === 'syncing' || status.sync.status === 'starting')) {
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

    try {
        await syncOfferbook();
        refreshBtn.innerHTML = '✅ Synced!';
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalText;
        }, 2000);
    } catch (error) {
        refreshBtn.innerHTML = '❌ Failed';
        showError(error.message);
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalText;
        }, 3000);
    }
}

async function initialize() {
    const activeSyncId = localStorage.getItem('active_sync_id');
    if (activeSyncId) {
        try {
            const status = await window.api.taker.getSyncStatus(activeSyncId);
            if (status.success && (status.sync.status === 'syncing' || status.sync.status === 'starting')) {
                const refreshBtn = content.querySelector('#refresh-market-btn');
                if (refreshBtn) {
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '<span class="animate-pulse">Syncing...</span>';
                }
                
                monitorExistingSync(activeSyncId);
            } else {
                localStorage.removeItem('active_sync_id');
            }
        } catch (err) {
            localStorage.removeItem('active_sync_id');
        }
    }

    await updateSyncHeights();
    await fetchMakers();
}

async function monitorExistingSync(syncId) {
    const refreshBtn = content.querySelector('#refresh-market-btn');
    const originalText = '🔄 Sync Market Data';
    const startTime = Date.now();

    const pollInterval = setInterval(async () => {
        try {
            const status = await window.api.taker.getSyncStatus(syncId);

            if (!status.success) {
                clearInterval(pollInterval);
                localStorage.removeItem('active_sync_id');
                syncProgress = null;
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = originalText;
                }
                updateUI();
                return;
            }

            const sync = status.sync;

            // Update progress - simplified
            if (sync.status === 'syncing' || sync.status === 'starting') {
                syncProgress = {
                    percent: sync.progress || 50,
                    status: sync.status,
                    message: sync.message || (sync.status === 'syncing' ? 'Discovering makers...' : 'Starting...')
                };
                updateUI();
            }

            if (sync.status === 'completed') {
                clearInterval(pollInterval);
                localStorage.removeItem('active_sync_id');
                lastSyncedHeight = syncProgress?.targetHeight || currentHeight;
                syncProgress = null;
                await fetchMakers();
                await updateSyncHeights();
                if (refreshBtn) {
                    refreshBtn.innerHTML = '✅ Synced!';
                    setTimeout(() => {
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = originalText;
                    }, 2000);
                }
            } else if (sync.status === 'failed') {
                clearInterval(pollInterval);
                localStorage.removeItem('active_sync_id');
                syncProgress = null;
                updateUI();
                if (refreshBtn) {
                    refreshBtn.innerHTML = '❌ Failed';
                    setTimeout(() => {
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = originalText;
                    }, 3000);
                }
            }
        } catch (error) {
            clearInterval(pollInterval);
            localStorage.removeItem('active_sync_id');
            syncProgress = null;
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalText;
            }
            updateUI();
        }
    }, 1000);
}

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className =
      'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
    errorDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="text-xl">❌</span>
                <div class="flex-1">
                    <div class="font-semibold mb-1">Error</div>
                    <div class="text-sm">${message}</div>
                </div>
            </div>
        `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  function calculateStats() {
    const totalLiquidity = makers.reduce((sum, m) => sum + m.maxSize, 0);
    const avgFee =
      makers.length > 0
        ? makers.reduce((sum, m) => sum + parseFloat(m.volumeFee), 0) /
          makers.length
        : 0;

    return {
      totalLiquidity: (totalLiquidity / 100000000).toFixed(2),
      avgFee: avgFee.toFixed(1),
      onlineMakers: makers.length,
    };
  }

  function formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  window.viewFidelityBond = (makerAddress) => {
    const maker = makers.find(m => m.address === makerAddress);
    if (!maker || !maker.bondTxid) {
        alert('No fidelity bond data available');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    const locktimeDays = maker.bondLocktime ? Math.floor(maker.bondLocktime / 144) : 0;
    const certExpiryDays = maker.bondCertExpiry ? Math.floor((maker.bondCertExpiry * 2016) / 144) : null;

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

                ${maker.bondCertExpiry !== null ? `
                <div class="bg-[#0f1419] p-4 rounded-lg">
                    <p class="text-sm text-gray-400 mb-1">Certificate Expiry</p>
                    <p class="text-lg font-mono text-orange-400">${maker.bondCertExpiry} difficulty periods</p>
                    <p class="text-xs text-gray-500 mt-1">${maker.bondCertExpiry * 2016} blocks (~${certExpiryDays} days)</p>
                </div>
                ` : ''}

                ${maker.bondPubkey ? `
                <div class="bg-[#0f1419] p-4 rounded-lg">
                    <p class="text-sm text-gray-400 mb-1">Bond Public Key</p>
                    <p class="text-white font-mono text-xs break-all">${maker.bondPubkey}</p>
                </div>
                ` : ''}

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
                        onclick="window.open('https://mempool.space/signet/tx/${maker.bondTxid}', '_blank')"
                        class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        View on Block Explorer →
                    </button>
                </div>
            </div>

            <div class="mt-6 flex justify-end">
                <button onclick="this.closest('.fixed').remove()" 
                    class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

  function toggleMakerSelection(index) {
    const makerIndex = selectedMakers.indexOf(index);
    if (makerIndex > -1) {
      selectedMakers.splice(makerIndex, 1);
    } else {
      selectedMakers.push(index);
    }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    makers.forEach((_, index) => {
      const checkbox = content.querySelector(`#maker-${index}`);
      if (checkbox) {
        checkbox.checked = selectedMakers.includes(index);
      }
    });

    const selectAllCheckbox = content.querySelector('#select-all-makers');
    if (selectAllCheckbox) {
      if (selectedMakers.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (selectedMakers.length === makers.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }

    const actionButtons = content.querySelector('#maker-actions');
    const selectedCount = content.querySelector('#selected-makers-count');

    if (selectedMakers.length > 0) {
      actionButtons.classList.remove('hidden');
      selectedCount.textContent = selectedMakers.length;
    } else {
      actionButtons.classList.add('hidden');
    }
  }

  function selectAllMakers() {
    const selectAllCheckbox = content.querySelector('#select-all-makers');
    if (selectAllCheckbox.checked) {
      selectedMakers = makers.map((_, index) => index);
    } else {
      selectedMakers = [];
    }
    updateSelectionUI();
  }

  function swapWithSelectedMakers() {
    if (selectedMakers.length === 0) {
      alert('Please select at least one maker');
      return;
    }

    const selectedMakerData = selectedMakers.map((index) => makers[index]);
    console.log(
      '🔄 Starting swap with',
      selectedMakerData.length,
      'makers:',
      selectedMakerData
    );

    import('./Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container, null, selectedMakerData);
    });
  }

  function updateUI() {
    const stats = calculateStats();
    const tableBody = content.querySelector('#maker-table-body');
    const statsContainer = content.querySelector('#market-stats');

    // Update sync status display
    const syncStatusDiv = content.querySelector('#sync-status');
    if (syncStatusDiv) {
        if (currentHeight !== null) {
            const lastSynced = lastSyncedHeight || currentHeight;
            const needsSync = currentHeight > lastSynced;
            const heightDiff = currentHeight - lastSynced;
            
            syncStatusDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="text-sm">
                            <span class="text-gray-400">Last Synced:</span>
                            <span class="font-mono text-cyan-400">${lastSynced.toLocaleString()}</span>
                        </div>
                        <div class="text-sm">
                            <span class="text-gray-400">Current:</span>
                            <span class="font-mono text-blue-400">${currentHeight.toLocaleString()}</span>
                        </div>
                        ${needsSync ? `
                            <div class="text-sm">
                                <span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold">
                                    ${heightDiff} blocks behind
                                </span>
                            </div>
                        ` : `
                            <div class="text-sm">
                                <span class="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                                    ✓ Up to date
                                </span>
                            </div>
                        `}
                    </div>
                </div>
            `;
        } else {
            syncStatusDiv.innerHTML = `
                <div class="text-sm text-gray-400">
                    <span class="text-gray-400">Market Data:</span>
                    <span class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold ml-2">
                        ${makers.length} makers available
                    </span>
                </div>
            `;
        }
    }

    // Update progress bar - simplified
    const progressContainer = content.querySelector('#sync-progress-container');
    if (progressContainer) {
        if (syncProgress && (syncProgress.status === 'syncing' || syncProgress.status === 'starting')) {
            progressContainer.classList.remove('hidden');
            progressContainer.innerHTML = `
                <div class="bg-[#0f1419] rounded-lg p-4 border border-blue-500/30">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-semibold text-blue-400">
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

    if (tableBody) {
      if (isLoading) {
        tableBody.innerHTML = `
                    <div class="col-span-8 text-center py-12">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B35] mx-auto mb-4"></div>
                        <p class="text-gray-400">Loading makers...</p>
                    </div>
                `;
      } else if (makers.length === 0) {
        tableBody.innerHTML = `
                    <div class="col-span-8 text-center py-12">
                        <p class="text-gray-400 mb-4">No makers found</p>
                    </div>
                `;

        setTimeout(() => {
          const retryBtn = content.querySelector('#retry-fetch');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => fetchMakers());
          }
        }, 100);
      } else {
        tableBody.innerHTML = makers
          .map(
            (maker, index) => `
                    <div class="grid grid-cols-8 gap-4 p-4 hover:bg-[#242d3d] transition-colors">
                        <div class="flex items-center">
                            <input type="checkbox" id="maker-${index}" class="w-4 h-4 accent-[#FF6B35]" />
                        </div>
                        <div class="text-gray-300 font-mono text-sm truncate" title="${maker.address}">${maker.address.substring(0, 20)}...</div>
                        <div class="text-green-400">${maker.baseFee}</div>
                        <div class="text-blue-400">${maker.volumeFee}%</div>
                        <div class="text-cyan-400">${maker.timeFee}%</div>
                        <div class="text-yellow-400">${maker.minSize.toLocaleString()}</div>
                        <div class="text-yellow-400">${(maker.maxSize / 1000000).toFixed(1)}M</div>
                        <div onclick="window.viewFidelityBond('${maker.address}')" class="text-purple-400 cursor-pointer hover:text-purple-300 hover:underline transition-colors">
                            ${maker.bond > 0 ? maker.bond.toLocaleString() : 'N/A'}
                        </div>
                    </div>
                `
          )
          .join('');

        makers.forEach((_, index) => {
          const checkbox = content.querySelector(`#maker-${index}`);
          if (checkbox) {
            checkbox.addEventListener('change', () =>
              toggleMakerSelection(index)
            );
          }
        });
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
      footer.innerHTML = `Showing ${makers.length} active offers • ${timeStr}`;
    }
  }

  content.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap Market</h2>
                <p class="text-gray-400">Live view of the current coinswap market</p>
            </div>
            <button id="refresh-market-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                🔄 Sync Market Data
            </button>
        </div>

        <!-- Sync Status Display -->
        <div class="bg-[#1a2332] rounded-lg p-4 mb-4">
            <div id="sync-status"></div>
        </div>

        <!-- Progress Bar (hidden by default) -->
        <div id="sync-progress-container" class="mb-4 hidden"></div>

        <div class="bg-[#1a2332] rounded-lg p-6 mb-6">
            <div class="flex items-start gap-3">
                <span class="text-2xl">ℹ️</span>
                <div>
                    <h3 class="text-lg font-semibold text-[#FF6B35] mb-2">Fee Calculation</h3>
                    <p class="text-gray-300 mb-2">Total fee for a swap is calculated as:</p>
                    <code class="block bg-[#0f1419] p-3 rounded text-green-400 font-mono text-sm">
                        Total Fee = Base Fee + (Amount × Volume Fee %) + (Locktime × Time Fee %)
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
            <div id="maker-actions" class="hidden bg-[#FF6B35] p-4 flex justify-between items-center">
                <span class="text-white font-semibold">
                    <span id="selected-makers-count">0</span> makers selected
                </span>
                <button id="swap-with-makers" class="bg-white text-[#FF6B35] px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                    Swap with Selected →
                </button>
            </div>

            <div class="grid grid-cols-8 gap-4 bg-[#FF6B35] p-4">
                <div class="flex items-center">
                    <input type="checkbox" id="select-all-makers" class="w-4 h-4 accent-[#FF6B35] mr-2" />
                    <span class="font-semibold text-sm">Select</span>
                </div>
                <div class="font-semibold">Maker Address</div>
                <div class="font-semibold">Fixed Fee</div>
                <div class="font-semibold">% Fee</div>
                <div class="font-semibold">Timelock Fee</div>
                <div class="font-semibold">Min Swap Size</div>
                <div class="font-semibold">Max Swap Size</div>
                <div class="font-semibold">Fidelity Bond</div>
            </div>

            <div id="maker-table-body" class="divide-y divide-gray-700">
                <div class="col-span-8 text-center py-12">
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

  content
    .querySelector('#refresh-market-btn')
    .addEventListener('click', handleRefresh);
  content
    .querySelector('#select-all-makers')
    .addEventListener('change', selectAllMakers);
  content
    .querySelector('#swap-with-makers')
    .addEventListener('click', swapWithSelectedMakers);

  initialize();
}