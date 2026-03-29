import {
  SwapStateManager,
  formatRelativeTime,
  formatElapsedTime,
} from './SwapStateManager.js';
import { icons } from '../../js/icons.js';

let swapHistory = [];

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
    return 'bg-purple-500/20 text-purple-400';
  }
  if (protocolLabel === 'Unified') {
    return 'bg-emerald-500/20 text-emerald-400';
  }
  return 'bg-blue-500/20 text-blue-400';
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
      nested.startedAt ||
      nested.started_at,
    null
  );
  const completedAt = normalizeTimestamp(
    report.completedAt ||
      report.completed_at ||
      report.failedAt ||
      report.failed_at ||
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

  return {
    id: report.swapId || nested.swapId || `swap_${Date.now()}`,
    completedAt,
    amount:
      toNumber(
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
    status: report.status || 'completed',
    protocol:
      report.protocol ||
      nested.protocol ||
      (report.isTaproot ? 'Taproot' : nested.isTaproot ? 'Taproot' : 'v1'),
    report: nested,
  };
}

export async function loadSwapHistory() {
  try {
    const result = await window.api.swapReports.getAll();
    if (result.success && result.reports) {
      swapHistory = result.reports
        .filter((report) => report.status === 'completed') // ✅ Only show completed
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

export function summarizeSwapHistory(history) {
  const totalSwaps = history.length;
  const totalAmount = history.reduce(
    (sum, s) => sum + (Number(s.amount) || 0),
    0
  );
  const totalFees = history.reduce(
    (sum, s) => sum + (Number(s.totalFee) || 0),
    0
  );
  const avgFeePaid = totalSwaps > 0 ? Math.round(totalFees / totalSwaps) : 0;
  return { totalSwaps, totalAmount, totalFees, avgFeePaid };
}

function satsToBtc(sats) {
  const normalized = Number(sats);
  if (!Number.isFinite(normalized)) return '0.00000000';
  return (normalized / 100000000).toFixed(8);
}

export function buildSwapHistoryMarkup(history) {
  if (history.length === 0) {
    return `
      <div class="text-center py-16">
        <div class="text-gray-500 mb-4 flex justify-center">${icons.refreshCw(64)}</div>
        <h3 class="text-xl text-gray-300 mb-2">No Swap History</h3>
        <p class="text-gray-500 mb-6">You haven't completed any coinswaps yet.</p>
      </div>
    `;
  }

  return `
    <div class="space-y-4">
      ${history
        .map((swap) => {
          const amount = Number(swap.amount) || 0;
          const totalOutputAmount = Number(swap.totalOutputAmount) || 0;
          const feePercentage = Number(swap.feePercentage) || 0;
          const totalFee = Number(swap.totalFee) || 0;
          const protocolLabel = getProtocolLabel(swap);
          const protocolClasses = getProtocolBadgeClasses(protocolLabel);
          const btcAmount = satsToBtc(amount);
          const outputBtc = satsToBtc(totalOutputAmount);
          const timeAgo = Number.isFinite(swap.completedAt)
            ? formatRelativeTime(swap.completedAt)
            : 'Unknown time';
          const dateStr = formatDate(swap.completedAt);
          const duration = formatDuration(swap.durationSeconds);

          return `
          <div class="swap-history-row bg-[#1a2332] hover:bg-[#242d3d] rounded-lg p-5 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg border border-transparent hover:border-[#FF6B35]/30" data-swap-id="${swap.id}">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-green-400">${icons.check(24)}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-1">
                  <span class="text-white font-semibold text-lg">Coinswap</span>
                  <span class="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Completed</span>
                  <span class="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">${swap.hops} hops</span>
                  <span class="px-2 py-0.5 ${protocolClasses} text-xs rounded-full">${protocolLabel}</span>
                </div>
                <div class="flex items-center gap-4 text-sm">
                  <span class="text-gray-500">${timeAgo}</span>
                  <span class="text-gray-600">•</span>
                  <span class="text-gray-500">${dateStr}</span>
                  <span class="text-gray-600">•</span>
                  <span class="text-gray-500">${duration}</span>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-lg font-mono text-green-400">${btcAmount} BTC</div>
                <div class="text-xs text-gray-500">${amount.toLocaleString()} sats</div>
              </div>
              <div class="text-gray-600 flex-shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-800 grid grid-cols-4 gap-4 text-sm">
              <div>
                <span class="text-gray-500">Makers</span>
                <p class="text-white font-mono">${swap.makersCount}</p>
              </div>
              <div>
                <span class="text-gray-500">Fee</span>
                <p class="text-yellow-400 font-mono">${feePercentage.toFixed(2)}%</p>
              </div>
              <div>
                <span class="text-gray-500">Total Fee</span>
                <p class="text-yellow-400 font-mono">${totalFee.toLocaleString()} sats</p>
              </div>
              <div>
                <span class="text-gray-500">Output</span>
                <p class="text-green-400 font-mono">${outputBtc} BTC</p>
              </div>
            </div>
          </div>
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
  await loadSwapHistory();

  const content = document.createElement('div');
  content.id = 'swap-history-content';

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

  async function viewSwapReport(swapId) {
    try {
      const result = await window.api.swapReports.get(swapId);
      console.log('📋 Raw result from API:', result); // ← ADD THIS
      console.log('📋 Report from result:', result.report.report); // ← ADD THIS

      if (result.success && result.report) {
        import('./SwapReport.js').then((module) => {
          container.innerHTML = '';
          const fullReport = {
            ...result.report.report,
            protocol: result.report.protocol ?? 'v1',
            isTaproot: result.report.isTaproot ?? false,
            protocolVersion: result.report.protocolVersion ?? 1,
          };
          module.SwapReportComponent(container, fullReport);
        });
      } else {
        console.error('Swap report not found for ID:', swapId);
        alert('Swap report not found');
      }
    } catch (error) {
      console.error('Failed to load swap report:', error);
      alert('Failed to load swap report: ' + error.message);
    }
  }

  function buildSwapHistoryList() {
    if (swapHistory.length === 0) {
      return `
        <div class="text-center py-16">
          <div class="text-gray-500 mb-4 flex justify-center">${icons.refreshCw(64)}</div>
          <h3 class="text-xl text-gray-300 mb-2">No Swap History</h3>
          <p class="text-gray-500 mb-6">You haven't completed any coinswaps yet.</p>
          <button id="start-first-swap" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg px-6 py-3 rounded-lg transition-colors">
            Start Your First Swap →
          </button>
        </div>
      `;
    }

    return `
      <div class="space-y-4">
        ${swapHistory
          .map((swap, index) => {
            const btcAmount = satsToBtc(swap.amount);
            const outputBtc = satsToBtc(swap.totalOutputAmount);
            const timeAgo = Number.isFinite(swap.completedAt)
              ? formatRelativeTime(swap.completedAt)
              : 'Unknown time';
            const dateStr = formatDate(swap.completedAt);
            const duration = formatDuration(swap.durationSeconds);

            return `
            <div class="swap-history-row bg-[#1a2332] hover:bg-[#242d3d] rounded-lg p-5 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg border border-transparent hover:border-[#FF6B35]/30" data-swap-id="${swap.id}">
              <div class="flex items-center gap-4">
                <!-- Status Icon -->
                <div class="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span class="text-green-400">${icons.check(24)}</span>
                </div>
                
                <!-- Main Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-1">
                    <span class="text-white font-semibold text-lg">Coinswap</span>
                    <span class="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Completed</span>
                    <span class="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">${swap.hops} hops</span>
                  </div>
                  <div class="flex items-center gap-4 text-sm">
                    <span class="text-gray-500">${timeAgo}</span>
                    <span class="text-gray-600">•</span>
                    <span class="text-gray-500">${dateStr}</span>
                    <span class="text-gray-600">•</span>
                    <span class="text-gray-500">${duration}</span>
                  </div>
                </div>
                
                <!-- Amount -->
                <div class="text-right flex-shrink-0">
                  <div class="text-lg font-mono text-green-400">${btcAmount} BTC</div>
                  <div class="text-xs text-gray-500">${swap.amount.toLocaleString()} sats</div>
                </div>
                
                <!-- Arrow -->
                <div class="text-gray-600 flex-shrink-0">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
              
              <!-- Details Row -->
              <div class="mt-4 pt-4 border-t border-gray-800 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-gray-500">Makers</span>
                  <p class="text-white font-mono">${swap.makersCount}</p>
                </div>
                <div>
                  <span class="text-gray-500">Fee</span>
                  <p class="text-yellow-400 font-mono">${swap.feePercentage?.toFixed(2) || '0.00'}%</p>
                </div>
                <div>
                  <span class="text-gray-500">Total Fee</span>
                  <p class="text-yellow-400 font-mono">${(swap.totalFee || 0).toLocaleString()} sats</p>
                </div>
                <div>
                  <span class="text-gray-500">Output</span>
                  <p class="text-green-400 font-mono">${outputBtc} BTC</p>
                </div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  }

  // Calculate stats
  const totalSwaps = swapHistory.length;
  const totalVolume = swapHistory.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalFees = swapHistory.reduce((sum, s) => sum + (s.totalFee || 0), 0);
  const avgHops =
    totalSwaps > 0
      ? (
          swapHistory.reduce((sum, s) => sum + (s.hops || 0), 0) / totalSwaps
        ).toFixed(1)
      : 0;

  content.innerHTML = `
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <button id="back-to-swap" class="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Swap
        </button>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Swap History</h2>
            <p class="text-gray-400">View all your completed coinswap transactions</p>
          </div>
          ${
            totalSwaps > 0
              ? `
            <button id="clear-history" class="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors">
              Clear History
            </button>
          `
              : ''
          }
        </div>
      </div>

      <!-- Stats Cards -->
      ${
        totalSwaps > 0
          ? `
        <div class="grid grid-cols-4 gap-4 mb-8">
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Total Swaps</p>
            <p class="text-2xl font-bold text-[#FF6B35]">${totalSwaps}</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Total Volume</p>
            <p class="text-2xl font-bold text-green-400">${satsToBtc(totalVolume)} BTC</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Total Fees Paid</p>
            <p class="text-2xl font-bold text-yellow-400">${totalFees.toLocaleString()} sats</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Avg. Hops</p>
            <p class="text-2xl font-bold text-cyan-400">${avgHops}</p>
          </div>
        </div>
      `
          : ''
      }

      <!-- Swap List -->
      <div id="swap-list-container">
        ${buildSwapHistoryList()}
      </div>
    </div>
  `;

  container.appendChild(content);

  // Event Listeners
  content.querySelector('#back-to-swap')?.addEventListener('click', () => {
    import('./Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  content.querySelector('#start-first-swap')?.addEventListener('click', () => {
    import('./Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  content.querySelector('#clear-history')?.addEventListener('click', async () => {
    if (
      confirm(
        'Are you sure you want to clear all swap history? This cannot be undone.'
      )
    ) {
      await SwapStateManager.clearSwapHistory();
      // Re-render the component
      container.innerHTML = '';
      SwapHistoryComponent(container);
    }
  });

  // Click handlers for swap rows
  content.querySelectorAll('.swap-history-row').forEach((row) => {
    row.addEventListener('click', () => {
      const swapId = row.dataset.swapId;
      viewSwapReport(swapId);
    });
  });
}
