export function SwapStatus() {
    return `
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-gray-300">Swap in Progress</h3>
                <span class="text-sm text-yellow-400">● Processing</span>
            </div>

            <!-- Progress Bar -->
            <div class="mb-6">
                <div class="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Step 2 of 5</span>
                    <span>40%</span>
                </div>
                <div class="w-full bg-[#0f1419] rounded-full h-3">
                    <div class="bg-[#FF6B35] h-3 rounded-full" style="width: 40%"></div>
                </div>
            </div>

            <!-- Current Step -->
            <div class="mb-6">
                <p class="text-sm text-gray-400 mb-2">Current Step:</p>
                <p class="text-white font-semibold">Signing contracts with Maker 2/3</p>
            </div>

            <!-- Maker Addresses -->
            <div class="mb-6">
                <p class="text-sm text-gray-400 mb-3">Makers Involved:</p>
                <div class="space-y-2">
                    <div class="flex items-center gap-3 bg-[#0f1419] rounded-lg p-3">
                        <span class="text-green-400">✓</span>
                        <span class="font-mono text-sm text-gray-300">ewaexd2es2uzr...26c</span>
                        <span class="text-xs text-gray-500">Completed</span>
                    </div>
                    <div class="flex items-center gap-3 bg-[#0f1419] rounded-lg p-3">
                        <span class="text-yellow-400">●</span>
                        <span class="font-mono text-sm text-gray-300">h2cxriyylj7ue...5rf</span>
                        <span class="text-xs text-yellow-400">In Progress</span>
                    </div>
                    <div class="flex items-center gap-3 bg-[#0f1419] rounded-lg p-3">
                        <span class="text-gray-600">○</span>
                        <span class="font-mono text-sm text-gray-500">abc123xyz789d...6gh</span>
                        <span class="text-xs text-gray-500">Pending</span>
                    </div>
                </div>
            </div>

            <!-- Transaction IDs -->
            <div>
                <p class="text-sm text-gray-400 mb-3">Funding Transactions:</p>
                <div class="space-y-2">
                    <div class="bg-[#0f1419] rounded-lg p-3">
                        <span class="font-mono text-xs text-gray-300">a1b2c3d4e5f6...7890</span>
                        <span class="text-xs text-green-400 ml-2">✓ Confirmed</span>
                    </div>
                    <div class="bg-[#0f1419] rounded-lg p-3">
                        <span class="font-mono text-xs text-gray-300">x9y8z7w6v5u4...3210</span>
                        <span class="text-xs text-yellow-400 ml-2">⏳ Pending</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}