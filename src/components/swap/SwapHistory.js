export function SwapHistory() {
    return `
        <div class="bg-[#1a2332] rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-300 mb-4">Recent Swaps</h3>
            <div class="space-y-3">
                <div class="bg-[#0f1419] rounded-lg p-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-mono text-sm text-gray-300">0.05000000 BTC</span>
                        <span class="text-xs text-green-400">✓ Success</span>
                    </div>
                    <p class="text-xs text-gray-500">2 hours ago • 3 makers</p>
                </div>
                
                <div class="bg-[#0f1419] rounded-lg p-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-mono text-sm text-gray-300">0.10000000 BTC</span>
                        <span class="text-xs text-green-400">✓ Success</span>
                    </div>
                    <p class="text-xs text-gray-500">1 day ago • 2 makers</p>
                </div>

                <div class="bg-[#0f1419] rounded-lg p-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-mono text-sm text-gray-300">0.03000000 BTC</span>
                        <span class="text-xs text-red-400">✗ Failed</span>
                    </div>
                    <p class="text-xs text-gray-500">3 days ago • Recovered</p>
                </div>
            </div>
        </div>
    `;
}