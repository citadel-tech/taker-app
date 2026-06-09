import { icons } from '../../js/icons.js';
import { SATS_SYMBOL } from '../../js/price.js';

function satsToBtc(sats) {
  const normalized = Number(sats || 0);
  return Number.isFinite(normalized)
    ? (normalized / 100000000).toFixed(8)
    : '0.00000000';
}

export function SwapReportComponent(container, swapReport, options = {}) {
  const trackerInfo = options.trackerInfo || null;
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
        <button id="back-btn" class="mt-4 bg-primary text-white px-6 py-3 rounded-lg">Back to Swaps</button>
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
  const toArray = (value) => {
    if (Array.isArray(value)) return value.filter((entry) => entry != null);
    return value == null ? [] : [value];
  };

  const nestedReport = swapReport.report || {};
  const rawStatus =
    swapReport.status ||
    swapReport.reportStatus ||
    swapReport.report_status ||
    nestedReport.status ||
    null;
  const normalizedStatus = (() => {
    const status = String(rawStatus || '').toLowerCase();
    if (status === 'success' || status === 'completed') return 'completed';
    if (status === 'failed' || status === 'failure' || status === 'error') {
      return 'failed';
    }
    return status || 'completed';
  })();
  const errorMessage =
    swapReport.errorMessage ||
    swapReport.error_message ||
    nestedReport.errorMessage ||
    nestedReport.error_message ||
    swapReport.error ||
    nestedReport.error ||
    null;

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
    swapReport.outgoingAmount ??
      swapReport.outgoing_amount ??
      swapReport.targetAmount ??
      swapReport.target_amount ??
      swapReport.incomingAmount ??
      swapReport.incoming_amount ??
      nestedReport.targetAmount ??
      nestedReport.target_amount ??
      nestedReport.outgoingAmount ??
      nestedReport.outgoing_amount ??
      swapReport.amount ??
      nestedReport.incomingAmount ??
      nestedReport.incoming_amount,
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
      swapReport.outputChangeUtxos ||
      swapReport.output_change_utxos ||
      [],
    outputSwapUtxos:
      swapReport.outputSwapUtxos ||
      swapReport.output_swap_utxos ||
      nestedReport.outputSwapUtxos ||
      nestedReport.output_swap_utxos ||
      [],
    outgoingContracts:
      swapReport.outgoingContracts ||
      swapReport.outgoing_contracts ||
      nestedReport.outgoingContracts ||
      nestedReport.outgoing_contracts ||
      [],
    incomingContracts:
      swapReport.incomingContracts ||
      swapReport.incoming_contracts ||
      nestedReport.incomingContracts ||
      nestedReport.incoming_contracts ||
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
    status: normalizedStatus,
    errorMessage,
    outgoingContractTxid,
    incomingContractTxid,
    recoveryTxids,
  };
  report.inputUtxos = toArray(report.inputUtxos);
  report.outputRegularUtxos = toArray(report.outputRegularUtxos);
  report.outputSwapUtxos = toArray(report.outputSwapUtxos);
  report.outgoingContracts = toArray(report.outgoingContracts);
  report.incomingContracts = toArray(report.incomingContracts);
  report.changeAmount = toNumber(
    swapReport.changeAmount ??
      swapReport.change_amount ??
      swapReport.outputChangeAmount ??
      swapReport.output_change_amount ??
      swapReport.output_change_amounts ??
      nestedReport.changeAmount ??
      nestedReport.change_amount ??
      nestedReport.outputChangeAmount ??
      nestedReport.output_change_amount ??
      nestedReport.output_change_amounts,
    NaN
  );

  console.log('📊 Normalized report:', report);

  // Helper functions
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getFirstField(source, keys, fallback = null) {
    if (!source || typeof source !== 'object') return fallback;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        return source[key];
      }
    }
    return fallback;
  }

  function getUtxoAmount(utxo) {
    if (utxo && typeof utxo === 'object' && 'reportEntry' in utxo) {
      return getUtxoAmount(utxo.reportEntry);
    }
    if (typeof utxo === 'number') return utxo;
    if (Array.isArray(utxo)) {
      const amount = utxo.find((entry) => Number.isFinite(Number(entry)));
      return toNumber(amount, NaN);
    }
    if (!utxo || typeof utxo !== 'object') return NaN;
    return toNumber(
      getFirstField(utxo, [
        'amount',
        'value',
        'sats',
        'satoshis',
        'amount_sats',
        'amountSats',
      ]),
      NaN
    );
  }

  function sumUtxos(utxos) {
    return utxos.reduce((sum, utxo) => {
      const amount = getUtxoAmount(utxo);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
  }

  if (!Number.isFinite(report.changeAmount)) {
    report.changeAmount = sumUtxos(report.outputRegularUtxos);
  }

  function getUtxoTitle(utxo, fallbackLabel, groupLabel = 'Report entry') {
    if (utxo && typeof utxo === 'object' && 'reportEntry' in utxo) {
      const entry = utxo.reportEntry;
      if (typeof entry === 'number') return `${utxo.reportLabel} amount`;
      return getUtxoTitle(entry, fallbackLabel, groupLabel);
    }
    if (typeof utxo === 'number') return `${fallbackLabel} amount`;
    if (typeof utxo === 'string') return utxo;
    if (Array.isArray(utxo)) {
      const [first, second, third] = utxo;
      const firstNumber = Number(first);
      const secondNumber = Number(second);

      if (typeof first === 'string' && Number.isFinite(secondNumber)) {
        return `${first}:${second}`;
      }

      if (Number.isFinite(firstNumber) && typeof second === 'string') {
        return second;
      }

      if (typeof second === 'string' && Number.isFinite(Number(third))) {
        return `${second}:${third}`;
      }

      return utxo.map((entry) => String(entry)).join(' · ') || fallbackLabel;
    }
    if (!utxo || typeof utxo !== 'object') return fallbackLabel;
    const outpoint =
      getFirstField(utxo, ['outpoint', 'point']) ||
      (getFirstField(utxo, ['txid', 'tx_id', 'txHash', 'tx_hash'])
        ? `${getFirstField(utxo, ['txid', 'tx_id', 'txHash', 'tx_hash'])}:${getFirstField(utxo, ['vout', 'index', 'output_index'], '?')}`
        : null);
    return (
      outpoint ||
      getFirstField(utxo, ['address', 'script_pubkey', 'scriptPubkey', 'contract_txid', 'contractTxid']) ||
      JSON.stringify(utxo)
    );
  }

  function getUtxoMeta(utxo) {
    if (utxo && typeof utxo === 'object' && 'reportEntry' in utxo) {
      const meta = getUtxoMeta(utxo.reportEntry);
      return [utxo.reportLabel, meta].filter(Boolean).join(' · ');
    }
    if (typeof utxo === 'number') return 'amount recorded in report';
    if (Array.isArray(utxo)) {
      const [first, second, third] = utxo;
      const parts = [];
      if (Number.isFinite(Number(first))) parts.push(`${formatNumber(Number(first))} ${SATS_SYMBOL}`);
      if (typeof second === 'string' && Number.isFinite(Number(first))) {
        parts.push('report output');
      } else if (third != null) {
        parts.push(String(third));
      }
      return parts.join(' · ');
    }
    if (!utxo || typeof utxo !== 'object') return '';
    const parts = [];
    const type = getFirstField(utxo, ['type', 'spend_type', 'spendType', 'label']);
    const address = getFirstField(utxo, ['address']);
    const vout = getFirstField(utxo, ['vout', 'index', 'output_index']);
    if (type) parts.push(String(type));
    if (vout != null) parts.push(`vout ${vout}`);
    if (address) parts.push(truncateAddress(String(address), 10, 8));
    return parts.join(' · ');
  }

  function buildUtxoRowsHtml(utxos, emptyText, groupLabel = 'Report entry') {
    if (!utxos.length) {
      return emptyText ? `<p class="swap-report-empty">${emptyText}</p>` : '';
    }

    return utxos
      .map((utxo, index) => {
        const title = getUtxoTitle(utxo, `${groupLabel} ${index + 1}`, groupLabel);
        const amount = getUtxoAmount(utxo);
        const meta = getUtxoMeta(utxo);
        return `
          <div class="swap-report-utxo-row">
            <div>
              <strong>${escapeHtml(title)}</strong>
              ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
            </div>
            ${Number.isFinite(amount) ? `<em>${formatNumber(amount)} ${SATS_SYMBOL}</em>` : ''}
          </div>
        `;
      })
      .join('');
  }

  function getMakerFeeParts(makerIndex) {
    const makerFee = report.makerFeeInfo[makerIndex] || {};
    const baseFee = toNumber(
      getFirstField(makerFee, ['baseFee', 'base_fee', 'makerBaseFee', 'maker_base_fee']),
      0
    );
    const amountFee = toNumber(
      getFirstField(makerFee, [
        'amountRelativeFee',
        'amount_relative_fee',
        'liquidityFee',
        'liquidity_fee',
        'volumeFee',
        'volume_fee',
      ]),
      0
    );
    const timeFee = toNumber(
      getFirstField(makerFee, ['timeRelativeFee', 'time_relative_fee', 'timeFee', 'time_fee']),
      0
    );
    const explicitTotal = toNumber(
      getFirstField(makerFee, ['totalFee', 'total_fee', 'feePaid', 'fee_paid', 'amount']),
      NaN
    );
    const componentTotal = baseFee + amountFee + timeFee;
    const totalFee = Number.isFinite(explicitTotal) ? explicitTotal : componentTotal;
    const unattributed = Math.max(0, totalFee - componentTotal);
    const fidelityTx =
      getFirstField(makerFee, [
        'fidelityTxid',
        'fidelity_txid',
        'fidelityBondTxid',
        'fidelity_bond_txid',
        'bondTxid',
        'bond_txid',
        'fidelityTransaction',
        'fidelity_transaction',
      ]) || null;

    return {
      baseFee,
      amountFee,
      timeFee,
      unattributed,
      totalFee,
      hasComponents: componentTotal > 0,
      fidelityTx,
    };
  }

  function getMakerFeeDisplay(makerIndex) {
    const parts = getMakerFeeParts(makerIndex);
    return Number.isFinite(parts.totalFee) && parts.totalFee > 0
      ? `${formatNumber(parts.totalFee)} ${SATS_SYMBOL}`
      : 'Not itemized';
  }

  const itemizedMakerFeeTotal = report.makerFeeInfo.reduce((sum, _entry, index) => {
    const totalFee = getMakerFeeParts(index).totalFee;
    return Number.isFinite(totalFee) ? sum + totalFee : sum;
  }, 0);

  if (report.totalMakerFees <= 0 && itemizedMakerFeeTotal > 0) {
    report.totalMakerFees = itemizedMakerFeeTotal;
    if (report.totalFee <= report.miningFee) {
      report.totalFee = report.totalMakerFees + report.miningFee;
    }
    report.feePercentage =
      report.targetAmount > 0 ? (report.totalFee / report.targetAmount) * 100 : 0;
  }

  function truncateAddress(addr, start = 14, end = 16) {
    if (!addr || typeof addr !== 'string') return 'unknown';

    const separatorIndex = addr.lastIndexOf(':');
    if (separatorIndex === -1) {
      if (addr.length <= start + end) return addr;
      return `${addr.substring(0, start)}...${addr.substring(addr.length - end)}`;
    }

    const host = addr.substring(0, separatorIndex);
    const port = addr.substring(separatorIndex + 1);

    if (host.length <= start + end + 3) {
      return `${host}:${port}`;
    }

    return `${host.substring(0, start)}...${host.substring(host.length - end)}:${port}`;
  }

  function truncateTxid(txid, start = 20, end = 12) {
    if (!txid || typeof txid !== 'string') return 'unknown';
    if (txid.length <= start + end) return txid;
    return `${txid.substring(0, start)}...${txid.substring(txid.length - end)}`;
  }

  function getOutputAddress(output) {
    if (Array.isArray(output)) {
      return output.find((entry) => typeof entry === 'string' && entry.trim()) || '';
    }
    if (!output || typeof output !== 'object') return '';
    return String(
      getFirstField(output, [
        'address',
        'script_pubkey',
        'scriptPubkey',
        'destination',
      ], '')
    );
  }

  function buildOutputRowsHtml(outputs, label) {
    if (!outputs.length) return '';

    return outputs
      .map((output, index) => {
        const amount = getUtxoAmount(output);
        const address = getOutputAddress(output);
        return `
          <div class="swap-report-output-row">
            <div>
              <span>${label} ${index + 1}</span>
              <strong title="${escapeHtml(address)}">${escapeHtml(address || 'Address not included')}</strong>
            </div>
            <em>${Number.isFinite(amount) ? `${formatNumber(amount)} ${SATS_SYMBOL}` : 'Amount not included'}</em>
            ${address ? `<button class="copy-output-btn" data-copy-text="${escapeHtml(address)}" title="Copy address">${icons.clipboardCopy(16)}</button>` : ''}
          </div>
        `;
      })
      .join('');
  }

  function buildWalletOutputsHtml() {
    const changeRows = buildOutputRowsHtml(report.outputRegularUtxos, 'Change output');
    const swapRows = buildOutputRowsHtml(report.outputSwapUtxos, 'Swap output');

    if (!changeRows && !swapRows) return '';

    return `
      <div class="swap-report-output-group">
        ${changeRows ? `
          <div class="swap-report-output-subgroup">
            <h4>Change UTXOs</h4>
            ${changeRows}
          </div>
        ` : ''}
        ${swapRows ? `
          <div class="swap-report-output-subgroup">
            <h4>Incoming Swap UTXOs</h4>
            ${swapRows}
          </div>
        ` : ''}
      </div>
    `;
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
    const feeParts = getMakerFeeParts(makerIndex);
    const feePaid = Number.isFinite(feeParts.totalFee) ? feeParts.totalFee : 0;
    const feeRate =
      report.targetAmount > 0 ? (feePaid / report.targetAmount) * 100 : 0;
    const color = makerColors[makerIndex % makerColors.length];
    const feeRows = [
      ['Base fee', feeParts.baseFee, 'Fixed maker fee'],
      ['Liquidity fee', feeParts.amountFee, 'Amount-relative fee'],
      ['Time fee', feeParts.timeFee, 'Refund locktime fee'],
      ...(feeParts.unattributed > 0
        ? [['Other maker fee', feeParts.unattributed, 'Included in report total']]
        : []),
    ];

    // Remove any existing popup
    const existingPopup = document.querySelector('.maker-popup-overlay');
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.className = 'maker-popup-overlay';
    overlay.innerHTML = `
      <div class="maker-popup" style="--maker-color: ${color};">
        <div class="maker-popup-head">
          <div class="maker-popup-title">
            <div class="maker-popup-token">M${makerIndex + 1}</div>
            <div>
              <h3>Maker ${makerIndex + 1}</h3>
              <p>Swap Partner</p>
            </div>
          </div>
          <button class="close-popup maker-popup-close" type="button" aria-label="Close">&times;</button>
        </div>
        
        <div class="maker-popup-body">
          <section class="maker-popup-card maker-popup-address">
            <span>Onion Address</span>
            <div>
              <strong>${escapeHtml(makerAddr)}</strong>
              <button class="copy-addr-btn maker-popup-icon-btn" type="button" title="Copy address">${icons.clipboardCopy(15)}</button>
            </div>
          </section>
          
          <section class="maker-popup-card">
            <span>Fee Information</span>
            <div class="maker-popup-metrics">
              <div>
                <small>Fee Paid</small>
                <strong>${formatNumber(feePaid)} ${SATS_SYMBOL}</strong>
              </div>
              <div>
                <small>Fee Rate</small>
                <strong>${feeRate.toFixed(2)}%</strong>
              </div>
            </div>
          </section>

          <section class="maker-popup-card">
            <span>Fee Breakdown</span>
            <div class="maker-popup-fee-breakdown">
              ${feeRows
                .map(
                  ([label, amount, note]) => `
                    <div>
                      <span>
                        <b>${label}</b>
                        <small>${note}</small>
                      </span>
                      <strong>${formatNumber(amount)} ${SATS_SYMBOL}</strong>
                    </div>
                  `
                )
                .join('')}
              <div class="maker-popup-fee-total">
                <span>
                  <b>Total maker fee</b>
                  <small>Base + liquidity + time${feeParts.unattributed > 0 ? ' + other' : ''}</small>
                </span>
                <strong>${formatNumber(feePaid)} ${SATS_SYMBOL}</strong>
              </div>
              ${
                feeParts.hasComponents
                  ? ''
                  : '<p>Component-level fee data was not included in this report.</p>'
              }
            </div>
          </section>

          ${
            feeParts.fidelityTx
              ? `
                <section class="maker-popup-card maker-popup-address">
                  <span>Fidelity Tx</span>
                  <div>
                    <strong>${escapeHtml(feeParts.fidelityTx)}</strong>
                    <button class="copy-fidelity-btn maker-popup-icon-btn" type="button" title="Copy fidelity transaction">${icons.clipboardCopy(15)}</button>
                  </div>
                </section>
              `
              : ''
          }
          
          <section class="maker-popup-card">
            <span>Swap Position</span>
            <div class="maker-popup-position">
              <b>Hop ${makerIndex + 1} of ${report.makersCount}</b>
              <small>
                ${makerIndex === 0 ? '(First maker in chain)' : makerIndex === report.makersCount - 1 ? '(Last maker in chain)' : '(Middle of chain)'}
              </small>
            </div>
          </section>
        </div>
        
        <div class="maker-popup-actions">
          <button class="copy-addr-btn maker-popup-secondary" type="button">
            ${icons.clipboardCopy(15)} Copy Address
          </button>
          <button class="close-popup maker-popup-primary" type="button">
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

    overlay.querySelectorAll('.copy-fidelity-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        copyToClipboard(feeParts.fidelityTx);
      });
    });
  }

  const makerColors = ['#518def', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];
  const makeReportEntry = (reportLabel, reportEntry) => ({
    reportLabel,
    reportEntry,
  });
  const transactionArtifacts = [
    ...(report.outgoingContractTxid
      ? [
          {
            label: 'Outgoing Contract Tx',
            txid: report.outgoingContractTxid,
            accent: '#f5c451',
            description: 'Outgoing contract transaction from the report.',
          },
        ]
      : []),
    ...(report.incomingContractTxid
      ? [
          {
            label: 'Incoming Contract Tx',
            txid: report.incomingContractTxid,
            accent: '#518def',
            description: 'Incoming contract transaction from the report.',
          },
        ]
      : []),
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
      return '';
    }

    return report.transactionArtifacts
      .map((artifact) => {
        const directionIcon = artifact.label.toLowerCase().includes('incoming')
          ? '↙'
          : artifact.label.toLowerCase().includes('outgoing')
            ? '↗'
            : '→';
        return `
          <div class="swap-report-artifact" style="--artifact-accent: ${artifact.accent}">
            <div>
              <h4><span>${directionIcon}</span>${artifact.label}</h4>
              <p>${artifact.txid}</p>
            </div>
            <button class="copy-txid-btn" data-txid="${artifact.txid}" title="Copy transaction">${icons.clipboardCopy(16)}</button>
            <button class="view-txid-btn" data-txid="${artifact.txid}" title="View transaction">${icons.externalLink(16)}</button>
          </div>
        `;
      })
      .join('');
  }

  const HANDSHAKE_STEPS = [
    { key: 'negotiated', label: 'Negotiated' },
    { key: 'connected', label: 'Connected' },
    { key: 'contractDataSent', label: 'Contract sent' },
    { key: 'makerContractReceived', label: 'Contract received' },
    { key: 'swapcoinCreated', label: 'Swapcoin created' },
    { key: 'privkeyReceived', label: 'Privkey received' },
    { key: 'privkeyForwarded', label: 'Privkey forwarded' },
  ];

  function buildHandshakeHtml(progress) {
    if (!progress) return '';
    // Find the last completed step to detect where it broke
    let lastDone = -1;
    HANDSHAKE_STEPS.forEach((s, i) => { if (progress[s.key]) lastDone = i; });
    return `
      <div class="maker-handshake">
        ${HANDSHAKE_STEPS.map((s, i) => {
          const done = progress[s.key];
          const broken = !done && i === lastDone + 1;
          return `<span class="maker-handshake-step ${done ? 'done' : broken ? 'broken' : 'skip'}" title="${s.label}">${done ? icons.checkCircle(11) : broken ? icons.xCircle(11) : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>'}<small>${s.label}</small></span>`;
        }).join('')}
      </div>
    `;
  }

  // Build maker addresses HTML - Now clickable to show popup
  function buildMakersHtml() {
    if (!report.makerAddresses || report.makerAddresses.length === 0) {
      return '<p class="swap-report-empty">No maker data available</p>';
    }

    return report.makerAddresses
      .map((addr, idx) => {
        const progress = trackerInfo?.makerProgress?.[idx] || null;
        return `
        <div class="maker-card-wrap">
          <button class="maker-card swap-report-maker-row" data-maker-index="${idx}">
            <span>Maker ${String(idx + 1).padStart(2, '0')}</span>
            <strong>${truncateAddress(addr, 20, 18)}</strong>
            <em>View ${icons.externalLink(12)}</em>
          </button>
          ${isFailedReport && progress ? buildHandshakeHtml(progress) : ''}
        </div>
      `;
      })
      .join('');
  }

  function buildMakerFeeLinesHtml() {
    const count = Math.max(makerCount, report.makerFeeInfo.length);
    if (!count) return '';

    return `
      <div class="swap-report-maker-fees">
        <span>Maker fee split</span>
        ${Array.from({ length: count }, (_, idx) => {
          const addr = report.makerAddresses[idx] || `Maker ${idx + 1}`;
          return `
            <button class="maker-fee-row" data-maker-index="${idx}" type="button">
              <span>Maker ${idx + 1}</span>
              <strong>${getMakerFeeDisplay(idx)}</strong>
              <em>${escapeHtml(truncateAddress(addr, 10, 8))}</em>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function buildFeeDetailsHtml() {
    const lines = [
      `<div><span>Maker fees</span><strong>${formatNumber(report.totalMakerFees)} <span class="cs-sats-symbol" role="img" aria-label="satoshis"><span></span><span></span><span></span></span></strong></div>`,
      `<div><span>Mining fees</span><strong>${formatNumber(report.miningFee)} <span class="cs-sats-symbol" role="img" aria-label="satoshis"><span></span><span></span><span></span></span></strong></div>`,
    ];

    if (report.changeAmount > 0) {
      lines.push(
        `<div><span>Change amount</span><strong>${formatNumber(report.changeAmount)} <span class="cs-sats-symbol" role="img" aria-label="satoshis"><span></span><span></span><span></span></span></strong></div>`
      );
    }

    return lines.join('');
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
        <div class="bg-app-bg rounded-lg p-5 border border-gray-800">
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
                  text-anchor="middle" fill="#6EE7B7" font-size="${Math.max(8, youFont - 12)}">&#x2713; Completed</text>
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

  const makerCount = report.makersCount || report.makerAddresses.length;
  const displaySwapId = report.swapId || 'unknown';
  const displayAmount = report.totalOutputAmount || report.targetAmount;
  const isFailedReport = report.status === 'failed';
  const reportStatusLabel = isFailedReport ? 'Failed' : 'Completed';

  content.innerHTML = `
    <div class="swap-report-page ${isFailedReport ? 'is-failed' : ''}">
      <header class="swap-report-head">
        <button id="report-back-btn" class="swap-report-head-back" type="button" aria-label="Back to swap">
          ${icons.arrowLeft(28)}
        </button>
        <div>
          <h2>Swap <span>${reportStatusLabel}</span></h2>
        </div>
      </header>

      <div class="swap-report-layout">
        <section class="swap-report-main">
          <h3>Swap Summary</h3>
          ${
            isFailedReport && report.errorMessage
              ? `
                <div class="swap-report-error-banner">
                  ${icons.alertTriangle(18)}
                  <div>
                    <strong>Failure reason${trackerInfo?.failedAtPhase ? ` <em class="swap-report-phase-badge">${escapeHtml(trackerInfo.failedAtPhase)}</em>` : ''}</strong>
                    <span>${escapeHtml(trackerInfo?.failureReasonFormatted || report.errorMessage)}</span>
                  </div>
                </div>
              `
              : ''
          }
          <div class="swap-report-hero">
            <span>${isFailedReport ? 'Attempted Amount' : 'Amount Swapped'}</span>
            <strong>${formatNumber(displayAmount)} <span class="cs-sats-symbol" role="img" aria-label="satoshis"><span></span><span></span><span></span></span></strong>
            <p>≈ ${satsToBtc(displayAmount)} BTC</p>
            <b>${icons.timer(15)} Duration ${formatDuration(report.swapDurationSeconds)}</b>
          </div>

          <div class="swap-report-block">
            <div class="swap-report-block-head">
              <span>Transactions</span>
            </div>
            <div class="swap-report-artifacts">
              ${buildTransactionArtifactsHtml()}
              ${buildWalletOutputsHtml()}
            </div>
          </div>

          ${isFailedReport && trackerInfo?.recoveryPhase === 'NotStarted' ? `
          <div class="swap-report-recovery-callout">
            ${icons.recycle(15)}
            <span>Funds pending recovery — visit the <strong>Recovery</strong> page to track progress.</span>
          </div>
          ` : ''}

          <div class="swap-report-block">
            <div class="swap-report-block-head">
              <span>Swap Partners</span>
              <strong>${makerCount} maker${makerCount === 1 ? '' : 's'}</strong>
            </div>
            <div class="swap-report-makers">
              ${buildMakersHtml()}
            </div>
          </div>

          <div class="swap-report-export-bar">
            <button id="export-report">${icons.arrowDownCircle(18)} Export report</button>
          </div>
        </section>

        <aside class="swap-report-side">
          <section class="swap-report-fees">
            <h3>Fee Details</h3>
            <div class="swap-report-fee-lines">
              ${buildFeeDetailsHtml()}
            </div>
            ${buildMakerFeeLinesHtml()}
            <div class="swap-report-total-fee">
              <span>Total fee</span>
              <strong>${formatNumber(report.totalFee)} <span class="cs-sats-symbol" role="img" aria-label="satoshis"><span></span><span></span><span></span></span></strong>
              <p>${satsToBtc(report.totalFee)} BTC</p>
            </div>
            <div class="swap-report-percent">
              <span>Of swap amount</span>
              <strong>${report.feePercentage.toFixed(3)}%</strong>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;

  container.appendChild(content);

  content.querySelectorAll('.maker-card').forEach((card) => {
    card.addEventListener('click', () => {
      showMakerPopup(parseInt(card.dataset.makerIndex));
    });
  });

  content.querySelectorAll('.maker-fee-row').forEach((row) => {
    row.addEventListener('click', () => {
      showMakerPopup(parseInt(row.dataset.makerIndex));
    });
  });

  content.querySelectorAll('.copy-txid-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.txid);
    });
  });

  content.querySelectorAll('.copy-output-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.copyText);
    });
  });

  content.querySelectorAll('.view-txid-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.open(`https://mutinynet.com/tx/${btn.dataset.txid}`, '_blank');
    });
  });

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

  content.querySelector('#report-back-btn').addEventListener('click', () => {
    if (window.appManager) {
      window.appManager.renderComponent(options.backTarget || 'swap');
    }
  });

}
