export function AddressListComponent(container) {
  // ADDRESS DATA
  const addresses = [
    { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', type: 'P2WPKH', used: 0, received: 0.00000000, lastUsed: 'Never', status: 'Current' },
    { address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', type: 'P2WPKH', used: 2, received: 0.05000000, lastUsed: '2 hours ago', status: 'Used' },
    { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', type: 'P2WPKH', used: 1, received: 0.10000000, lastUsed: '1 day ago', status: 'Used' },
    { address: 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', type: 'P2WSH', used: 3, received: 0.08500000, lastUsed: '3 days ago', status: 'Used' },
    { address: 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr', type: 'P2TR', used: 1, received: 0.02000000, lastUsed: '5 days ago', status: 'Used' },
    { address: 'bc1qklvpn0jzeg6txfxm59wjn3vyrd4d3p8vhjs2hmrgu57zfmjy8znqhtwz3z', type: 'P2WSH', used: 5, received: 0.15000000, lastUsed: '1 week ago', status: 'Used' },
    { address: 'bc1qm3n4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1g', type: 'P2WPKH', used: 4, received: 0.12000000, lastUsed: '2 weeks ago', status: 'Used' },
    { address: 'bc1q5n8e8arfpn6qcw8d9jme9v8a3r2p4u5t6y7z8x9c0b1m2n3o4p5q6r7s8t9', type: 'P2WSH', used: 2, received: 0.06000000, lastUsed: '3 weeks ago', status: 'Used' },
    { address: 'bc1pxw7yt3qrx8jh9k3md5nl6p7q8rs9tu0vw1x2y3z4a5b6c7d8e9f0g', type: 'P2TR', used: 0, received: 0.00000000, lastUsed: 'Never', status: 'Unused' },
    { address: 'bc1q9vlvyj8tgnh4hzqzjf2dgk6xfwwgczrmfm50lnvtg8w9rjd5v6nqr3h2k5', type: 'P2WSH', used: 8, received: 0.22000000, lastUsed: '1 month ago', status: 'Used' },
    { address: 'bc1p2wsldez5mud2yam29q22wgfh9439spgduvct83k3pm50fcx5dz4qupq0fr', type: 'P2TR', used: 4, received: 0.09500000, lastUsed: '2 months ago', status: 'Used' }
  ];

  let currentFilter = 'all';

  function getFilteredAddresses() {
    return currentFilter === 'all' ? addresses : addresses.filter(addr => addr.type === currentFilter);
  }

  function getTypeColor(type) {
    const colors = { 'P2WPKH': 'text-blue-400', 'P2WSH': 'text-cyan-400', 'P2TR': 'text-purple-400' };
    return colors[type] || 'text-gray-400';
  }

  function getStatusColor(status) {
    const colors = { 'Current': 'text-green-400', 'Used': 'text-gray-400', 'Unused': 'text-gray-400' };
    return colors[status] || 'text-gray-400';
  }

  function render() {
    const filteredAddresses = getFilteredAddresses();
    const totalAddresses = filteredAddresses.length;
    const usedAddresses = filteredAddresses.filter(addr => addr.status !== 'Unused').length;
    const reusedAddresses = filteredAddresses.filter(addr => addr.used > 1).length;
    const totalReceived = filteredAddresses.reduce((sum, addr) => sum + addr.received, 0);

    container.innerHTML = `
        <div id="address-list-content">
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
                <div class="grid grid-cols-4 gap-2">
                    <button onclick="window.filterAddresses('all')" class="${currentFilter === 'all' ? 'bg-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'} rounded-lg p-3 text-left transition-colors">
                        <div class="text-white font-semibold text-sm">All Types</div>
                        <div class="text-xs ${currentFilter === 'all' ? 'text-white/80' : 'text-gray-400'} mt-1">${addresses.length} addresses</div>
                    </button>
                    <button onclick="window.filterAddresses('P2WPKH')" class="${currentFilter === 'P2WPKH' ? 'bg-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'} rounded-lg p-3 text-left transition-colors">
                        <div class="text-white font-semibold text-sm">Segwit Pubkey</div>
                        <div class="text-xs ${currentFilter === 'P2WPKH' ? 'text-white/80' : 'text-gray-400'} mt-1">P2WPKH (bc1q...)</div>
                    </button>
                    <button onclick="window.filterAddresses('P2WSH')" class="${currentFilter === 'P2WSH' ? 'bg-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'} rounded-lg p-3 text-left transition-colors">
                        <div class="text-white font-semibold text-sm">Segwit Script</div>
                        <div class="text-xs ${currentFilter === 'P2WSH' ? 'text-white/80' : 'text-gray-400'} mt-1">P2WSH (bc1q...)</div>
                    </button>
                    <button onclick="window.filterAddresses('P2TR')" class="${currentFilter === 'P2TR' ? 'bg-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'} rounded-lg p-3 text-left transition-colors">
                        <div class="text-white font-semibold text-sm">Taproot</div>
                        <div class="text-xs ${currentFilter === 'P2TR' ? 'text-white/80' : 'text-gray-400'} mt-1">P2TR (bc1p...)</div>
                    </button>
                </div>
            </div>

            <!-- Address Stats -->
            <div class="grid grid-cols-4 gap-4 mb-6">
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Total Addresses</p>
                    <p class="text-2xl font-mono text-[#FF6B35]">${totalAddresses}</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Used Addresses</p>
                    <p class="text-2xl font-mono text-green-400">${usedAddresses}</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Reused Address</p>
                    <p class="text-2xl font-mono text-blue-400">${reusedAddresses}</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Total Received</p>
                    <p class="text-2xl font-mono text-cyan-400">${totalReceived.toFixed(2)} BTC</p>
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
                            ${filteredAddresses.map(addr => `
                                <tr class="border-b border-gray-800 hover:bg-[#242d3d]">
                                    <td class="py-3 px-4 font-mono text-sm text-gray-300">${addr.address}</td>
                                    <td class="py-3 px-4 text-sm ${getTypeColor(addr.type)}">${addr.type}</td>
                                    <td class="py-3 px-4 text-sm text-gray-300">${addr.used} ${addr.used === 1 ? 'time' : 'times'}</td>
                                    <td class="py-3 px-4 text-sm font-mono ${addr.received > 0 ? 'text-green-400' : 'text-gray-300'}">${addr.received.toFixed(8)}</td>
                                    <td class="py-3 px-4 text-sm text-gray-400">${addr.lastUsed}</td>
                                    <td class="py-3 px-4 text-sm ${getStatusColor(addr.status)}">${addr.status}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Add back button handler
    container.querySelector('#back-to-receive').addEventListener('click', () => {
      import('./Receive.js').then((module) => {
        container.innerHTML = '';
        module.ReceiveComponent(container);
      });
    });
  }

  // Global function for filtering - simple and clean
  window.filterAddresses = (filter) => {
    currentFilter = filter;
    render();
  };

  // Initialize
  render();
}