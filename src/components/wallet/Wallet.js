export function WalletComponent(container) {
  const content = document.createElement('div');
  content.id = 'wallet-content';

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Wallet</h2>
        <p class="text-gray-400 mb-8">Your Bitcoin balance and transaction history</p>

        <!-- Balance Card -->
        <div class="bg-[#1a2332] rounded-lg p-6 mb-6">
            <h3 class="text-xl font-semibold mb-4 text-gray-300">Balance</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p class="text-sm text-gray-400 mb-1">Regular</p>
                    <p class="text-2xl font-mono text-green-400">0.15000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">≈ $4,500</p>
                </div>
                <div>
                    <p class="text-sm text-gray-400 mb-1">Swap</p>
                    <p class="text-2xl font-mono text-blue-400">0.05000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">≈ $1,500</p>
                </div>
                <div>
                    <p class="text-sm text-gray-400 mb-1">Contract</p>
                    <p class="text-2xl font-mono text-yellow-400">0.00000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">≈ $0</p>
                </div>
                <div>
                    <p class="text-sm text-gray-400 mb-1">Spendable</p>
                    <p class="text-2xl font-mono text-[#FF6B35]">0.20000000 BTC</p>
                    <p class="text-xs text-gray-500 mt-1">≈ $6,000</p>
                </div>
            </div>
        </div>

       <!-- UTXOs Section -->
<div class="bg-[#1a2332] rounded-lg p-6 mb-6">
    <h3 class="text-xl font-semibold mb-4 text-gray-300">UTXOs</h3>
    <div class="overflow-x-auto">
        <table class="w-full">
            <thead>
                <tr class="border-b border-gray-700">
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold">Txid</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold">Vout</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold">Confirmations</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                </tr>
            </thead>
            <tbody>
                <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                    <td class="py-3 px-4 font-mono text-sm text-gray-300">a1b2c3d4...e5f6</td>
                    <td class="py-3 px-4 text-gray-300">0</td>
                    <td class="py-3 px-4 text-green-400 font-mono">0.05000000</td>
                    <td class="py-3 px-4 text-gray-300">142</td>
                    <td class="py-3 px-4 text-green-400">Regular</td>
                </tr>
                <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                    <td class="py-3 px-4 font-mono text-sm text-gray-300">7g8h9i0j...k1l2</td>
                    <td class="py-3 px-4 text-gray-300">1</td>
                    <td class="py-3 px-4 text-green-400 font-mono">0.10000000</td>
                    <td class="py-3 px-4 text-gray-300">89</td>
                    <td class="py-3 px-4 text-green-400">Regular</td>
                </tr>
                <tr class="hover:bg-[#242d3d]">
                    <td class="py-3 px-4 font-mono text-sm text-gray-300">m3n4o5p6...q7r8</td>
                    <td class="py-3 px-4 text-gray-300">0</td>
                    <td class="py-3 px-4 text-blue-400 font-mono">0.05000000</td>
                    <td class="py-3 px-4 text-gray-300">23</td>
                    <td class="py-3 px-4 text-blue-400">Swap</td>
                </tr>
            </tbody>
        </table>
<button id="view-all-utxos" class="mt-4 text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold transition-colors">
    View All UTXOs →
</button>
    </div>
</div>
        <!-- Recent Transactions -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <h3 class="text-xl font-semibold mb-4 text-gray-300">Recent Transactions</h3>
            <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-[#242d3d] rounded">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                            <span class="text-green-400">↓</span>
                        </div>
                        <div>
                            <p class="text-white font-mono text-sm">Received</p>
                            <p class="text-gray-400 text-xs">2 hours ago</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-green-400 font-mono">+0.05000000 BTC</p>
                        <p class="text-gray-400 text-xs">6 confirmations</p>
                    </div>
                </div>
                <div class="flex items-center justify-between p-3 bg-[#242d3d] rounded">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                            <span class="text-red-400">↑</span>
                        </div>
                        <div>
                            <p class="text-white font-mono text-sm">Sent</p>
                            <p class="text-gray-400 text-xs">1 day ago</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-red-400 font-mono">-0.02000000 BTC</p>
                        <p class="text-gray-400 text-xs">142 confirmations</p>
                    </div>
                </div>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Add view all UTXOs handler
  const viewAllButton = content.querySelector('#view-all-utxos');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      import('./UtxoList.js').then((module) => {
        container.innerHTML = '';
        module.UtxoListComponent(container);
      });
    });
  }
}
