export function Market(container) {
    const content = document.createElement('div');
    content.id = 'market-content';
    
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
            <!-- Table Header -->
            <div class="grid grid-cols-7 gap-4 bg-[#FF6B35] p-4">
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
                    <div class="text-sm opacity-80">Fidelity Bond</div>
                </div>
            </div>

            <!-- Table Rows -->
            <div class="divide-y divide-gray-700">
                <div class="grid grid-cols-7 gap-4 p-4 hover:bg-[#242d3d] cursor-pointer transition-colors">
                    <div class="text-gray-300 font-mono text-sm truncate">ewaexd2es2uzr34wp26cj5zgph7bug7zh...</div>
                    <div class="text-green-400">100</div>
                    <div class="text-blue-400">10.00%</div>
                    <div class="text-cyan-400">0.50%</div>
                    <div class="text-yellow-400">10,000</div>
                    <div class="text-yellow-400">49,890,356</div>
                    <div class="text-purple-400">50,000</div>
                </div>
                
                <div class="grid grid-cols-7 gap-4 p-4 hover:bg-[#242d3d] cursor-pointer transition-colors">
                    <div class="text-gray-300 font-mono text-sm truncate">h2cxriyylj7uefzd65rfejyfrbd2hyt37h...</div>
                    <div class="text-green-400">100</div>
                    <div class="text-blue-400">10.00%</div>
                    <div class="text-cyan-400">0.50%</div>
                    <div class="text-yellow-400">10,000</div>
                    <div class="text-yellow-400">49,908,736</div>
                    <div class="text-purple-400">50,000</div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 text-center text-gray-400 text-sm border-t border-gray-700">
                Showing 2 active offers • 2:18:11 PM
            </div>
        </div>
    `;
    
    container.appendChild(content);
}