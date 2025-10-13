export function SwapForm() {
    return `
        <div class="bg-[#1a2332] rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-300 mb-6">Initiate Swap</h3>

            <!-- Amount to Swap -->
            <div class="mb-6">
                <label class="block text-sm text-gray-400 mb-2">Amount to Swap</label>
                <div class="relative">
                    <input 
                        type="text" 
                        placeholder="0.00000000" 
                        class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 pr-20 text-white font-mono text-lg focus:outline-none focus:border-[#FF6B35] transition-colors"
                    />
                    <button class="absolute right-2 top-1/2 -translate-y-1/2 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-1 rounded text-sm font-semibold transition-colors">
                        Max
                    </button>
                </div>
                <p class="text-xs text-gray-400 mt-2">≈ $0.00 USD</p>
            </div>

            <!-- Number of Makers -->
            <div class="mb-6">
                <label class="block text-sm text-gray-400 mb-2">Number of Makers (Hops)</label>
                <div class="grid grid-cols-4 gap-2">
                    <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                        2
                    </button>
                    <button class="bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                        3
                    </button>
                    <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                        4
                    </button>
                    <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                        5
                    </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">More hops = better privacy, higher fees</p>
            </div>

            <!-- Maker Selection -->
            <div class="mb-6">
                <label class="block text-sm text-gray-400 mb-2">Maker Selection</label>
                <div class="flex gap-2">
                    <button class="flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                        Auto Select
                    </button>
                    <button class="flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                        Manual Select
                    </button>
                </div>
            </div>

            <!-- Start Swap Button -->
            <button class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-colors text-lg">
                Start Coinswap
            </button>
        </div>
    `;
}