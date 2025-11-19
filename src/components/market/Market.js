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
            
            const response = await fetch('http://localhost:3001/api/taker/offers');
            const data = await response.json();

            if (data.success && data.offerbook) {
                // Use good makers (verified and online)
                const goodMakers = data.offerbook.goodMakers || [];
                
                makers = goodMakers.map((item, index) => {
                    const offer = item.offer;
                    const address = item.address?.address || item.address;
                    
                    return {
                        address: address,
                        baseFee: offer.baseFee || 0,
                        volumeFee: (offer.amountRelativeFeePct || 0).toFixed(2),
                        timeFee: (offer.timeRelativeFeePct || 0).toFixed(2),
                        minSize: offer.minSize || 0,
                        maxSize: offer.maxSize || 0,
                        bond: offer.fidelity?.bond?.amount?.sats || 0,
                        bondTxid: offer.fidelity?.bond?.outpoint?.txid || '',
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
            console.log('🔄 Syncing offerbook...');
            
            const response = await fetch('http://localhost:3001/api/taker/sync-offerbook', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                console.log('✅ Offerbook synced');
                // Refresh makers after sync
                await fetchMakers();
            } else {
                throw new Error(data.error || 'Failed to sync offerbook');
            }
        } catch (error) {
            console.error('❌ Sync failed:', error);
            showError('Failed to sync: ' + error.message);
        }
    }

    // UI FUNCTIONS
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
            avgResponse: '2.3' // This would need to be tracked separately
        };
    }

    // Global function for viewing fidelity bonds
    window.viewFidelityBond = (makerAddress) => {
        const maker = makers.find(m => m.address === makerAddress);
        if (maker && maker.bondTxid) {
            const url = `https://mempool.space/tx/${maker.bondTxid}`;
            window.open(url, '_blank');
        }
    };

    // SELECTION FUNCTIONS
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
        // Update individual checkboxes
        makers.forEach((_, index) => {
            const checkbox = content.querySelector(`#maker-${index}`);
            if (checkbox) {
                checkbox.checked = selectedMakers.includes(index);
            }
        });

        // Update select all checkbox
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

        // Update action buttons
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
        
        import('../swap/Swap.js').then((module) => {
            container.innerHTML = '';
            module.SwapComponent(container, null, selectedMakerData);
        });
    }

    function updateUI() {
        const stats = calculateStats();
        const tableBody = content.querySelector('#maker-table-body');
        const statsContainer = content.querySelector('#market-stats');

        // Update stats
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

        // Update table
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
                        retryBtn.addEventListener('click', () => {
                            isLoading = true;
                            updateUI();
                            fetchMakers();
                        });
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

                // Re-attach event listeners for checkboxes
                makers.forEach((_, index) => {
                    const checkbox = content.querySelector(`#maker-${index}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => toggleMakerSelection(index));
                    }
                });
            }
        }

        // Update footer
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
    
    // RENDER
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

        <!-- Stats Cards -->
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

        <!-- Market Table -->
        <div class="bg-[#1a2332] rounded-lg overflow-hidden">
            <!-- Action Buttons -->
            <div id="maker-actions" class="hidden bg-[#FF6B35] p-4 flex justify-between items-center">
                <span class="text-white font-semibold">
                    <span id="selected-makers-count">0</span> makers selected
                </span>
                <button id="swap-with-makers" class="bg-white text-[#FF6B35] px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                    Swap with Selected →
                </button>
            </div>

            <!-- Table Header -->
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

            <!-- Table Body -->
            <div id="maker-table-body" class="divide-y divide-gray-700">
                <div class="col-span-8 text-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B35] mx-auto mb-4"></div>
                    <p class="text-gray-400">Loading makers...</p>
                </div>
            </div>

            <!-- Footer -->
            <div id="market-footer" class="p-4 text-center text-gray-400 text-sm border-t border-gray-700">
                Loading...
            </div>
        </div>
    `;
    
    container.appendChild(content);

    // EVENT LISTENERS
    content.querySelector('#refresh-market-btn').addEventListener('click', handleRefresh);
    content.querySelector('#select-all-makers').addEventListener('change', selectAllMakers);
    content.querySelector('#swap-with-makers').addEventListener('click', swapWithSelectedMakers);

    // INITIAL LOAD
    // fetchMakers(); // Disabled for now - fetchOffers() is blocking the server
    
    // Show a message instead
    const tableBody = content.querySelector('#maker-table-body');
    if (tableBody) {
        tableBody.innerHTML = `
            <div class="col-span-8 text-center py-12">
                <p class="text-gray-400 mb-4">Market discovery temporarily disabled</p>
                <p class="text-sm text-gray-500">Use manual maker selection in the Swap page</p>
            </div>
        `;
    }
}