import { formatRelativeTime } from './SwapStateManager.js';

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
  const protocol = report.protocol || report.report?.protocol || 'v1';
  return protocol === 'v2' ? 'Taproot' : 'Legacy P2WSH';
}

function getProtocolBadgeClasses(protocolLabel) {
  return protocolLabel === 'Taproot'
    ? 'bg-purple-500/20 text-purple-400'
    : 'bg-blue-500/20 text-blue-400';
}

function normalizeSwapReport(report) {
  const nested = report.report || {};
  const startedAt = report.startedAt || nested.startedAt || Date.now();
  const completedAt =
    report.completedAt || report.failedAt || nested.completedAt || Date.now();
  const totalFee =
    nested.totalFee ||
    nested.total_fee ||
    report.totalFee ||
    report.total_fee ||
    0;
  const makersCount =
    nested.makersCount || nested.makers_count || report.makerCount || 0;

  return {
    id: report.swapId || nested.swapId || `swap_${Date.now()}`,
    completedAt,
    amount: report.amount || nested.amount || nested.targetAmount || 0,
    totalOutputAmount:
      nested.totalOutputAmount || nested.total_output_amount || 0,
    makersCount,
    hops: makersCount + 1,
    totalFee,
    feePercentage:
      nested.feePercentage || nested.fee_percentage || report.feePercentage || 0,
    durationSeconds: Math.max(
      0,
      Math.floor((completedAt - startedAt) / 1000) || 0
    ),
    status: report.status || 'completed',
    protocol: report.protocol || nested.protocol || 'v1',
    report: nested,
  };
}

export async function loadSwapHistory() {
  try {
    const result = await window.api.swapReports.getAll();
    if (!result.success) {
      throw new Error(result.error || 'Failed to load swap history');
    }
    return (result.reports || []).map(normalizeSwapReport);
  } catch (error) {
    console.error('Failed to load swap history:', error);
    throw error;
  }
}

export function summarizeSwapHistory(swapHistory) {
  const totalSwaps = swapHistory.length;
  const totalAmount = swapHistory.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalFees = swapHistory.reduce((sum, s) => sum + (s.totalFee || 0), 0);
  const avgFeePaid =
    totalSwaps > 0 ? Math.round(totalFees / totalSwaps) : 0;

  return {
    totalSwaps,
    totalAmount,
    totalFees,
    avgFeePaid,
  };
}

