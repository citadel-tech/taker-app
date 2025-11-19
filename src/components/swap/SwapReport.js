export function SwapReportComponent(container, swapReport) {
  console.log('📊 SwapReportComponent loading with report:', swapReport);
  
  const content = document.createElement('div');
  content.id = 'swap-report-content';

  // Helper functions
  function satsToBtc(sats) {
    return (sats / 100000000).toFixed(8);
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Copied to clipboard!');
    });
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }

  const makerColors = ['#FF6B35', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];

  // UI
  content.innerHTML = `
    <style>
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @keyframes flowAnimation {
        0% {
          stroke-dashoffset: 1000;
        }
        100% {
          stroke-dashoffset: 0;
        }
      }

      .animate-fade-in-up {
        animation: fadeInUp 0.6s ease-out forwards;
      }

      .animate-slide-in {
        animation: slideIn 0.5s ease-out forwards;
      }

      .stagger-1 { animation-delay: 0.1s; }
      .stagger-2 { animation-delay: 0.2s; }
      .stagger-3 { animation-delay: 0.3s; }
      .stagger-4 { animation-delay: 0.4s; }

      .flow-path {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: flowAnimation 2s ease-out forwards;
      }

      .broken-link {
        position: relative;
      }

      .broken-link::before {
        content: "🔓";
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 24px;
        animation: pulse 2s infinite;
      }
    </style>

    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8 animate-fade-in-up">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-gradient-to-br from-[#FF6B35] to-[#ff8c5a] rounded-xl flex items-center justify-center shadow-lg">
              <span class="text-3xl">🪙</span>
            </div>
            <div>
              <h2 class="text-4xl font-bold bg-gradient-to-r from-[#FF6B35] to-[#ff8c5a] bg-clip-text text-transparent">
                Coinswap Report
              </h2>
              <p class="text-gray-400 text-sm mt-1">Privacy-Enhanced Bitcoin Transaction</p>
            </div>
          </div>
          <button id="back-to-wallet" class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-6 py-3 rounded-lg transition-all hover:scale-105">
            ← Back to Wallet
          </button>
        </div>
        
        <div class="flex items-center gap-4">
          <div class="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg backdrop-blur-sm">
            <span class="text-green-400 font-semibold">✅ SWAP COMPLETED SUCCESSFULLY</span>
          </div>
          <div class="px-4 py-2 bg-[#1a2332] rounded-lg">
            <span class="text-gray-400 text-sm">ID: </span>
            <span class="font-mono text-white text-sm">${swapReport.swapId}</span>
          </div>
        </div>
      </div>

      <!-- Visual Flow Diagram - THE MAIN ATTRACTION -->
      <div class="mb-8 animate-fade-in-up stagger-1">
        <div class="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-xl p-8 border border-[#FF6B35]/20 shadow-2xl">
          <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span>🔗</span> Transaction Path Visualization
            <span class="text-sm font-normal text-gray-400">(On-Chain Linkability Eliminated)</span>
          </h3>
          
          <!-- Technical Explanation Box -->
          <div class="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 class="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
              <span>ℹ️</span> How Link Breaking Works
            </h4>
            <div class="text-xs text-gray-300 space-y-1">
              <p>• <strong>No Common Ownership:</strong> Each hop uses UTXOs from different owners (you → maker1 → maker2 → you)</p>
              <p>• <strong>Atomic Swaps:</strong> HTLCs ensure coins actually change hands at each step</p>
              <p>• <strong>Fresh Keys:</strong> New addresses generated at every hop</p>
              <p>• <strong>Result:</strong> Blockchain observers cannot prove transactions are related - the link is cryptographically broken</p>
            </div>
          </div>
          
          <!-- Before Coinswap -->
          <div class="mb-8">
            <p class="text-red-400 font-semibold mb-3">❌ Before Coinswap (Observable Link):</p>
            <div class="flex items-center justify-center gap-4 p-6 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div class="flex flex-col items-center">
                <div class="w-20 h-20 bg-red-500/20 border-2 border-red-500 rounded-lg flex items-center justify-center">
                  <span class="text-2xl">👤</span>
                </div>
                <p class="text-xs text-gray-400 mt-2">Your Wallet</p>
              </div>
              
              <div class="flex-1 flex items-center justify-center relative">
                <svg width="200" height="40" class="mx-4">
                  <line x1="0" y1="20" x2="200" y2="20" stroke="#ef4444" stroke-width="3" stroke-dasharray="5,5"/>
                  <text x="100" y="15" fill="#ef4444" font-size="10" text-anchor="middle" font-weight="bold">
                    TRACEABLE
                  </text>
                </svg>
              </div>
              
              <div class="flex flex-col items-center">
                <div class="w-20 h-20 bg-red-500/20 border-2 border-red-500 rounded-lg flex items-center justify-center">
                  <span class="text-2xl">🏪</span>
                </div>
                <p class="text-xs text-gray-400 mt-2">Destination</p>
              </div>
            </div>
          </div>

          <!-- After Coinswap -->
          <div>
            <p class="text-green-400 font-semibold mb-3">✅ After Coinswap (Links Broken):</p>
            <div class="p-6 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div class="flex items-center justify-between relative">
                
                <!-- Start -->
                <div class="flex flex-col items-center z-10" style="flex: 0 0 100px;">
                  <div class="w-24 h-24 bg-gradient-to-br from-[#FF6B35] to-[#ff8c5a] rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                    <span class="text-3xl">👤</span>
                  </div>
                  <p class="text-xs text-white mt-2 font-semibold">You</p>
                  <p class="text-xs text-gray-500">${satsToBtc(swapReport.targetAmount)} BTC</p>
                </div>

                ${Array.from({ length: swapReport.makersCount }, (_, i) => {
                  const color = makerColors[i % makerColors.length];
                  return `
                    <!-- Arrow ${i + 1} with Enhanced Broken Indicator -->
                    <div class="flex-1 flex flex-col items-center justify-center relative px-4 group">
                      <svg width="100%" height="60" style="overflow: visible;">
                        <defs>
                          <marker id="arrowhead${i}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                            <polygon points="0 0, 10 3, 0 6" fill="${color}" />
                          </marker>
                        </defs>
                        <path d="M 0 30 Q 50 10, 100% 30" stroke="${color}" stroke-width="3" fill="none" 
                              marker-end="url(#arrowhead${i})" class="flow-path" style="animation-delay: ${i * 0.3}s"/>
                        <text x="50%" y="20" fill="${color}" font-size="10" text-anchor="middle" font-weight="bold" class="cursor-help">
                          🔓 BROKEN
                        </text>
                      </svg>
                      <!-- Detailed Tooltip on Hover -->
                      <div class="hidden group-hover:block absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-72 bg-[#0f1419] border-2 border-${color} rounded-lg p-4 shadow-2xl z-50" style="border-color: ${color};">
                        <p class="text-sm font-bold mb-3" style="color: ${color};">🔓 Link Broken - Hop ${i + 1}</p>
                        <div class="text-xs text-gray-300 space-y-2">
                          <div class="flex items-start gap-2">
                            <span class="text-green-400 mt-0.5">✓</span>
                            <div>
                              <strong class="text-white">No Common Ownership:</strong> Transaction ${i + 1} uses Maker ${i + 1}'s UTXO (not yours)
                            </div>
                          </div>
                          <div class="flex items-start gap-2">
                            <span class="text-green-400 mt-0.5">✓</span>
                            <div>
                              <strong class="text-white">HTLC Swap:</strong> Atomic swap ensures coins actually change hands
                            </div>
                          </div>
                          <div class="flex items-start gap-2">
                            <span class="text-green-400 mt-0.5">✓</span>
                            <div>
                              <strong class="text-white">Fresh Address:</strong> New keys generated, no address reuse
                            </div>
                          </div>
                          <div class="flex items-start gap-2">
                            <span class="text-green-400 mt-0.5">✓</span>
                            <div>
                              <strong class="text-white">Result:</strong> Blockchain observers cannot prove this tx is related to previous one
                            </div>
                          </div>
                        </div>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">Hop ${i + 1}</p>
                    </div>

                    <!-- Maker ${i + 1} -->
                    <div class="flex flex-col items-center z-10" style="flex: 0 0 100px;">
                      <div class="w-24 h-24 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform border-2"
                           style="background: linear-gradient(135deg, ${color}20, ${color}40); border-color: ${color};">
                        <span class="text-2xl font-bold" style="color: ${color};">M${i + 1}</span>
                      </div>
                      <p class="text-xs text-white mt-2 font-semibold">Maker ${i + 1}</p>
                      <p class="text-xs text-gray-500 font-mono">${swapReport.makerAddresses[i]?.substring(0, 6)}...</p>
                    </div>
                  `;
                }).join('')}

                <!-- Final Arrow with Enhanced Broken Indicator -->
                <div class="flex-1 flex flex-col items-center justify-center relative px-4 group">
                  <svg width="100%" height="60" style="overflow: visible;">
                    <defs>
                      <marker id="arrowheadFinal" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="#10B981" />
                      </marker>
                    </defs>
                    <path d="M 0 30 Q 50 10, 100% 30" stroke="#10B981" stroke-width="3" fill="none" 
                          marker-end="url(#arrowheadFinal)" class="flow-path" style="animation-delay: ${swapReport.makersCount * 0.3}s"/>
                    <text x="50%" y="20" fill="#10B981" font-size="10" text-anchor="middle" font-weight="bold" class="cursor-help">
                      🔓 BROKEN
                    </text>
                  </svg>
                  <!-- Detailed Tooltip on Hover -->
                  <div class="hidden group-hover:block absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-72 bg-[#0f1419] border-2 border-green-500 rounded-lg p-4 shadow-2xl z-50">
                    <p class="text-sm font-bold text-green-400 mb-3">🔓 Final Link Broken - Your Coins Return</p>
                    <div class="text-xs text-gray-300 space-y-2">
                      <div class="flex items-start gap-2">
                        <span class="text-green-400 mt-0.5">✓</span>
                        <div>
                          <strong class="text-white">Back to You:</strong> Final HTLC returns coins to your fresh address
                        </div>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="text-green-400 mt-0.5">✓</span>
                        <div>
                          <strong class="text-white">Complete Break:</strong> No on-chain evidence linking your original UTXO to this final one
                        </div>
                      </div>
                      <div class="flex items-start gap-2">
                        <span class="text-green-400 mt-0.5">✓</span>
                        <div>
                          <strong class="text-white">Result:</strong> You have clean Bitcoin with no traceable history from the swap
                        </div>
                      </div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Final Hop</p>
                </div>

                <!-- End -->
                <div class="flex flex-col items-center z-10" style="flex: 0 0 100px;">
                  <div class="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                    <span class="text-3xl">👤</span>
                  </div>
                  <p class="text-xs text-white mt-2 font-semibold">You</p>
                  <p class="text-xs text-gray-500">${satsToBtc(swapReport.totalOutputAmount)} BTC</p>
                </div>

              </div>
            </div>
          </div>

          <!-- Technical Privacy Explanation -->
          <div class="mt-6 space-y-4">
            <!-- Main Explanation -->
            <div class="p-5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 rounded-lg">
              <h4 class="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                <span>🔒</span> How Coinswap Breaks Transaction Links
              </h4>
              <p class="text-sm text-gray-200 mb-3">
                Unlike traditional Bitcoin transactions where you can trace coins from sender to receiver, coinswap creates <strong>cryptographically unlinkable hops</strong> 
                that make it impossible for blockchain observers to follow the money trail.
              </p>
            </div>

            <!-- Technical Details Grid -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Box 1: UTXO Ownership -->
              <div class="bg-[#1a2332] border border-blue-500/30 rounded-lg p-4">
                <h5 class="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <span>👥</span> Different UTXO Ownership
                </h5>
                <p class="text-xs text-gray-300 leading-relaxed">
                  Each transaction in the chain uses UTXOs from <strong>different owners</strong>. Your original UTXO → Maker1's UTXO → Maker2's UTXO → Your new UTXO. 
                  No common input ownership means no on-chain link.
                </p>
              </div>

              <!-- Box 2: HTLCs -->
              <div class="bg-[#1a2332] border border-green-500/30 rounded-lg p-4">
                <h5 class="text-sm font-bold text-green-400 mb-2 flex items-center gap-2">
                  <span>⚛️</span> HTLC Atomic Swaps
                </h5>
                <p class="text-xs text-gray-300 leading-relaxed">
                  Hash Time-Locked Contracts ensure coins <strong>actually swap ownership</strong> atomically. Not just passing through - genuine ownership change at each hop. 
                  If any hop fails, the entire swap reverts.
                </p>
              </div>

              <!-- Box 3: Fresh Keys -->
              <div class="bg-[#1a2332] border border-yellow-500/30 rounded-lg p-4">
                <h5 class="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                  <span>🔑</span> Fresh Addresses
                </h5>
                <p class="text-xs text-gray-300 leading-relaxed">
                  Every hop generates <strong>brand new addresses</strong> with new private keys. No address reuse, no key reuse. 
                  Combined with ownership changes, this eliminates heuristic-based tracking.
                </p>
              </div>

              <!-- Box 4: Blockchain View -->
              <div class="bg-[#1a2332] border border-red-500/30 rounded-lg p-4">
                <h5 class="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                  <span>👁️</span> Observer's Perspective
                </h5>
                <p class="text-xs text-gray-300 leading-relaxed">
                  To an outside observer: ${swapReport.makersCount + 1} <strong>unrelated transactions</strong> with no provable connection. 
                  They can't prove Tx1 output became Tx2 input, or that you're involved in both.
                </p>
              </div>
            </div>

            <!-- vs Traditional Transaction -->
            <div class="bg-[#0f1419] border border-gray-700 rounded-lg p-4">
              <h5 class="text-sm font-bold text-gray-300 mb-3">🔍 Comparison: Regular vs Coinswap</h5>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-red-400 font-semibold mb-2">❌ Regular Transaction:</p>
                  <ul class="text-xs text-gray-400 space-y-1 list-disc list-inside">
                    <li>Single transaction visible</li>
                    <li>Clear input → output path</li>
                    <li>Easily traceable</li>
                    <li>Common ownership analysis</li>
                  </ul>
                </div>
                <div>
                  <p class="text-xs text-green-400 font-semibold mb-2">✅ Coinswap Transaction:</p>
                  <ul class="text-xs text-gray-400 space-y-1 list-disc list-inside">
                    <li>${swapReport.makersCount + 1} separate transactions</li>
                    <li>No provable connections</li>
                    <li>Untraceable across hops</li>
                    <li>Ownership breaks at each hop</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        ${[
          { label: 'Swap Amount', value: satsToBtc(swapReport.targetAmount) + ' BTC', subtext: swapReport.targetAmount.toLocaleString() + ' sats', color: 'from-[#FF6B35] to-[#ff8c5a]', icon: '💰' },
          { label: 'Duration', value: formatDuration(swapReport.swapDurationSeconds), subtext: swapReport.swapDurationSeconds.toFixed(1) + 's total', color: 'from-cyan-500 to-blue-500', icon: '⏱️' },
          { label: 'Privacy Hops', value: swapReport.makersCount + 1, subtext: swapReport.makersCount + ' makers used', color: 'from-purple-500 to-pink-500', icon: '🔗' },
          { label: 'Total Fee', value: swapReport.feePercentage.toFixed(2) + '%', subtext: swapReport.totalFee.toLocaleString() + ' sats', color: 'from-yellow-500 to-orange-500', icon: '💸' }
        ].map((stat, idx) => `
          <div class="bg-[#1a2332] rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer animate-fade-in-up stagger-${idx + 1}">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-white">${stat.label}</p>
              <span class="text-2xl">${stat.icon}</span>
            </div>
            <p class="text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent">${stat.value}</p>
            <p class="text-xs text-gray-500 mt-1">${stat.subtext}</p>
          </div>
        `).join('')}
      </div>

      <!-- Details Grid -->
      <div class="grid grid-cols-3 gap-6">
        
        <!-- Transactions & Fees -->
        <div class="col-span-2 space-y-6">
          
          <!-- Transactions -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-2">
            <h3 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span>📝</span> Funding Transactions
            </h3>
            <div class="space-y-3">
              ${swapReport.fundingTxidsByHop.map((txids, hopIdx) => `
                <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-800 hover:border-[#FF6B35]/50 transition-colors">
                  <p class="text-sm font-semibold mb-2" style="color: ${makerColors[hopIdx % makerColors.length]}">
                    <span class="inline-block w-6 h-6 rounded-full text-center leading-6 text-xs" 
                          style="background: ${makerColors[hopIdx % makerColors.length]}20; border: 2px solid ${makerColors[hopIdx % makerColors.length]}">
                      ${hopIdx + 1}
                    </span>
                    Hop ${hopIdx + 1}
                  </p>
                  ${txids.map((txid, txIdx) => `
                    <div class="flex items-center justify-between group hover:bg-[#1a2332] p-2 rounded transition-colors">
                      <p class="font-mono text-xs text-gray-300 flex-1">${txid.substring(0, 20)}...${txid.substring(-12)}</p>
                      <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="copy-txid-btn text-gray-400 hover:text-white text-sm transition-colors" 
                                data-txid="${txid}" title="Copy">📋</button>
                        <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm transition-colors" 
                                data-txid="${txid}" title="View">🔍</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Makers -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-3">
            <h3 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span>🤝</span> Swap Partners
            </h3>
            <div class="grid grid-cols-2 gap-3">
              ${swapReport.makerAddresses.map((addr, idx) => `
                <div class="bg-[#0f1419] rounded-lg p-4 border hover:scale-105 transition-transform cursor-pointer"
                     style="border-color: ${makerColors[idx % makerColors.length]}40;">
                  <div class="flex items-center gap-3 mb-2">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
                         style="background: ${makerColors[idx % makerColors.length]}20; color: ${makerColors[idx % makerColors.length]};">
                      M${idx + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-gray-400">Maker ${idx + 1}</p>
                      <p class="font-mono text-xs text-white truncate">${addr.substring(0, 16)}...</p>
                    </div>
                    <button class="copy-maker-btn text-gray-400 hover:text-white transition-colors" data-address="${addr}">
                      📋
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

        <!-- Right Sidebar -->
        <div class="space-y-6">
          
          <!-- Fee Breakdown -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-2">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>💰</span> Fee Details
            </h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center pb-3 border-b border-gray-700">
                <span class="text-sm text-gray-400">Maker Fees</span>
                <span class="font-mono text-sm text-yellow-400">${swapReport.totalMakerFees.toLocaleString()}</span>
              </div>
              <div class="flex justify-between items-center pb-3 border-b border-gray-700">
                <span class="text-sm text-gray-400">Mining Fees</span>
                <span class="font-mono text-sm text-cyan-400">${swapReport.miningFee.toLocaleString()}</span>
              </div>
              <div class="flex justify-between items-center pt-2">
                <span class="text-sm font-semibold text-white">Total</span>
                <div class="text-right">
                  <p class="font-mono text-lg text-[#FF6B35] font-bold">${swapReport.totalFee.toLocaleString()}</p>
                  <p class="text-xs text-gray-500">${satsToBtc(swapReport.totalFee)} BTC</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Privacy Impact -->
          <div class="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-6 animate-fade-in-up stagger-3">
            <h3 class="text-lg font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <span>🔒</span> Privacy Achieved
            </h3>
            <ul class="space-y-2 text-sm">
              <li class="flex items-start gap-2 text-purple-200">
                <span class="text-green-400 mt-0.5">✓</span>
                <span><span class="font-bold">${swapReport.makersCount + 1}</span> transaction hops completed</span>
              </li>
              <li class="flex items-start gap-2 text-purple-200">
                <span class="text-green-400 mt-0.5">✓</span>
                <span>Links broken at each hop</span>
              </li>
              <li class="flex items-start gap-2 text-purple-200">
                <span class="text-green-400 mt-0.5">✓</span>
                <span>No common input ownership</span>
              </li>
              <li class="flex items-start gap-2 text-purple-200">
                <span class="text-green-400 mt-0.5">✓</span>
                <span>Enhanced anonymity set</span>
              </li>
            </ul>
          </div>

          <!-- UTXO Summary -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-4">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📦</span> UTXO Summary
            </h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Inputs</span>
                <span class="font-mono text-white">${swapReport.inputUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Regular Outputs</span>
                <span class="font-mono text-green-400">${swapReport.outputRegularUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Swap Coins</span>
                <span class="font-mono text-blue-400">${swapReport.outputSwapUtxos.length}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-8 flex gap-4 animate-fade-in-up stagger-4">
        <button id="export-report" class="flex-1 bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold py-4 rounded-lg transition-all hover:scale-105">
          📥 Export Report
        </button>
        <button id="done-btn" class="flex-1 bg-gradient-to-r from-[#FF6B35] to-[#ff8c5a] hover:from-[#ff7d4d] hover:to-[#ffa070] text-white font-bold py-4 rounded-lg transition-all hover:scale-105 shadow-lg">
          ✅ Done - Return to Wallet
        </button>
      </div>
    </div>
  `;

  container.appendChild(content);

  // EVENT LISTENERS

  // Copy maker addresses
  content.querySelectorAll('.copy-maker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.address);
    });
  });

  // Copy transaction IDs
  content.querySelectorAll('.copy-txid-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.txid);
    });
  });

  // View transaction in explorer
  content.querySelectorAll('.view-txid-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const txid = btn.dataset.txid;
      window.open(`https://mempool.space/tx/${txid}`, '_blank');
    });
  });

  // Export report as JSON
  content.querySelector('#export-report').addEventListener('click', () => {
    const reportJson = JSON.stringify(swapReport, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coinswap-report-${swapReport.swapId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Report exported!');
  });

  // Back to wallet
  content.querySelector('#back-to-wallet').addEventListener('click', () => {
    if (window.appManager) {
      window.appManager.renderComponent('wallet');
    }
  });

  // Done button
  content.querySelector('#done-btn').addEventListener('click', () => {
    if (window.appManager) {
      window.appManager.renderComponent('wallet');
    }
  });
}