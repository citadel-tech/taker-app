export function SwapReportComponent(container, swapReport) {
  function normalizeProtocol(value, fallbackIsTaproot = false) {
    switch (value) {
      case 'v2':
      case 'Taproot':
        return 'Taproot';
      case 'Unified':
        return 'Unified';
      case 'v1':
      case 'Legacy':
      case 'Legacy P2WSH':
        return 'Legacy';
      default:
        return fallbackIsTaproot ? 'Taproot' : 'Legacy';
    }
  }

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
        <button id="back-btn" class="mt-4 bg-[#FF6B35] text-white px-6 py-3 rounded-lg">Back to Swaps</button>
      </div>
    `;
    container.appendChild(content);
    content.querySelector('#back-btn')?.addEventListener('click', () => {
      if (window.appManager) window.appManager.renderComponent('swap');
    });
    return;
  }

  const toNumber = (value, fallback = 0) => {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
  };

  const flattenTxidEntries = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => flattenTxidEntries(entry));
    }

    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }

    return [];
  };

  const dedupeTxids = (value) => [...new Set(flattenTxidEntries(value))];

  const nestedReport = swapReport.report || {};

  const rawTotalMakerFees = toNumber(
    swapReport.totalMakerFees ??
      swapReport.total_maker_fees ??
      nestedReport.totalMakerFees ??
      nestedReport.total_maker_fees,
    0
  );
  const rawMiningFee = toNumber(
    swapReport.miningFee ??
      swapReport.mining_fee ??
      nestedReport.miningFee ??
      nestedReport.mining_fee,
    0
  );
  const rawFeePaidOrEarned = toNumber(
    swapReport.fee_paid_or_earned ??
      swapReport.feePaidOrEarned ??
      nestedReport.fee_paid_or_earned ??
      nestedReport.feePaidOrEarned ??
      nestedReport.feePaidOrEarned,
    NaN
  );
  const providedTotalFee = toNumber(
    swapReport.totalFee ??
      swapReport.total_fee ??
      nestedReport.totalFee ??
      nestedReport.total_fee,
    NaN
  );
  const componentTotalFee = rawTotalMakerFees + Math.max(0, rawMiningFee);
  const netFeePaidOrEarned = Number.isFinite(rawFeePaidOrEarned)
    ? Math.abs(rawFeePaidOrEarned)
    : NaN;
  const rawTotalFee =
    Number.isFinite(providedTotalFee) && providedTotalFee >= 0
      ? providedTotalFee
      : componentTotalFee > 0
        ? componentTotalFee
        : Number.isFinite(netFeePaidOrEarned)
          ? netFeePaidOrEarned
          : 0;
  const normalizedMiningFee =
    rawMiningFee >= 0
      ? rawMiningFee
      : Math.max(0, rawTotalFee - rawTotalMakerFees);

  // Extract values with safe defaults
  const normalizedFundingTxids =
    swapReport.fundingTxidsByHop ||
    swapReport.funding_txids_by_hop ||
    swapReport.fundingTxids ||
    swapReport.funding_txids ||
    nestedReport.fundingTxidsByHop ||
    nestedReport.funding_txids_by_hop ||
    nestedReport.fundingTxids ||
    nestedReport.funding_txids ||
    [];
  const flattenedFundingTxids = dedupeTxids(normalizedFundingTxids);
  const normalizedTargetAmount = toNumber(
    swapReport.targetAmount ??
      swapReport.target_amount ??
      swapReport.incomingAmount ??
      swapReport.incoming_amount ??
      swapReport.outgoingAmount ??
      swapReport.outgoing_amount ??
      nestedReport.targetAmount ??
      nestedReport.target_amount ??
      swapReport.amount ??
      nestedReport.incomingAmount ??
      nestedReport.incoming_amount ??
      nestedReport.outgoingAmount ??
      nestedReport.outgoing_amount,
    0
  );
  const normalizedTotalFundingTxs = toNumber(
    swapReport.totalFundingTxs ??
      swapReport.total_funding_txs ??
      nestedReport.totalFundingTxs ??
      nestedReport.total_funding_txs,
    flattenedFundingTxids.length
  );
  const normalizedFeePercentage = toNumber(
    swapReport.feePercentage ??
      swapReport.fee_percentage ??
      nestedReport.feePercentage ??
      nestedReport.fee_percentage,
    normalizedTargetAmount > 0 ? (rawTotalFee / normalizedTargetAmount) * 100 : 0
  );

  const protocol = normalizeProtocol(
    swapReport.protocol || nestedReport.protocol,
    swapReport.isTaproot || nestedReport.isTaproot || false
  );
  const hasExplicitProtocolMetadata =
    Boolean(swapReport.protocol || nestedReport.protocol) ||
    typeof swapReport.isTaproot === 'boolean' ||
    typeof nestedReport.isTaproot === 'boolean';
  const outgoingContractTxid =
    swapReport.outgoingContractTxid ||
    swapReport.outgoing_contract_txid ||
    nestedReport.outgoingContractTxid ||
    nestedReport.outgoing_contract_txid ||
    null;
  const incomingContractTxid =
    swapReport.incomingContractTxid ||
    swapReport.incoming_contract_txid ||
    nestedReport.incomingContractTxid ||
    nestedReport.incoming_contract_txid ||
    null;
  const recoveryTxids = dedupeTxids(
    swapReport.recoveryTxids ||
      swapReport.recovery_txids ||
      nestedReport.recoveryTxids ||
      nestedReport.recovery_txids ||
      []
  );
  const sweepTxid =
    swapReport.sweep_txid ||
    swapReport.sweepTxid ||
    swapReport.taker_sweep_txid ||
    swapReport.takerSweepTxid ||
    null;

  const report = {
    swapId: swapReport.swapId || swapReport.swap_id || 'unknown',
    nativeSwapId:
      swapReport.nativeSwapId ||
      swapReport.native_swap_id ||
      nestedReport.nativeSwapId ||
      nestedReport.native_swap_id ||
      null,
    swapDurationSeconds:
      toNumber(
        swapReport.swapDurationSeconds ??
          swapReport.swap_duration_seconds ??
          nestedReport.swapDurationSeconds ??
          nestedReport.swap_duration_seconds,
        0
      ),
    targetAmount: normalizedTargetAmount,
    totalInputAmount:
      toNumber(
        swapReport.totalInputAmount ??
          swapReport.total_input_amount ??
          swapReport.incomingAmount ??
          swapReport.incoming_amount ??
          nestedReport.totalInputAmount ??
          nestedReport.total_input_amount,
        normalizedTargetAmount
      ),
    totalOutputAmount:
      toNumber(
        swapReport.totalOutputAmount ??
          swapReport.total_output_amount ??
          swapReport.outgoingAmount ??
          swapReport.outgoing_amount ??
          swapReport.incomingAmount ??
          swapReport.incoming_amount ??
          nestedReport.totalOutputAmount ??
          nestedReport.total_output_amount ??
          nestedReport.outgoingAmount ??
          nestedReport.outgoing_amount,
        0
      ),
    makersCount: toNumber(
      swapReport.makersCount ??
        swapReport.makers_count ??
        nestedReport.makersCount ??
        nestedReport.makers_count,
      0
    ),
    makerAddresses:
      swapReport.makerAddresses ||
      swapReport.maker_addresses ||
      nestedReport.makerAddresses ||
      nestedReport.maker_addresses ||
      [],
    totalFundingTxs: normalizedTotalFundingTxs,
    fundingTxidsByHop: normalizedFundingTxids,
    fundingTxids: flattenedFundingTxids,
    totalFee: rawTotalFee,
    totalMakerFees: rawTotalMakerFees,
    miningFee: normalizedMiningFee,
    feePercentage: normalizedFeePercentage,
    makerFeeInfo:
      swapReport.makerFeeInfo ||
      swapReport.maker_fee_info ||
      nestedReport.makerFeeInfo ||
      nestedReport.maker_fee_info ||
      [],
    inputUtxos:
      swapReport.inputUtxos ||
      swapReport.input_utxos ||
      nestedReport.inputUtxos ||
      nestedReport.input_utxos ||
      [],
    outputRegularUtxos:
      swapReport.outputRegularUtxos ||
      swapReport.output_regular_utxos ||
      nestedReport.outputRegularUtxos ||
      nestedReport.output_regular_utxos ||
      nestedReport.outputChangeUtxos ||
      nestedReport.output_change_utxos ||
      [],
    outputSwapUtxos:
      swapReport.outputSwapUtxos ||
      swapReport.output_swap_utxos ||
      nestedReport.outputSwapUtxos ||
      nestedReport.output_swap_utxos ||
      [],
    sweepTxid,
    protocol: hasExplicitProtocolMetadata ? protocol : null,
    isTaproot:
      protocol === 'Taproot' ||
      swapReport.isTaproot ||
      nestedReport.isTaproot ||
      false,
    protocolVersion:
      swapReport.protocolVersion ||
      (protocol === 'Taproot' ? 2 : 1),
    outgoingContractTxid,
    incomingContractTxid,
    recoveryTxids,
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
  const transactionArtifacts = [
    {
      label: 'Outgoing Contract',
      txid: report.outgoingContractTxid,
      accent: '#FF6B35',
      description: 'Contract transaction recorded on the outgoing side.',
    },
    {
      label: 'Incoming Contract',
      txid: report.incomingContractTxid,
      accent: '#10B981',
      description: 'Contract transaction recorded on the incoming side.',
    },
    ...report.fundingTxids.map((txid, index) => ({
      label: `Funding Transaction ${index + 1}`,
      txid,
      accent: makerColors[index % makerColors.length],
      description: 'Funding transaction captured directly from the saved report.',
    })),
    ...report.recoveryTxids.map((txid, index) => ({
      label: `Recovery Transaction ${index + 1}`,
      txid,
      accent: '#F59E0B',
      description: 'Recovery-related transaction included by the backend.',
    })),
    ...(report.sweepTxid
      ? [
          {
            label: 'Final Sweep',
            txid: report.sweepTxid,
            accent: '#06B6D4',
            description: 'Final sweep transaction when present in the report.',
          },
        ]
      : []),
  ].filter((artifact) => artifact.txid);
  report.transactionArtifacts = transactionArtifacts;
  report.artifactsCount = transactionArtifacts.length;

  function buildTransactionArtifactsHtml() {
    if (!report.transactionArtifacts || report.transactionArtifacts.length === 0) {
      return `
        <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-800">
          <p class="text-gray-400 text-sm">
            No transaction IDs were embedded in this report file. The report still includes makers, fees, and UTXO outputs below.
          </p>
        </div>
      `;
    }

    return report.transactionArtifacts
      .map((artifact) => {
        return `
          <div class="bg-[#0f1419] rounded-lg p-4 border-l-4" style="border-color: ${artifact.accent}">
            <div class="flex items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold mb-1" style="color: ${artifact.accent}">
                  ${artifact.label}
                </p>
                <p class="text-xs text-gray-500 mb-2">${artifact.description}</p>
                <p class="font-mono text-xs text-gray-300 break-all">${artifact.txid}</p>
              </div>
              <div class="flex gap-2 shrink-0">
                <button class="copy-txid-btn text-gray-400 hover:text-white text-sm transition-colors"
                        data-txid="${artifact.txid}" title="Copy">📋</button>
                <button class="view-txid-btn text-gray-400 hover:text-[#FF6B35] text-sm transition-colors"
                        data-txid="${artifact.txid}" title="View on Explorer">🔍</button>
              </div>
            </div>
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

  function getReportInfoLines() {
    return `
      <div>
        <p class="mb-1"><strong>Rendering Mode:</strong> This report is built from whichever fields are actually present in the saved JSON.</p>
        <p><strong>Artifacts:</strong> Contract, funding, recovery, and sweep transaction IDs are shown whenever the backend included them.</p>
      </div>
      <div>
        <p class="mb-1"><strong>Makers Recorded:</strong> ${report.makersCount || report.makerAddresses.length}</p>
        <p><strong>Protocol Metadata:</strong> ${report.protocol || 'Not explicitly included in this report file.'}</p>
      </div>
    `;
  }

  // Build swap circuit visualization (circular SVG)
  function buildCircularFlowHtml() {
    const isFinitePoint = (point) =>
      point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y);

    const makersCount = Number(report.makersCount);
    const actualMakers = Math.max(
      0,
      Number.isFinite(makersCount) && makersCount > 0
        ? makersCount
        : report.makerAddresses.length
    );
    const totalNodes = actualMakers + 1; // +1 for You

    // Dynamic node sizing
    const youHalf = actualMakers <= 5 ? 38 : actualMakers <= 10 ? 30 : 22;
    const makerHalf = actualMakers <= 5 ? 32 : actualMakers <= 10 ? 25 : 18;
    const youFont = actualMakers <= 5 ? 22 : actualMakers <= 10 ? 16 : 13;
    const makerFont = actualMakers <= 5 ? 20 : actualMakers <= 10 ? 14 : 10;
    const youRx = actualMakers <= 5 ? 14 : 10;
    const makerRx = actualMakers <= 5 ? 10 : 7;
    const maxNodeHalf = Math.max(youHalf, makerHalf);
    const labelPad = youHalf + 62;

    function getRectPoint(distance, width, height) {
      const halfW = width / 2;
      const halfH = height / 2;
      const top = width / 2;
      const right = height;
      const bottom = width;
      const left = height;
      const perimeter = top + right + bottom + left + top;
      let remaining = ((distance % perimeter) + perimeter) % perimeter;

      const linePoint = (x1, y1, x2, y2, travelled, segmentLength) => {
        const ratio = segmentLength === 0 ? 0 : travelled / segmentLength;
        return {
          x: x1 + (x2 - x1) * ratio,
          y: y1 + (y2 - y1) * ratio,
        };
      };

      const segments = [
        {
          length: top,
          point: (travelled) =>
            linePoint(0, -halfH, halfW, -halfH, travelled, top),
        },
        {
          length: right,
          point: (travelled) =>
            linePoint(halfW, -halfH, halfW, halfH, travelled, right),
        },
        {
          length: bottom,
          point: (travelled) =>
            linePoint(halfW, halfH, -halfW, halfH, travelled, bottom),
        },
        {
          length: left,
          point: (travelled) =>
            linePoint(-halfW, halfH, -halfW, -halfH, travelled, left),
        },
        {
          length: top,
          point: (travelled) =>
            linePoint(-halfW, -halfH, 0, -halfH, travelled, top),
        },
      ];

      for (const segment of segments) {
        if (remaining <= segment.length) {
          return segment.point(remaining);
        }
        remaining -= segment.length;
      }

      return { x: 0, y: -halfH };
    }

    function buildAdaptiveLayout() {
      const gap = 14;

      if (actualMakers <= 4) {
        const minRadius =
          (maxNodeHalf + gap) / Math.sin(Math.PI / totalNodes);
        const radius = Math.max(minRadius, 140);
        const svgSize = Math.round((radius + labelPad) * 2);
        const centerX = svgSize / 2;
        const centerY = svgSize / 2;
        const angleStep = (2 * Math.PI) / totalNodes;
        const positions = Array.from({ length: totalNodes }, (_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          };
        });

        return {
          centerX,
          centerY,
          svgWidth: svgSize,
          svgHeight: svgSize,
          positions,
          guideMarkup: `<circle cx="${centerX}" cy="${centerY}" r="${radius}"
                  fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.6"/>`,
        };
      }

      if (actualMakers <= 11) {
        const safeSin = Math.max(Math.sin(Math.PI / totalNodes), 0.22);
        const minRadius =
          (maxNodeHalf + gap + Math.max(0, actualMakers - 5) * 2) / safeSin;
        const rx = Math.max(minRadius * 1.15, 190 + actualMakers * 10);
        const ry = Math.max(minRadius * 0.72, 120 + actualMakers * 5);
        const svgWidth = Math.round(rx * 2 + labelPad * 2 + 30);
        const svgHeight = Math.round(ry * 2 + labelPad * 2);
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        const angleStep = (2 * Math.PI) / totalNodes;
        const positions = Array.from({ length: totalNodes }, (_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return {
            x: centerX + rx * Math.cos(angle),
            y: centerY + ry * Math.sin(angle),
          };
        });

        return {
          centerX,
          centerY,
          svgWidth,
          svgHeight,
          positions,
          guideMarkup: `<ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}"
                  fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.6"/>`,
        };
      }

      const isSquareLayout = actualMakers <= 14;
      const width = isSquareLayout
        ? Math.max(420, 360 + actualMakers * 16)
        : Math.max(640, 430 + actualMakers * 24);
      const height = isSquareLayout
        ? width
        : Math.max(320, 250 + Math.min(actualMakers - 14, 8) * 18);
      const halfW = width / 2;
      const halfH = height / 2;
      const perimeter = width * 2 + height * 2;
      const svgWidth = Math.round(width + labelPad * 2);
      const svgHeight = Math.round(height + labelPad * 2);
      const centerX = svgWidth / 2;
      const centerY = svgHeight / 2;
      const step = perimeter / totalNodes;
      const positions = Array.from({ length: totalNodes }, (_, i) => {
        const point = getRectPoint(step * i, width, height);
        return {
          x: centerX + point.x,
          y: centerY + point.y,
        };
      });

      const x = centerX - halfW;
      const y = centerY - halfH;
      const guideMarkup = `<rect x="${x}" y="${y}" width="${width}" height="${height}"
                fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="7 7" opacity="0.6"/>`;

      return {
        centerX,
        centerY,
        svgWidth,
        svgHeight,
        positions,
        guideMarkup,
      };
    }

    const { centerX, centerY, svgWidth, svgHeight, positions, guideMarkup } =
      buildAdaptiveLayout();
    const hasValidLayout =
      Number.isFinite(centerX) &&
      Number.isFinite(centerY) &&
      Number.isFinite(svgWidth) &&
      Number.isFinite(svgHeight) &&
      Array.isArray(positions) &&
      positions.length === totalNodes &&
      positions.every(isFinitePoint);

    if (!hasValidLayout) {
      console.warn('⚠️ Invalid swap circuit layout, falling back to simple list', {
        actualMakers,
        totalNodes,
        centerX,
        centerY,
        svgWidth,
        svgHeight,
        positions,
      });

      return `
        <div class="bg-[#0f1419] rounded-lg p-5 border border-gray-800">
          <p class="text-gray-300 text-sm mb-3">Swap path visualization unavailable for this report.</p>
          <div class="space-y-2">
            <div class="text-[#10B981] font-semibold">You</div>
            ${Array.from({ length: actualMakers }, (_, i) => {
              const addr = report.makerAddresses[i] || `Maker ${i + 1}`;
              const color = makerColors[i % makerColors.length];
              return `<div class="font-mono text-xs" style="color: ${color};">Maker ${i + 1}: ${truncateAddress(addr)}</div>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="flex items-center justify-center overflow-auto">
        <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" class="mx-auto max-w-full">
          <defs>
            ${Array.from({ length: totalNodes }, (_, i) => {
              const color = i < actualMakers ? makerColors[i % makerColors.length] : '#10B981';
              return `<marker id="r-arrow-${i}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${color}" opacity="0.9"/>
              </marker>`;
            }).join('')}
            <filter id="r-glow-you" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <!-- Guide path -->
          ${guideMarkup}

          <!-- Arrows -->
          ${positions.map((pos, i) => {
            const nextPos = positions[(i + 1) % positions.length];
            const color = i < actualMakers ? makerColors[i % makerColors.length] : '#10B981';
            const fromHalf = i === 0 ? youHalf : makerHalf;
            const toHalf = (i + 1) % positions.length === 0 ? youHalf : makerHalf;
            if (!isFinitePoint(pos) || !isFinitePoint(nextPos)) return '';
            const dx = nextPos.x - pos.x;
            const dy = nextPos.y - pos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (!Number.isFinite(len) || len <= 0) return '';
            const sx = pos.x + (dx / len) * (fromHalf + 4);
            const sy = pos.y + (dy / len) * (fromHalf + 4);
            const ex = nextPos.x - (dx / len) * (toHalf + 10);
            const ey = nextPos.y - (dy / len) * (toHalf + 10);
            if (![sx, sy, ex, ey].every(Number.isFinite)) return '';
            return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
                          stroke="${color}" stroke-width="2" marker-end="url(#r-arrow-${i})" opacity="0.75"/>`;
          }).join('')}

          <!-- You node (completed — green) -->
          <g>
            <rect x="${(positions[0].x - youHalf).toFixed(1)}" y="${(positions[0].y - youHalf).toFixed(1)}"
                  width="${youHalf * 2}" height="${youHalf * 2}" rx="${youRx}"
                  fill="#10B981" filter="url(#r-glow-you)"/>
            <text x="${positions[0].x.toFixed(1)}" y="${(positions[0].y + youFont * 0.38).toFixed(1)}"
                  text-anchor="middle" fill="white" font-size="${youFont}" font-weight="bold">You</text>
            <text x="${positions[0].x.toFixed(1)}" y="${(positions[0].y + youHalf + 17).toFixed(1)}"
                  text-anchor="middle" fill="#6EE7B7" font-size="${Math.max(8, youFont - 12)}">Completed ✓</text>
          </g>

          <!-- Maker nodes (clickable) -->
          ${Array.from({ length: actualMakers }, (_, i) => {
            const pos = positions[i + 1];
            const color = makerColors[i % makerColors.length];
            const addr = report.makerAddresses[i] || '';
            const shortAddr = addr ? truncateAddress(addr, 6, 4) : '';
            return `<g class="maker-node cursor-pointer" data-maker-index="${i}"
                       style="transition: opacity 0.2s;">
              <rect x="${(pos.x - makerHalf).toFixed(1)}" y="${(pos.y - makerHalf).toFixed(1)}"
                    width="${makerHalf * 2}" height="${makerHalf * 2}" rx="${makerRx}" fill="${color}"/>
              <text x="${pos.x.toFixed(1)}" y="${(pos.y + makerFont * 0.38).toFixed(1)}"
                    text-anchor="middle" fill="white" font-size="${makerFont}" font-weight="bold">M${i + 1}</text>
              ${actualMakers <= 10 ? `
              <text x="${pos.x.toFixed(1)}" y="${(pos.y + makerHalf + 14).toFixed(1)}"
                    text-anchor="middle" fill="#9CA3AF" font-size="${Math.max(7, makerFont - 3)}">${shortAddr}</text>
              ` : ''}
            </g>`;
          }).join('')}

          <text x="${centerX}" y="${centerY}" text-anchor="middle" fill="#6B7280" font-size="11" font-weight="bold">Private Route</text>
          <text x="${centerX}" y="${centerY + 15}" text-anchor="middle" fill="#4B5563" font-size="9">${actualMakers} makers</text>
        </svg>
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

.maker-node {
  transform-box: fill-box;
  transform-origin: center;
}

.maker-node:hover {
  filter: brightness(1.08);
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
              <p class="text-gray-400 text-sm mt-1">View Detailed Swap Data.</p>
            </div>
          </div>
          <button id="back-to-wallet" class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-6 py-3 rounded-lg transition-all hover:scale-105">
            ← Back to Swaps
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
          ${
            report.nativeSwapId
              ? `
          <div class="px-4 py-2 bg-[#1a2332] rounded-lg">
            <span class="text-gray-400 text-sm">Backend Swap ID: </span>
            <span class="font-mono text-white text-sm">${report.nativeSwapId}</span>
          </div>
          `
              : ''
          }
        </div>
      </div>

      <!-- Circular Flow Diagram -->
      <div class="mb-8 animate-fade-in-up stagger-1">
        <div class="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-xl p-8 border border-[#FF6B35]/20 shadow-2xl">
          <h3 class="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <svg class="w-7 h-7 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="6" cy="6" r="2" stroke-width="2"></circle>
              <circle cx="18" cy="6" r="2" stroke-width="2"></circle>
              <circle cx="12" cy="18" r="2" stroke-width="2"></circle>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 6h8M7 7.5l4 8M17 7.5l-4 8"></path>
            </svg>
            Swap Circuit
            <span class="text-sm font-normal text-gray-400">(Click on makers for details)</span>
          </h3>
          <p class="text-xs text-gray-500 mb-6">Your coins move across the swap circuit and come back with broken transaction links.</p>
          
          <!-- Circular Flow -->
          <div class="flex justify-center">
            ${buildCircularFlowHtml()}
          </div>
          
        
          
          <div class="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 class="text-sm font-bold text-blue-300 mb-2 flex items-center gap-2">
              <span>ℹ️</span> Report Summary
            </h4>
            <div class="text-xs text-gray-300 grid grid-cols-1 md:grid-cols-2 gap-4">
              ${getReportInfoLines()}
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-5 gap-4 mb-6">
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
<p class="text-sm text-white">On-Chain Artifacts</p>
            <span class="text-2xl">🔗</span>
          </div>
         <p class="text-2xl font-bold text-purple-400">
  ${report.artifactsCount}
</p>
<p class="text-xs text-gray-400 mt-1">
  Transaction IDs extracted from this report
</p>
        </div>

        <div class="bg-[#1a2332] rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer animate-fade-in-up stagger-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-white">Swap Partners</p>
            <span class="text-2xl">🤝</span>
          </div>
          <p class="text-2xl font-bold text-yellow-400">${report.makersCount || report.makerAddresses.length}</p>
          <p class="text-xs text-gray-400 mt-1">Makers recorded in the report</p>
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
          
          <!-- Transaction Artifacts -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-2">
            <h3 class="text-xl font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <span>📝</span> Transaction Artifacts
            </h3>
            <div class="space-y-3">
              ${buildTransactionArtifactsHtml()}
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

          <!-- UTXO Summary with Tooltip -->
          <div class="bg-[#1a2332] rounded-lg p-6 animate-fade-in-up stagger-4">
            <h3 class="text-lg font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <span>📦</span> UTXO Summary
            </h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Outgoing Regular/Swap UTXOs</span>
                <span class="font-mono text-white">${report.inputUtxos.length}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Incoming Swap UTXOs</span>
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
          Back to Swaps
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
      window.open(`https://mutinynet.com/tx/${txid}`, '_blank');
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
      window.appManager.renderComponent('swap');
    }
  });

  // Done button
  content.querySelector('#done-btn').addEventListener('click', () => {
    if (window.appManager) {
      window.appManager.renderComponent('swap');
    }
  });
}
