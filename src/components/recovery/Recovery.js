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
        <div class="flex flex-col gap-4 mb-8 md:flex-row md:items-start md:justify-between">
            <div>
                <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Recovery</h2>
                <p class="text-gray-400">Recover funds from failed or stuck coinswaps</p>
            </div>
            <button
                id="manual-recovery-btn"
                class="shrink-0 bg-[#ff6b35] hover:bg-[#ff7f50] text-white font-bold px-5 py-3 rounded-xl transition-all border border-[#ff6b35] shadow-lg shadow-black/30 hover:shadow-xl hover:scale-[1.02]"
            >
                Trigger Recovery
            </button>
        </div>

        <div class="space-y-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-300 mb-4">How Recovery Works</h3>
                <div class="space-y-4 text-sm text-gray-400">
                    <div class="flex gap-3 items-start">
                        <span class="text-[#FF6B35] font-bold">1.</span>
                        <p>The Recovery routine detects failed swaps, waits for HTLC timelock expiry then creates and broadcasts a refund transaction back to wallet.</p>
                    </div>
                    <div class="flex gap-3 items-start">
                        <span class="text-[#FF6B35] font-bold">2.</span>
                        <p>It might take several hours for timelock to expire.</p>
                    </div>
                    <div class="flex gap-3 items-start">
                        <span class="text-[#FF6B35] font-bold">3.</span>
                        <p>Recovery is automatically triggered for any unspent swap contract transactions at wallet startup. If you still see pending recoveries here, use the Trigger Recovery button to manually trigger a recovery.</p>
                    </div>
                    <div class="flex gap-3 items-start">
                        <span class="text-[#FF6B35] font-bold">4.</span>
                        <p>While waiting for recovery the app can be safely closed. Recovery will resume in next restart.</p>
                    </div>
                    <div class="flex gap-3 items-start">
                        <span class="text-[#FF6B35] font-bold">5.</span>
                        <p>Always ensure to not have very old pending recoveries. That can put your funds at risk.</p>
                    </div>
                </div>
            </div>

            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-300 mb-4">Recovery Stats</h3>
                <div class="grid gap-4 sm:grid-cols-3">
                    <div class="rounded-lg bg-[#111827]/40 p-4">
                        <p class="text-sm text-gray-400 mb-1">Total Recovered</p>
                        <p id="total-recovered" class="text-xl font-mono text-green-400">0.00000000 BTC</p>
                    </div>
                    <div class="rounded-lg bg-[#111827]/40 p-4">
                        <p class="text-sm text-gray-400 mb-1">Recovery Rate</p>
                        <p id="recovery-rate" class="text-xl font-mono text-blue-400">100%</p>
                    </div>
                    <div class="rounded-lg bg-[#111827]/40 p-4">
                        <p class="text-sm text-gray-400 mb-1">Pending</p>
                        <p id="pending-count" class="text-xl font-mono text-yellow-400">0</p>
                    </div>
                </div>
            </div>

            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-300 mb-4">Manual Recovery</h3>
                <p class="text-sm text-gray-400">If automatic recovery fails, you can manually recover funds.</p>
                <div id="recovery-status" class="hidden mt-4 p-3 rounded-lg text-sm"></div>
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
            btn.textContent = 'Trigger Recovery';
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }, 3000);
    });
}
