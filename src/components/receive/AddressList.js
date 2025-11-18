import { AddressStorage } from '../storage/Addressstorage.js';

export function AddressListComponent(container) {
  let currentFilter = 'all';

  function getFilteredAddresses() {
    const addresses = AddressStorage.getAllAddresses();
    if (currentFilter === 'all') return addresses;
    return addresses.filter(addr => addr.type === currentFilter);
  }

  function getTypeColor(type) {
    const colors = { 
      'P2WPKH': 'text-blue-400', 
      'P2WSH': 'text-cyan-400', 
      'P2TR': 'text-purple-400',
      'P2PKH': 'text-yellow-400',
      'P2SH': 'text-orange-400'
    };
    return colors[type] || 'text-gray-400';
  }

  function getStatusColor(status) {
    const colors = { 
      'Current': 'text-green-400', 
      'Used': 'text-gray-400', 
      'Unused': 'text-yellow-400' 
    };
    return colors[status] || 'text-gray-400';
  }

  function render() {
    const allAddresses = AddressStorage.getAllAddresses();
    const filteredAddresses = getFilteredAddresses();
    const stats = AddressStorage.getStats();

    // Get unique address types for filter buttons
    const addressTypes = [...new Set(allAddresses.map(a => a.type))];

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
                    <button onclick="window.filterAddresses('all')" 
                            class="${currentFilter === 'all' ? 'bg-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'} rounded-lg p-3 text-left transition-colors">
                        <div class="text-white font-semibold text-sm">All Types</div>
                        <div class="text-xs ${currentFilter === 'all' ? 'text-white/80' : 'text-gray-400'} mt-1">${allAddresses.length} addresses</div>
                    </button>
                    ${addressTypes.map(type => {
                        const count = allAddresses.filter(a => a.type === type).length;
                        return `
                            <button onclick="window.filterAddresses('${type}')" 
                                    class="${currentFilter === type ? 'bg-[#FF6B35] border-2 border-[#FF6B35]' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'} rounded-lg p-3 text-left transition-colors">
                                <div class="text-white font-semibold text-sm">${type}</div>
                                <div class="text-xs ${currentFilter === type ? 'text-white/80' : 'text-gray-400'} mt-1">${count} address${count !== 1 ? 'es' : ''}</div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Address Stats -->
            <div class="grid grid-cols-4 gap-4 mb-6">
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Total Addresses</p>
                    <p class="text-2xl font-mono text-[#FF6B35]">${stats.total}</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Used Addresses</p>
                    <p class="text-2xl font-mono text-green-400">${stats.used}</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Reused Address</p>
                    <p class="text-2xl font-mono text-blue-400">${stats.reused}</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <p class="text-sm text-gray-400 mb-2">Total Received</p>
                    <p class="text-2xl font-mono text-cyan-400">${(stats.totalReceived / 100000000).toFixed(8)} BTC</p>
                </div>
            </div>

            <!-- Address Table -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-semibold text-gray-300">Address Details</h3>
                    ${filteredAddresses.length === 0 ? '' : `
                        <button id="export-addresses" class="text-sm bg-[#242d3d] hover:bg-[#2d3748] text-white px-4 py-2 rounded-lg transition-colors">
                            Export CSV
                        </button>
                    `}
                </div>

                ${filteredAddresses.length === 0 ? `
                    <div class="text-center py-8">
                        <p class="text-gray-400 mb-4">No addresses generated yet</p>
                        <button id="go-to-receive" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold px-6 py-2 rounded-lg transition-colors">
                            Generate First Address
                        </button>
                    </div>
                ` : `
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
                                    <tr class="border-b border-gray-800 hover:bg-[#242d3d] cursor-pointer" onclick="window.copyAddress('${addr.address}')">
                                        <td class="py-3 px-4">
                                            <div class="flex items-center space-x-2">
                                                <span class="font-mono text-sm text-gray-300">${addr.address}</span>
                                                <span class="text-xs text-gray-500 hover:text-gray-300">📋</span>
                                            </div>
                                        </td>
                                        <td class="py-3 px-4 text-sm ${getTypeColor(addr.type)}">${addr.type}</td>
                                        <td class="py-3 px-4 text-sm text-gray-300">${addr.used} ${addr.used === 1 ? 'time' : 'times'}</td>
                                        <td class="py-3 px-4 text-sm font-mono ${addr.received > 0 ? 'text-green-400' : 'text-gray-300'}">${(addr.received / 100000000).toFixed(8)}</td>
                                        <td class="py-3 px-4 text-sm text-gray-400">${AddressStorage.formatLastUsed(addr.lastUsed)}</td>
                                        <td class="py-3 px-4 text-sm ${getStatusColor(addr.status)}">${addr.status}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Note about address reuse -->
            ${currentFilter === 'all' && stats.total === 1 ? `
                <div class="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p class="text-sm text-yellow-400">
                        ⚠️ Currently generating the same address due to technical limitations. 
                        This will be fixed in a future update. Your funds are safe.
                    </p>
                </div>
            ` : ''}
        </div>
    `;

    // Add event handlers
    const backButton = container.querySelector('#back-to-receive');
    if (backButton) {
      backButton.addEventListener('click', () => {
        import('./Receive.js').then((module) => {
          container.innerHTML = '';
          module.ReceiveComponent(container);
        });
      });
    }

    const goToReceiveButton = container.querySelector('#go-to-receive');
    if (goToReceiveButton) {
      goToReceiveButton.addEventListener('click', () => {
        import('./Receive.js').then((module) => {
          container.innerHTML = '';
          module.ReceiveComponent(container);
        });
      });
    }

    const exportButton = container.querySelector('#export-addresses');
    if (exportButton) {
      exportButton.addEventListener('click', exportAddresses);
    }
  }

  // Export addresses to CSV
  function exportAddresses() {
    const addresses = AddressStorage.getAllAddresses();
    const csv = [
      'Address,Type,Used,Received (BTC),Last Used,Status,Created At',
      ...addresses.map(addr => 
        `"${addr.address}","${addr.type}",${addr.used},${(addr.received / 100000000).toFixed(8)},"${AddressStorage.formatLastUsed(addr.lastUsed)}","${addr.status}","${new Date(addr.createdAt).toLocaleString()}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coinswap-addresses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Copy address to clipboard
  window.copyAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      // Show temporary toast
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = 'Address copied!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Global function for filtering
  window.filterAddresses = (filter) => {
    currentFilter = filter;
    render();
  };

  // Initialize
  render();
}