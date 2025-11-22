export function Market(container) {
    const content = document.createElement('div');
    content.id = 'market-content';

    // STATE
    let makers = [];
    let selectedMakers = [];
    let isLoading = true;

    // API FUNCTIONS
    async function fetchMakers() {
        try {
            console.log('📡 Fetching makers from API...');
            isLoading = true;
            updateUI();

            // IPC call to get offers
            const data = await window.api.taker.getOffers();

            if (data.success && data.offerbook) {
                const goodMakers = data.offerbook.goodMakers || [];
                
                makers = goodMakers.map((item, index) => {
                    const offer = item.offer;
                    const addressObj = item.address || {};
                    const onionAddr = addressObj.onion_addr || '';
                    const port = addressObj.port || '6102';
                    const fullAddress = `${onionAddr}:${port}`;
                    
                    return {
                        address: fullAddress,
                        baseFee: offer.baseFee || 0,
                        volumeFee: (offer.amountRelativeFeePct || 0).toFixed(2),
                        timeFee: (offer.timeRelativeFeePct || 0).toFixed(2),
                        minSize: offer.minSize || 0,
                        maxSize: offer.maxSize || 0,
                        bond: offer.fidelity?.bond?.amount || 0,
                        bondTxid: offer.fidelity?.bond?.outpoint?.split(':')[0] || '',
                        requiredConfirms: offer.requiredConfirms || 0,
                        minimumLocktime: offer.minimumLocktime || 0,
                        index: index
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

    async function syncOfferbook() {
        try {
            console.log('🔄 Starting offerbook sync...');

            // IPC call to start sync in worker thread
            const result = await window.api.taker.syncOfferbook();

            if (!result.success) {
                throw new Error(result.error || 'Failed to start sync');
            }

            const syncId = result.syncId;
            console.log('📡 Sync started:', syncId);

            // Poll for completion (timeout after 2 minutes)
            const timeout = 120000; // 2 minutes
            const startTime = Date.now();

            return new Promise((resolve, reject) => {
                const pollInterval = setInterval(async () => {
                    try {
                        // Check timeout
                        if (Date.now() - startTime > timeout) {
                            clearInterval(pollInterval);
                            reject(new Error('Sync timeout - operation took too long'));
                            return;
                        }

                        const status = await window.api.taker.getSyncStatus(syncId);

                        if (!status.success) {
                            clearInterval(pollInterval);
                            reject(new Error('Failed to get sync status'));
                            return;
                        }

                        const sync = status.sync;
                        console.log('📊 Sync status:', sync.status);

                        if (sync.status === 'completed') {
                            clearInterval(pollInterval);
                            console.log('✅ Offerbook synced');
                            // Wait a moment for file to be written
                            await new Promise(r => setTimeout(r, 1000));
                            await fetchMakers();
                            resolve();
                        } else if (sync.status === 'failed') {
                            clearInterval(pollInterval);
                            reject(new Error(sync.error || 'Sync failed'));
                        }
                    } catch (error) {
                        clearInterval(pollInterval);
                        reject(error);
                    }
                }, 1000); // Poll every second
            });
        } catch (error) {
            console.error('❌ Sync failed:', error);
            throw error;
        }
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
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
        const avgFee = makers.length > 0 
            ? makers.reduce((sum, m) => sum + parseFloat(m.volumeFee), 0) / makers.length 
            : 0;
        
        return {
            totalLiquidity: (totalLiquidity / 100000000).toFixed(2),
            avgFee: avgFee.toFixed(1),
            onlineMakers: makers.length,
            avgResponse: '2.3'
        };
    }

    window.viewFidelityBond = (makerAddress) => {
        const maker = makers.find(m => m.address === makerAddress);
        if (maker && maker.bondTxid) {
            const url = `https://mempool.space/signet/tx/${maker.bondTxid}`;
            window.open(url, '_blank');
        }
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

        const selectedMakerData = selectedMakers.map(index => makers[index]);
        console.log('🔄 Starting swap with', selectedMakerData.length, 'makers:', selectedMakerData);
        
        import('./Swap.js').then((module) => {
            container.innerHTML = '';
            module.SwapComponent(container, null, selectedMakerData);
        });
    }

    function updateUI() {
        const stats = calculateStats();
        const tableBody = content.querySelector('#maker-table-body');
        const statsContainer = content.querySelector('#market-stats');

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
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Avg Response</p>
                    <p class="text-2xl font-mono text-cyan-400">${stats.avgResponse}s</p>
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
                        <button id="retry-fetch" class="bg-[#FF6B35] text-white px-6 py-2 rounded-lg hover:bg-[#ff7d4d]">
                            Refresh
                        </button>
                    </div>
                `;
                
                setTimeout(() => {
                    const retryBtn = content.querySelector('#retry-fetch');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', () => fetchMakers());
                    }
                }, 100);
            } else {
                tableBody.innerHTML = makers.map((maker, index) => `
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
                `).join('');

                makers.forEach((_, index) => {
                    const checkbox = content.querySelector(`#maker-${index}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => toggleMakerSelection(index));
                    }
                });
            }
        }

        const footer = content.querySelector('#market-footer');
        if (footer) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            footer.innerHTML = `Showing ${makers.length} active offers • ${timeStr}`;
        }
    }

    async function handleRefresh() {
        const refreshBtn = content.querySelector('#refresh-market-btn');
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
            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalText;
            }, 3000);
        }
    }
    
    content.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap Market</h2>
                <p class="text-gray-400">Live market offers with competitive rates</p>
            </div>
            <button id="refresh-market-btn" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                🔄 Refresh Market
            </button>
        </div>

        <div id="market-stats" class="grid grid-cols-4 gap-4 mb-6">
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
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Avg Response</p>
                <p class="text-2xl font-mono text-cyan-400">0.0s</p>
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
                <div>
                    <div class="font-semibold">Address</div>
                    <div class="text-sm opacity-80">Maker Address</div>
                </div>
                <div>
                    <div class="font-semibold">Base Fee</div>
                    <div class="text-sm opacity-80">Fixed Fee</div>
                </div>
                <div>
                    <div class="font-semibold">Amount</div>
                    <div class="text-sm opacity-80">Volume Fee</div>
                </div>
                <div>
                    <div class="font-semibold">Time</div>
                    <div class="text-sm opacity-80">Fee Lock</div>
                </div>
                <div>
                    <div class="font-semibold">Min Size</div>
                    <div class="text-sm opacity-80">Minimum Order</div>
                </div>
                <div>
                    <div class="font-semibold">Max Size</div>
                    <div class="text-sm opacity-80">Maximum Order</div>
                </div>
                <div>
                    <div class="font-semibold">Bond</div>
                    <div class="text-sm opacity-80">Click to View</div>
                </div>
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

    content.querySelector('#refresh-market-btn').addEventListener('click', handleRefresh);
    content.querySelector('#select-all-makers').addEventListener('change', selectAllMakers);
    content.querySelector('#swap-with-makers').addEventListener('click', swapWithSelectedMakers);

    // Initial load
    fetchMakers();
}