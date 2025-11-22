export function SwapReportComponent(container, swapReport) {
  console.log('📊 SwapReportComponent loading with report:', swapReport);
  console.log('📊 Report keys:', Object.keys(swapReport || {}));
  
  const content = document.createElement('div');
  content.id = 'swap-report-content';

  // Validate report data
  if (!swapReport || typeof swapReport !== 'object') {
    console.error('❌ Invalid swap report:', swapReport);
    content.innerHTML = `
      <div class="text-center py-20">
        <p class="text-red-400 text-xl">Error: No swap report data available</p>
        <button id="back-btn" class="mt-4 bg-[#FF6B35] text-white px-6 py-3 rounded-lg">Back to Wallet</button>
      </div>
    `;
    container.appendChild(content);
    content.querySelector('#back-btn')?.addEventListener('click', () => {
      if (window.appManager) window.appManager.renderComponent('wallet');
    });
    return;
  }

  // Extract values with safe defaults
  const report = {
    swapId: swapReport.swapId || swapReport.swap_id || 'unknown',
    swapDurationSeconds: swapReport.swapDurationSeconds || swapReport.swap_duration_seconds || 0,
    targetAmount: swapReport.targetAmount || swapReport.target_amount || 0,
    totalInputAmount: swapReport.totalInputAmount || swapReport.total_input_amount || 0,
    totalOutputAmount: swapReport.totalOutputAmount || swapReport.total_output_amount || 0,
    makersCount: swapReport.makersCount || swapReport.makers_count || 0,
    makerAddresses: swapReport.makerAddresses || swapReport.maker_addresses || [],
    totalFundingTxs: swapReport.totalFundingTxs || swapReport.total_funding_txs || 0,
    fundingTxidsByHop: swapReport.fundingTxidsByHop || swapReport.funding_txids_by_hop || [],
    totalFee: swapReport.totalFee || swapReport.total_fee || 0,
    totalMakerFees: swapReport.totalMakerFees || swapReport.total_maker_fees || 0,
    miningFee: swapReport.miningFee || swapReport.mining_fee || 0,
    feePercentage: swapReport.feePercentage || swapReport.fee_percentage || 0,
    makerFeeInfo: swapReport.makerFeeInfo || swapReport.maker_fee_info || [],
    inputUtxos: swapReport.inputUtxos || swapReport.input_utxos || [],
    outputRegularUtxos: swapReport.outputRegularUtxos || swapReport.output_regular_utxos || [],
    outputSwapUtxos: swapReport.outputSwapUtxos || swapReport.output_swap_utxos || []
  };

  console.log('📊 Normalized report:', report);

  // Helper functions
  function satsToBtc(sats) {
    if (typeof sats !== 'number' || isNaN(sats)) return '0.00000000';
    return (sats / 100000000).toFixed(8);
  }

  function formatDuration(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString();
  }

  function truncateAddress(addr, start = 16, end = 8) {
    if (!addr || typeof addr !== 'string') return 'unknown';
    if (addr.length <= start + end) return addr;
    return `${addr.substring(0, start)}...${addr.substring(addr.length - end)}`;
  }

  function truncateTxid(txid, start = 20, end = 12) {
    if (!txid || typeof txid !== 'string') return 'unknown';
    if (txid.length <= start + end) return txid;
    return `${txid.substring(0, start)}...${txid.substring(txid.length - end)}`;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Copied to clipboard!');
    }).catch(err => {
      console.error('Copy failed:', err);
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

  // Build funding transactions HTML
  function buildFundingTxsHtml() {
    if (!report.fundingTxidsByHop || report.fundingTxidsByHop.length === 0) {
      return '<p class="text-gray-500 text-sm">No transaction data available</p>';
    }

    return report.fundingTxidsByHop.map((txids, hopIdx) => {
      const txidArray = Array.isArray(txids) ? txids : [txids];
      const color = makerColors[hopIdx % makerColors.length];
      
      return `
        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-800 hover:border-[#FF6B35]/50 transition-colors">
          <p class="text-sm font-semibold mb-2" style="color: ${color}">
            <span class="inline-block w-6 h-6 rounded-full text-center leading-6 text-xs" 
                  style="background: ${color}20; border: 2px solid ${color}">
              ${hopIdx + 1}
            </span>
            Hop ${hopIdx + 1}
          </p>
          ${txidArray.map(txid => `
            <div class="flex items-center justify-between hover:bg-[#1a2332] p-2 rounded transition-colors">
              <p class="font-mono text-xs text-gray-300 flex-1">${truncateTxid(txid)}</p>
              <div class="flex gap-2">
                <button class="copy-txid-btn text-gray-400 hover:text-white text-sm transition-colors" 
                        data-txid="${txid}" title="Copy">📋</button>
                <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm transition-colors" 
                        data-txid="${txid}" title="View on Explorer">🔍</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  }

  // Build maker addresses HTML - Now clickable to copy
  function buildMakersHtml() {
    if (!report.makerAddresses || report.makerAddresses.length === 0) {
      return '<p class="text-gray-500 text-sm">No maker data available</p>';
    }

    return report.makerAddresses.map((addr, idx) => {
      const color = makerColors[idx % makerColors.length];
      return `
        <div class="bg-[#0f1419] rounded-lg p-4 border hover:border-[${color}] transition-all cursor-pointer copy-maker-card"
             style="border-color: ${color}40;" data-address="${addr}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
                 style="background: ${color}20; color: ${color};">
              M${idx + 1}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-400">Maker ${idx + 1}</p>
              <p class="font-mono text-xs text-white truncate">${truncateAddress(addr)}</p>
            </div>
            <span class="text-gray-500 text-sm">📋</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Build visual flow for makers - FIXED: Simplified arrows without SVG markers
  function buildMakerFlowHtml() {
    if (report.makersCount === 0) {
      return '';
    }

    return Array.from({ length: report.makersCount }, (_, i) => {
      const color = makerColors[i % makerColors.length];
      const makerAddr = report.makerAddresses[i] || `maker${i + 1}`;
      
      return `
        <!-- Arrow ${i + 1} - Simplified CSS arrows -->
        <div class="flex-1 flex flex-col items-center justify-center relative px-2">
          <div class="flex items-center w-full">
            <div class="flex-1 h-1 rounded" style="background: ${color};"></div>
            <span class="text-xl font-bold" style="color: ${color};">➔</span>
          </div>
          <span class="px-2 py-1 rounded text-xs font-bold mt-1" style="background: ${color}20; color: ${color};">
            🔓 BROKEN
          </span>
          <p class="text-xs text-gray-500 mt-1">Hop ${i + 1}</p>
        </div>

        <!-- Maker ${i + 1} - Clickable to copy -->
        <div class="flex flex-col items-center z-10 copy-maker-flow cursor-pointer" style="flex: 0 0 100px;" data-address="${makerAddr}" title="Click to copy address">
          <div class="w-20 h-20 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform border-2"
               style="background: linear-gradient(135deg, ${color}20, ${color}40); border-color: ${color};">
            <span class="text-xl font-bold" style="color: ${color};">M${i + 1}</span>
          </div>
          <p class="text-xs text-white mt-2 font-semibold">Maker ${i + 1}</p>
          <p class="text-xs text-gray-500 font-mono">${truncateAddress(makerAddr, 6, 0)}</p>
        </div>
      `;
    }).join('');
  }

  // UI
  content.innerHTML = `
    <style>
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
      .stagger-1 { animation-delay: 0.1s; }
      .stagger-2 { animation-delay: 0.2s; }
      .stagger-3 { animation-delay: 0.3s; }
      .stagger-4 { animation-delay: 0.4s; }
      
      .copy-maker-card:hover {
        transform: scale(1.02);
      }
      
      .copy-maker-flow:hover {
        opacity: 0.8;
      }
    </style>

    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8 animate-fade-in-up">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-[#FF6B35] rounded-xl flex items-center justify-center shadow-lg">
              <span class="text-3xl">🪙</span>
            </div>
            <div>
              <h2 class="text-4xl font-bold text-[#FF6B35]">
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
            <span class="font-mono text-white text-sm">${report.swapId}</span>
          </div>
        </div>
      </div>

      <!-- Visual Flow Diagram -->
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
              
              <div class="flex-1 flex flex-col items-center justify-center">
                <div class="flex items-center w-full max-w-xs">
                  <div class="flex-1 h-1 bg-red-500 rounded" style="background: repeating-linear-gradient(90deg, #ef4444 0px, #ef4444 5px, transparent 5px, transparent 10px);"></div>
                  <span class="text-red-500 text-xl font-bold">➔</span>
                </div>
                <span class="text-red-400 text-xs font-bold mt-1">TRACEABLE</span>
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
            <div class="p-6 bg-green-500/5 border border-green-500/20 rounded-lg overflow-x-auto">
              <div class="flex items-center justify-between relative min-w-max">
                
                <!-- Start - You -->
                <div class="flex flex-col items-center z-10" style="flex: 0 0 100px;">
                  <div class="w-20 h-20 bg-[#FF6B35] rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                    <span class="text-2xl">👤</span>
                  </div>
                  <p class="text-xs text-white mt-2 font-semibold">You</p>
                  <p class="text-xs text-gray-500">${satsToBtc(report.targetAmount)} BTC</p>
                </div>

                ${buildMakerFlowHtml()}

                <!-- Final Arrow -->
                <div class="flex-1 flex flex-col items-center justify-center relative px-2">
                  <div class="flex items-center w-full">
                    <div class="flex-1 h-1 rounded bg-green-500"></div>
                    <span class="text-xl font-bold text-green-500">➔</span>
                  </div>
                  <span class="px-2 py-1 rounded text-xs font-bold mt-1 bg-green-500/20 text-green-400">
                    🔓 BROKEN
                  </span>
                  <p class="text-xs text-gray-500 mt-1">Final Hop</p>
                </div>

                <!-- End - You -->
                <div class="flex flex-col items-center z-10" style="flex: 0 0 100px;">
                  <div class="w-20 h-20 bg-green-500 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                    <span class="text-2xl">👤</span>
                  </div>
                  <p class="text-xs text-white mt-2 font-semibold">You</p>
                  <p class="text-xs text-gray-500">${satsToBtc(report.totalOutputAmount)} BTC</p>
                </div>

              </div>
            </div>
          </div>

          <!-- Technical Privacy Explanation -->
          <div class="mt-6 grid grid-cols-2 gap-4">
            <div class="bg-[#1a2332] border border-blue-500/30 rounded-lg p-4">
              <h5 class="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                <span>👥</span> Different UTXO Ownership
              </h5>
              <p class="text-xs text-gray-300 leading-relaxed">
                Each transaction uses UTXOs from <strong>different owners</strong>. No common input ownership means no on-chain link.
              </p>
            </div>
            <div class="bg-[#1a2332] border border-green-500/30 rounded-lg p-4">
              <h5 class="text-sm font-bold text-green-400 mb-2 flex items-center gap-2">
                <span>⚛️</span> HTLC Atomic Swaps
              </h5>
              <p class="text-xs text-gray-300 leading-relaxed">
                Hash Time-Locked Contracts ensure coins <strong>actually swap ownership</strong> atomically at each hop.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-[#1a2332] rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer animate-fade-in-up stagger-1">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-white">Swap Amount</p>
            <span class="text-2xl">💰</span>
          </div>
          <p class="text-2xl font-bold text-[#FF6B35]">${satsToBtc(report.targetAmount)} BTC</p>
          <p class="text-xs text-gray-400 mt-1">${formatNumber(report.targetAmount)} sats</p>
        </div>

        <div class="bg-[#1a2332] rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer animate-fade-in-up stagger-2">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-white">Duration</p>
            <span class="text-2xl">⏱️</span>
          </div>
          <p class="text-2xl font-bold text-cyan-400">${formatDuration(report.swapDurationSeconds)}</p>
          <p class="text-xs text-gray-400 mt-1">${report.swapDurationSeconds.toFixed(1)}s total</p>
        </div>

        <div class="bg-[#1a2332] rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer animate-fade-in-up stagger-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-white">Privacy Hops</p>
            <span class="text-2xl">🔗</span>
          </div>
          <p class="text-2xl font-bold text-purple-400">${report.makersCount + 1}</p>
          <p class="text-xs text-gray-400 mt-1">${report.makersCount} makers used</p>
        </div>

        <div class="bg-[#1a2332] rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer animate-fade-in-up stagger-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-white">Total Fee</p>
            <span class="text-2xl">💸</span>
          </div>
          <p class="text-2xl font-bold text-yellow-400">${report.feePercentage.toFixed(2)}%</p>
          <p class="text-xs text-gray-400 mt-1">${formatNumber(report.totalFee)} sats</p>
        </div>
      </div>

      <!-- Details Grid -->
      <div class="grid grid-cols-3 gap-6">
        
        <!-- Transactions & Makers -->
        <div class="col-span-2 space-y-6">
          
          <!-- Funding Transactions -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-2">
            <h3 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span>📝</span> Funding Transactions
            </h3>
            <div class="space-y-3">
              ${buildFundingTxsHtml()}
            </div>
          </div>

          <!-- Swap Partners / Makers -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-3">
            <h3 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span>🤝</span> Swap Partners
              <span class="text-xs text-gray-500 font-normal ml-2">(Click to copy address)</span>
            </h3>
            <div class="grid grid-cols-2 gap-3">
              ${buildMakersHtml()}
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
                <span class="font-mono text-sm text-yellow-400">${formatNumber(report.totalMakerFees)}</span>
              </div>
              <div class="flex justify-between items-center pb-3 border-b border-gray-700">
                <span class="text-sm text-gray-400">Mining Fees</span>
                <span class="font-mono text-sm text-cyan-400">${formatNumber(report.miningFee)}</span>
              </div>
              <div class="flex justify-between items-center pt-2">
                <span class="text-sm font-semibold text-white">Total</span>
                <div class="text-right">
                  <p class="font-mono text-lg text-[#FF6B35] font-bold">${formatNumber(report.totalFee)}</p>
                  <p class="text-xs text-gray-500">${satsToBtc(report.totalFee)} BTC</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Privacy Impact -->
          <div class="bg-purple-500/20 border border-purple-500/30 rounded-lg p-6 animate-fade-in-up stagger-3">
            <h3 class="text-lg font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <span>🔒</span> Privacy Achieved
            </h3>
            <ul class="space-y-2 text-sm">
              <li class="flex items-start gap-2 text-purple-200">
                <span class="text-green-400 mt-0.5">✓</span>
                <span><span class="font-bold">${report.makersCount + 1}</span> transaction hops completed</span>
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
                <span class="font-mono text-white">${report.inputUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Regular Outputs</span>
                <span class="font-mono text-green-400">${report.outputRegularUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Swap Coins</span>
                <span class="font-mono text-blue-400">${report.outputSwapUtxos.length}</span>
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
        <button id="done-btn" class="flex-1 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-4 rounded-lg transition-all hover:scale-105 shadow-lg">
          ✅ Done - Return to Wallet
        </button>
      </div>
    </div>
  `;

  container.appendChild(content);

  // EVENT LISTENERS

  // Copy maker addresses from cards
  content.querySelectorAll('.copy-maker-card').forEach(card => {
    card.addEventListener('click', () => {
      copyToClipboard(card.dataset.address);
    });
  });

  // Copy maker addresses from flow diagram
  content.querySelectorAll('.copy-maker-flow').forEach(el => {
    el.addEventListener('click', () => {
      copyToClipboard(el.dataset.address);
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
      // Use mempool.space signet explorer (change to mainnet when ready)
      window.open(`https://mempool.space/signet/tx/${txid}`, '_blank');
    });
  });

  // Export report as JSON
  content.querySelector('#export-report').addEventListener('click', () => {
    const reportJson = JSON.stringify(report, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coinswap-report-${report.swapId}.json`;
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