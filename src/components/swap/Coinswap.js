import { SwapStateManager, formatElapsedTime } from './SwapStateManager.js';

export async function CoinswapComponent(container, swapConfig) {
  const content = document.createElement('div');
  content.id = 'coinswap-content';

  const existingSwap = await SwapStateManager.getActiveSwap();
  const savedProgress = await SwapStateManager.getSwapProgress();

  let actualSwapConfig;
  let shouldStartNew = true;

  let pollInterval = null;
  let logPollInterval = null;
  let lastLogLine = '';
  let processedLogs = new Set();

  if (existingSwap && existingSwap.status === 'in_progress' && savedProgress) {
    actualSwapConfig = existingSwap;
    shouldStartNew = false;
  } else {
    actualSwapConfig = swapConfig;
  }

  let currentStep = savedProgress ? savedProgress.currentStep || 0 : 0;
  let startTime = savedProgress ? savedProgress.startTime : (actualSwapConfig.startTime || Date.now());
  let logMessages = savedProgress ? savedProgress.logMessages || [] : [];
  let currentHop = 0;

  const swapData = {
    amount: actualSwapConfig.amount,
    makers: actualSwapConfig.makers,
    hops: actualSwapConfig.hops,
    transactions: savedProgress?.transactions || [],
  };

  if (swapData.transactions.length === 0) {
    for (let i = 0; i < swapData.hops; i++) {
      swapData.transactions.push({
        id: `tx${i}`,
        txid: '',
        status: 'pending',
        confirmations: 0,
        timestamp: null,
        fee: 0,
        maker: null,
        size: 0,
      });
    }
  }

  const makerColors = ['#FF6B35', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];

  function addLog(message, type = 'info') {
    // Avoid duplicate logs
    const logKey = `${type}:${message}`;
    if (processedLogs.has(logKey)) return;
    processedLogs.add(logKey);

    const timestamp = new Date().toLocaleTimeString();
    logMessages.unshift({ timestamp, message, type });
    if (logMessages.length > 100) logMessages.pop();
    updateLogs();
  }

  function saveProgress() {
    SwapStateManager.saveSwapProgress({
      currentStep,
      startTime,
      logMessages,
      transactions: swapData.transactions,
      lastUpdated: Date.now()
    });
  }

  function updateLogs() {
    const logContainer = content.querySelector('#log-container');
    if (!logContainer) return;
    logContainer.innerHTML = logMessages.slice(0, 50).map(log => `
      <div class="text-xs font-mono mb-1">
        <span class="text-gray-500">[${log.timestamp}]</span>
        <span class="${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-gray-300'}">${log.message}</span>
      </div>
    `).join('');
  }

  function updateElapsedTime() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeEl = content.querySelector('#elapsed-time');
    if (timeEl) timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateHopStatus(hopIndex, statusText, color) {
    const hop = content.querySelector(`#hop-${hopIndex}`);
    if (!hop) return;

    const hopStatus = hop.querySelector('.hop-status');
    if (hopStatus) {
      hopStatus.textContent = statusText;
      const colorClass = color === 'green' ? 'text-green-400' :
        color === 'yellow' ? 'text-yellow-400' :
          color === 'orange' ? 'text-orange-400' :
            color === 'blue' ? 'text-blue-400' : 'text-gray-400';
      hopStatus.className = `hop-status text-xs ${colorClass} font-bold`;
      if (color === 'yellow' || color === 'orange') {
        hopStatus.classList.add('animate-pulse');
      }
    }
  }

  function updateMakerVisibility(makerIndex, visible) {
    const maker = content.querySelector(`#maker-${makerIndex}`);
    if (maker) {
      maker.style.opacity = visible ? '1' : '0.3';
      maker.style.filter = visible ? 'blur(0)' : 'blur(4px)';
    }
  }

  function updateYouSend(active) {
    const youSend = content.querySelector('#you-send');
    if (youSend) youSend.style.opacity = active ? '1' : '0.5';
  }

  function updateYouReceive(active) {
    const youReceive = content.querySelector('#you-receive');
    if (youReceive) youReceive.style.opacity = active ? '1' : '0.3';
  }

  function setTransactionTxid(hopIndex, txid) {
    if (swapData.transactions[hopIndex]) {
      swapData.transactions[hopIndex].txid = txid;
      swapData.transactions[hopIndex].status = 'broadcasting';
      updateTxList();
      updateArrowLink(hopIndex, txid);  // Add this
    }
  }

  function setTransactionConfirmed(hopIndex) {
    if (swapData.transactions[hopIndex]) {
      swapData.transactions[hopIndex].status = 'confirmed';
      swapData.transactions[hopIndex].confirmations = 1;
      updateTxList();
    }
  }

  async function fetchSwapLogs() {
    try {
      // IPC call to get logs
      const data = await window.api.logs.get(150);
      if (!data.success || !data.logs) return;

      data.logs.forEach(line => {
        // Parse timestamp from log
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+)/);
        if (!timestampMatch) return;

        const logTime = new Date(timestampMatch[1]).getTime();

        // Only process logs from after swap started
        if (logTime < startTime) return;

        if (line && !processedLogs.has(line)) {
          processedLogs.add(line);
          parseAndHandleLog(line);
        }
      });
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }

  function parseAndHandleLog(line) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+)[^\s]*\s+(\w+)\s+([\w:]+)\s+-\s+(.+)$/);
    if (!match) return;

    const [, timestamp, level, module, message] = match;

    if (!module.startsWith('coinswap::')) return;

    const logKey = `${timestamp}:${message}`;
    if (processedLogs.has(logKey)) return;
    processedLogs.add(logKey);

    const type = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'info';

    // Add raw message to log
    addLog(message, type);

    // Update UI based on message content
    if (message.includes('Initiating coinswap with id')) {
      updateYouSend(true);
      updateHopStatus(0, 'Initializing...', 'yellow');
    }
    else if (message.includes('Broadcasted Funding tx') || message.includes('Waiting for funding transaction confirmation. Txids')) {
      const txMatch = message.match(/(?:txid:|Txids\s*:\s*\[)([a-f0-9]+)/i);
      if (txMatch) {
        const emptySlot = swapData.transactions.findIndex(tx => !tx.txid);
        if (emptySlot !== -1) {
          setTransactionTxid(emptySlot, txMatch[1]);
          updateHopStatus(emptySlot, 'Confirming...', 'orange');
        }
      }
    }
    else if (message.match(/Tx [a-f0-9]+ \| Confirmed at/i)) {
      const txMatch = message.match(/Tx ([a-f0-9]+)/i);
      if (txMatch) {
        const slot = swapData.transactions.findIndex(tx => tx.txid?.startsWith(txMatch[1].substring(0, 8)));
        if (slot !== -1) {
          setTransactionConfirmed(slot);
          updateHopStatus(slot, '✓ Confirmed', 'green');
          if (slot < swapData.hops - 1) {
            updateMakerVisibility(slot + 1, true);
          }

        }
      }
    }
    else if (message.includes('Swaps settled successfully')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, '✓ Complete', 'green');
      }
    }
    else if (message.includes('Successfully swept incoming swap coin')) {
      updateYouReceive(true);
    }
  }

  function startSwap() {
    if (shouldStartNew && currentStep === 0) {
      console.log('🚀 Starting REAL coinswap polling');

      const swapId = actualSwapConfig.swapId;
      if (!swapId) {
        addLog('Error: No swap ID found', 'error');
        return;
      }

      currentStep = 1;
      addLog('Coinswap started...', 'info');
      addLog(`Swap ID: ${swapId}`, 'info');
      addLog(`Amount: ${(swapData.amount / 100000000).toFixed(8)} BTC`, 'info');
      addLog(`Makers: ${swapData.makers}`, 'info');

      SwapStateManager.saveSwapProgress({
        currentStep: 1,
        startTime,
        logMessages,
        transactions: swapData.transactions,
        status: 'in_progress'
      });

      if (window.appManager) window.appManager.startBackgroundSwapManager();
    }

    setInterval(updateElapsedTime, 1000);
    startPollingSwapStatus();
    startPollingLogs();
  }

  function startPollingLogs() {
    // Initial fetch
    fetchSwapLogs();
    // Poll every 1 second for real-time feel
    logPollInterval = setInterval(fetchSwapLogs, 1000);
  }

  async function triggerRecovery() {
    try {
      // IPC call to trigger recovery
      await window.api.taker.recover();
      console.log('🔄 Recovery triggered');
    } catch (err) {
      console.error('Recovery call failed:', err);
    }
  }

  function startPollingSwapStatus() {
    const swapId = actualSwapConfig.swapId;

    if (!swapId) {
      addLog('Error: No swap ID for polling', 'error');
      return;
    }

    pollInterval = setInterval(async () => {
      try {
        // IPC call to get coinswap status
        const result = await window.api.coinswap.getStatus(swapId);

        if (!result.success) {
          console.error('Polling error:', result.error);
          return;
        }

        const swap = result.swap;

        if (swap.status === 'completed') {
          clearInterval(pollInterval);
          clearInterval(logPollInterval);

          if (swap.report) {
            completeSwapWithReport(swap.report);
          } else {
            completeSwap();
          }
        } else if (swap.status === 'failed') {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (logPollInterval) {
            clearInterval(logPollInterval);
            logPollInterval = null;
          }

          if (content.dataset.failed === 'true') return;
          content.dataset.failed = 'true';

          addLog('Swap failed: ' + swap.error, 'error');
          content.querySelector('#swap-status-text').textContent = 'Swap Failed';
          content.querySelector('#swap-status-text').className = 'text-2xl font-bold text-red-400';

          SwapStateManager.saveSwapProgress({
            ...SwapStateManager.getSwapProgress(),
            status: 'failed',
            error: swap.error
          });

          triggerRecovery();
        }

      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }

  function completeSwapWithReport(report) {
    if (content.dataset.completed === 'true') return;
    content.dataset.completed = 'true';

    addLog('Generating swap report...', 'success');

    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className = 'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');

    const transformedReport = transformSwapReport(report);
    actualSwapConfig.swapReport = transformedReport;

    SwapStateManager.saveSwapProgress({
      ...SwapStateManager.getSwapProgress(),
      status: 'completed',
      report: transformedReport
    });

    SwapStateManager.completeSwap(transformedReport);

    setTimeout(() => {
  SwapStateManager.clearSwapData();
}, 3000);

    if (window.appManager) window.appManager.stopBackgroundSwapManager();
  }

  function transformSwapReport(backendReport) {
    if (!backendReport) return getDefaultReport();

    const getValue = (snakeCase, camelCase, defaultVal = 0) => {
      return backendReport[snakeCase] ?? backendReport[camelCase] ?? defaultVal;
    };

    const getArrayValue = (snakeCase, camelCase, defaultVal = []) => {
      return backendReport[snakeCase] || backendReport[camelCase] || defaultVal;
    };

    const swapId = getValue('swap_id', 'swapId', actualSwapConfig.swapId || 'unknown');
    const swapDurationSeconds = getValue('swap_duration_seconds', 'swapDurationSeconds', 0);
    const targetAmount = getValue('target_amount', 'targetAmount', swapData.amount || 0);
    const totalInputAmount = getValue('total_input_amount', 'totalInputAmount', 0);
    const totalOutputAmount = getValue('total_output_amount', 'totalOutputAmount', 0);
    const makersCount = getValue('makers_count', 'makersCount', swapData.makers || 0);
    const makerAddresses = getArrayValue('maker_addresses', 'makerAddresses', []);
    const totalFundingTxs = getValue('total_funding_txs', 'totalFundingTxs', 0);
    const fundingTxidsByHop = getArrayValue('funding_txids_by_hop', 'fundingTxidsByHop', []);
    const totalFee = getValue('total_fee', 'totalFee', 0);
    const miningFee = getValue('mining_fee', 'miningFee', 0);
    const inputUtxos = getArrayValue('input_utxos', 'inputUtxos', []);
    const outputRegularUtxos = getArrayValue('output_regular_utxos', 'outputRegularUtxos', []);
    const outputSwapUtxos = getArrayValue('output_swap_utxos', 'outputSwapUtxos', []);
    const makerFeeInfoRaw = getArrayValue('maker_fee_info', 'makerFeeInfo', []);

    let totalMakerFees = 0;
    const makerFeeInfo = makerFeeInfoRaw.map((info, idx) => {
      const baseFee = info.base_fee ?? info.baseFee ?? 0;
      const amountRelativeFee = info.amount_relative_fee ?? info.amountRelativeFee ?? 0;
      const timeRelativeFee = info.time_relative_fee ?? info.timeRelativeFee ?? 0;
      const feeTotal = baseFee + amountRelativeFee + timeRelativeFee;
      totalMakerFees += feeTotal;

      return {
        makerIndex: idx,
        makerAddress: makerAddresses[idx] || `maker${idx + 1}`,
        baseFee,
        amountRelativeFee,
        timeRelativeFee,
        totalFee: feeTotal
      };
    });

    const calculatedMiningFee = miningFee || (totalFee - totalMakerFees);
    const feePercentage = targetAmount > 0 ? (totalFee / targetAmount) * 100 : 0;

    return {
      swapId,
      swapDurationSeconds,
      targetAmount,
      totalInputAmount,
      totalOutputAmount,
      makersCount,
      makerAddresses,
      totalFundingTxs,
      fundingTxidsByHop,
      totalFee,
      totalMakerFees,
      miningFee: calculatedMiningFee,
      feePercentage,
      makerFeeInfo,
      inputUtxos,
      outputRegularUtxos,
      outputSwapUtxos
    };
  }

  function getDefaultReport() {
    return {
      swapId: actualSwapConfig.swapId || 'unknown',
      swapDurationSeconds: (Date.now() - startTime) / 1000,
      targetAmount: swapData.amount || 0,
      totalInputAmount: swapData.amount || 0,
      totalOutputAmount: (swapData.amount || 0) - 1000,
      makersCount: swapData.makers || 0,
      makerAddresses: [],
      totalFundingTxs: swapData.hops || 0,
      fundingTxidsByHop: [],
      totalFee: 1000,
      totalMakerFees: 300,
      miningFee: 700,
      feePercentage: 5,
      makerFeeInfo: [],
      inputUtxos: [],
      outputRegularUtxos: [],
      outputSwapUtxos: []
    };
  }

  function completeSwap() {
    if (content.dataset.completed === 'true') return;
    content.dataset.completed = 'true';

    addLog('All operations completed!', 'success');

    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className = 'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');

    const defaultReport = getDefaultReport();
    SwapStateManager.completeSwap(defaultReport);
    actualSwapConfig.swapReport = defaultReport;

    if (window.appManager) window.appManager.stopBackgroundSwapManager();
  }

  function viewSwapReport() {
    import('./SwapReport.js').then((module) => {
      container.innerHTML = '';
      const report = actualSwapConfig.swapReport || getDefaultReport();
      module.SwapReportComponent(container, report);
    });
  }

  function updateArrowLink(hopIndex, txid) {
    const arrow = content.querySelector(`#arrow-link-${hopIndex}`);
    if (arrow && txid) {
      // Use mempool.space for mainnet, or localhost for regtest
      const baseUrl = 'https://mempool.space/tx/';  // Change to 'http://localhost:8080/tx/' for regtest
      arrow.href = `${baseUrl}${txid}`;
    }
  }

  function updateTxList() {
    const txList = content.querySelector('#transaction-list');
    if (!txList) return;

    const txHtml = swapData.transactions.map((tx, index) => {
      const hasData = tx.txid || tx.status !== 'pending';
      if (!hasData) {
        return `
          <div class="bg-[#0f1419] rounded p-2 text-xs opacity-50">
            <div class="flex justify-between mb-1">
              <span class="text-gray-400">Hop ${index + 1}</span>
              <span class="text-gray-500">⏳</span>
            </div>
            <div class="font-mono text-gray-500">Waiting...</div>
          </div>
        `;
      }

      return `
        <div class="bg-[#0f1419] rounded p-2 text-xs">
          <div class="flex justify-between mb-1">
            <span class="text-gray-400">Hop ${index + 1}</span>
            <span class="${tx.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">
              ${tx.status === 'confirmed' ? '✓' : tx.status === 'broadcasting' ? '📡' : '⏳'}
            </span>
          </div>
          <div class="font-mono text-gray-300">${tx.txid ? tx.txid.substring(0, 12) + '...' : 'Pending'}</div>
          <div class="text-gray-500 mt-1">
            ${tx.fee ? `Fee: ${tx.fee} sats` : ''} 
            ${tx.size ? `| ${tx.size} vB` : ''}
          </div>
        </div>
      `;
    }).join('');

    txList.innerHTML = txHtml;
  }

  function buildFlowDiagram() {
    return `
    <div class="flex items-center justify-center gap-4 px-8 overflow-x-auto">
      <!-- You Send -->
      <div id="you-send" class="text-center transition-all flex-shrink-0" style="opacity: 0.5;">
        <div class="w-20 h-20 bg-[#FF6B35] rounded-xl flex items-center justify-center mb-2 shadow-lg">
          <span class="text-xl text-white font-bold">You</span>
        </div>
        <div class="text-xs text-gray-400">Your Coins</div>
        <div class="text-xs font-mono text-white mt-1">${(swapData.amount / 100000000).toFixed(4)} BTC</div>
      </div>

      ${Array.from({ length: swapData.hops }, (_, i) => {
      const color = makerColors[i % makerColors.length];
      return `
          <!-- Arrow to Hop ${i + 1} -->
          <a id="arrow-link-${i}" href="#" target="_blank" class="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer" title="View on mempool.space">
            <svg width="40" height="30" style="overflow: visible;">
              <defs>
                <marker id="arrow-${i}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="${color}" />
                </marker>
              </defs>
              <line x1="0" y1="15" x2="40" y2="15" stroke="${color}" stroke-width="2" marker-end="url(#arrow-${i})" opacity="0.5"/>
            </svg>
          </a>

          <!-- Hop ${i + 1} -->
          <div id="hop-${i}" class="flex flex-col items-center gap-1 flex-shrink-0">
            <div class="text-center px-3 py-1 bg-[#0f1419] border border-gray-700 rounded min-w-[100px]">
              <div class="hop-status text-xs text-gray-500 font-bold">Pending</div>
            </div>
            ${i < swapData.hops - 1 ? `
              <div id="maker-${i + 1}" class="text-center transition-all mt-1" style="opacity: 0.3; filter: blur(3px);">
                <div class="w-14 h-14 rounded-lg flex items-center justify-center shadow-lg" style="background: ${color};">
                  <span class="text-lg text-white font-bold">M${i + 1}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">Maker ${i + 1}</div>
              </div>
            ` : ''}
          </div>
        `;
    }).join('')}

      <!-- Final Arrow -->
      <a id="arrow-link-final" href="#" target="_blank" class="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer" title="View on mempool.space">
        <svg width="40" height="30" style="overflow: visible;">
          <defs>
            <marker id="arrow-final" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#10B981" />
            </marker>
          </defs>
          <line x1="0" y1="15" x2="40" y2="15" stroke="#10B981" stroke-width="2" marker-end="url(#arrow-final)" opacity="0.5"/>
        </svg>
      </a>

      <!-- You Receive -->
      <div id="you-receive" class="text-center transition-all flex-shrink-0" style="opacity: 0.3;">
        <div class="w-20 h-20 bg-green-500 rounded-xl flex items-center justify-center mb-2 shadow-lg">
          <span class="text-xl text-white font-bold">You</span>
        </div>
        <div class="text-xs text-gray-400">New Coins</div>
        <div class="text-xs font-mono text-white mt-1">${(swapData.amount / 100000000).toFixed(4)} BTC</div>
      </div>
    </div>

    <div class="text-center mt-4">
      <div class="inline-block bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-1">
        <span class="text-blue-300 text-xs">Each hop breaks the transaction link</span>
      </div>
    </div>
  `;
  }

  content.innerHTML = `
    <div class="mb-6">
      <button id="back-to-swap" class="text-gray-400 hover:text-white mb-4">← Back</button>
      <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap in Progress</h2>
      <p id="swap-status-text" class="text-gray-400">Executing swap through ${swapData.makers} makers...</p>
    </div>

    <div class="bg-[#1a2332] rounded-lg p-6 mb-6">
      ${buildFlowDiagram()}
    </div>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-[#1a2332] rounded-lg p-4">
        <h3 class="text-lg font-semibold text-gray-300 mb-3">Progress</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">Amount</span>
            <span class="font-mono text-white">${(swapData.amount / 100000000).toFixed(8)} BTC</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Hops</span>
            <span class="text-cyan-400">${swapData.hops}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">Time</span>
            <span id="elapsed-time" class="text-yellow-400">0:00</span>
          </div>
        </div>
      </div>

      <div class="bg-[#1a2332] rounded-lg p-4">
        <h3 class="text-lg font-semibold text-gray-300 mb-3">Transactions</h3>
        <div id="transaction-list" class="space-y-2 max-h-48 overflow-y-auto"></div>
      </div>

      <div class="bg-[#1a2332] rounded-lg p-4">
        <h3 class="text-lg font-semibold text-gray-300 mb-3">Status</h3>
        <div class="space-y-2">
          <div class="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400">
            ℹ️ Do not close window
          </div>
          <div class="p-2 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400">
            🔒 Funds protected by HTLCs
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#1a2332] rounded-lg p-4">
      <h3 class="text-lg font-semibold text-gray-300 mb-3">Activity Log</h3>
      <div id="log-container" class="bg-[#0f1419] rounded p-3 h-40 overflow-y-auto font-mono text-xs"></div>
    </div>

    <button id="complete-button" class="hidden w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg">
      View Swap Report →
    </button>
  `;

  container.appendChild(content);

  content.querySelector('#back-to-swap').addEventListener('click', () => {
    if (pollInterval) clearInterval(pollInterval);
    if (logPollInterval) clearInterval(logPollInterval);
    import('./Swap.js').then(module => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  content.querySelector('#complete-button').addEventListener('click', viewSwapReport);

  // Initialize UI
  updateTxList();
  if (logMessages.length > 0) updateLogs();

  if (savedProgress && savedProgress.currentStep > 0) {
    setInterval(updateElapsedTime, 1000);
    startPollingSwapStatus();
    startPollingLogs();
  } else if (shouldStartNew) {
    setTimeout(() => startSwap(), 500);
  }
}