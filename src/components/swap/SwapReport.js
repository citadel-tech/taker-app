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
    swapDurationSeconds:
      swapReport.swapDurationSeconds || swapReport.swap_duration_seconds || 0,
    targetAmount: swapReport.targetAmount || swapReport.target_amount || 0,
    totalInputAmount:
      swapReport.totalInputAmount || swapReport.total_input_amount || 0,
    totalOutputAmount:
      swapReport.totalOutputAmount || swapReport.total_output_amount || 0,
    makersCount: swapReport.makersCount || swapReport.makers_count || 0,
    makerAddresses:
      swapReport.makerAddresses || swapReport.maker_addresses || [],
    totalFundingTxs:
      swapReport.totalFundingTxs || swapReport.total_funding_txs || 0,
    fundingTxidsByHop:
      swapReport.fundingTxidsByHop || swapReport.funding_txids_by_hop || [],
    totalFee: swapReport.totalFee || swapReport.total_fee || 0,
    totalMakerFees:
      swapReport.totalMakerFees || swapReport.total_maker_fees || 0,
    miningFee: swapReport.miningFee || swapReport.mining_fee || 0,
    feePercentage: swapReport.feePercentage || swapReport.fee_percentage || 0,
    makerFeeInfo: swapReport.makerFeeInfo || swapReport.maker_fee_info || [],
    inputUtxos: swapReport.inputUtxos || swapReport.input_utxos || [],
    outputRegularUtxos:
      swapReport.outputRegularUtxos || swapReport.output_regular_utxos || [],
    outputSwapUtxos:
      swapReport.outputSwapUtxos || swapReport.output_swap_utxos || [],
    sweepTxid:
      swapReport.sweep_txid ||
      swapReport.sweepTxid ||
      swapReport.taker_sweep_txid ||
      swapReport.takerSweepTxid ||
      null,
  };

  console.log('📊 Normalized report:', report);

  const isV2Swap =
    report.protocolVersion === 2 ||
    report.isTaproot === true ||
    (report.fundingTxidsByHop && report.fundingTxidsByHop.length === 1);

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
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showNotification('Copied to clipboard!');
      })
      .catch((err) => {
        console.error('Copy failed:', err);
      });
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className =
      'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }

  // Show maker popup
  function showMakerPopup(makerIndex) {
    const makerAddr = report.makerAddresses[makerIndex] || 'unknown';
    const makerFee = report.makerFeeInfo[makerIndex] || {};
    const feePaid =
      makerFee.totalFee ||
      makerFee.total_fee ||
      makerFee.feePaid ||
      makerFee.fee_paid ||
      makerFee.amount ||
      0;

    const feeRate =
      report.targetAmount > 0 ? (feePaid / report.targetAmount) * 100 : 0;
    const color = makerColors[makerIndex % makerColors.length];

    // Remove any existing popup
    const existingPopup = document.querySelector('.maker-popup-overlay');
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.className =
      'maker-popup-overlay fixed inset-0 bg-black/60 flex items-center justify-center z-50';
    overlay.innerHTML = `
      <div class="maker-popup bg-[#1a2332] border-2 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl transform animate-popup"
           style="border-color: ${color};">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl"
                 style="background: ${color}20; color: ${color};">
              M${makerIndex + 1}
            </div>
            <div>
              <h3 class="text-xl font-bold text-white">Maker ${makerIndex + 1}</h3>
              <p class="text-xs text-gray-400">Swap Partner</p>
            </div>
          </div>
          <button class="close-popup text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div class="space-y-4">
          <!-- Address -->
          <div class="bg-[#0f1419] rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-1">Onion Address</p>
            <div class="flex items-center gap-2">
              <p class="font-mono text-sm text-white break-all flex-1">${makerAddr}</p>
              <button class="copy-addr-btn text-gray-400 hover:text-[#FF6B35] transition-colors" title="Copy">📋</button>
            </div>
          </div>
          
          <!-- Fee Info -->
          <div class="bg-[#0f1419] rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-2">Fee Information</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-gray-500">Fee Paid</p>
                  <p class="font-mono text-sm" style="color: ${color};">${formatNumber(feePaid)} sats</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Fee Rate</p>
                  <p class="font-mono text-sm" style="color: ${color};">${feeRate.toFixed(2)}%</p>
              </div>
            </div>
          </div>
          
          <!-- Hop Position -->
          <div class="bg-[#0f1419] rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-2">Swap Position</p>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-bold" style="background: ${color}20; color: ${color};">
                Hop ${makerIndex + 1} of ${report.makersCount}
              </span>
              <span class="text-xs text-gray-500">
                ${makerIndex === 0 ? '(First maker in chain)' : makerIndex === report.makersCount - 1 ? '(Last maker in chain)' : '(Middle of chain)'}
              </span>
            </div>
          </div>
          
          <!-- Privacy Contribution -->
          <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p class="text-xs text-green-400 mb-1">🔒 Privacy Contribution</p>
            <p class="text-xs text-gray-300">This maker broke the transaction link between hop ${makerIndex} and hop ${makerIndex + 2}, making it impossible to trace the flow of funds.</p>
          </div>
        </div>
        
        <div class="mt-6 flex gap-3">
          <button class="copy-addr-btn flex-1 bg-[#242d3d] hover:bg-[#2d3748] text-white py-3 rounded-lg transition-colors">
            📋 Copy Address
          </button>
          <button class="close-popup flex-1 text-white py-3 rounded-lg transition-colors"
                  style="background: ${color};">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners for popup
    overlay.querySelectorAll('.close-popup').forEach((btn) => {
      btn.addEventListener('click', () => overlay.remove());
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelectorAll('.copy-addr-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        copyToClipboard(makerAddr);
      });
    });
  }

  const makerColors = ['#FF6B35', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];

  // Build funding transactions HTML
  function buildFundingTxsHtml() {
    if (!report.fundingTxidsByHop || report.fundingTxidsByHop.length === 0) {
      return '<p class="text-gray-500 text-sm">No transaction data available</p>';
    }

    if (isV2Swap) {
  // Extract transaction IDs
  const outgoingTxids = report.outgoingContracts || []; // Add this to report
  const incomingTxids = report.incomingContracts || []; // Add this to report
  const takerOutgoing = Array.isArray(report.fundingTxidsByHop[0]) 
    ? report.fundingTxidsByHop[0][0] 
    : report.fundingTxidsByHop[0];
  const takerIncoming = report.sweepTxid;

  return `
    <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
      <p class="text-sm text-blue-300 mb-2">
        <strong>Taproot Coinswap (V2 Protocol)</strong>
      </p>
      <p class="text-xs text-gray-300">
        Uses <strong>MuSig2</strong> for cooperative signatures. Only <strong>2 on-chain transactions</strong> visible: 
        your outgoing contract and the final sweep. All ${report.makersCount} makers coordinate off-chain.
      </p>
    </div>

    <!-- Outgoing Contracts Section -->
    <div class="mb-6">
      <h4 class="text-md font-semibold text-[#FF6B35] mb-3 flex items-center gap-2">
        <span>📤</span> Outgoing Contracts
      </h4>
      
      <!-- Taker's Outgoing -->
      <div class="bg-[#0f1419] rounded-lg p-4 mb-3 border-l-4 border-[#FF6B35]">
        <p class="text-sm font-semibold mb-2 text-[#FF6B35]">
          Taker (You)
        </p>
        <div class="flex items-center justify-between hover:bg-[#1a2332] p-2 rounded transition-colors">
          <p class="font-mono text-xs text-gray-300 flex-1">
            ${takerOutgoing ? truncateTxid(takerOutgoing) : 'N/A'}
          </p>
          <div class="flex gap-2">
            <button class="copy-txid-btn text-gray-400 hover:text-white text-sm" 
                    data-txid="${takerOutgoing || ''}" ${!takerOutgoing ? 'disabled' : ''}>📋</button>
            <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm" 
                    data-txid="${takerOutgoing || ''}" ${!takerOutgoing ? 'disabled' : ''}>🔍</button>
          </div>
        </div>
      </div>

      <!-- Makers' Outgoing Contracts -->
      ${report.makerAddresses.map((addr, idx) => {
        const color = makerColors[idx % makerColors.length];
        const txid = outgoingTxids[idx] || 'N/A'; // Get from report
        
        return `
          <div class="bg-[#0f1419] rounded-lg p-4 mb-3 border-l-4" style="border-color: ${color}">
            <p class="text-sm font-semibold mb-2" style="color: ${color}">
              Maker ${idx + 1}
            </p>
            <div class="flex items-center justify-between hover:bg-[#1a2332] p-2 rounded transition-colors">
              <p class="font-mono text-xs text-gray-300 flex-1">
                ${typeof txid === 'string' ? truncateTxid(txid) : 'N/A'}
              </p>
              <div class="flex gap-2">
                <button class="copy-txid-btn text-gray-400 hover:text-white text-sm" 
                        data-txid="${txid}" ${txid === 'N/A' ? 'disabled' : ''}>📋</button>
                <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm" 
                        data-txid="${txid}" ${txid === 'N/A' ? 'disabled' : ''}>🔍</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Incoming Contracts Section -->
    <div>
      <h4 class="text-md font-semibold text-[#10B981] mb-3 flex items-center gap-2">
        <span>📥</span> Incoming Contracts
      </h4>
      
      <!-- Makers' Incoming Contracts -->
      ${report.makerAddresses.map((addr, idx) => {
        const color = makerColors[idx % makerColors.length];
        const txid = incomingTxids[idx] || 'N/A'; // Get from report
        
        return `
          <div class="bg-[#0f1419] rounded-lg p-4 mb-3 border-l-4" style="border-color: ${color}">
            <p class="text-sm font-semibold mb-2" style="color: ${color}">
              Maker ${idx + 1}
            </p>
            <div class="flex items-center justify-between hover:bg-[#1a2332] p-2 rounded transition-colors">
              <p class="font-mono text-xs text-gray-300 flex-1">
                ${typeof txid === 'string' ? truncateTxid(txid) : 'N/A'}
              </p>
              <div class="flex gap-2">
                <button class="copy-txid-btn text-gray-400 hover:text-white text-sm" 
                        data-txid="${txid}" ${txid === 'N/A' ? 'disabled' : ''}>📋</button>
                <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm" 
                        data-txid="${txid}" ${txid === 'N/A' ? 'disabled' : ''}>🔍</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}

      <!-- Taker's Incoming (Sweep) -->
      <div class="bg-[#0f1419] rounded-lg p-4 border-l-4 border-[#10B981]">
        <p class="text-sm font-semibold mb-2 text-[#10B981]">
          Taker (You) - Final Sweep
        </p>
        <div class="flex items-center justify-between hover:bg-[#1a2332] p-2 rounded transition-colors">
          <p class="font-mono text-xs text-gray-300 flex-1">
            ${takerIncoming ? truncateTxid(takerIncoming) : 'N/A'}
          </p>
          <div class="flex gap-2">
            <button class="copy-txid-btn text-gray-400 hover:text-white text-sm" 
                    data-txid="${takerIncoming || ''}" ${!takerIncoming ? 'disabled' : ''}>📋</button>
            <button class="view-txid-btn text-gray-400 hover:text-[#10B981] text-sm" 
                    data-txid="${takerIncoming || ''}" ${!takerIncoming ? 'disabled' : ''}>🔍</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

    // ✅ V1 PROTOCOL: Show all funding transactions

    return report.fundingTxidsByHop
      .map((txids, hopIdx) => {
        const txidArray = Array.isArray(txids) ? txids : [txids];
        const color = makerColors[hopIdx % makerColors.length];

        return `
        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-800 hover:border-[#FF6B35]/50 transition-colors">
          <p class="text-sm font-semibold text-lg mb-2" style="color: ${color}">
            <span class="inline-block w-6 h-6 rounded-full text-center leading-6 text-xs" 
                  style="background: ${color}20; border: 2px solid ${color}">
              ${hopIdx + 1}
            </span>
            Hop ${hopIdx + 1}
          </p>
          ${txidArray
            .map(
              (txid) => `
            <div class="flex items-center justify-between hover:bg-[#1a2332] p-2 rounded transition-colors">
              <p class="font-mono text-xs text-gray-300 flex-1">${truncateTxid(txid)}</p>
              <div class="flex gap-2">
                <button class="copy-txid-btn text-gray-400 hover:text-white text-sm transition-colors" 
                        data-txid="${txid}" title="Copy">📋</button>
                <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm transition-colors" 
                        data-txid="${txid}" title="View on Explorer">🔍</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
      })
      .join('');
  }

  // Build maker addresses HTML - Now clickable to show popup
  function buildMakersHtml() {
    if (!report.makerAddresses || report.makerAddresses.length === 0) {
      return '<p class="text-gray-500 text-sm">No maker data available</p>';
    }

    return report.makerAddresses
      .map((addr, idx) => {
        const color = makerColors[idx % makerColors.length];
        return `
        <div class="maker-card bg-[#0f1419] rounded-lg p-4 border hover:border-[${color}] transition-all cursor-pointer hover:scale-102 hover:shadow-lg"
             style="border-color: ${color}40;" data-maker-index="${idx}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
                 style="background: ${color}20; color: ${color};">
              M${idx + 1}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-400">Maker ${idx + 1}</p>
              <p class="font-mono text-xs text-white truncate">${truncateAddress(addr)}</p>
            </div>
            <span class="text-gray-500 text-sm">→</span>
          </div>
        </div>
      `;
      })
      .join('');
  }

  // Build circular flow visualization - true circle layout
  function buildCircularFlowHtml() {
    const totalNodes = report.makersCount + 1; // You + makers (You appears once, at start/end position)
    const size = 350;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 160;

    // Calculate positions around a circle
    // Start at top (You), go clockwise through makers, back to You
    const allNodes = [];

    // "You" at top (both start and end point)
    allNodes.push({
      type: 'you',
      label: 'You',
      angle: -Math.PI / 2, // Top
      color: '#FF6B35',
    });

    // Makers distributed around the circle clockwise
    for (let i = 0; i < report.makersCount; i++) {
      // Distribute makers evenly around the circle (excluding the "You" position)
      const angleStep = (2 * Math.PI) / (report.makersCount + 1);
      const angle = -Math.PI / 2 + angleStep * (i + 1);

      allNodes.push({
        type: 'maker',
        index: i,
        label: `M${i + 1}`,
        angle: angle,
        color: makerColors[i % makerColors.length],
      });
    }

    // Calculate x, y positions
    const nodePositions = allNodes.map((node) => ({
      ...node,
      x: centerX + radius * Math.cos(node.angle),
      y: centerY + radius * Math.sin(node.angle),
    }));

    // Build SVG arrows (curved paths around the circle)
    let arrowsHtml = '';

    for (let i = 0; i < nodePositions.length; i++) {
      const from = nodePositions[i];
      const toIndex = (i + 1) % nodePositions.length;
      const to = nodePositions[toIndex];

      const midAngle = (from.angle + to.angle) / 2;
      let adjustedMidAngle = midAngle;
      if (Math.abs(from.angle - to.angle) > Math.PI) {
        adjustedMidAngle = midAngle + Math.PI;
      }

      const arcRadius = radius + 20;
      const midX = centerX + arcRadius * Math.cos(adjustedMidAngle);
      const midY = centerY + arcRadius * Math.sin(adjustedMidAngle);

      const circleRadius = 40;

      // Calculate start point offset along the arc from 'from' node
      const startAngle = Math.atan2(midY - from.y, midX - from.x);
      const startX = from.x + circleRadius * Math.cos(startAngle);
      const startY = from.y + circleRadius * Math.sin(startAngle);

      // Calculate end point offset along the arc to 'to' node
      const arrowheadLength = -2; // Negative to pull it back
      const endAngle = Math.atan2(midY - to.y, midX - to.x);
      const endX = to.x + (circleRadius + arrowheadLength) * Math.cos(endAngle);
      const endY = to.y + (circleRadius + arrowheadLength) * Math.sin(endAngle);

      const color = from.color;

      arrowsHtml += `
        <defs>
          <linearGradient id="gradient-${i}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:1" />
          </linearGradient>
          <filter id="glow-${i}">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <marker id="arrowhead-${i}" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto">
            <polygon points="0 0, 12 5, 0 10" fill="${color}" />
          </marker>
        </defs>
        <path d="M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}"
              stroke="url(#gradient-${i})" 
              stroke-width="2.5" 
              fill="none" 
              filter="url(#glow-${i})"
              marker-end="url(#arrowhead-${i})" 
              opacity="0.9"/>
      `;
    }

    // Build node elements
    let nodesHtml = nodePositions
      .map((node, idx) => {
        const isYou = node.type === 'you';

        return `
      <div class="absolute transform -translate-x-1/2 -translate-y-1/2 
                  ${!isYou ? 'maker-node cursor-pointer' : ''} 
                  transition-all duration-300 z-10"
           style="left: ${node.x}px; top: ${node.y}px;"
           ${!isYou ? `data-maker-index="${node.index}"` : ''}>
        <div class="flex flex-col items-center gap-2">
<div class="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 backdrop-blur-sm relative"
               style="background: ${isYou ? 'linear-gradient(135deg, ' + node.color + ' 0%, ' + node.color + '99 100%)' : 'linear-gradient(135deg, ' + node.color + '40 0%, ' + node.color + '20 100%)'}; 
                      border-color: ${node.color};
                      box-shadow: 0 0 30px ${node.color}50;">
            ${
              isYou
                ? '<span class="text-3xl">👤</span>'
                : `<span class="font-bold text-2xl" style="color: ${node.color};">${node.label}</span>`
            }
          </div>
          <div class="text-center bg-[#0f1419]/90 px-3 py-1 rounded-lg backdrop-blur-sm border border-gray-700">
            <p class="text-sm text-white font-bold">${isYou ? 'You' : `Maker ${node.index + 1}`}</p>
            ${!isYou ? `<p class="text-xs text-gray-400 font-mono">${truncateAddress(report.makerAddresses[node.index] || '', 8, 4)}</p>` : '<p class="text-xs text-gray-400">Start/End</p>'}
          </div>
        </div>
      </div>
    `;
      })
      .join('');

    return `
   <div class="relative mx-auto bg-gradient-to-br from-[#0a0f16] to-[#1a2332] rounded-2xl p-8" style="width: ${size}px; height: ${size}px;">
      <svg class="absolute inset-0" width="${size}" height="${size}">
        ${arrowsHtml}
      </svg>
      ${nodesHtml}
      
      <!-- Center info -->
      <div class="absolute transform -translate-x-1/2 -translate-y-1/2 text-center bg-[#1a2332]/80 backdrop-blur-sm rounded-xl px-6 py-4 border-2 border-[#FF6B35]/30 shadow-xl"
           style="left: ${centerX}px; top: ${centerY}px;">
        <p class="text-4xl font-black text-[#FF6B35] mb-1">${report.makersCount + 1}</p>
        <p class="text-xs text-gray-400 font-semibold text-lg uppercase tracking-wider">Total Hops</p>
      </div>
    </div>
  `;
  }

  // UI
  content.innerHTML = `
    <style>
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes popup {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.maker-node:hover {
  z-index: 20 !important;
  transform: scale(1.15) !important;
}
      
      .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
      .animate-popup { animation: popup 0.2s ease-out forwards; }
      .stagger-1 { animation-delay: 0.1s; }
      .stagger-2 { animation-delay: 0.2s; }
      .stagger-3 { animation-delay: 0.3s; }
      .stagger-4 { animation-delay: 0.4s; }
      
      .maker-card:hover {
        transform: scale(1.02);
      }
      
      .maker-node:hover {
        z-index: 10;
      }
      
      /* Tooltip styles */
      .tooltip-trigger {
        position: relative;
      }
      
      .tooltip-trigger:hover .tooltip-content {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      
      .tooltip-content {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(10px);
        padding: 8px 12px;
        background: #0f1419;
        border: 1px solid #374151;
        border-radius: 8px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 50;
        margin-bottom: 8px;
      }
      
      .tooltip-content::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #374151;
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
            <span class="text-green-400 font-semibold text-lg">✅ SWAP COMPLETED SUCCESSFULLY</span>
          </div>
          <div class="px-4 py-2 bg-[#1a2332] rounded-lg">
            <span class="text-gray-400 text-sm">ID: </span>
            <span class="font-mono text-white text-sm">${report.swapId}</span>
          </div>
        </div>
      </div>

      <!-- Circular Flow Diagram -->
      <div class="mb-8 animate-fade-in-up stagger-1">
        <div class="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-xl p-8 border border-[#FF6B35]/20 shadow-2xl">
          <h3 class="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <span>🔗</span> Transaction Flow
            <span class="text-sm font-normal text-gray-400">(Click on makers for details)</span>
          </h3>
          <p class="text-xs text-gray-500 mb-6">Your coins flow through multiple makers and return to you with broken transaction links</p>
          
          <!-- Circular Flow -->
          <div class="flex justify-center">
            ${buildCircularFlowHtml()}
          </div>
          
        
          
          <!-- Technical Explanation Box -->
<div class="mt-6 p-4 ${isV2Swap ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-blue-500/10 border border-blue-500/30'} rounded-lg">
  <h4 class="text-sm font-bold ${isV2Swap ? 'text-purple-300' : 'text-blue-300'} mb-2 flex items-center gap-2">
    <span>ℹ️</span> ${isV2Swap ? 'Taproot Protocol (V2)' : 'P2WSH Protocol (V1)'}
  </h4>
  <div class="text-xs text-gray-300 grid grid-cols-2 gap-4">
    ${
      isV2Swap
        ? `
      <div>
        <p class="mb-1"><strong>⚡ MuSig2:</strong> Cooperative signatures between makers</p>
        <p><strong>🔗 One TX:</strong> Only 1 on-chain funding transaction</p>
      </div>
      <div>
        <p class="mb-1"><strong>🔓 Privacy:</strong> Same link-breaking as V1</p>
        <p><strong>💰 Efficient:</strong> Lower on-chain footprint</p>
      </div>
    `
        : `
      <div>
        <p class="mb-1"><strong>🔄 Circular Path:</strong> Coins flow You → Makers → You</p>
        <p><strong>⚛️ Atomic Swaps:</strong> HTLCs ensure safe exchanges</p>
      </div>
      <div>
        <p class="mb-1"><strong>🔓 Link Breaking:</strong> Each hop uses different UTXOs</p>
        <p><strong>👁️ Result:</strong> Observers cannot trace the path</p>
      </div>
    `
    }
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
<p class="text-sm text-white">${isV2Swap ? 'On-Chain TXs' : 'Privacy Hops'}</p>
            <span class="text-2xl">🔗</span>
          </div>
         <p class="text-2xl font-bold text-purple-400">
  ${isV2Swap ? '2' : report.makersCount + 1}
</p>
<p class="text-xs text-gray-400 mt-1">
  ${isV2Swap ? 'On-chain TXs (V2)' : `${report.makersCount} makers used`}
</p>
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
            <h3 class="text-xl font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <span>📝</span> Funding Transactions
            </h3>
            <div class="space-y-3">
              ${buildFundingTxsHtml()}
            </div>
          </div>

          <!-- Swap Partners / Makers -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-3">
            <h3 class="text-xl font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <span>🤝</span> Swap Partners
              <span class="text-xs text-gray-500 font-normal ml-2">(Click for details)</span>
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
            <h3 class="text-lg font-semibold text-lg text-white mb-4 flex items-center gap-2">
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
                <span class="text-sm font-semibold text-lg text-white">Total</span>
                <div class="text-right">
                  <p class="font-mono text-lg text-[#FF6B35] font-bold">${formatNumber(report.totalFee)}</p>
                  <p class="text-xs text-gray-500">${satsToBtc(report.totalFee)} BTC</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Privacy Impact -->
          <div class="bg-purple-500/20 border border-purple-500/30 rounded-lg p-6 animate-fade-in-up stagger-3">
            <h3 class="text-lg font-semibold text-lg text-purple-300 mb-3 flex items-center gap-2">
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

          <!-- UTXO Summary with Tooltip -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-4">
            <h3 class="text-lg font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <span>📦</span> UTXO Summary
              <span class="tooltip-trigger">
                <span class="text-gray-500 text-sm cursor-help">ⓘ</span>
                <span class="tooltip-content text-xs text-gray-300">
                  UTXOs (Unspent Transaction Outputs) used in the swap process
                </span>
              </span>
            </h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between items-center tooltip-trigger">
                <span class="text-gray-400 flex items-center gap-1">
                  Inputs
                  <span class="tooltip-content text-xs text-gray-300">
                    Your UTXOs that were spent to initiate the swap
                  </span>
                </span>
                <span class="font-mono text-white">${report.inputUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center tooltip-trigger">
                <span class="text-gray-400 flex items-center gap-1">
                  Regular Outputs
                  <span class="tooltip-content text-xs text-gray-300">
                    Standard outputs returned to your wallet
                  </span>
                </span>
                <span class="font-mono text-green-400">${report.outputRegularUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center tooltip-trigger">
                <span class="text-gray-400 flex items-center gap-1">
                  Swap Coins
                  <span class="tooltip-content text-xs text-gray-300">
                    Privacy-enhanced coins from the swap (different history)
                  </span>
                </span>
                <span class="font-mono text-blue-400">${report.outputSwapUtxos.length}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-8 flex gap-4 animate-fade-in-up stagger-4">
        <button id="export-report" class="flex-1 bg-[#242d3d] hover:bg-[#2d3748] text-white font-semibold text-lg py-4 rounded-lg transition-all hover:scale-105">
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

  // Maker cards - show popup
  content.querySelectorAll('.maker-card').forEach((card) => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.makerIndex);
      showMakerPopup(index);
    });
  });

  // Maker nodes in circular flow - show popup
  content.querySelectorAll('.maker-node').forEach((node) => {
    node.addEventListener('click', () => {
      const index = parseInt(node.dataset.makerIndex);
      showMakerPopup(index);
    });
  });

  // Copy transaction IDs
  content.querySelectorAll('.copy-txid-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.txid);
    });
  });

  // View transaction in explorer
  content.querySelectorAll('.view-txid-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const txid = btn.dataset.txid;
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
