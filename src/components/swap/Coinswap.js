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
  let startTime = savedProgress
    ? savedProgress.startTime
    : actualSwapConfig.startTime || Date.now();
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
      lastUpdated: Date.now(),
    });
  }

  function updateLogs() {
    const logContainer = content.querySelector('#log-container');
    if (!logContainer) return;
    logContainer.innerHTML = logMessages
      .slice(0, 50)
      .map(
        (log) => `
      <div class="text-xs font-mono mb-1">
        <span class="text-gray-500">[${log.timestamp}]</span>
        <span class="${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-gray-300'}">${log.message}</span>
      </div>
    `
      )
      .join('');
  }

  function updateElapsedTime() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeEl = content.querySelector('#elapsed-time');
    if (timeEl)
      timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateHopStatus(hopIndex, statusText, color) {
    const hop = content.querySelector(`#hop-${hopIndex}`);
    if (!hop) return;

    const hopStatus = hop.querySelector('.hop-status');
    if (hopStatus) {
      hopStatus.textContent = statusText;
      const colorClass =
        color === 'green'
          ? 'text-green-400'
          : color === 'yellow'
            ? 'text-yellow-400'
            : color === 'orange'
              ? 'text-orange-400'
              : color === 'blue'
                ? 'text-blue-400'
                : 'text-gray-400';
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
      updateArrowLink(hopIndex, txid); // Add this
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

      data.logs.forEach((line) => {
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
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2}T[\d:.]+)[^\s]*\s+(\w+)\s+([\w:]+)\s+-\s+(.+)$/
    );
    if (!match) return;

    const [, timestamp, level, module, message] = match;

    if (!module.startsWith('coinswap::')) return;

    const logKey = `${timestamp}:${message}`;
    if (processedLogs.has(logKey)) return;
    processedLogs.add(logKey);

    const type =
      level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'info';

    // Add raw message to log
    addLog(message, type);

    // Update UI based on message content (supports both V1 and V2 protocols)

    // V1: "Initiating coinswap with id" | V2: "Initiating coinswap with id"
    if (message.includes('Initiating coinswap with id')) {
      updateYouSend(true);
      updateHopStatus(0, 'Initializing...', 'yellow');
    }
    // V1: "Broadcasted Funding tx" / "Waiting for funding transaction confirmation"
    // V2: "Registered watcher for taker's outgoing contract"
    else if (
      message.includes('Broadcasted Funding tx') ||
      message.includes('Waiting for funding transaction confirmation. Txids')
    ) {
      const txMatch = message.match(/(?:txid:|Txids\s*:\s*\[)([a-f0-9]+)/i);
      if (txMatch) {
        const emptySlot = swapData.transactions.findIndex((tx) => !tx.txid);
        if (emptySlot !== -1) {
          setTransactionTxid(emptySlot, txMatch[1]);
          updateHopStatus(emptySlot, 'Confirming...', 'orange');
        }
      }
    }
    // V2: "Registered watcher for taker's outgoing contract: txid:vout"
    else if (
      message.includes("Registered watcher for taker's outgoing contract")
    ) {
      const txMatch = message.match(/([a-f0-9]{64}):(\d+)/i);
      if (txMatch) {
        const emptySlot = swapData.transactions.findIndex((tx) => !tx.txid);
        if (emptySlot !== -1) {
          setTransactionTxid(emptySlot, txMatch[1]);
          updateHopStatus(emptySlot, 'Broadcasting...', 'orange');
        }
      }
    }
    // V2: "Persisted outgoing swapcoin to wallet store"
    else if (message.includes('Persisted outgoing swapcoin to wallet store')) {
      updateHopStatus(0, 'Confirming...', 'orange');
    }
    // V1: "Tx [txid] | Confirmed at"
    else if (message.match(/Tx [a-f0-9]+ \| Confirmed at/i)) {
      const txMatch = message.match(/Tx ([a-f0-9]+)/i);
      if (txMatch) {
        const slot = swapData.transactions.findIndex((tx) =>
          tx.txid?.startsWith(txMatch[1].substring(0, 8))
        );
        if (slot !== -1) {
          setTransactionConfirmed(slot);
          updateHopStatus(slot, '✓ Confirmed', 'green');
          // Light up next maker, or all makers if this is the last hop
          if (slot < swapData.hops - 1) {
            updateMakerVisibility(slot + 1, true);
          } else {
            // Last hop confirmed - ensure all makers are visible
            for (let i = 0; i < swapData.makers; i++) {
              updateMakerVisibility(i, true);
            }
          }
        }
      }
    }
    // V2: "Transaction confirmed at blockheight: {ht}, txid : {txid}"
    else if (message.includes('Transaction confirmed at blockheight')) {
      const txMatch = message.match(/txid\s*:\s*([a-f0-9]{64})/i);
      if (txMatch) {
        const slot = swapData.transactions.findIndex((tx) =>
          tx.txid?.startsWith(txMatch[1].substring(0, 8))
        );
        if (slot !== -1) {
          setTransactionConfirmed(slot);
          updateHopStatus(slot, '✓ Confirmed', 'green');
          if (slot < swapData.hops - 1) {
            updateMakerVisibility(slot + 1, true);
          }
        }
      }
    }
    // V2: "Transaction seen in mempool,waiting for confirmation, txid: {txid}"
    else if (message.includes('Transaction seen in mempool')) {
      const txMatch = message.match(/txid\s*:\s*([a-f0-9]{64})/i);
      if (txMatch) {
        const slot = swapData.transactions.findIndex((tx) =>
          tx.txid?.startsWith(txMatch[1].substring(0, 8))
        );
        if (slot !== -1) {
          updateHopStatus(slot, 'In mempool...', 'yellow');
        }
      }
    }
    // V2: Negotiating with makers
    else if (message.includes('Received AckResponse from maker')) {
      updateHopStatus(0, 'Negotiating...', 'yellow');
    }
    // V2: "All makers have responded with their outgoing keys"
    else if (
      message.includes('All makers have responded with their outgoing keys')
    ) {
      updateHopStatus(0, 'Keys received', 'green');
    }
    // V2: "Sweeping taker's incoming contract"
    else if (message.includes("Sweeping taker's incoming contract")) {
      updateHopStatus(0, 'Sweeping...', 'yellow');
    }
    // V2: "Broadcast taker sweep transaction"
    else if (message.includes('Broadcast taker sweep transaction')) {
      const txMatch = message.match(/([a-f0-9]{64})/i);
      if (txMatch) {
        // Update the transaction with sweep txid
        const slot = swapData.transactions.findIndex((tx) => tx.txid);
        if (slot !== -1) {
          setTransactionConfirmed(slot);
          updateHopStatus(slot, '✓ Swept', 'green');
        }
      }
    }
    // V1: "Swaps settled successfully" | V2: "Swaps settled successfully"
    else if (message.includes('Swaps settled successfully')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, '✓ Complete', 'green');
      }
    }
    // V2: "Taker sweep completed successfully"
    else if (message.includes('Taker sweep completed successfully')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, '✓ Complete', 'green');
      }
      updateYouReceive(true);
    }
    // V2: "Successfully Completed Taproot Coinswap"
    else if (message.includes('Successfully Completed Taproot Coinswap')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, '✓ Complete', 'green');
      }
      updateYouReceive(true);
    }
    // V1: "Successfully swept incoming swap coin"
    else if (message.includes('Successfully swept incoming swap coin')) {
      updateYouReceive(true);
    }
    // V2: "Recorded swept incoming swapcoin V2"
    else if (message.includes('Recorded swept incoming swapcoin V2')) {
      updateYouReceive(true);
    }
    // V2: "Starting forward-flow private key handover"
    else if (message.includes('Starting forward-flow private key handover')) {
      updateHopStatus(0, 'Key exchange...', 'yellow');
    }
    // V2: "Downloading offer from taproot maker"
    else if (message.includes('Downloading offer from taproot maker')) {
      updateHopStatus(0, 'Fetching offers...', 'yellow');
    }
    // V2: "Successfully downloaded offer from taproot maker"
    else if (
      message.includes('Successfully downloaded offer from taproot maker')
    ) {
      updateHopStatus(0, 'Offers received', 'blue');
    }
    // V2: Recovery started
    else if (message.includes('Starting taproot swap recovery')) {
      addLog('Recovery initiated...', 'warn');
      updateHopStatus(0, 'Recovering...', 'orange');
    }
    // V2: Recovery success (hashlock)
    else if (
      message.includes('Successfully recovered incoming contract via hashlock')
    ) {
      addLog('Recovered via hashlock', 'success');
    }
    // V2: Recovery success (timelock)
    else if (
      message.includes('Successfully recovered outgoing contract via timelock')
    ) {
      addLog('Recovered via timelock', 'success');
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
        status: 'in_progress',
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
          content.querySelector('#swap-status-text').textContent =
            'Swap Failed';
          content.querySelector('#swap-status-text').className =
            'text-2xl font-bold text-red-400';

          SwapStateManager.saveSwapProgress({
            ...SwapStateManager.getSwapProgress(),
            status: 'failed',
            error: swap.error,
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
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');

    const transformedReport = transformSwapReport(report);
    actualSwapConfig.swapReport = transformedReport;

    SwapStateManager.saveSwapProgress({
      ...SwapStateManager.getSwapProgress(),
      status: 'completed',
      report: transformedReport,
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

    const swapId = getValue(
      'swap_id',
      'swapId',
      actualSwapConfig.swapId || 'unknown'
    );
    const swapDurationSeconds = getValue(
      'swap_duration_seconds',
      'swapDurationSeconds',
      0
    );
    const targetAmount = getValue(
      'target_amount',
      'targetAmount',
      swapData.amount || 0
    );
    const totalInputAmount = getValue(
      'total_input_amount',
      'totalInputAmount',
      0
    );
    const totalOutputAmount = getValue(
      'total_output_amount',
      'totalOutputAmount',
      0
    );
    const makersCount = getValue(
      'makers_count',
      'makersCount',
      swapData.makers || 0
    );
    const makerAddresses = getArrayValue(
      'maker_addresses',
      'makerAddresses',
      []
    );
    const totalFundingTxs = getValue('total_funding_txs', 'totalFundingTxs', 0);
    const fundingTxidsByHop = getArrayValue(
      'funding_txids_by_hop',
      'fundingTxidsByHop',
      []
    );
    const totalFee = getValue('total_fee', 'totalFee', 0);
    const miningFee = getValue('mining_fee', 'miningFee', 0);
    const inputUtxos = getArrayValue('input_utxos', 'inputUtxos', []);
    const outputRegularUtxos = getArrayValue(
      'output_regular_utxos',
      'outputRegularUtxos',
      []
    );
    const outputSwapUtxos = getArrayValue(
      'output_swap_utxos',
      'outputSwapUtxos',
      []
    );
    const makerFeeInfoRaw = getArrayValue('maker_fee_info', 'makerFeeInfo', []);

    let totalMakerFees = 0;
    const makerFeeInfo = makerFeeInfoRaw.map((info, idx) => {
      const baseFee = info.base_fee ?? info.baseFee ?? 0;
      const amountRelativeFee =
        info.amount_relative_fee ?? info.amountRelativeFee ?? 0;
      const timeRelativeFee =
        info.time_relative_fee ?? info.timeRelativeFee ?? 0;
      const feeTotal = baseFee + amountRelativeFee + timeRelativeFee;
      totalMakerFees += feeTotal;

      return {
        makerIndex: idx,
        makerAddress: makerAddresses[idx] || `maker${idx + 1}`,
        baseFee,
        amountRelativeFee,
        timeRelativeFee,
        totalFee: feeTotal,
      };
    });

    const calculatedMiningFee = miningFee || totalFee - totalMakerFees;
    const feePercentage =
      targetAmount > 0 ? (totalFee / targetAmount) * 100 : 0;

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
      outputSwapUtxos,
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
      outputSwapUtxos: [],
    };
  }

  function completeSwap() {
    if (content.dataset.completed === 'true') return;
    content.dataset.completed = 'true';

    addLog('All operations completed!', 'success');

    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
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
      const baseUrl = 'https://mempool.space/tx/'; // Change to 'http://localhost:8080/tx/' for regtest
      arrow.href = `${baseUrl}${txid}`;
    }
  }

  function updateTxList() {
    const txList = content.querySelector('#transaction-list');
    if (!txList) return;

    const txHtml = swapData.transactions
      .map((tx, index) => {
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
      })
      .join('');

    txList.innerHTML = txHtml;
  }

  function buildFlowDiagram() {
    const actualMakers = swapData.makers; // Number of actual makers (e.g., 2)
    const radius = 140; // Radius of the circle
    const centerX = 200;
    const centerY = 200;

    // Calculate positions for nodes in a circle
    // Total nodes: You + Makers (no duplicate "You")
    const totalNodes = actualMakers + 1; // +1 for single "You"
    const angleStep = (2 * Math.PI) / totalNodes;

    const positions = [];
    for (let i = 0; i < totalNodes; i++) {
      const angle = angleStep * i - Math.PI / 2; // Start from top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positions.push({ x, y });
    }

    return `
    <div class="flex items-center justify-center" style="min-height: 450px;">
      <svg width="450" height="450" viewBox="0 0 400 400" class="mx-auto">
        <defs>
          ${Array.from({ length: actualMakers + 1 }, (_, i) => {
            const color =
              i < actualMakers
                ? makerColors[i % makerColors.length]
                : '#10B981';
            return `
              <marker id="arrow-${i}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${color}" />
              </marker>
            `;
          }).join('')}
        </defs>
        
        <!-- Draw arrows between nodes (including back to You) -->
        ${positions
          .map((pos, i) => {
            const nextPos = positions[(i + 1) % positions.length]; // Wrap around to first node
            const color =
              i < actualMakers
                ? makerColors[i % makerColors.length]
                : '#10B981';

            // Calculate arrow direction
            const dx = nextPos.x - pos.x;
            const dy = nextPos.y - pos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const offsetStart = i === 0 ? 40 : 35; // Larger offset for "You" node
            const offsetEnd = (i + 1) % positions.length === 0 ? 40 : 35;

            const startX = pos.x + (dx / length) * offsetStart;
            const startY = pos.y + (dy / length) * offsetStart;
            const endX = nextPos.x - (dx / length) * offsetEnd;
            const endY = nextPos.y - (dy / length) * offsetEnd;

            return `
            <a id="arrow-link-${i}" href="#" class="cursor-pointer hover:opacity-80" title="View transaction" onclick="event.preventDefault();">
              <line 
                x1="${startX}" y1="${startY}" 
                x2="${endX}" y2="${endY}" 
                stroke="${color}" 
                stroke-width="2.5" 
                marker-end="url(#arrow-${i})" 
                opacity="0.6"
                class="transition-opacity"
              />
            </a>
          `;
          })
          .join('')}
        
        <!-- You (single node - transitions from Send to Receive) -->
        <g id="you-node" style="transition: all 0.3s;">
          <rect 
            x="${positions[0].x - 38}" y="${positions[0].y - 38}" 
            width="76" height="76" 
            rx="14" 
            fill="#FF6B35" 
            class="shadow-lg"
            id="you-rect"
            style="transition: fill 0.5s;"
          />
          <text 
            x="${positions[0].x}" y="${positions[0].y}" 
            text-anchor="middle" 
            fill="white" 
            font-size="22" 
            font-weight="bold"
          >You</text>
          <text 
            id="you-state-text"
            x="${positions[0].x}" y="${positions[0].y + 50}" 
            text-anchor="middle" 
            fill="#D1D5DB" 
            font-size="10"
          >Send</text>
          <text 
            x="${positions[0].x}" y="${positions[0].y + 65}" 
            text-anchor="middle" 
            fill="white" 
            font-size="9" 
            font-family="monospace"
          >${(swapData.amount / 100000000).toFixed(4)}</text>
        </g>
        
        <!-- Makers -->
        ${Array.from({ length: actualMakers }, (_, i) => {
          const pos = positions[i + 1]; // Offset by 1 because "You" is at position 0
          const color = makerColors[i % makerColors.length];
          return `
            <g id="maker-${i}" style="opacity: ${i === 0 ? '1' : '0.3'}; filter: ${i === 0 ? 'blur(0)' : 'blur(3px)'}; transition: all 0.3s;">
              <!-- Maker node -->
              <rect 
                x="${pos.x - 32}" y="${pos.y - 32}" 
                width="64" height="64" 
                rx="10" 
                fill="${color}" 
                class="shadow-lg"
              />
              <text 
                x="${pos.x}" y="${pos.x === positions[1].x ? pos.y : pos.y + 3}" 
                text-anchor="middle" 
                fill="white" 
                font-size="20" 
                font-weight="bold"
              >M${i + 1}</text>
              <text 
                x="${pos.x}" y="${pos.y + 48}" 
                text-anchor="middle" 
                fill="#D1D5DB" 
                font-size="9"
              >Maker ${i + 1}</text>
              
              <!-- Status indicator -->
              <g id="hop-${i}">
                <rect 
                  x="${pos.x - 52}" y="${pos.y - 58}" 
                  width="104" height="22" 
                  rx="5" 
                  fill="#0f1419" 
                  stroke="#374151" 
                  stroke-width="1"
                />
                <text 
                  class="hop-status" 
                  x="${pos.x}" y="${pos.y - 42}" 
                  text-anchor="middle" 
                  fill="#9CA3AF" 
                  font-size="10" 
                  font-weight="bold"
                >Pending</text>
              </g>
            </g>
          `;
        }).join('')}
      </svg>
    </div>
  `;
  }

  function updateYouSend(active) {
    const youNode = content.querySelector('#you-node');
    const youRect = content.querySelector('#you-rect');
    const youStateText = content.querySelector('#you-state-text');

    if (youNode && active) {
      youNode.style.opacity = '1';
      if (youRect) youRect.setAttribute('fill', '#FF6B35');
      if (youStateText) youStateText.textContent = 'Sending...';
    }
  }

  function updateYouReceive(active) {
    const youNode = content.querySelector('#you-node');
    const youRect = content.querySelector('#you-rect');
    const youStateText = content.querySelector('#you-state-text');

    if (youNode && active) {
      youNode.style.opacity = '1';
      if (youRect) {
        youRect.setAttribute('fill', '#10B981'); // Green color
        // Add a subtle pulse animation
        youRect.style.animation = 'pulse 2s ease-in-out infinite';
      }
      if (youStateText) youStateText.textContent = 'Received ✓';
    }
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
        <h3 class="text-lg font-semibold text-lg text-gray-300 mb-3">Progress</h3>
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
        <h3 class="text-lg font-semibold text-lg text-gray-300 mb-3">Transactions</h3>
        <div id="transaction-list" class="space-y-2 max-h-48 overflow-y-auto"></div>
      </div>

      <div class="bg-[#1a2332] rounded-lg p-4">
        <h3 class="text-lg font-semibold text-lg text-gray-300 mb-3">Status</h3>
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
      <h3 class="text-lg font-semibold text-lg text-gray-300 mb-3">Activity Log</h3>
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
    import('./Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  content
    .querySelector('#complete-button')
    .addEventListener('click', viewSwapReport);

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
