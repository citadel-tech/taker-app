export function RecoveryComponent(container) {
    const content = document.createElement('div');
    content.id = 'recovery-content';

    async function triggerRecovery() {
        try {
            // IPC call to trigger recovery
            const result = await window.api.taker.recover();
            return result;
        } catch (error) {
            console.error('Recovery failed:', error);
            return { success: false, error: error.message };
        }
    }
    
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
                    <div id="stuck-swaps-list" class="space-y-4"></div>
                </div>

                <!-- Recovery History -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-gray-300 mb-6">Recovery History</h3>
                    <div id="recovery-history" class="space-y-3">
                        <p class="text-gray-500 text-sm text-center py-4">No recovery history</p>
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
                            ℹ Recovery is automatic but may take several hours due to timelock periods
                        </p>
                    </div>
                </div>

                <!-- Recovery Stats -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Recovery Stats</h3>
                    <div class="space-y-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Total Recovered</p>
                            <p id="total-recovered" class="text-xl font-mono text-green-400">0.00000000 BTC</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Recovery Rate</p>
                            <p id="recovery-rate" class="text-xl font-mono text-blue-400">100%</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Pending</p>
                            <p id="pending-count" class="text-xl font-mono text-yellow-400">0</p>
                        </div>
                    </div>
                </div>

                <!-- Manual Recovery -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Manual Recovery</h3>
                    <p class="text-sm text-gray-400 mb-4">If automatic recovery fails, you can manually recover funds</p>
                    <button id="manual-recovery-btn" class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-3 rounded-lg transition-colors border border-gray-700">
                        Manually Trigger Recovery
                    </button>
                    <div id="recovery-status" class="hidden mt-3 p-3 rounded-lg text-sm"></div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(content);

    // Event listener for manual recovery button
    content.querySelector('#manual-recovery-btn').addEventListener('click', async () => {
        const btn = content.querySelector('#manual-recovery-btn');
        const statusDiv = content.querySelector('#recovery-status');
        
        btn.textContent = 'Recovering...';
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        
        statusDiv.classList.remove('hidden', 'bg-green-500/20', 'bg-red-500/20');
        statusDiv.classList.add('bg-blue-500/20');
        statusDiv.innerHTML = '<span class="text-blue-400">⏳ Running recovery process...</span>';
        
        const result = await triggerRecovery();
        
        if (result.success) {
            statusDiv.classList.remove('bg-blue-500/20');
            statusDiv.classList.add('bg-green-500/20');
            statusDiv.innerHTML = '<span class="text-green-400">✓ Recovery completed successfully</span>';
            btn.textContent = 'Recovery Complete!';
        } else {
            statusDiv.classList.remove('bg-blue-500/20');
            statusDiv.classList.add('bg-red-500/20');
            statusDiv.innerHTML = `<span class="text-red-400">✗ ${result.error || 'Recovery failed'}</span>`;
            btn.textContent = 'Recovery Failed';
        }
        
        setTimeout(() => {
            btn.textContent = 'Manually Trigger Recovery';
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }, 3000);
    });
}