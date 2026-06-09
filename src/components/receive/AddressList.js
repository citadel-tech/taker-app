import { icons } from '../../js/icons.js';
import { formatSats } from '../../js/price.js';

export function AddressListComponent(container) {
  let currentFilter = 'all';
  let sortBy = 'newest';
  let allAddresses = [];

  function getSpendTypeDisplay(spendType = '') {
    const normalized = String(spendType || '').toLowerCase();
    if (normalized.includes('swap')) return 'Swap';
    if (normalized.includes('contract')) return 'Contract';
    if (normalized.includes('seed') || normalized.includes('regular')) return 'Regular';
    return 'Regular';
  }

  function extractSpendType(tx) {
    const candidates = [
      tx?.detail?.address?.spendType,
      tx?.detail?.address?.spendInfo?.spendType,
      tx?.detail?.spendType,
      tx?.detail?.spendInfo?.spendType,
      tx?.detail?.label,
    ];

    const match = candidates.find((value) => typeof value === 'string' && value.trim());
    return getSpendTypeDisplay(match);
  }

  // Fetch addresses from transactions
  async function fetchAddresses() {
    try {
const result = await window.api.taker.getTransactions(200, 0);
      
      if (!result.success || !result.transactions) {
        return [];
      }

      const addressMap = new Map();

      result.transactions.forEach(tx => {
        const category = (tx.detail.category || '').toLowerCase();
        
        if (category === 'receive' || category === '"receive"') {
          const addr = tx.detail.address?.address || tx.detail.address;
          
          if (addr) {
            if (!addressMap.has(addr)) {
              addressMap.set(addr, {
                address: addr,
                used: 0,
                received: 0,
                createdAt: (tx.info.blocktime || tx.info.time) * 1000,
                type: detectAddressType(addr, extractSpendType(tx)),
                spendType: extractSpendType(tx),
                lastUsed: (tx.info.blocktime || tx.info.time) * 1000
              });
            }
            
            const addrData = addressMap.get(addr);
            addrData.used++;
            addrData.received += (tx.detail.amount?.sats || 0);
            addrData.lastUsed = Math.max(addrData.lastUsed, (tx.info.blocktime || tx.info.time) * 1000);
          }
        }
      });

      return Array.from(addressMap.values());
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
      return [];
    }
  }

  function detectAddressType(address, fallbackSpendType = '') {
    if (address.startsWith('bc1q') || address.startsWith('tb1q') || address.startsWith('bcrt1q')) {
      return address.length > 50 ? 'P2WSH' : 'P2WPKH';
    }
    if (address.startsWith('bc1p') || address.startsWith('tb1p') || address.startsWith('bcrt1p')) return 'P2TR';
    if (address.startsWith('3')) return 'P2SH';
    if (address.startsWith('1')) return 'P2PKH';
    if (address.startsWith('2')) return 'P2SH';
    if (address.startsWith('m') || address.startsWith('n')) return 'P2PKH';

    const spendType = getSpendTypeDisplay(fallbackSpendType);
    if (spendType === 'Contract' || spendType === 'Swap') return 'P2WSH';
    return 'P2WPKH';
  }

  function getFilteredAddresses() {
    let addresses = [...allAddresses];

    // Apply spend-type filter
    if (currentFilter !== 'all') {
      addresses = addresses.filter(
        (addr) => addr.spendType.toLowerCase() === currentFilter
      );
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
      P2SH: 'yellow',
    };
    return colors[type] || 'gray';
  }

  function formatLastUsed(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  function getStats() {
    const used = allAddresses.filter(a => a.used > 0).length;
    const reused = allAddresses.filter(a => a.used > 1).length;
    const totalReceived = allAddresses.reduce((sum, a) => sum + a.received, 0);
    
    return {
      used,
      reused,
      totalReceived
    };
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
    if (allAddresses.length === 0) {
      showToast('No addresses to export');
      return;
    }

    const csv = [
      'Address,Type,Spend Type,Times Used,Received (sats),Created At,Last Used',
      ...allAddresses.map((addr) => {
        return `"${addr.address}","${addr.type}","${addr.spendType}",${addr.used},${Math.round(addr.received)},"${new Date(addr.createdAt).toLocaleString()}","${formatLastUsed(addr.lastUsed)}"`;
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
    const filteredAddresses = getFilteredAddresses();
    const stats = getStats();
    const spendTypeFilters = [
      { value: 'regular', label: 'Regular' },
      { value: 'contract', label: 'Contract' },
      { value: 'swap', label: 'Swap' },
    ];

    container.innerHTML = `
      <div id="address-list-content" class="app-page address-list-page">
        <div class="app-head">
          <div>
            <button id="back-to-receive" class="app-button ghost sm" type="button">
              ${icons.arrowLeft(14)} Back to Receive
            </button>
            <h2>All Addresses</h2>
            <p>Addresses derived from transaction history</p>
          </div>
          <div class="app-actions">
            <button id="export-addresses" class="app-button secondary" type="button">
              ${icons.arrowDownCircle(14)} Export CSV
            </button>
            <button id="refresh-addresses" class="app-button primary" type="button">
              ${icons.refreshCw(14)} Refresh
            </button>
          </div>
        </div>

        <section class="address-stats">
          <div class="app-card">
            <span class="app-accent"></span>
            <span class="app-card-label">Used Addresses</span>
            <strong>${stats.used}</strong>
          </div>
          <div class="app-card">
            <span class="app-accent"></span>
            <span class="app-card-label">Reused Addresses</span>
            <strong>${stats.reused}</strong>
          </div>
          <div class="app-card">
            <span class="app-accent"></span>
            <span class="app-card-label">Total Received</span>
            <strong>${formatSats(stats.totalReceived)}</strong>
          </div>
        </section>

        <section class="address-panel">
          <div class="address-toolbar">
            <div class="address-filter-group">
              <span>Filter</span>
              <button data-filter="all" class="address-filter-btn ${currentFilter === 'all' ? 'is-active' : ''}" type="button">
                All (${allAddresses.length})
              </button>
              ${spendTypeFilters
                .map((type) => {
                  const count = allAddresses.filter(
                    (a) => a.spendType === type.label
                  ).length;
                  return `
                  <button data-filter="${type.value}" class="address-filter-btn ${currentFilter === type.value ? 'is-active' : ''}" type="button">
                    ${type.label} (${count})
                  </button>
                `;
                })
                .join('')}
            </div>

            <label class="address-sort">
              <span>Sort</span>
              <select id="sort-select">
                <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                <option value="oldest" ${sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                <option value="most-used" ${sortBy === 'most-used' ? 'selected' : ''}>Most Used</option>
                <option value="most-received" ${sortBy === 'most-received' ? 'selected' : ''}>Most Received</option>
              </select>
            </label>
          </div>

          <div class="address-panel-head">
            <h3>Address Details</h3>
            <span>Showing ${filteredAddresses.length} of ${allAddresses.length}</span>
          </div>

          ${
            filteredAddresses.length === 0
              ? `
            <div class="address-empty">
              ${icons.inbox(44)}
              <p>No addresses ${currentFilter !== 'all' ? `for ${currentFilter} spend type` : 'found in transaction history'}</p>
              <button id="go-to-receive" class="app-button primary" type="button">
                Generate New Address
              </button>
            </div>
          `
              : `
            <div class="address-table-wrap">
              <table class="address-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Type</th>
                    <th>Spend Type</th>
                    <th>Times Used</th>
                    <th>Received</th>
                    <th>Created</th>
                    <th>Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredAddresses
                    .map((addr) => {
                      const typeClass = `is-${getTypeColor(addr.type)}`;
                      const spendTypeClass =
                        addr.spendType === 'Regular'
                          ? 'is-green'
                          : addr.spendType === 'Contract'
                            ? 'is-yellow'
                            : 'is-blue';
                      const createdDate = new Date(addr.createdAt);

                      return `
                      <tr class="address-row" data-address="${addr.address}">
                        <td>
                          <div class="address-cell">
                            <a href="https://mutinynet.com/address/${addr.address}" 
                               target="_blank" 
                               title="${addr.address}">
                                ${addr.address.substring(0, 12)}...${addr.address.substring(addr.address.length - 8)}
                            </a>
                            <button class="copy-btn" data-address="${addr.address}" title="Copy address" type="button">
                                ${icons.clipboardCopy(14)}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span class="address-badge ${typeClass}">
                            ${addr.type}
                          </span>
                        </td>
                        <td>
                          <span class="address-badge ${spendTypeClass}">
                            ${addr.spendType}
                          </span>
                        </td>
                        <td>${addr.used}</td>
                        <td class="${addr.received > 0 ? 'is-positive' : 'is-muted'}">
                          ${formatSats(addr.received)}
                        </td>
                        <td title="${createdDate.toLocaleString()}">
                          ${createdDate.toLocaleDateString()}
                        </td>
                        <td>
                          ${formatLastUsed(addr.lastUsed)}
                        </td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </section>
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

    // Go to receive button
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
    const filterButtons = container.querySelectorAll('.address-filter-btn');
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
          btn.innerHTML = icons.clipboardCopy(14);
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
        refreshButton.innerHTML = 'Refreshing...';
        refreshButton.disabled = true;
        allAddresses = await fetchAddresses();
        render();
        showToast('Address list refreshed');
      });
    }
  }

  // Initialize
  (async () => {
    container.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p class="text-gray-400">Loading addresses...</p>
        </div>
      </div>
    `;
    
    allAddresses = await fetchAddresses();
    render();
  })();
}
