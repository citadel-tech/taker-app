export function Market(container) {
    const content = document.createElement('div');
    content.id = 'market-content';

    // MAKER DATA
    const makers = [
        {
            address: 'ewaexd2es2uzr34wp26cj5zgph7bug7zh',
            baseFee: 100,
            volumeFee: 10.00,
            timeFee: 0.50,
            minSize: 10000,
            maxSize: 49890356,
            bond: 50000,
            bondTxid: 'a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234'
        },
        {
            address: 'h2cxriyylj7uefzd65rfejyfrbd2hyt37h',
            baseFee: 100,
            volumeFee: 10.00,
            timeFee: 0.50,
            minSize: 10000,
            maxSize: 49908736,
            bond: 50000,
            bondTxid: 'fedcba0987654321098765432109876543210fedcba0987654321098765432101'
        }
    ];

    let selectedMakers = [];

    // Global function for viewing fidelity bonds
    window.viewFidelityBond = (makerAddress) => {
        const maker = makers.find(m => m.address === makerAddress);
        if (maker && maker.bondTxid) {
            const url = `https://mempool.space/tx/${maker.bondTxid}`;
            // Try to use electron's shell module if available, otherwise use window.open
            if (typeof require !== 'undefined') {
                try {
                    const { shell } = require('electron');
                    shell.openExternal(url);
                } catch (error) {
                    window.open(url, '_blank');
                }
            } else {
                window.open(url, '_blank');
            }
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
        const selectedMakerData = selectedMakers.map(index => makers[index]);
        
        import('../swap/Swap.js').then((module) => {
            container.innerHTML = '';
            module.SwapComponent(container, null, selectedMakerData);
        });
    }
    
    content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap Market</h2>
        <p class="text-gray-400 mb-8">Live market offers with competitive rates</p>

        <!-- Stats Cards -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Liquidity</p>
                <p class="text-2xl font-mono text-[#FF6B35]">0.15 BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Average Fee</p>
                <p class="text-2xl font-mono text-green-400">9.5%</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Online Makers</p>
                <p class="text-2xl font-mono text-blue-400">3</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Avg Response</p>
                <p class="text-2xl font-mono text-cyan-400">2.3s</p>
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

            <!-- Table Rows -->
            <div class="divide-y divide-gray-700">
                ${makers.map((maker, index) => `
                    <div class="grid grid-cols-8 gap-4 p-4 hover:bg-[#242d3d] transition-colors">
                        <div class="flex items-center">
                            <input type="checkbox" id="maker-${index}" class="w-4 h-4 accent-[#FF6B35]" />
                        </div>
                        <div class="text-gray-300 font-mono text-sm truncate">${maker.address}...</div>
                        <div class="text-green-400">${maker.baseFee}</div>
                        <div class="text-blue-400">${maker.volumeFee}%</div>
                        <div class="text-cyan-400">${maker.timeFee}%</div>
                        <div class="text-yellow-400">${maker.minSize.toLocaleString()}</div>
                        <div class="text-yellow-400">${(maker.maxSize / 1000000).toFixed(1)}M</div>
                        <div onclick="window.viewFidelityBond('${maker.address}')" class="text-purple-400 cursor-pointer hover:text-purple-300 hover:underline transition-colors">
                            ${maker.bond.toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Footer -->
            <div class="p-4 text-center text-gray-400 text-sm border-t border-gray-700">
                Showing 2 active offers • 2:18:11 PM
            </div>
        </div>
    `;
    
    container.appendChild(content);

    // EVENT LISTENERS
    
    // Select all checkbox
    content.querySelector('#select-all-makers').addEventListener('change', selectAllMakers);
    
    // Individual maker checkboxes
    makers.forEach((_, index) => {
        content.querySelector(`#maker-${index}`).addEventListener('change', () => {
            toggleMakerSelection(index);
        });
    });
    
    // Swap with selected makers button
    content.querySelector('#swap-with-makers').addEventListener('click', swapWithSelectedMakers);
}