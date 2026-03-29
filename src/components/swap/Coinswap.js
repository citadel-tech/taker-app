import { SwapStateManager, formatElapsedTime } from './SwapStateManager.js';
import { icons } from '../../js/icons.js';

export async function CoinswapComponent(container, swapConfig) {
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
      default:
        return fallbackIsTaproot ? 'Taproot' : 'Legacy';
    }
  }

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
  let startTime =
    savedProgress?.startTime || actualSwapConfig?.startTime || Date.now();
  let logMessages = savedProgress ? savedProgress.logMessages || [] : [];
  let currentHop = 0;

  const swapProtocol = normalizeProtocol(
    actualSwapConfig?.protocol,
    actualSwapConfig?.isTaproot || false
  );
  const isV2 = swapProtocol === 'Taproot';

  const swapData = {
    amount: actualSwapConfig.amount,
    makers: actualSwapConfig.makers,
    hops: actualSwapConfig.hops,
    transactions: savedProgress?.transactions || [],
  };

  if (swapData.transactions.length === 0) {
    if (isV2) {
      swapData.transactions = [
        {
          id: 'tx-outgoing',
          txid: '',
          status: 'pending',
          label: 'Locking Funds',
        },
        {
          id: 'tx-incoming',
          txid: '',
          status: 'pending',
          label: 'Receiving Funds',
        },
      ];
    } else {
      // Existing V1 behavior
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

      // ✅ FIX: Use setAttribute for SVG elements
      hopStatus.setAttribute(
        'class',
        `hop-status text-xs ${colorClass} font-bold`
      );

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

  function markAllMakersComplete() {
    for (let i = 0; i < swapData.makers; i++) {
      updateMakerVisibility(i, true);
      updateHopStatus(i, `${icons.check(14, 'mr-1')} Complete`, 'green');
    }
  }

  function markAllMakersFailed() {
    for (let i = 0; i < swapData.makers; i++) {
      updateMakerVisibility(i, true);
      updateHopStatus(i, 'Failed', 'orange');
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

    const makerIndexMatch = message.match(/maker\s+(\d+)/i);
    const makerIndex =
      makerIndexMatch && Number.isFinite(Number(makerIndexMatch[1]))
        ? Number(makerIndexMatch[1])
        : null;

    // Update UI based on message content (supports both V1 and V2 protocols)

    // V1: "Initiating coinswap with id" | V2: "Initiating coinswap with id"
    if (message.includes('Initiating coinswap with id')) {
      updateYouSend(true);
      updateHopStatus(0, 'Initializing...', 'yellow');
    }
    // V1: "Broadcasted Funding tx" / "Waiting for funding transaction confirmation"
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
        // This is hop 0 - taker's outgoing contract
        setTransactionTxid(0, txMatch[1]);
        updateHopStatus(0, 'Broadcasting...', 'orange');
        updateMakerVisibility(0, true); // Light up first maker
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
          updateHopStatus(slot, `${icons.check(14, 'mr-1')} Confirmed`, 'green');

          const confirmedHops = swapData.transactions.filter(
            (tx) => tx.status === 'confirmed'
          ).length;

          for (let i = 0; i < Math.min(confirmedHops, swapData.makers); i++) {
            updateMakerVisibility(i, true);
          }

          console.log(
            `✅ Hop ${slot + 1} confirmed. Lighting up ${Math.min(confirmedHops, swapData.makers)} makers`
          );
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
          updateHopStatus(slot, `${icons.check(14, 'mr-1')} Confirmed`, 'green');

          // ✅ When outgoing is confirmed, light up ALL makers and mark intermediate hops as "Processing"
          if (slot === 0) {
            // Light up all makers
            for (let i = 0; i < swapData.makers; i++) {
              updateMakerVisibility(i, true);
            }
            // Mark intermediate hops as processing (hops 1 to N-1)
            for (let i = 1; i < swapData.hops - 1; i++) {
              updateHopStatus(i, `${icons.refreshCw(14, 'mr-1 animate-spin')} Processing...`, 'blue');
            }
            console.log(
              `✅ Outgoing contract confirmed. All ${swapData.makers} makers now active`
            );
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
      // Mark first few hops as negotiating
      updateHopStatus(0, 'Negotiating...', 'yellow');
    }
    // V2: "All makers have responded with their outgoing keys"
    else if (
      message.includes('All makers have responded with their outgoing keys')
    ) {
      // Mark all intermediate hops as "Keys received"
      for (let i = 1; i < swapData.hops - 1; i++) {
        updateHopStatus(i, `${icons.key(14, 'mr-1')} Keys received`, 'green');
      }
    }
    // V2: "Registered watcher for taker's incoming contract"
    else if (
      message.includes("Registered watcher for taker's incoming contract")
    ) {
      const txMatch = message.match(/([a-f0-9]{64}):(\d+)/i);
      if (txMatch) {
        // This is the final hop - mark it
        const lastHop = swapData.hops - 1;
        updateHopStatus(lastHop, `${icons.arrowDownCircle(14, 'mr-1')} Receiving...`, 'blue');
      }
    }
    // V2: "Sweeping taker's incoming contract"
    else if (message.includes("Sweeping taker's incoming contract")) {
      const lastHop = swapData.hops - 1;
      updateHopStatus(lastHop, 'Sweeping...', 'yellow');
    }
    // V2: "Broadcast taker sweep transaction"
    else if (message.includes('Broadcast taker sweep transaction')) {
      const txMatch = message.match(/([a-f0-9]{64})/i);
      if (txMatch) {
        const lastHop = swapData.hops - 1;
        updateHopStatus(lastHop, `${icons.check(14, 'mr-1')} Swept`, 'green');
      }
    }
    // V1: "Swaps settled successfully"
    else if (message.includes('Swaps settled successfully')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, `${icons.check(14, 'mr-1')} Complete`, 'green');
      }
    }
    // V2: "Taker sweep completed successfully"
    else if (message.includes('Taker sweep completed successfully')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, `${icons.check(14, 'mr-1')} Complete`, 'green');
      }
      // Make sure all makers are visible
      for (let i = 0; i < swapData.makers; i++) {
        updateMakerVisibility(i, true);
      }
      updateYouReceive(true);
    }
    // V2: "Successfully Completed Taproot Coinswap"
    else if (message.includes('Successfully Completed Taproot Coinswap')) {
      for (let i = 0; i < swapData.hops; i++) {
        updateHopStatus(i, `${icons.check(14, 'mr-1')} Complete`, 'green');
      }
      // Make sure all makers are visible
      for (let i = 0; i < swapData.makers; i++) {
        updateMakerVisibility(i, true);
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
      // Mark intermediate hops as doing key exchange
      for (let i = 1; i < swapData.hops - 1; i++) {
        updateHopStatus(i, `${icons.keyRound(14, 'mr-1')} Key exchange...`, 'yellow');
      }
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
    // V2: "Sending contract data to maker N"
    else if (
      makerIndex !== null &&
      message.includes('Sending contract data to maker')
    ) {
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Contracting...', 'yellow');
    }
    // V2: "Received Taproot contract data from maker N"
    else if (
      makerIndex !== null &&
      message.includes('Received Taproot contract data from maker')
    ) {
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Contract received', 'blue');
    }
    // V2: "Verified Taproot contract data from maker N"
    else if (
      makerIndex !== null &&
      message.includes('Verified Taproot contract data from maker')
    ) {
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, `${icons.check(14, 'mr-1')} Contract ready`, 'green');
    }
    // V2: "Received private key from maker N"
    else if (
      makerIndex !== null &&
      message.includes('Received private key from maker')
    ) {
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, `${icons.keyRound(14, 'mr-1')} Key received`, 'green');
    }
    // V2: "Sending privkey to maker N and awaiting response"
    else if (
      makerIndex !== null &&
      message.includes('Sending privkey to maker') &&
      message.includes('awaiting response')
    ) {
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Finalizing...', 'yellow');
    }
    // V2: "Exchanging contract data with makers..."
    else if (message.includes('Exchanging contract data with makers')) {
      for (let i = 0; i < swapData.makers; i++) {
        updateMakerVisibility(i, true);
        updateHopStatus(i, 'Exchanging...', 'yellow');
      }
    }
    // V2: "Finalizing swap..."
    else if (message.includes('Finalizing swap')) {
      for (let i = 0; i < swapData.makers; i++) {
        updateMakerVisibility(i, true);
        updateHopStatus(i, 'Finalizing...', 'yellow');
      }
    }
    // V2: "Swap finalized successfully"
    else if (message.includes('Swap finalized successfully')) {
      markAllMakersComplete();
      updateYouReceive(true);
    }
    // V2: "Sweeping N completed incoming swap coins"
    else if (message.includes('Sweeping') && message.includes('completed incoming swap coins')) {
      markAllMakersComplete();
      updateYouReceive(true);
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
    } else if (
      message.includes("Registered watcher for taker's outgoing contract")
    ) {
      const txMatch = message.match(/([a-f0-9]{64})/);
      if (txMatch && isV2) {
        setTransactionTxid(0, txMatch[1]); // slot 0 = outgoing
        updateHopStatus(0, 'Locked', 'orange'); // but we won't show per-hop status anymore
      }
    } else if (message.includes('Broadcast taker sweep transaction')) {
      const txMatch = message.match(/([a-f0-9]{64})/i);
      if (txMatch && isV2) {
        setTransactionTxid(1, txMatch[1]);
        updateYouReceive(true);
      }
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
      if (actualSwapConfig.nativeSwapId) {
        addLog(`Backend Swap ID: ${actualSwapConfig.nativeSwapId}`, 'info');
      }
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

        if (swap.nativeSwapId && actualSwapConfig.nativeSwapId !== swap.nativeSwapId) {
          actualSwapConfig.nativeSwapId = swap.nativeSwapId;
          addLog(`Backend Swap ID: ${swap.nativeSwapId}`, 'info');
        }

        if (swap.status === 'prepared') {
          addLog('Swap prepared, starting execution...', 'info');
          return;
        }

        if (swap.status === 'completed') {
          clearInterval(pollInterval);
          clearInterval(logPollInterval);

          console.log('🎯 Swap completed! Report data:', swap.report);

          if (swap.report) {
            await completeSwapWithReport(swap.report);
          } else {
            console.warn('⚠️ No report from backend, using default');
            await completeSwap();
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
          updateHeaderState('failed');
          markAllMakersFailed();
          content.querySelector('#swap-status-text').textContent =
            'Swap Failed';
          content.querySelector('#swap-status-text').className =
            'text-2xl font-bold text-red-400';

          await SwapStateManager.saveSwapProgress({
            ...(await SwapStateManager.getSwapProgress()),
            status: 'failed',
            error: swap.error,
          });

          // Show failure modal
          showFailureModal(swap.error);

          // Trigger recovery
          triggerRecovery();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }

  function showFailureModal(errorMessage) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className =
      'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50';
    modal.innerHTML = `
    <div class="bg-[#1a2332] rounded-lg p-6 max-w-md mx-4 border border-red-500/30">
      <div class="flex items-center mb-4">
        <div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mr-4">
          <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-red-400">Swap Failed</h3>
      </div>
      
      <div class="mb-6">
        <p class="text-gray-300 mb-3">The coinswap could not be completed. Your funds are safe and recovery has been initiated.</p>
        
        <div class="bg-[#0f1419] rounded p-3 mb-3">
          <p class="text-xs text-gray-400 mb-1">Error Details:</p>
          <p class="text-sm text-red-300 font-mono break-words">${errorMessage || 'Unknown error'}</p>
        </div>
        
        <div class="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-xs text-blue-300">
          <p class="font-semibold mb-1">${icons.shieldCheck(16, 'mr-2')} Your funds are protected</p>
          <p>Recovery process has started automatically. Check your wallet for returned funds.</p>
        </div>
      </div>
      
      <button id="modal-to-swap" class="w-full bg-[#FF6B35] hover:bg-[#FF8555] text-white font-bold py-3 px-4 rounded-lg transition-colors">
        Back to Swap Page
      </button>
    </div>
  `;

    document.body.appendChild(modal);

    // Add event listener
    modal.querySelector('#modal-to-swap').addEventListener('click', () => {
      modal.remove();
      if (pollInterval) clearInterval(pollInterval);
      if (logPollInterval) clearInterval(logPollInterval);

      // Navigate back to Swap page
      import('./Swap.js').then((module) => {
        container.innerHTML = '';
        module.SwapComponent(container);
      });
    });
  }

  async function completeSwapWithReport(report) {
    if (content.dataset.completed === 'true') return;
    content.dataset.completed = 'true';

    console.log('🎯 completeSwapWithReport called with:', report);

    console.log('🔍 actualSwapConfig:', actualSwapConfig); // ← ADD THIS
    console.log('🔍 isTaproot value:', actualSwapConfig?.isTaproot); // ← ADD THIS

    addLog('Generating swap report...', 'success');

    updateHeaderState('completed');
    markAllMakersComplete();
    updateYouReceive(true);
    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');

    const transformedReport = transformSwapReport(report);
    transformedReport.protocol = swapProtocol;
    transformedReport.isTaproot = swapProtocol === 'Taproot';
    transformedReport.protocolVersion = swapProtocol === 'Taproot' ? 2 : 1;
    transformedReport.nativeSwapId =
      transformedReport.nativeSwapId || actualSwapConfig.nativeSwapId || null;

    actualSwapConfig.swapReport = transformedReport;

    await SwapStateManager.saveSwapProgress({
      ...(await SwapStateManager.getSwapProgress()),
      status: 'completed',
      report: transformedReport,
    });

    await SwapStateManager.completeSwap(transformedReport);

    setTimeout(() => {
      void SwapStateManager.clearSwapData();
    }, 3000);

    if (window.appManager) window.appManager.stopBackgroundSwapManager();
  }

  function transformSwapReport(backendReport) {
    console.log(
      '🔍 Full backend report:',
      JSON.stringify(backendReport, null, 2)
    ); // ← ADD THIS

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
    const nativeSwapId = getValue(
      'native_swap_id',
      'nativeSwapId',
      actualSwapConfig.nativeSwapId || null
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
    const feePaidOrEarned = getValue(
      'fee_paid_or_earned',
      'feePaidOrEarned',
      NaN
    );
    const totalFee = getValue('total_fee', 'totalFee', NaN);
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

    const outgoingContracts = getArrayValue(
      'outgoing_contracts',
      'outgoingContracts',
      []
    );
    const incomingContracts = getArrayValue(
      'incoming_contracts',
      'incomingContracts',
      []
    );

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

    const componentTotalFee = totalMakerFees + Math.max(0, miningFee);
    const netFeePaidOrEarned = Number.isFinite(feePaidOrEarned)
      ? Math.abs(feePaidOrEarned)
      : NaN;
    const normalizedTotalFee =
      Number.isFinite(totalFee) && totalFee >= 0
        ? totalFee
        : componentTotalFee > 0
          ? componentTotalFee
          : Number.isFinite(netFeePaidOrEarned)
            ? netFeePaidOrEarned
            : 0;
    const calculatedMiningFee =
      Number.isFinite(miningFee) && miningFee >= 0
        ? miningFee
        : Math.max(0, normalizedTotalFee - totalMakerFees);
    const feePercentage =
      targetAmount > 0 ? (normalizedTotalFee / targetAmount) * 100 : 0;

    return {
      swapId,
      nativeSwapId,
      swapDurationSeconds,
      targetAmount,
      totalInputAmount,
      totalOutputAmount,
      makersCount,
      makerAddresses,
      totalFundingTxs,
      fundingTxidsByHop,
      totalFee: normalizedTotalFee,
      totalMakerFees,
      miningFee: calculatedMiningFee,
      feePercentage,
      makerFeeInfo,
      inputUtxos,
      outputRegularUtxos,
      outputSwapUtxos,
      outgoingContracts,
      incomingContracts,
    };
  }

  function getDefaultReport() {
    return {
      swapId: actualSwapConfig.swapId || 'unknown',
      nativeSwapId: actualSwapConfig.nativeSwapId || null,
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

  async function completeSwap() {
    if (content.dataset.completed === 'true') return;
    content.dataset.completed = 'true';

    addLog('All operations completed!', 'success');

    updateHeaderState('completed');
    markAllMakersComplete();
    updateYouReceive(true);
    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');

    const defaultReport = getDefaultReport();
    await SwapStateManager.completeSwap(defaultReport);
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
      const baseUrl = 'https://mutinynet.com/tx/';
      // ✅ FIX: Use setAttributeNS for SVG href
      arrow.setAttributeNS(
        'http://www.w3.org/1999/xlink',
        'href',
        `${baseUrl}${txid}`
      );
    }
  }

  function updateTxList() {
    const txList = content.querySelector('#transaction-list');
    if (!txList) return;

    if (isV2) {
      const [outgoing, incoming] = swapData.transactions;
      txList.innerHTML = `
      <div class="space-y-3">
        <div class="bg-[#0f1419] rounded p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-300 font-medium">Locking Funds</span>
            <span class="${outgoing.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">
              ${outgoing.status === 'confirmed' ? `${icons.check(14, 'mr-1')} Confirmed` : outgoing.txid ? 'Broadcasted' : 'Pending'}
            </span>
          </div>
          ${outgoing.txid ? `<div class="font-mono text-xs text-gray-400 break-all">${outgoing.txid}</div>` : '<div class="text-gray-500 text-xs">Waiting for broadcast...</div>'}
        </div>

        <div class="bg-[#0f1419] rounded p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-300 font-medium">Receiving Funds</span>
            <span class="${incoming.status === 'confirmed' ? 'text-green-400' : 'text-gray-500'}">
              ${incoming.status === 'confirmed' ? `${icons.check(14, 'mr-1')} Received` : 'Waiting...'}
            </span>
          </div>
          ${incoming.txid ? `<div class="font-mono text-xs text-gray-400 break-all">${incoming.txid}</div>` : '<div class="text-gray-500 text-xs">Sweep pending</div>'}
        </div>
      </div>
    `;
    } else {
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
              ${tx.status === 'confirmed' ? icons.check(14) : tx.status === 'broadcasting' ? icons.radio(14) : icons.hourglass(14)}
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
  }

  function buildFlowDiagram() {
    const actualMakers = swapData.makers; // Number of actual makers (e.g., 2)
    const totalNodes = actualMakers + 1;

    // Dynamic node sizing based on maker count
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

    const statusW = Math.max(70, makerHalf * 3.5);
    const statusHalfW = statusW / 2;

    return `
    <div class="flex items-center justify-center overflow-auto">
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" class="mx-auto max-w-full">
        <defs>
          ${Array.from({ length: totalNodes }, (_, i) => {
            const color = i < actualMakers ? makerColors[i % makerColors.length] : '#10B981';
            return `<marker id="arrow-${i}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="${color}" opacity="0.85"/>
            </marker>`;
          }).join('')}
          <filter id="glow-you" x="-50%" y="-50%" width="200%" height="200%">
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
          const dx = nextPos.x - pos.x;
          const dy = nextPos.y - pos.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const sx = pos.x + (dx / len) * (fromHalf + 4);
          const sy = pos.y + (dy / len) * (fromHalf + 4);
          const ex = nextPos.x - (dx / len) * (toHalf + 10);
          const ey = nextPos.y - (dy / len) * (toHalf + 10);
          return `<a id="arrow-link-${i}" href="#" target="_blank" rel="noopener noreferrer" title="View transaction">
            <line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
                  stroke="${color}" stroke-width="2" marker-end="url(#arrow-${i})" opacity="0.6" class="transition-opacity"/>
          </a>`;
        }).join('')}

        <!-- You node -->
        <g id="you-node" style="transition: all 0.3s;">
          <rect x="${(positions[0].x - youHalf).toFixed(1)}" y="${(positions[0].y - youHalf).toFixed(1)}"
                width="${youHalf * 2}" height="${youHalf * 2}" rx="${youRx}"
                fill="#FF6B35" id="you-rect" style="transition: fill 0.5s;" filter="url(#glow-you)"/>
          <text x="${positions[0].x.toFixed(1)}" y="${(positions[0].y + youFont * 0.38).toFixed(1)}"
                text-anchor="middle" fill="white" font-size="${youFont}" font-weight="bold">You</text>
          <text id="you-state-text"
                x="${positions[0].x.toFixed(1)}" y="${(positions[0].y + youHalf + 17).toFixed(1)}"
                text-anchor="middle" fill="#D1D5DB" font-size="${Math.max(8, youFont - 12)}">Send</text>
          <text x="${positions[0].x.toFixed(1)}" y="${(positions[0].y + youHalf + 30).toFixed(1)}"
                text-anchor="middle" fill="white" font-size="${Math.max(7, youFont - 14)}"
                font-family="monospace">${(swapData.amount / 100000000).toFixed(4)}</text>
        </g>

        <!-- Makers -->
        ${Array.from({ length: actualMakers }, (_, i) => {
          const pos = positions[i + 1];
          const color = makerColors[i % makerColors.length];
          return `<g id="maker-${i}" style="opacity: ${i === 0 ? '1' : '0.3'}; filter: ${i === 0 ? 'none' : 'blur(2px)'}; transition: all 0.4s;">
            <rect x="${(pos.x - makerHalf).toFixed(1)}" y="${(pos.y - makerHalf).toFixed(1)}"
                  width="${makerHalf * 2}" height="${makerHalf * 2}" rx="${makerRx}" fill="${color}"/>
            <text x="${pos.x.toFixed(1)}" y="${(pos.y + makerFont * 0.38).toFixed(1)}"
                  text-anchor="middle" fill="white" font-size="${makerFont}" font-weight="bold">M${i + 1}</text>
            ${actualMakers <= 12 ? `
            <text x="${pos.x.toFixed(1)}" y="${(pos.y + makerHalf + 14).toFixed(1)}"
                  text-anchor="middle" fill="#9CA3AF" font-size="${Math.max(7, makerFont - 3)}">Maker ${i + 1}</text>
            ` : ''}
            <g id="hop-${i}">
              <rect x="${(pos.x - statusHalfW).toFixed(1)}" y="${(pos.y - makerHalf - 26).toFixed(1)}"
                    width="${statusW.toFixed(1)}" height="20" rx="4"
                    fill="#0f1419" stroke="#374151" stroke-width="1"/>
              <text class="hop-status" x="${pos.x.toFixed(1)}" y="${(pos.y - makerHalf - 13).toFixed(1)}"
                    text-anchor="middle" fill="#9CA3AF" font-size="${Math.max(8, makerFont - 1)}" font-weight="bold">Pending</text>
            </g>
          </g>`;
        }).join('')}

        ${isV2 ? `
          <text x="${centerX}" y="${centerY}" text-anchor="middle" fill="#6B7280" font-size="11" font-weight="bold">${swapProtocol}</text>
          <text x="${centerX}" y="${centerY + 15}" text-anchor="middle" fill="#4B5563" font-size="9">MuSig2</text>
        ` : ''}
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

  function updateHeaderState(state) {
    const titleEl = content.querySelector('#swap-page-title');
    const badgeEl = content.querySelector('#swap-page-badge');
    const badgeDotEl = content.querySelector('#swap-page-badge-dot');
    const badgeTextEl = content.querySelector('#swap-page-badge-text');

    if (!titleEl || !badgeEl || !badgeDotEl || !badgeTextEl) return;

    if (state === 'completed') {
      titleEl.textContent = 'Coinswap Complete';
      badgeEl.className =
        'flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full';
      badgeDotEl.className = 'w-2 h-2 rounded-full bg-green-400';
      badgeTextEl.className = 'text-xs text-green-400 font-medium';
      badgeTextEl.textContent = 'Complete';
      return;
    }

    if (state === 'failed') {
      titleEl.textContent = 'Coinswap Failed';
      badgeEl.className =
        'flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full';
      badgeDotEl.className = 'w-2 h-2 rounded-full bg-red-400';
      badgeTextEl.className = 'text-xs text-red-400 font-medium';
      badgeTextEl.textContent = 'Failed';
    }
  }

  content.innerHTML = `
    <!-- Header -->
    <div class="mb-4">
      <button id="back-to-swap" class="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 mb-3 transition-colors">← Back</button>
      <div class="flex items-center gap-3 mb-1">
        <h2 id="swap-page-title" class="text-2xl font-bold text-[#FF6B35]">Coinswap in Progress</h2>
        <span id="swap-page-badge" class="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
          <span id="swap-page-badge-dot" class="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
          <span id="swap-page-badge-text" class="text-xs text-orange-400 font-medium">Active</span>
        </span>
      </div>
      <p id="swap-status-text" class="text-gray-500 text-sm">Executing swap through ${swapData.makers} makers...</p>
    </div>

    <!-- Flow diagram -->
    <div class="bg-[#1a2332] rounded-xl mb-4 overflow-hidden">
      ${buildFlowDiagram()}
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-${isV2 ? '2' : '3'} gap-3 mb-4">
      <div class="bg-[#1a2332] rounded-xl p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Amount</p>
        <p class="font-mono text-white font-semibold">${(swapData.amount / 100000000).toFixed(8)} BTC</p>
        ${!isV2
          ? `<p class="text-xs text-gray-500 mt-2">Hops: <span class="text-cyan-400">${swapData.hops}</span></p>`
          : `<p class="text-xs text-cyan-400 mt-2">${swapProtocol} swap</p>`
        }
      </div>

      ${!isV2 ? `
      <div class="bg-[#1a2332] rounded-xl p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wide mb-2">Hop Transactions</p>
        <div id="transaction-list" class="space-y-1.5 max-h-28 overflow-y-auto"></div>
      </div>
      ` : ''}

      <div class="bg-[#1a2332] rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Elapsed</p>
          <span id="elapsed-time" class="font-mono text-yellow-400 font-bold text-xl">0:00</span>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs">
            <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
            <span class="text-blue-400">Do not close window</span>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
            <span class="text-purple-400">Funds protected by HTLCs</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity log -->
    <div class="bg-[#1a2332] rounded-xl p-4">
      <p class="text-xs text-gray-500 uppercase tracking-wide mb-2">Activity Log</p>
      <div id="log-container" class="bg-[#0a0f16] rounded-lg p-3 h-36 overflow-y-auto font-mono text-xs"></div>
    </div>

    <button id="complete-button" class="hidden w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors">
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
