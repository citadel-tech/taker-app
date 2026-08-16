import { icons } from '../../js/icons.js';
import { SATS_SYMBOL } from '../../js/price.js';
import { explorerTxUrl, normalizeSwapProtocol, escapeHtml, formatDuration, copyToText, truncateMiddle, formatTorEndpoint, showToast } from '../../js/openswapHelpers.js';

function satsToBtc(sats) {
  const normalized = Number(sats || 0);
  return Number.isFinite(normalized)
    ? (normalized / 100000000).toFixed(8)
    : '0.00000000';
}

export function SwapReportComponent(container, swapReport, options = {}) {
  const trackerInfo = options.trackerInfo || null;

  console.log('📊 SwapReportComponent loading with report:', swapReport);
  console.log('📊 Report keys:', Object.keys(swapReport || {}));

  const content = document.createElement('div');
  content.id = 'swap-report-content';

  // Validate report data
  if (!swapReport || typeof swapReport !== 'object') {
    console.error('❌ Invalid swap report:', swapReport);
    content.innerHTML = `
      <div class="text-center py-20">
        <p class="text-danger text-xl">Error: No swap report data available</p>
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
  const rawFeePaid = toNumber(
    swapReport.fee_paid ??
      swapReport.feePaid ??
      nestedReport.fee_paid ??
      nestedReport.feePaid,
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
  const netFeePaid = Number.isFinite(rawFeePaid)
    ? Math.abs(rawFeePaid)
    : NaN;
  const rawTotalFee =
    Number.isFinite(providedTotalFee) && providedTotalFee >= 0
      ? providedTotalFee
      : componentTotalFee > 0
        ? componentTotalFee
        : Number.isFinite(netFeePaid)
          ? netFeePaid
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

  const protocol = normalizeSwapProtocol(
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

  // Extract deniability proofs from the raw report file structure, filtered to this swap only
  const rawDeniabilityProofs =
    swapReport.deniability_proofs ||
    swapReport.deniabilityProofs ||
    nestedReport.deniability_proofs ||
    nestedReport.deniabilityProofs ||
    [];
  const allProofs = Array.isArray(rawDeniabilityProofs) ? rawDeniabilityProofs : [];
  const currentSwapId = report.nativeSwapId || report.swapId || null;
  report.deniabilityProofs = currentSwapId
    ? allProofs.filter((p) => p.swap_id === currentSwapId)
    : [];

  console.log('📊 Normalized report:', report);

  // Helper functions
  function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString();
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
    if (address) parts.push(truncateMiddle(String(address), { start: 10, end: 8, ellipsis: '...' }));
    return parts.join(' · ');
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

  async function copyToClipboard(text) {
    if (await copyToText(text)) {
      showNotification('Copied to clipboard!');
    } else {
      showNotification('Copy failed');
    }
  }

  function showNotification(message) {
    showToast(message, { className: 'app-toast top', duration: 2000, fade: true });
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
            <strong>${escapeHtml(formatTorEndpoint(addr, { start: 20, end: 18, ellipsis: '...', keepPort: true }))}</strong>
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
              <em>${escapeHtml(formatTorEndpoint(addr, { start: 10, end: 8, ellipsis: '...', keepPort: true }))}</em>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function formatUnixTs(ts) {
    if (!ts) return 'Unknown';
    return new Date(ts * 1000).toLocaleString();
  }

  function hexRow(label, value) {
    if (!value) return '';
    // ECDSA signatures serialize as { signature: hex, sighash_type: ... }
    if (value && typeof value === 'object' && value.signature) value = value.signature;
    if (typeof value !== 'string') value = JSON.stringify(value);
    const display = truncateMiddle(value, { start: 12, end: 8 });
    return `
      <div class="dp-row">
        <span class="dp-label">${label}</span>
        <span class="dp-val" title="${escapeHtml(value)}">${escapeHtml(display)}</span>
        <button class="dp-copy" data-copy="${escapeHtml(value)}" title="Copy">${icons.clipboardCopy(13)}</button>
      </div>
    `;
  }

  function outpointRow(label, outpoint, accent) {
    if (!outpoint) return '';
    const parts = typeof outpoint === 'string' ? outpoint.split(':') : [];
    const txid = parts.length >= 2 ? parts.slice(0, -1).join(':') : String(outpoint);
    const vout = parts.length >= 2 ? parts[parts.length - 1] : '';
    const display = truncateMiddle(txid, { start: 12, end: 8 }) + (vout !== '' ? `:${vout}` : '');
    return `
      <div class="dp-row">
        <span class="dp-label">${label}</span>
        <span class="dp-val" title="${escapeHtml(txid)}">${escapeHtml(display)}</span>
        <button class="dp-copy" data-copy="${escapeHtml(txid)}" title="Copy txid">${icons.clipboardCopy(13)}</button>
        <button class="dp-ext" data-txid="${escapeHtml(txid)}" title="View on explorer">${icons.externalLink(13)}</button>
      </div>
    `;
  }

  function buildDeniabilityProofHtml() {
    if (!report.deniabilityProofs || report.deniabilityProofs.length === 0) return '';

    const proofBlocks = report.deniabilityProofs.map((dp, i) => {
      const proofData = dp.proof?.Taproot || dp.proof?.Legacy || null;
      const isTaproot = !!dp.proof?.Taproot;
      const contractOutpoint = proofData?.contract_outpoint || null;
      const fundingOutpoint = proofData?.funding_outpoint || null;
      const outgoingOutpoint = dp.outgoing_swapcoin || null;

      return `
        <div class="dp-proof-block">
          <div class="dp-header">
            <span class="dp-badge dp-proto">${escapeHtml(dp.protocol || (isTaproot ? 'Taproot' : 'Legacy'))}</span>
            <span class="dp-badge dp-role">${escapeHtml(dp.role || '')}</span>
            ${dp.direction ? `<span class="dp-badge dp-dir">${escapeHtml(dp.direction)}</span>` : ''}
            <span class="dp-created">Created ${formatUnixTs(dp.created_at)}</span>
          </div>

          <div class="dp-rows">
            ${outpointRow(isTaproot ? 'Contract outpoint' : 'Funding outpoint', contractOutpoint || fundingOutpoint)}
            ${outpointRow('Outgoing swapcoin', outgoingOutpoint)}
            ${hexRow('Internal key', proofData?.internal_key)}
            ${hexRow('My MuSig key', proofData?.pub_mine_musig)}
            ${hexRow('Other MuSig key', proofData?.pub_other_musig)}
            ${hexRow('My hashlock key', proofData?.pub_mine_hashlock)}
            ${!isTaproot ? hexRow('My multisig key', proofData?.pub_mine_multi) : ''}
            ${!isTaproot ? hexRow('Other multisig key', proofData?.pub_other_multi) : ''}
            ${hexRow('Signature (MuSig)', proofData?.sig_musig)}
            ${hexRow('Signature (hashlock)', proofData?.sig_hashlock)}
            ${!isTaproot ? hexRow('Signature (multisig)', proofData?.sig_multi) : ''}
          </div>

          <details class="dp-scripts">
            <summary>Scripts</summary>
            ${hexRow('Hashlock script', proofData?.hashlock_script || proofData?.htlc_redeemscript)}
            ${hexRow('Timelock script', proofData?.timelock_script)}
            ${!isTaproot ? hexRow('Multisig redeemscript', proofData?.multisig_redeemscript) : ''}
          </details>
        </div>
      `;
    }).join('');

    const proofCount = report.deniabilityProofs.length;
    return `
      <div class="swap-report-block" id="deniability-section">
        <div class="swap-report-block-head">
          <span>Deniability Proof</span>
          <strong>${proofCount} proof${proofCount === 1 ? '' : 's'}</strong>
        </div>
        <p class="dp-desc">
          Proves you controlled the keys for this swap's contract outputs.
          If a counterparty presents false transaction records, this proof establishes your actual participation in this openswap.
        </p>
        ${proofBlocks}
        <div class="dp-verify-bar">
          <button id="verify-deniability-btn" class="dp-verify-btn">
            Verify on-chain
          </button>
          <div id="verify-deniability-result" class="dp-verify-result" style="display:none;"></div>
        </div>
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

  const makerCount = report.makersCount || report.makerAddresses.length;
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

          ${buildDeniabilityProofHtml()}

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
      window.open(explorerTxUrl(btn.dataset.txid), '_blank');
    });
  });

  // Deniability proof — copy buttons
  content.querySelectorAll('.dp-copy').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copy));
  });

  // Deniability proof — external link buttons
  content.querySelectorAll('.dp-ext').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.open(explorerTxUrl(btn.dataset.txid), '_blank');
    });
  });

  // Deniability proof — verify on-chain
  const verifyBtn = content.querySelector('#verify-deniability-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const resultEl = content.querySelector('#verify-deniability-result');
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying…';
      resultEl.style.display = 'none';
      try {
        const swapId = report.nativeSwapId || report.swapId;
        const res = await window.api.taker.verifyDeniability(swapId);
        resultEl.style.display = '';
        if (res.success && res.isDeniable) {
          resultEl.className = 'dp-verify-result dp-ok';
          resultEl.textContent = 'Proof valid — your key ownership over this swap\'s contract output is confirmed on-chain.';
        } else if (res.success && !res.isDeniable) {
          resultEl.className = 'dp-verify-result dp-fail';
          resultEl.textContent = 'Proof did not verify — key ownership could not be confirmed against on-chain data.';
        } else {
          resultEl.className = 'dp-verify-result dp-fail';
          resultEl.textContent = `Verification error: ${res.error}`;
        }
      } catch (err) {
        resultEl.style.display = '';
        resultEl.className = 'dp-verify-result dp-fail';
        resultEl.textContent = `Verification error: ${err.message}`;
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify on-chain';
      }
    });
  }

  content.querySelector('#export-report').addEventListener('click', () => {
    const reportJson = JSON.stringify(report, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openswap-report-${report.swapId}.json`;
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
