import { formatRelativeTime } from './SwapStateManager.js';
import { icons } from '../../js/icons.js';
import { formatSats, SATS_SYMBOL } from '../../js/price.js';

let swapHistory = [];
let currentSort = 'newest';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeTimestamp(value, fallback = null) {
  if (value == null || value === '') return fallback;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0m 0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return 'Unknown date';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProtocolLabel(report) {
  const protocol = report.protocol || report.report?.protocol;
  switch (protocol) {
    case 'v2':
    case 'Taproot':
      return 'Taproot';
    case 'Unified':
      return 'Unified';
    case 'v1':
    case 'Legacy':
    default:
      return 'Legacy';
  }
}

function getProtocolBadgeClasses(protocolLabel) {
  if (protocolLabel === 'Taproot') {
    return 'is-taproot';
  }
  if (protocolLabel === 'Unified') {
    return 'is-unified';
  }
  return 'is-legacy';
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'success' || status === 'completed') return 'completed';
  if (status.startsWith('recovery')) return 'completed';
  if (status === 'failed' || status === 'failure' || status === 'error') {
    return 'failed';
  }
  return status || 'unknown';
}

function getStatusLabel(status) {
  switch (normalizeStatus(status)) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

function normalizeSwapReport(report) {
  const nested = report.report || {};
  const toNumber = (value, fallback = 0) => {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
  };
  const startedAt = normalizeTimestamp(
    report.startedAt ||
      report.started_at ||
      report.startTimestamp ||
      report.start_timestamp ||
      nested.startedAt ||
      nested.started_at,
    null
  );
  const completedAt = normalizeTimestamp(
    report.completedAt ||
      report.completed_at ||
      report.failedAt ||
      report.failed_at ||
      report.endTimestamp ||
      report.end_timestamp ||
      nested.completedAt ||
      nested.completed_at ||
      nested.endTimestamp ||
      nested.end_timestamp ||
      report.fileModifiedAt,
    null
  );
  const totalMakerFees = toNumber(
    nested.totalMakerFees ??
      nested.total_maker_fees ??
      report.totalMakerFees ??
      report.total_maker_fees,
    0
  );
  const miningFee = toNumber(
    nested.miningFee ??
      nested.mining_fee ??
      report.miningFee ??
      report.mining_fee,
    0
  );
  const feePaidOrEarned = toNumber(
    nested.fee_paid_or_earned ??
      nested.feePaidOrEarned ??
      report.fee_paid_or_earned ??
      report.feePaidOrEarned,
    NaN
  );
  const providedTotalFee = toNumber(
    nested.totalFee ??
      nested.total_fee ??
      report.totalFee ??
      report.total_fee,
    NaN
  );
  const derivedTotalFee = Number.isFinite(feePaidOrEarned)
    ? Math.abs(feePaidOrEarned)
    : totalMakerFees + miningFee;
  const totalFee =
    Number.isFinite(providedTotalFee) &&
    (providedTotalFee > 0 || derivedTotalFee <= 0)
      ? providedTotalFee
      : derivedTotalFee;
  const makersCount =
    nested.makersCount || nested.makers_count || report.makerCount || 0;
  const status = normalizeStatus(report.status || nested.status);
  const errorMessage =
    report.errorMessage ||
    report.error_message ||
    nested.errorMessage ||
    nested.error_message ||
    report.error ||
    nested.error ||
    null;

  return {
    id: report.swapId || nested.swapId || `swap_${Date.now()}`,
    completedAt,
    amount:
      toNumber(
        nested.outgoingAmount ??
          nested.outgoing_amount ??
          report.totalOutputAmount ??
          report.total_output_amount ??
          report.amount ??
          nested.amount ??
          nested.targetAmount ??
          nested.target_amount ??
          nested.incomingAmount ??
          nested.incoming_amount,
        0
      ),
    totalOutputAmount: toNumber(
      nested.totalOutputAmount ??
        nested.total_output_amount ??
        nested.outgoingAmount ??
        nested.outgoing_amount ??
        report.totalOutputAmount ??
        report.total_output_amount,
      0
    ),
    makersCount,
    hops: makersCount + 1,
    totalFee,
    feePercentage:
      nested.feePercentage || nested.fee_percentage || report.feePercentage || 0,
    durationSeconds: Math.max(
      0,
      Number.isFinite(completedAt) && Number.isFinite(startedAt)
        ? Math.floor((completedAt - startedAt) / 1000)
        : toNumber(
            nested.swapDurationSeconds ??
              nested.swap_duration_seconds ??
              report.swapDurationSeconds ??
              report.swap_duration_seconds,
            0
          )
    ),
    status,
    errorMessage,
    protocol:
      report.protocol ||
      nested.protocol ||
      (report.isTaproot ? 'Taproot' : nested.isTaproot ? 'Taproot' : 'v1'),
    report: nested,
  };
}

function getSortedSwapHistory(history, sort = currentSort) {
  const sorted = [...history];
  sorted.sort((a, b) => {
    if (sort === 'oldest') return (a.completedAt || 0) - (b.completedAt || 0);
    if (sort === 'amount-high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    if (sort === 'amount-low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
    return (b.completedAt || 0) - (a.completedAt || 0);
  });
  return sorted;
}

export async function loadSwapHistory() {
  try {
    const result = await window.api.swapReports.getAll();
    if (result.success && result.reports) {
      swapHistory = result.reports
        .map((report) => {
          const normalized = normalizeSwapReport(report);
          return {
            id: normalized.id,
            completedAt: normalized.completedAt,
            amount: normalized.amount,
            totalOutputAmount: normalized.totalOutputAmount,
            makersCount: normalized.makersCount,
            hops: normalized.hops,
            totalFee: normalized.totalFee,
            feePercentage: normalized.feePercentage,
            durationSeconds: normalized.durationSeconds,
            status: normalized.status,
            errorMessage: normalized.errorMessage,
            protocol: normalized.protocol,
            report: normalized.report,
          };
        })
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    } else {
      swapHistory = [];
      throw new Error(result.error || 'Failed to load swap history');
    }
  } catch (error) {
    swapHistory = [];
    console.error('Failed to load swap history:', error);
    throw error;
  }
  return swapHistory;
}

export async function openSwapReport(container, swapId, options = {}) {
  try {
    const result = await window.api.swapReports.get(swapId);

    if (result.success && result.report) {
      const module = await import('./SwapReport.js');
      container.innerHTML = '';
      const fullReport = {
        ...result.report,
        ...result.report.report,
        protocol: result.report.protocol ?? 'v1',
        isTaproot: result.report.isTaproot ?? false,
        protocolVersion: result.report.protocolVersion ?? 1,
      };
      module.SwapReportComponent(container, fullReport, {
        backTarget: options.backTarget || 'swapReports',
        trackerInfo: result.trackerInfo || null,
      });
      return true;
    }

    throw new Error(result.error || 'Swap report not found');
  } catch (error) {
    console.error('Failed to load swap report:', error);
    alert('Failed to load swap report: ' + error.message);
    return false;
  }
}

export function summarizeSwapHistory(history) {
  const totalSwaps = history.length;
  const completedSwaps = history.filter(
    (s) => normalizeStatus(s.status) === 'completed'
  );
  const failedSwaps = history.filter(
    (s) => normalizeStatus(s.status) === 'failed'
  );
  const totalAmount = completedSwaps.reduce(
    (sum, s) => sum + (Number(s.amount) || 0),
    0
  );
  const totalFees = completedSwaps.reduce(
    (sum, s) => sum + (Number(s.totalFee) || 0),
    0
  );
  const avgFeePaid =
    completedSwaps.length > 0 ? Math.round(totalFees / completedSwaps.length) : 0;
  return {
    totalSwaps,
    completedSwaps: completedSwaps.length,
    failedSwaps: failedSwaps.length,
    totalAmount,
    totalFees,
    avgFeePaid,
  };
}

export function buildSwapHistoryMarkup(history) {
  if (history.length === 0) {
    return `
      <div class="swap-reports-empty">
        <div>${icons.fileText(42)}</div>
        <h3>No swap reports</h3>
        <p>Completed and failed swap reports will appear here.</p>
      </div>
    `;
  }

  return `
    <div class="swap-reports-list">
      ${history
        .map((swap) => {
          const amount = Number(swap.amount) || 0;
          const totalOutputAmount = Number(swap.totalOutputAmount) || 0;
          const feePercentage = Number(swap.feePercentage) || 0;
          const totalFee = Number(swap.totalFee) || 0;
          const protocolLabel = getProtocolLabel(swap);
          const protocolClasses = getProtocolBadgeClasses(protocolLabel);
          const status = normalizeStatus(swap.status);
          const statusLabel = getStatusLabel(status);
          const statusClasses =
            status === 'failed'
              ? 'swap-report-status failed'
              : 'swap-report-status completed';
          const displayedOutputAmount =
            status === 'failed' ? 0 : totalOutputAmount;
          const timeAgo = Number.isFinite(swap.completedAt)
            ? formatRelativeTime(swap.completedAt)
            : 'Unknown time';
          const dateStr = formatDate(swap.completedAt);
          const duration = formatDuration(swap.durationSeconds);
          const errorMessage = swap.errorMessage
            ? `<p class="swap-report-row-error">${escapeHtml(swap.errorMessage)}</p>`
            : '';

          return `
          <button class="swap-report-list-row ${status === 'failed' ? 'is-failed' : ''}" data-swap-id="${escapeHtml(swap.id)}" type="button">
            <div class="swap-report-row-main">
              <span class="swap-report-row-icon">${status === 'failed' ? icons.xCircle(20) : icons.fileText(20)}</span>
              <div>
                <strong>Swap ${escapeHtml(String(swap.id).slice(0, 10))}</strong>
                <p>${timeAgo} · ${dateStr} · ${duration}</p>
                ${errorMessage}
              </div>
            </div>
            <div class="swap-report-row-badges">
              <span class="${statusClasses}">${statusLabel}</span>
              <span>${swap.hops} hops</span>
              <span class="${protocolClasses}">${protocolLabel}</span>
            </div>
            <div class="swap-report-row-details">
              <div>
                <span>Amount</span>
                <strong>${formatSats(amount)}</strong>
              </div>
              <div>
                <span>Makers</span>
                <strong>${swap.makersCount}</strong>
              </div>
              <div>
                <span>Total fee</span>
                <strong>${totalFee.toLocaleString()} ${SATS_SYMBOL}</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>${formatSats(displayedOutputAmount)}</strong>
              </div>
            </div>
            <em>${icons.externalLink(16)}</em>
          </button>
        `;
        })
        .join('')}
    </div>
  `;
}

export async function SwapHistoryComponent(container) {
  if (container.querySelector('#swap-history-content')) {
    console.log('⚠️ SwapHistory component already rendered, skipping');
    return;
  }

  console.log('📜 SwapHistoryComponent loading...');
  let loadError = null;
  try {
    await loadSwapHistory();
  } catch (error) {
    loadError = error;
  }

  const content = document.createElement('div');
  content.id = 'swap-history-content';

  const viewSwapReport = (swapId) =>
    openSwapReport(container, swapId, {
      backTarget: 'swapReports',
      messageTarget: content,
    });

  // Calculate stats
  const totalSwaps = swapHistory.length;
  const completedSwaps = swapHistory.filter(
    (s) => normalizeStatus(s.status) === 'completed'
  );
  const failedSwaps = swapHistory.filter(
    (s) => normalizeStatus(s.status) === 'failed'
  );
  const totalVolume = completedSwaps.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalFees = completedSwaps.reduce((sum, s) => sum + (s.totalFee || 0), 0);
  const avgHops =
    completedSwaps.length > 0
      ? (
          completedSwaps.reduce((sum, s) => sum + (s.hops || 0), 0) /
          completedSwaps.length
        ).toFixed(1)
      : 0;

  content.innerHTML = `
    <div class="swap-reports-page">
      <header class="swap-reports-head">
        <div>
          <h2>Swap Reports</h2>
          <p>Review completed and failed coinswap reports, makers, and fee details.</p>
        </div>
        <button id="back-to-swap" class="swap-reports-back" type="button">
          ${icons.arrowLeft(17)} Back
        </button>
      </header>

      ${
        totalSwaps > 0
          ? `
        <section class="swap-reports-stats">
          <div>
            <span>Total reports</span>
            <strong>${totalSwaps}</strong>
          </div>
          <div>
            <span>Failed</span>
            <strong>${failedSwaps.length}</strong>
          </div>
          <div>
            <span>Total volume</span>
            <strong>${formatSats(totalVolume)}</strong>
          </div>
          <div>
            <span>Total fees</span>
            <strong>${totalFees.toLocaleString()} ${SATS_SYMBOL}</strong>
          </div>
          <div>
            <span>Avg hops</span>
            <strong>${avgHops}</strong>
          </div>
        </section>
      `
          : ''
      }

      <section class="swap-reports-panel">
        ${
          loadError
            ? `
              <div class="swap-reports-empty error">
                <div>${icons.alertTriangle(42)}</div>
                <h3>Unable to load reports</h3>
                <p>${escapeHtml(loadError.message || 'Please try again.')}</p>
              </div>
            `
            : `
              <div class="swap-reports-toolbar">
                <label>
                  <span>Sort</span>
                  <select id="swap-history-sort">
                    <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>Newest first</option>
                    <option value="oldest" ${currentSort === 'oldest' ? 'selected' : ''}>Oldest first</option>
                    <option value="amount-high" ${currentSort === 'amount-high' ? 'selected' : ''}>Amount high to low</option>
                    <option value="amount-low" ${currentSort === 'amount-low' ? 'selected' : ''}>Amount low to high</option>
                  </select>
                </label>
              </div>
              <div id="swap-reports-list-container">
                ${buildSwapHistoryMarkup(getSortedSwapHistory(swapHistory))}
              </div>
            `
        }
      </section>
    </div>
  `;

  container.appendChild(content);

  // Event Listeners
  content.querySelector('#back-to-swap')?.addEventListener('click', () => {
    if (window.appManager) {
      window.appManager.renderComponent('swap');
    }
  });

  content.querySelector('#swap-history-sort')?.addEventListener('change', (event) => {
    currentSort = event.target.value;
    const listContainer = content.querySelector('#swap-reports-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = buildSwapHistoryMarkup(
      getSortedSwapHistory(swapHistory, currentSort)
    );
    bindSwapReportRows();
  });

  // Click handlers for swap rows
  function bindSwapReportRows() {
    content.querySelectorAll('.swap-report-list-row').forEach((row) => {
      row.addEventListener('click', () => {
        const swapId = row.dataset.swapId;
        viewSwapReport(swapId);
      });
    });
  }

  bindSwapReportRows();
}
