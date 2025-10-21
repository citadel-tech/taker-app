export function UtxoListComponent(container) {
  const content = document.createElement('div');
  content.id = 'utxo-list-content';

  content.innerHTML = `
        <div class="mb-6">
            <button id="back-to-wallet" class="text-gray-400 hover:text-white transition-colors mb-4">
                ← Back to Wallet
            </button>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All UTXOs</h2>
            <p class="text-gray-400">Complete list of unspent transaction outputs</p>
        </div>

        <!-- UTXO Stats -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total UTXOs</p>
                <p class="text-2xl font-mono text-[#FF6B35]">12</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Value</p>
                <p class="text-2xl font-mono text-green-400">0.20 BTC</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Confirmed</p>
                <p class="text-2xl font-mono text-blue-400">10</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Unconfirmed</p>
                <p class="text-2xl font-mono text-yellow-400">2</p>
            </div>
        </div>

        <!-- UTXO Table -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-gray-300">UTXO Details</h3>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Txid</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Vout</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Confirmations</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Address</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">a1b2c3d4e5f6...7890</td>
                            <td class="py-3 px-4 text-gray-300">0</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.05000000</td>
                            <td class="py-3 px-4 text-gray-300">142</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qxy2...wlh</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">7g8h9i0j1k2l...3m4n</td>
                            <td class="py-3 px-4 text-gray-300">1</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.10000000</td>
                            <td class="py-3 px-4 text-gray-300">89</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qar0...8zt</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">m3n4o5p6q7r8...s9t0</td>
                            <td class="py-3 px-4 text-gray-300">0</td>
                            <td class="py-3 px-4 text-blue-400 font-mono">0.05000000</td>
                            <td class="py-3 px-4 text-gray-300">23</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qw50...3yn</td>
                            <td class="py-3 px-4 text-blue-400">Swap</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">u1v2w3x4y5z6...a7b8</td>
                            <td class="py-3 px-4 text-gray-300">2</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.03000000</td>
                            <td class="py-3 px-4 text-gray-300">67</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qm3n...5op</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">c9d0e1f2g3h4...i5j6</td>
                            <td class="py-3 px-4 text-gray-300">1</td>
                            <td class="py-3 px-4 text-green-400 font-mono">0.02000000</td>
                            <td class="py-3 px-4 text-gray-300">156</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qrs7...9tu</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">k7l8m9n0o1p2...q3r4</td>
                            <td class="py-3 px-4 text-gray-300">0</td>
                            <td class="py-3 px-4 text-yellow-400 font-mono">0.01500000</td>
                            <td class="py-3 px-4 text-yellow-400">2</td>
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qvwx...1yz</td>
                            <td class="py-3 px-4 text-green-400">Regular</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Add back button handler
  const backButton = content.querySelector('#back-to-wallet');
  backButton.addEventListener('click', () => {
    const walletModule = import('../wallet/Wallet.js');
    walletModule.then((module) => {
      container.innerHTML = '';
      module.WalletComponent(container);
    });
  });
}
