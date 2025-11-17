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
                
                <!-- QR Code Placeholder -->
                <div class="bg-white p-6 rounded-lg mb-6 flex items-center justify-center">
                    <div id="qr-container" class="w-64 h-64 bg-gray-200 flex items-center justify-center text-gray-400">
                        <div id="qr-loading" class="text-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                            <p class="text-sm">Generating address...</p>
                        </div>
                    </div>
                </div>

                <!-- Address Display -->
                <div class="mb-6">
                    <div class="bg-[#0f1419] border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                        <span id="current-address" class="font-mono text-sm text-white break-all">
                            Loading...
                        </span>
                        <button id="copy-address" disabled class="ml-4 bg-[#FF6B35] hover:bg-[#ff7d4d] disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                            Copy
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">This address can be used multiple times</p>
                </div>

                <!-- Generate New Address Button -->
                <button id="generate-new" disabled class="w-full bg-[#242d3d] hover:bg-[#2d3748] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors border border-gray-700">
                    <span class="generate-text">Generate New Address</span>
                    <span class="generate-loading hidden">
                        <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                    </span>
                </button>
            </div>

            <!-- Right: Info & Recent Addresses -->
            <div class="space-y-6">
                <!-- Info Card -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">How to Receive</h3>
                    <div class="space-y-3 text-sm text-gray-400">
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">1.</span>
                            <p>Share your Bitcoin address or QR code with the sender</p>
                        </div>
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">2.</span>
                            <p>Wait for the transaction to be broadcast to the network</p>
                        </div>
                        <div class="flex gap-3">
                            <span class="text-[#FF6B35] font-bold">3.</span>
                            <p>Funds will appear after network confirmation (~10 minutes)</p>
                        </div>
                    </div>

                    <div class="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-xs text-blue-400">
                            💡 Each address can be reused, but generating new addresses improves privacy
                        </p>
                    </div>
                </div>

                <!-- Status Card -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Address Status</h3>
                    <div id="address-status" class="space-y-2">
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Generated:</span>
                            <span id="generation-time" class="text-white">-</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Times used:</span>
                            <span id="usage-count" class="text-white">-</span>
                        </div>
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">Total received:</span>
                            <span id="total-received" class="text-white">-</span>
                        </div>
                    </div>
                </div>

                <!-- Recent Addresses -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Recent Addresses</h3>
                    <div id="recent-addresses" class="space-y-3">
                        <div class="text-sm text-gray-500 text-center py-4">
                            Load your transaction history to see recent addresses
                        </div>
                    </div>
                    
                    <button id="view-all-addresses" class="mt-4 text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold transition-colors">
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
  const qrLoading = content.querySelector('#qr-loading');
  const generationTime = content.querySelector('#generation-time');
  const usageCount = content.querySelector('#usage-count');
  const totalReceived = content.querySelector('#total-received');

  // API helpers
  async function callAPI(endpoint, method = 'GET', data = null) {
    const response = await fetch(`http://localhost:3001/api${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : null
    });
    return response.json();
  }

  // Generate QR code (simple implementation)
  function generateQR(text) {
    // For now, just show the address text. In production, use a QR library like qrcode.js
    qrContainer.innerHTML = `
      <div class="text-center p-4">
        <div class="text-xs text-gray-600 mb-2">QR Code</div>
        <div class="font-mono text-xs text-gray-800 break-all">${text}</div>
        <div class="text-xs text-gray-600 mt-2">Install qrcode.js for actual QR codes</div>
      </div>
    `;
  }

  // Copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = 'Copied!';
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
      
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 2000);
    }
  }

  // Generate new address
  async function generateNewAddress() {
    if (isGenerating) return;
    
    isGenerating = true;
    generateButton.disabled = true;
    generateText.classList.add('hidden');
    generateLoading.classList.remove('hidden');
    
    try {
      console.log('🎯 Requesting new address...');
      const result = await callAPI('/taker/address', 'POST');
      
      if (result.success && result.address) {
        currentAddress = result.address;
        currentAddressEl.textContent = result.address;
        copyButton.disabled = false;
        
        // Update QR code
        generateQR(result.address);
        
        // Update status
        generationTime.textContent = new Date().toLocaleTimeString();
        usageCount.textContent = '0';
        totalReceived.textContent = '0 BTC';
        
        console.log('✅ New address generated:', result.address);
      } else {
        throw new Error(result.error || 'Failed to generate address');
      }
    } catch (error) {
      console.error('❌ Address generation failed:', error);
      currentAddressEl.textContent = `Error: ${error.message}`;
      qrContainer.innerHTML = `
        <div class="text-center text-red-400">
          <p>❌</p>
          <p class="text-sm mt-2">Address generation failed</p>
        </div>
      `;
    } finally {
      isGenerating = false;
      generateButton.disabled = false;
      generateText.classList.remove('hidden');
      generateLoading.classList.add('hidden');
    }
  }

  // Initialize - load existing address or generate new one
  async function initialize() {
    try {
      // For now, always generate a new address
      // In a full implementation, we'd check for an existing unused address first
      await generateNewAddress();
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      currentAddressEl.textContent = 'Failed to initialize';
      qrContainer.innerHTML = `
        <div class="text-center text-red-400">
          <p>❌</p>
          <p class="text-sm mt-2">Initialization failed</p>
          <button onclick="initialize()" class="mt-2 text-xs underline">Retry</button>
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
      import('./AddressList.js').then((module) => {
        container.innerHTML = '';
        module.AddressListComponent(container);
      }).catch(() => {
        alert('Address list feature not yet implemented');
      });
    });
  }

  // Initialize the component
  initialize();

  return content;
}