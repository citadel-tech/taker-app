export function SendComponent(container) {
    const content = document.createElement('div');
    content.id = 'send-content';
    
    content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Send Bitcoin</h2>
        <p class="text-gray-400 mb-8">Send BTC to any Bitcoin address</p>

        <div class="grid grid-cols-3 gap-6">
            <!-- Left: Send Form -->
            <div class="col-span-2">
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <!-- Recipient Address -->
                    <div class="mb-6">
                        <label class="block text-sm text-gray-400 mb-2">Recipient Address</label>
                        <input 
                            type="text" 
                            placeholder="bc1q..." 
                            class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                        />
                        <p class="text-xs text-gray-500 mt-2">Enter a valid Bitcoin address</p>
                    </div>

                    <!-- Amount -->
                    <div class="mb-6">
                        <label class="block text-sm text-gray-400 mb-2">Amount</label>
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

                    <!-- Fee Rate -->
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-sm text-gray-400">Fee Rate</label>
                            <span class="text-sm text-gray-400">2 sats/vByte</span>
                        </div>
                        
                        <!-- Fee Presets -->
                        <div class="grid grid-cols-3 gap-2 mb-4">
                            <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-center transition-colors">
                                <div class="text-white font-semibold">Slow</div>
                                <div class="text-xs text-gray-400 mt-1">1 sat/vB</div>
                                <div class="text-xs text-gray-500">~60 min</div>
                            </button>
                            <button class="bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg p-3 text-center">
                                <div class="text-white font-semibold">Normal</div>
                                <div class="text-xs text-white/80 mt-1">2 sat/vB</div>
                                <div class="text-xs text-white/60">~30 min</div>
                            </button>
                            <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-center transition-colors">
                                <div class="text-white font-semibold">Fast</div>
                                <div class="text-xs text-gray-400 mt-1">5 sat/vB</div>
                                <div class="text-xs text-gray-500">~10 min</div>
                            </button>
                        </div>

                        <!-- Custom Fee -->
                        <div class="flex items-center gap-2">
                            <input 
                                type="number" 
                                placeholder="Custom" 
                                class="flex-1 bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35] transition-colors"
                            />
                            <span class="text-sm text-gray-400">sats/vByte</span>
                        </div>
                    </div>

                    <!-- Send Button -->
                    <button class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-colors text-lg">
                        Send Bitcoin
                    </button>
                </div>
            </div>

            <!-- Right: Summary -->
            <div class="col-span-1">
                <div class="bg-[#1a2332] rounded-lg p-6 sticky top-8">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Transaction Summary</h3>
                    
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Available Balance</p>
                            <p class="text-xl font-mono text-green-400">0.20000000 BTC</p>
                            <p class="text-xs text-gray-500">≈ $6,000</p>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Amount</span>
                                <span class="text-sm font-mono text-white">0.00000000 BTC</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-sm text-gray-400">Network Fee</span>
                                <span class="text-sm font-mono text-yellow-400">~0.00000280 BTC</span>
                            </div>
                            <div class="flex justify-between pt-2 border-t border-gray-700">
                                <span class="text-sm font-semibold text-gray-300">Total</span>
                                <span class="text-sm font-mono font-semibold text-[#FF6B35]">0.00000280 BTC</span>
                            </div>
                        </div>

                        <div class="border-t border-gray-700 pt-4">
                            <p class="text-sm text-gray-400 mb-1">Remaining Balance</p>
                            <p class="text-lg font-mono text-blue-400">0.19999720 BTC</p>
                        </div>
                    </div>

                    <div class="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-xs text-blue-400">
                            ⓘ Transactions are irreversible. Double-check the address before sending.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(content);
}