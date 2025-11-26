import { AddressStorage } from './AddressStorage.js';

export function AddressListComponent(container) {
  let currentFilter = 'all';
  let sortBy = 'newest';

  function getFilteredAddresses() {
    let addresses = AddressStorage.getAllAddresses();

    // Apply type filter
    if (currentFilter !== 'all') {
      addresses = addresses.filter((addr) => addr.type === currentFilter);
    }

    // Apply sorting
    if (sortBy === 'newest') {
      addresses.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'oldest') {
      addresses.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === 'most-used') {
      addresses.sort((a, b) => b.used - a.used);
    } else if (sortBy === 'most-received') {
      addresses.sort((a, b) => b.received - a.received);
    }

    return addresses;
  }

  function getTypeColor(type) {
    const colors = {
      P2WPKH: 'green',
      P2WSH: 'blue',
      P2TR: 'purple',
      P2PKH: 'yellow',
      P2SH: 'orange',
    };
    return colors[type] || 'gray';
  }

  function getStatusInfo(addr) {
    if (addr.used === 0) {
      return { text: 'Unused', color: 'yellow' };
    } else if (addr.used === 1) {
      return { text: 'Used', color: 'green' };
    } else {
      return { text: `Reused (${addr.used}x)`, color: 'blue' };
    }
  }

  async function syncAddressUsage() {
    try {
      // IPC call to get UTXOs
      const data = await window.api.taker.getUtxos();

      if (!data.success) return;

      const utxos = data.utxos || [];
      const addresses = AddressStorage.getAllAddresses();

      addresses.forEach((addr) => {
        const matchingUtxos = utxos.filter(
          (u) => u.utxo.address === addr.address
        );

        if (matchingUtxos.length > 0) {
          const totalReceived = matchingUtxos.reduce(
            (sum, u) => sum + u.utxo.amount,
            0
          );

          AddressStorage.updateAddress(addr.address, {
            used: matchingUtxos.length,
            received: totalReceived,
            lastUsed: Date.now(),
          });
        }
      });
    } catch (err) {
      console.error('Failed to sync address usage:', err);
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Address copied!');
    } catch (err) {
      console.error('Failed to copy:', err);
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Address copied!');
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className =
      'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function exportAddresses() {
    const addresses = AddressStorage.getAllAddresses();

    if (addresses.length === 0) {
      showToast('No addresses to export');
      return;
    }

    const csv = [
      'Address,Type,Status,Times Used,Received (BTC),Created At,Last Used',
      ...addresses.map((addr) => {
        const statusInfo = getStatusInfo(addr);
        return `"${addr.address}","${addr.type}","${statusInfo.text}",${addr.used},${(addr.received / 100000000).toFixed(8)},"${new Date(addr.createdAt).toLocaleString()}","${AddressStorage.formatLastUsed(addr.lastUsed)}"`;
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coinswap-addresses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Addresses exported!');
  }

  function render() {
    const allAddresses = AddressStorage.getAllAddresses();
    const filteredAddresses = getFilteredAddresses();
    const stats = AddressStorage.getStats();

    // Get unique address types for filter buttons
    const addressTypes = [...new Set(allAddresses.map((a) => a.type))];

    container.innerHTML = `
      <div id="address-list-content">
        <div class="flex justify-between items-center mb-6">
          <div>
            <button id="back-to-receive" class="text-gray-400 hover:text-white transition-colors mb-4 flex items-center gap-2">
              <span>←</span> Back to Receive
            </button>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">All Addresses</h2>
            <p class="text-gray-400">Complete list of generated addresses</p>
          </div>
          <div class="flex gap-2">
            <button id="export-addresses" class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              📥 Export CSV
            </button>
            <button id="refresh-addresses" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              🔄 Refresh
            </button>
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
            <p class="text-sm text-gray-400 mb-2">Reused Addresses</p>
            <p class="text-2xl font-mono text-blue-400">${stats.reused}</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-6">
            <p class="text-sm text-gray-400 mb-2">Total Received</p>
            <p class="text-2xl font-mono text-cyan-400">${(stats.totalReceived / 100000000).toFixed(8)} BTC</p>
          </div>
        </div>

        <!-- Filter & Sort -->
        <div class="bg-[#1a2332] rounded-lg p-4 mb-6">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <!-- Type Filter -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-400 mr-2">Filter:</span>
              <button data-filter="all" class="filter-btn ${currentFilter === 'all' ? 'bg-[#FF6B35] text-white' : 'bg-[#0f1419] text-gray-400 border border-gray-700 hover:bg-[#242d3d]'} px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                All (${allAddresses.length})
              </button>
              ${addressTypes
                .map((type) => {
                  const count = allAddresses.filter(
                    (a) => a.type === type
                  ).length;
                  const color = getTypeColor(type);
                  return `
                  <button data-filter="${type}" class="filter-btn ${currentFilter === type ? 'bg-[#FF6B35] text-white' : `bg-[#0f1419] text-${color}-400 border border-gray-700 hover:bg-[#242d3d]`} px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                    ${type} (${count})
                  </button>
                `;
                })
                .join('')}
            </div>

            <!-- Sort -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-400">Sort:</span>
              <select id="sort-select" class="bg-[#0f1419] border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#FF6B35]">
                <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                <option value="oldest" ${sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                <option value="most-used" ${sortBy === 'most-used' ? 'selected' : ''}>Most Used</option>
                <option value="most-received" ${sortBy === 'most-received' ? 'selected' : ''}>Most Received</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Address Table -->
        <div class="bg-[#1a2332] rounded-lg p-6">
          <h3 class="text-xl font-semibold text-gray-300 mb-4">Address Details</h3>

          ${
            filteredAddresses.length === 0
              ? `
            <div class="text-center py-12">
              <div class="text-4xl mb-4">📭</div>
              <p class="text-gray-400 mb-4">No addresses ${currentFilter !== 'all' ? `of type ${currentFilter}` : 'generated yet'}</p>
              <button id="go-to-receive" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold px-6 py-2 rounded-lg transition-colors">
                Generate New Address
              </button>
            </div>
          `
              : `
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-700">
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Address</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Type</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Status</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Times Used</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Received</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Created</th>
                    <th class="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredAddresses
                    .map((addr) => {
                      const typeColor = getTypeColor(addr.type);
                      const statusInfo = getStatusInfo(addr);
                      const createdDate = new Date(addr.createdAt);

                      return `
                      <tr class="border-b border-gray-800 hover:bg-[#242d3d] transition-colors address-row" data-address="${addr.address}">
                        <td class="py-3 px-4">
    <div class="flex items-center gap-2">
        <a href="https://mempool.space/signet/address/${addr.address}" 
           target="_blank" 
           class="font-mono text-sm text-blue-400 hover:text-blue-300 underline truncate max-w-[200px]" 
           title="${addr.address}">
            ${addr.address.substring(0, 12)}...${addr.address.substring(addr.address.length - 8)}
        </a>
        <button class="copy-btn text-gray-500 hover:text-[#FF6B35] transition-colors" data-address="${addr.address}" title="Copy address">
            📋
        </button>
    </div>
</td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-1 rounded text-xs font-semibold bg-${typeColor}-500/20 text-${typeColor}-400 border border-${typeColor}-500/30">
                            ${addr.type}
                          </span>
                        </td>
                        <td class="py-3 px-4">
                          <span class="px-2 py-1 rounded text-xs font-semibold bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400">
                            ${statusInfo.text}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-sm text-gray-300 font-mono">${addr.used}</td>
                        <td class="py-3 px-4 text-sm font-mono ${addr.received > 0 ? 'text-green-400' : 'text-gray-500'}">
                          ${(addr.received / 100000000).toFixed(8)}
                        </td>
                        <td class="py-3 px-4 text-sm text-gray-400" title="${createdDate.toLocaleString()}">
                          ${createdDate.toLocaleDateString()}
                        </td>
                        <td class="py-3 px-4 text-sm text-gray-400">
                          ${AddressStorage.formatLastUsed(addr.lastUsed)}
                        </td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
            
            <div class="mt-4 text-center text-sm text-gray-500">
              Showing ${filteredAddresses.length} of ${allAddresses.length} addresses
            </div>
          `
          }
        </div>

        <!-- Privacy Info -->
        <div class="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h4 class="text-sm font-semibold text-blue-400 mb-2">💡 Privacy Tip</h4>
          <p class="text-xs text-blue-300">
            For best privacy, generate a new address for each transaction. Address reuse can link your transactions together and reduce your anonymity.
            Addresses marked as "Reused" have received multiple transactions and may have reduced privacy.
          </p>
        </div>
      </div>
    `;

    setupEventHandlers();
  }

  function setupEventHandlers() {
    // Back button
    const backButton = container.querySelector('#back-to-receive');
    if (backButton) {
      backButton.addEventListener('click', () => {
        import('./Receive.js').then((module) => {
          container.innerHTML = '';
          module.ReceiveComponent(container);
        });
      });
    }

    // Go to receive button (when no addresses)
    const goToReceiveButton = container.querySelector('#go-to-receive');
    if (goToReceiveButton) {
      goToReceiveButton.addEventListener('click', () => {
        import('./Receive.js').then((module) => {
          container.innerHTML = '';
          module.ReceiveComponent(container);
        });
      });
    }

    // Filter buttons
    const filterButtons = container.querySelectorAll('.filter-btn');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        render();
      });
    });

    // Sort select
    const sortSelect = container.querySelector('#sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        render();
      });
    }

    // Copy buttons
    const copyButtons = container.querySelectorAll('.copy-btn');
    copyButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const address = btn.dataset.address;
        await copyToClipboard(address);
        btn.textContent = '✓';
        setTimeout(() => {
          btn.textContent = '📋';
        }, 1500);
      });
    });

    // Export button
    const exportButton = container.querySelector('#export-addresses');
    if (exportButton) {
      exportButton.addEventListener('click', exportAddresses);
    }

    // Refresh button
    const refreshButton = container.querySelector('#refresh-addresses');
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        refreshButton.innerHTML = '⏳ Syncing...';
        refreshButton.disabled = true;
        await syncAddressUsage();
        render();
        showToast('Address list synced with wallet');
      });
    }
  }

  // Initialize
  (async () => {
    await syncAddressUsage();
    render();
  })();
}
