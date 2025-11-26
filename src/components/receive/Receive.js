import { AddressStorage } from './AddressStorage.js';

export function ReceiveComponent(container) {
  const content = document.createElement('div');
  content.id = 'receive-content';

  let currentAddress = null;
  let isGenerating = false;

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Receive Bitcoin</h2>
        <p class="text-gray-400 mb-8">Generate a new address to receive BTC</p>

        <div class="grid grid-cols-2 gap-6">
            <!-- Left: Address Display -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-300 mb-6">Your Bitcoin Address</h3>
                
                <!-- QR Code -->
                <div class="bg-white p-4 rounded-lg mb-6 flex items-center justify-center">
                    <div id="qr-container" class="flex items-center justify-center" style="min-height: 256px; min-width: 256px;">
                        <div id="qr-loading" class="text-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                            <p class="text-sm text-gray-500">Generating address...</p>
                        </div>
                    </div>
                </div>

                <!-- Address Display -->
                <div class="mb-6">
                    <div class="bg-[#0f1419] border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                        <span id="current-address" class="font-mono text-sm text-white break-all flex-1 mr-4">
                            Loading...
                        </span>
                        <button id="copy-address" disabled class="bg-[#FF6B35] hover:bg-[#ff7d4d] disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                            Copy
                        </button>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span id="address-type-badge" class="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">--</span>
                    </div>
                </div>

                <!-- Generate New Address Button -->
                <button id="generate-new" disabled class="w-full bg-[#242d3d] hover:bg-[#2d3748] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors border border-gray-700">
                    <span class="generate-text">Generate New Address</span>
                    <span class="generate-loading hidden">
                        <span class="inline-block animate-spin mr-2">⟳</span>
                        Generating...
                    </span>
                </button>
            </div>

            <!-- Right: Info & Recent Addresses -->
            <div class="space-y-6">
                <!-- Info Card -->
                <div class="mt-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p class="text-xs text-red-400">
                      ⚠️ <strong>PRIVACY WARNING:</strong> Reusing addresses can cause significant privacy reduction. Always generate a fresh address for each transaction to maintain anonymity.
                  </p>
                </div>

                <!-- Address Status Card -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Address Status</h3>
                    <div id="address-status" class="space-y-3">
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Generated:</span>
                            <span id="generation-time" class="text-white font-mono">-</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Times used:</span>
                            <span id="usage-count" class="text-white font-mono">-</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Total received:</span>
                            <span id="total-received" class="text-white font-mono">-</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Status:</span>
                            <span id="address-status-text" class="text-green-400">-</span>
                        </div>
                    </div>
                </div>

                <!-- Recent Addresses -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold text-gray-300">Recent Addresses</h3>
                        <span id="total-addresses" class="text-xs text-gray-500">0 total</span>
                    </div>
                    <div id="recent-addresses" class="space-y-2 max-h-48 overflow-y-auto">
                        <div class="text-sm text-gray-500 text-center py-4">
                            No addresses generated yet
                        </div>
                    </div>
                    
                    <button id="view-all-addresses" class="mt-4 text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold transition-colors w-full text-left">
                        View All Addresses →
                    </button>
                </div>
            </div>
        </div>
    `;

  container.appendChild(content);

  // Get DOM elements
  const currentAddressEl = content.querySelector('#current-address');
  const copyButton = content.querySelector('#copy-address');
  const generateButton = content.querySelector('#generate-new');
  const generateText = content.querySelector('.generate-text');
  const generateLoading = content.querySelector('.generate-loading');
  const qrContainer = content.querySelector('#qr-container');
  const generationTime = content.querySelector('#generation-time');
  const usageCount = content.querySelector('#usage-count');
  const totalReceived = content.querySelector('#total-received');
  const addressTypeBadge = content.querySelector('#address-type-badge');
  const addressStatusText = content.querySelector('#address-status-text');
  const recentAddressesEl = content.querySelector('#recent-addresses');
  const totalAddressesEl = content.querySelector('#total-addresses');

  // API helpers (using IPC)
  async function getNextAddress() {
    return await window.api.taker.getNextAddress();
  }

  // Generate QR code using QR Code API or canvas
  function generateQR(text) {
    // Use a public QR code API for simplicity
    // In production, you might want to use a local library like qrcode.js
    const size = 256;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=000000&margin=10`;
    
    qrContainer.innerHTML = `
      <img 
        src="${qrApiUrl}" 
        alt="QR Code for ${text}" 
        class="rounded"
        style="width: ${size}px; height: ${size}px;"
        onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'text-center text-gray-500 p-4\\'><p>QR generation failed</p><p class=\\'text-xs mt-2 font-mono\\'>${text.substring(0, 20)}...</p></div>'"
      />
    `;
  }

  // Copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = '✓ Copied!';
      copyButton.classList.add('bg-green-500');
      copyButton.classList.remove('bg-[#FF6B35]');

      setTimeout(() => {
        copyButton.textContent = 'Copy';
        copyButton.classList.remove('bg-green-500');
        copyButton.classList.add('bg-[#FF6B35]');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      copyButton.textContent = '✓ Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 2000);
    }
  }

  // Update address status display
  function updateAddressStatus(addressData) {
    if (!addressData) {
      generationTime.textContent = '-';
      usageCount.textContent = '-';
      totalReceived.textContent = '-';
      addressStatusText.textContent = '-';
      addressTypeBadge.textContent = '--';
      return;
    }

    const createdDate = new Date(addressData.createdAt);
    generationTime.textContent = createdDate.toLocaleTimeString();
    usageCount.textContent = addressData.used.toString();
    totalReceived.textContent =
      (addressData.received / 100000000).toFixed(8) + ' BTC';

    // Status
    if (addressData.used === 0) {
      addressStatusText.textContent = 'Unused';
      addressStatusText.className = 'text-yellow-400';
    } else if (addressData.used === 1) {
      addressStatusText.textContent = 'Used once';
      addressStatusText.className = 'text-green-400';
    } else {
      addressStatusText.textContent = `Used ${addressData.used} times`;
      addressStatusText.className = 'text-blue-400';
    }

    // Address type badge
    const typeColors = {
      P2WPKH: 'bg-green-500/20 text-green-400 border-green-500/30',
      P2WSH: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      P2TR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      P2PKH: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      P2SH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };
    const colorClass =
      typeColors[addressData.type] ||
      'bg-gray-500/20 text-gray-400 border-gray-500/30';
    addressTypeBadge.className = `text-xs px-2 py-1 rounded border ${colorClass}`;
    addressTypeBadge.textContent = addressData.type;
  }

  // Update recent addresses list
  function updateRecentAddresses() {
    const addresses = AddressStorage.getAllAddresses();
    totalAddressesEl.textContent = `${addresses.length} total`;

    if (addresses.length === 0) {
      recentAddressesEl.innerHTML = `
        <div class="text-sm text-gray-500 text-center py-4">
          No addresses generated yet
        </div>
      `;
      return;
    }

    // Show last 5 addresses
    const recentAddresses = addresses.slice(0, 5);

    recentAddressesEl.innerHTML = recentAddresses
      .map((addr, index) => {
        const isCurrent = addr.address === currentAddress;
        const typeColors = {
          P2WPKH: 'text-green-400',
          P2WSH: 'text-blue-400',
          P2TR: 'text-purple-400',
        };
        const typeColor = typeColors[addr.type] || 'text-gray-400';

        return `
        <div class="flex items-center justify-between p-2 rounded ${isCurrent ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/30' : 'bg-[#0f1419] hover:bg-[#242d3d]'} cursor-pointer transition-colors recent-address-item" data-address="${addr.address}">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gray-300 truncate">${addr.address.substring(0, 16)}...${addr.address.substring(addr.address.length - 8)}</span>
              ${isCurrent ? '<span class="text-xs text-[#FF6B35]">●</span>' : ''}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs ${typeColor}">${addr.type}</span>
              <span class="text-xs text-gray-500">•</span>
              <span class="text-xs text-gray-500">${addr.used > 0 ? `Used ${addr.used}x` : 'Unused'}</span>
            </div>
          </div>
          <div class="text-right ml-2">
            <div class="text-xs ${addr.received > 0 ? 'text-green-400' : 'text-gray-500'} font-mono">
              ${addr.received > 0 ? (addr.received / 100000000).toFixed(4) : '0'} BTC
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Add click handlers to switch to that address
    recentAddressesEl
      .querySelectorAll('.recent-address-item')
      .forEach((item) => {
        item.addEventListener('click', () => {
          const address = item.dataset.address;
          selectAddress(address);
        });
      });
  }

  // Select an existing address
  function selectAddress(addressString) {
    currentAddress = addressString;
    currentAddressEl.textContent = addressString;
    copyButton.disabled = false;
    generateQR(addressString);

    const addressData = AddressStorage.getAddress(addressString);
    updateAddressStatus(addressData);
    updateRecentAddresses();
  }

  // Generate new address
  async function generateNewAddress() {
    if (isGenerating) return;

    isGenerating = true;
    generateButton.disabled = true;
    generateText.classList.add('hidden');
    generateLoading.classList.remove('hidden');

    // Show loading in QR container
    qrContainer.innerHTML = `
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
        <p class="text-sm text-gray-500">Generating...</p>
      </div>
    `;

    try {
      console.log('🎯 Requesting new address...');
      const result = await getNextAddress();

      if (result.success && result.address) {
        // Handle both string and object address formats
        const addressString =
          typeof result.address === 'string'
            ? result.address
            : result.address.address;

        currentAddress = addressString;
        currentAddressEl.textContent = addressString;
        copyButton.disabled = false;

        // Save to address storage
        const savedAddress = AddressStorage.addAddress(addressString);

        // Update QR code
        generateQR(addressString);

        // Update status display
        updateAddressStatus(savedAddress);

        // Update recent addresses list
        updateRecentAddresses();

        console.log('✅ New address generated and saved:', addressString);
      } else {
        throw new Error(result.error || 'Failed to generate address');
      }
    } catch (error) {
      console.error('❌ Address generation failed:', error);
      currentAddressEl.textContent = `Error: ${error.message}`;
      qrContainer.innerHTML = `
        <div class="text-center text-red-400 p-4">
          <p class="text-2xl mb-2">❌</p>
          <p class="text-sm">Address generation failed</p>
          <p class="text-xs text-gray-500 mt-2">${error.message}</p>
        </div>
      `;
    } finally {
      isGenerating = false;
      generateButton.disabled = false;
      generateText.classList.remove('hidden');
      generateLoading.classList.add('hidden');
    }
  }

  // Initialize - always generate a new address on page load
  async function initialize() {
    try {
      // Always generate a new address
      await generateNewAddress();

      // Update recent addresses list
      updateRecentAddresses();

      // Enable generate button
      generateButton.disabled = false;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      currentAddressEl.textContent = 'Failed to initialize';
      qrContainer.innerHTML = `
      <div class="text-center text-red-400 p-4">
        <p class="text-2xl mb-2">❌</p>
        <p class="text-sm">Initialization failed</p>
        <button onclick="location.reload()" class="mt-2 text-xs underline">Retry</button>
      </div>
    `;
    }
  }

  // Event listeners
  copyButton.addEventListener('click', () => {
    if (currentAddress) {
      copyToClipboard(currentAddress);
    }
  });

  generateButton.addEventListener('click', generateNewAddress);

  // View all addresses handler
  const viewAllButton = content.querySelector('#view-all-addresses');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      import('./AddressList.js')
        .then((module) => {
          container.innerHTML = '';
          module.AddressListComponent(container);
        })
        .catch((err) => {
          console.error('Failed to load AddressList:', err);
          alert('Address list feature loading...');
        });
    });
  }

  // Initialize the component
  initialize();

  return content;
}
