export function SwapSummary() {
    return `
        <div class="bg-[#1a2332] rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-300 mb-4">Swap Summary</h3>
            
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-gray-400 mb-1">Available Balance</p>
                    <p class="text-xl font-mono text-green-400">0.20000000 BTC</p>
                </div>

                <div class="border-t border-gray-700 pt-4">
                    <div class="flex justify-between mb-2">
                        <span class="text-sm text-gray-400">Swap Amount</span>
                        <span class="text-sm font-mono text-white">0.00000000 BTC</span>
                    </div>
                    <div class="flex justify-between mb-2">
                        <span class="text-sm text-gray-400">Makers</span>
                        <span class="text-sm text-white">3 hops</span>
                    </div>
                    <div class="flex justify-between mb-2">
                        <span class="text-sm text-gray-400">Estimated Fee</span>
                        <span class="text-sm font-mono text-yellow-400">~0.00005000 BTC</span>
                    </div>
                </div>
            </div>

            <div class="mt-6 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p class="text-xs text-purple-400">
                    ⓘ Coinswaps break transaction links for enhanced privacy
                </p>
            </div>
        </div>
    `;
}