export function buildSwapHistoryMarkup(swapHistory) {
  if (swapHistory.length === 0) {
    return `
      <div class="text-center py-16">
        <div class="text-6xl mb-4">🔄</div>
        <h3 class="text-xl text-gray-300 mb-2">No Swap History</h3>
        <p class="text-gray-500">Your completed and failed swaps will appear here.</p>
      </div>
    `;
  }

  return `
    <div class="overflow-hidden rounded-lg border border-gray-800">
      <div class="grid grid-cols-[1.7fr_0.9fr_1fr_1fr_1fr_1.25fr] gap-4 bg-[#0f1419] p-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        <div>Swap</div>
        <div>Status</div>
        <div>Protocol</div>
        <div>Amount</div>
        <div>Fee Paid</div>
        <div>When</div>
      </div>
      <div class="divide-y divide-gray-800">
        ${swapHistory
          .map((swap) => {
            const protocolLabel = getProtocolLabel(swap);
            const isFailed = swap.status === 'failed';

            return `
              <div class="swap-history-row grid grid-cols-[1.7fr_0.9fr_1fr_1fr_1fr_1.25fr] gap-4 p-4 bg-[#1a2332] hover:bg-[#242d3d] cursor-pointer transition-colors items-start" data-swap-id="${swap.id}">
                <div>
                  <p class="text-white font-semibold">Coinswap</p>
                  <p class="text-xs text-gray-500">${swap.hops} hops • ${swap.makersCount} makers</p>
                </div>
                <div>
                  <span class="px-2 py-0.5 rounded-full text-xs ${isFailed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}">
                    ${isFailed ? 'Failed' : 'Completed'}
                  </span>
                </div>
                <div>
                  <span class="px-2 py-0.5 rounded-full text-xs ${getProtocolBadgeClasses(protocolLabel)}">
                    ${protocolLabel}
                  </span>
                </div>
                <div>
                  <p class="font-mono text-green-400 break-all">${satsToBtc(swap.amount)} BTC</p>
                  <p class="text-xs text-gray-500">${swap.amount.toLocaleString()} sats</p>
                </div>
                <div>
                  <p class="font-mono text-yellow-400 break-all">${(swap.totalFee || 0).toLocaleString()} sats</p>
                  <p class="text-xs text-gray-500">${(swap.feePercentage || 0).toFixed(2)}%</p>
                </div>
                <div>
                  <p class="text-gray-300">${formatRelativeTime(swap.completedAt)}</p>
                  <p class="text-xs text-gray-500">${formatDate(swap.completedAt)} • ${formatDuration(swap.durationSeconds)}</p>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

export async function SwapHistoryComponent(container) {
  if (container.querySelector('#swap-history-content')) return;

  let swapHistory = [];
  let stats = summarizeSwapHistory([]);
  let loadError = null;

  try {
    swapHistory = await loadSwapHistory();
    stats = summarizeSwapHistory(swapHistory);
  } catch (error) {
    loadError = error;
  }

  const content = document.createElement('div');
  content.id = 'swap-history-content';
  content.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        <button id="back-to-swap" class="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Swap
        </button>
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Swap History</h2>
        <p class="text-gray-400">View all your completed and failed coinswaps</p>
      </div>

      ${
        loadError
          ? `
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-8">
          <p class="text-red-400 font-semibold mb-2">Unable to load swap history</p>
          <p class="text-sm text-gray-400">${loadError.message || 'Please try again.'}</p>
        </div>
      `
          : ''
      }

      ${
        stats.totalSwaps > 0
          ? `
        <div class="grid grid-cols-4 gap-4 mb-8">
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Total Swaps</p>
            <p class="text-xl xl:text-2xl font-bold text-[#FF6B35] break-all">${stats.totalSwaps}</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Total Amount</p>
            <p class="text-xl xl:text-2xl font-bold text-green-400 break-all">${satsToBtc(stats.totalAmount)} BTC</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Total Fees Paid</p>
            <p class="text-xl xl:text-2xl font-bold text-yellow-400 break-all">${stats.totalFees.toLocaleString()} sats</p>
          </div>
          <div class="bg-[#1a2332] rounded-lg p-4">
            <p class="text-sm text-gray-400 mb-1">Avg Fee Paid</p>
            <p class="text-xl xl:text-2xl font-bold text-cyan-400 break-all">${stats.avgFeePaid.toLocaleString()} sats</p>
          </div>
        </div>
      `
          : ''
      }

      <div id="swap-list-container">
        ${loadError ? '' : buildSwapHistoryMarkup(swapHistory)}
      </div>
    </div>
  `;

  container.appendChild(content);

  content.querySelector('#back-to-swap')?.addEventListener('click', () => {
    import('./Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  content.querySelectorAll('.swap-history-row').forEach((row) => {
    row.addEventListener('click', async () => {
      try {
        const swapId = row.dataset.swapId;
        const result = await window.api.swapReports.get(swapId);

        if (!result.success || !result.report) {
          throw new Error(`Swap report not found for ${swapId}`);
        }

        const module = await import('./SwapReport.js');

        container.innerHTML = '';
        const fullReport = {
          ...result.report,
          ...result.report.report,
          protocol: result.report.protocol ?? 'v1',
          isTaproot: result.report.isTaproot ?? false,
          protocolVersion: result.report.protocolVersion ?? 1,
        };
        module.SwapReportComponent(container, fullReport);
      } catch (error) {
        console.error('Failed to load swap report:', error);
        container.innerHTML = `
          <div class="p-6">
            <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
              <p class="text-red-400 font-semibold mb-2">Unable to open swap report</p>
              <p class="text-sm text-gray-400">${error.message || 'Please try again.'}</p>
            </div>
          </div>
        `;
      }
    });
  });
}
