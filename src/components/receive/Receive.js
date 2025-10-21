export function ReceiveComponent(container) {
  const content = document.createElement('div');
  content.id = 'receive-content';

  content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Receive Bitcoin</h2>
        <p class="text-gray-400 mb-8">Generate a new address to receive BTC</p>

        <div class="grid grid-cols-2 gap-6">
            <!-- Left: Address Display -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-300 mb-6">Your Bitcoin Address</h3>
                
                <!-- QR Code Placeholder -->
                <div class="bg-white p-6 rounded-lg mb-6 flex items-center justify-center">
                    <div class="w-64 h-64 bg-gray-200 flex items-center justify-center text-gray-400">
                        QR Code
                    </div>
                </div>

                <!-- Address -->
                <div class="mb-6">
                    <div class="bg-[#0f1419] border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                        <span class="font-mono text-sm text-white break-all">
                            bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
                        </span>
                        <button class="ml-4 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded text-sm font-semibold transition-colors whitespace-nowrap">
                            Copy
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">This address can be used multiple times</p>
                </div>

                <!-- Generate New Address Button -->
                <button class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-3 rounded-lg transition-colors border border-gray-700">
                    Generate New Address
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
                            ⓘ Each address can be reused, but generating new addresses improves privacy
                        </p>
                    </div>
                </div>

                <!-- Recent Addresses -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Recent Addresses</h3>
                    <div class="space-y-3">
                        <div class="bg-[#0f1419] rounded-lg p-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-mono text-sm text-gray-300">bc1qxy2...hx0wlh</span>
                                <span class="text-xs text-green-400">Current</span>
                            </div>
                            <p class="text-xs text-gray-500">Used 0 times</p>
                        </div>
                        
                        <div class="bg-[#0f1419] rounded-lg p-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-mono text-sm text-gray-300">bc1qar0...ggf8zt</span>
                                <span class="text-xs text-gray-400">Used</span>
                            </div>
                            <p class="text-xs text-gray-500">Used 2 times • 0.05 BTC received</p>
                        </div>

                        <div class="bg-[#0f1419] rounded-lg p-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-mono text-sm text-gray-300">bc1qw50...8t63yn</span>
                                <span class="text-xs text-gray-400">Used</span>
                            </div>
                            <p class="text-xs text-gray-500">Used 1 time • 0.10 BTC received</p>
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

  // Add view all addresses handler
  const viewAllButton = content.querySelector('#view-all-addresses');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      import('./AddressList.js').then((module) => {
        container.innerHTML = '';
        module.AddressListComponent(container);
      });
    });
  }
}
