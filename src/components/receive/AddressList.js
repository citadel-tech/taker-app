export function AddressListComponent(container) {
  const content = document.createElement('div');
  content.id = 'address-list-content';

  content.innerHTML = `
        <div class="mb-6">
            <button id="back-to-receive" class="text-gray-400 hover:text-white transition-colors mb-4">
                ← Back to Receive
            </button>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All Addresses</h2>
            <p class="text-gray-400">Complete list of generated addresses</p>
        </div>

        <!-- Address Type Filter -->
        <div class="mb-6">
            <label class="block text-sm text-gray-400 mb-2">Filter by Address Type</label>
            <div class="grid grid-cols-5 gap-2">
                <button class="bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg p-3 text-left transition-colors">
                    <div class="text-white font-semibold text-sm">All Types</div>
                    <div class="text-xs text-white/80 mt-1">25 addresses</div>
                </button>
                <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-left transition-colors">
                    <div class="text-white font-semibold text-sm">Legacy</div>
                    <div class="text-xs text-gray-400 mt-1">P2PKH (1...)</div>
                </button>
                <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-left transition-colors">
                    <div class="text-white font-semibold text-sm">Nested SegWit</div>
                    <div class="text-xs text-gray-400 mt-1">P2SH (3...)</div>
                </button>
                <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-left transition-colors">
                    <div class="text-white font-semibold text-sm">Native SegWit</div>
                    <div class="text-xs text-gray-400 mt-1">P2WPKH (bc1q...)</div>
                </button>
                <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-left transition-colors">
                    <div class="text-white font-semibold text-sm">Taproot</div>
                    <div class="text-xs text-gray-400 mt-1">P2TR (bc1p...)</div>
                </button>
            </div>
        </div>

        <!-- Address Stats -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Addresses</p>
                <p class="text-2xl font-mono text-[#FF6B35]">25</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Used Addresses</p>
                <p class="text-2xl font-mono text-green-400">18</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Current Address</p>
                <p class="text-2xl font-mono text-blue-400">1</p>
            </div>
            <div class="bg-[#1a2332] rounded-lg p-6">
                <p class="text-sm text-gray-400 mb-2">Total Received</p>
                <p class="text-2xl font-mono text-cyan-400">1.25 BTC</p>
            </div>
        </div>

        <!-- Address Table -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-semibold text-gray-300">Address Details</h3>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Address</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Used</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Received</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Last Used</th>
                            <th class="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</td>
                            <td class="py-3 px-4 text-sm text-blue-400">Native SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">0 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-gray-300">0.00000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Never</td>
                            <td class="py-3 px-4 text-sm text-green-400">Current</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq</td>
                            <td class="py-3 px-4 text-sm text-blue-400">Native SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">2 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.05000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">2 hours ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4</td>
                            <td class="py-3 px-4 text-sm text-blue-400">Native SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">1 time</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.10000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">1 day ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy</td>
                            <td class="py-3 px-4 text-sm text-yellow-400">Nested SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">3 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.08500000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">3 days ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr</td>
                            <td class="py-3 px-4 text-sm text-purple-400">Taproot</td>
                            <td class="py-3 px-4 text-sm text-gray-300">1 time</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.02000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">5 days ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa</td>
                            <td class="py-3 px-4 text-sm text-orange-400">Legacy</td>
                            <td class="py-3 px-4 text-sm text-gray-300">5 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.15000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">1 week ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qm3n4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g</td>
                            <td class="py-3 px-4 text-sm text-blue-400">Native SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">4 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.12000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">2 weeks ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5</td>
                            <td class="py-3 px-4 text-sm text-yellow-400">Nested SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">2 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.06000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">3 weeks ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1pxw7yt3qrx8jh9k3md5nl6p7q8rs9tu0vw1x2y3z4a5b6c7d8e9f0g</td>
                            <td class="py-3 px-4 text-sm text-purple-400">Taproot</td>
                            <td class="py-3 px-4 text-sm text-gray-300">0 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-gray-300">0.00000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Never</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Unused</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3</td>
                            <td class="py-3 px-4 text-sm text-blue-400">Native SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">6 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.18000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">1 month ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2</td>
                            <td class="py-3 px-4 text-sm text-orange-400">Legacy</td>
                            <td class="py-3 px-4 text-sm text-gray-300">8 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.22000000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">1 month ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                        <tr class="hover:bg-[#242d3d]">
                            <td class="py-3 px-4 font-mono text-sm text-gray-300">3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX</td>
                            <td class="py-3 px-4 text-sm text-yellow-400">Nested SegWit</td>
                            <td class="py-3 px-4 text-sm text-gray-300">4 times</td>
                            <td class="py-3 px-4 text-sm font-mono text-green-400">0.09500000</td>
                            <td class="py-3 px-4 text-sm text-gray-400">2 months ago</td>
                            <td class="py-3 px-4 text-sm text-gray-400">Used</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Add back button handler
  const backButton = content.querySelector('#back-to-receive');
  backButton.addEventListener('click', () => {
    import('./Receive.js').then((module) => {
      container.innerHTML = '';
      module.ReceiveComponent(container);
    });
  });
}
