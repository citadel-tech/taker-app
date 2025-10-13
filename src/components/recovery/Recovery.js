export function RecoveryComponent(container) {
    const content = document.createElement('div');
    content.id = 'recovery-content';
    
    content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Recovery</h2>
        <p class="text-gray-400 mb-8">Recover funds from failed or stuck coinswaps</p>

        <div class="grid grid-cols-3 gap-6">
            <!-- Left: Recovery Status -->
            <div class="col-span-2 space-y-6">
                <!-- No Pending Recovery -->
                <div class="bg-[#1a2332] rounded-lg p-8 text-center">
                    <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-4xl text-green-400">✓</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-300 mb-2">No Recovery Needed</h3>
                    <p class="text-gray-400 text-sm">All your swaps completed successfully. No stuck funds detected.</p>
                </div>

                <!-- Stuck Swaps (Hidden by default, shown when there are stuck swaps) -->
                <div class="bg-[#1a2332] rounded-lg p-6 hidden" id="stuck-swaps">
                    <h3 class="text-xl font-semibold text-gray-300 mb-6">Stuck Swaps Detected</h3>
                    
                    <div class="space-y-4">
                        <!-- Stuck Swap Item -->
                        <div class="bg-[#0f1419] border border-yellow-500/30 rounded-lg p-4">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="text-white font-semibold mb-1">Swap ID: a1b2c3d4</p>
                                    <p class="text-sm text-gray-400">Started 2 hours ago</p>
                                </div>
                                <span class="text-xs bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded">Stuck</span>
                            </div>

                            <div class="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p class="text-xs text-gray-500">Amount</p>
                                    <p class="font-mono text-sm text-white">0.05000000 BTC</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500">Makers</p>
                                    <p class="text-sm text-white">3 hops</p>
                                </div>
                            </div>

                            <div class="mb-4">
                                <p class="text-xs text-gray-500 mb-2">Issue:</p>
                                <p class="text-sm text-yellow-400">Maker dropped connection after funding</p>
                            </div>

                            <button class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 rounded-lg transition-colors">
                                Recover Funds
                            </button>
                        </div>

                        <!-- Another Stuck Swap -->
                        <div class="bg-[#0f1419] border border-red-500/30 rounded-lg p-4">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="text-white font-semibold mb-1">Swap ID: e5f6g7h8</p>
                                    <p class="text-sm text-gray-400">Started 1 day ago</p>
                                </div>
                                <span class="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded">Critical</span>
                            </div>

                            <div class="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p class="text-xs text-gray-500">Amount</p>
                                    <p class="font-mono text-sm text-white">0.10000000 BTC</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500">Makers</p>
                                    <p class="text-sm text-white">2 hops</p>
                                </div>
                            </div>

                            <div class="mb-4">
                                <p class="text-xs text-gray-500 mb-2">Issue:</p>
                                <p class="text-sm text-red-400">Contract timeout approaching in 2 hours</p>
                            </div>

                            <button class="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors">
                                Urgent Recovery
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recovery History -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-300 mb-6">Recovery History</h3>
                    
                    <div class="space-y-3">
                        <div class="bg-[#0f1419] rounded-lg p-4">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <p class="text-white font-mono text-sm mb-1">0.03000000 BTC</p>
                                    <p class="text-xs text-gray-500">Recovered 3 days ago</p>
                                </div>
                                <span class="text-xs text-green-400">✓ Success</span>
                            </div>
                            <p class="text-xs text-gray-400">Contract broadcast → Timelock claimed</p>
                        </div>

                        <div class="bg-[#0f1419] rounded-lg p-4">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <p class="text-white font-mono text-sm mb-1">0.08000000 BTC</p>
                                    <p class="text-xs text-gray-500">Recovered 1 week ago</p>
                                </div>
                                <span class="text-xs text-green-400">✓ Success</span>
                            </div>
                            <p class="text-xs text-gray-400">Hashlock spend successful</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Recovery Info -->
            <div class="col-span-1 space-y-6">
                <!-- How Recovery Works -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">How Recovery Works</h3>
                    <div class="space-y-3 text-sm text-gray-400">
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">1.</span>
                            <p>System detects failed swap or timeout</p>
                        </div>
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">2.</span>
                            <p>Broadcast contract transactions to blockchain</p>
                        </div>
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">3.</span>
                            <p>Wait for timelock or claim via hashlock</p>
                        </div>
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">4.</span>
                            <p>Funds returned to your wallet</p>
                        </div>
                    </div>

                    <div class="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-xs text-blue-400">
                            ⓘ Recovery is automatic but may take several hours due to timelock periods
                        </p>
                    </div>
                </div>

                <!-- Recovery Stats -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Recovery Stats</h3>
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Total Recovered</p>
                            <p class="text-xl font-mono text-green-400">0.11000000 BTC</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Recovery Rate</p>
                            <p class="text-xl font-mono text-blue-400">100%</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Pending</p>
                            <p class="text-xl font-mono text-yellow-400">0</p>
                        </div>
                    </div>
                </div>

                <!-- Manual Recovery -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Manual Recovery</h3>
                    <p class="text-sm text-gray-400 mb-4">If automatic recovery fails, you can manually recover funds</p>
                    <button class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-3 rounded-lg transition-colors border border-gray-700">
                        Manual Recovery Tool
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(content);
}