import { SwapStateManager, formatElapsedTime } from './SwapStateManager.js';
import { icons } from '../../js/icons.js';
import { formatSats } from '../../js/price.js';
import { createSwapProgressAnimation } from './SwapProgressAnimation.js';

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
  let progressAnimation = null;

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

  const routeMakerAddresses = Array.isArray(savedProgress?.routeMakerAddresses)
    ? savedProgress.routeMakerAddresses.slice(0, swapData.makers)
    : Array.from({ length: swapData.makers }, () => null);
  while (routeMakerAddresses.length < swapData.makers) {
    routeMakerAddresses.push(null);
  }
  const pendingMakerAddresses = Array.from({ length: swapData.makers }, () => null);
  const contractDataReceivedMakers = new Set();

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

  const makerColors = ['#518def', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];

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
      routeMakerAddresses,
      lastUpdated: Date.now(),
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function compactEndpoint(value, left = 7, right = 5) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= left + right + 3) return text;
    return `${text.slice(0, left)}...${text.slice(-right)}`;
  }

  function setPendingMakerAddress(makerIndex, address) {
    if (
      makerIndex === null ||
      makerIndex < 0 ||
      makerIndex >= swapData.makers ||
      !address
    ) {
      return;
    }

    pendingMakerAddresses[makerIndex] = address;
  }

  function revealMakerAddress(makerIndex, address = null) {
    if (
      makerIndex === null ||
      makerIndex < 0 ||
      makerIndex >= swapData.makers
    ) {
      return;
    }

    const resolvedAddress =
      address ||
      routeMakerAddresses[makerIndex] ||
      pendingMakerAddresses[makerIndex];
    if (!resolvedAddress) return;

    routeMakerAddresses[makerIndex] = resolvedAddress;
    progressAnimation?.setMakerAddress(makerIndex, resolvedAddress);

    const addressEl = content.querySelector(
      `#maker-${makerIndex} .route-address`
    );
    if (addressEl) {
      addressEl.textContent = compactEndpoint(resolvedAddress);
      addressEl.title = resolvedAddress;
      addressEl.classList.remove('is-pending');
    }
    saveProgress();
  }

  function updateLogs() {
    const logContainer = content.querySelector('#log-container');
    if (!logContainer) return;
    const logCount = content.querySelector('#swap-log-count');
    if (logCount) logCount.textContent = logMessages.length;
    const formatLogLevel = (type) => {
      if (type === 'error') return 'ERROR';
      if (type === 'warn') return 'WARNING';
      return 'INFO';
    };
    const getLogHighlight = (message) => {
      const text = String(message || '').toLowerCase();
      if (text.includes('fidelity')) return 'is-fidelity';
      if (text.includes('funding tx') || text.includes('funding transaction')) {
        return 'is-funding';
      }
      if (
        text.includes('contract tx') ||
        text.includes('contract data') ||
        text.includes('registered watcher') ||
        text.includes('broadcast contract') ||
        text.includes('incoming contract') ||
        text.includes('outgoing contract')
      ) {
        return 'is-contract';
      }
      if (
        text.includes('recovery') ||
        text.includes('recovered') ||
        text.includes('hashlock') ||
        text.includes('timelock')
      ) {
        return 'is-recovery';
      }
      if (text.includes('swap report') || text.includes('generating swap report')) {
        return 'is-report';
      }
      if (text.includes('txid') || text.includes('broadcast')) return 'is-tx';
      return '';
    };
    logContainer.innerHTML = logMessages
      .slice(0, 50)
      .map(
        (log, index) => `
      <div class="swap-log-line ${log.type} ${getLogHighlight(log.message)}">
        <span>${String(index + 1).padStart(2, '0')}.${String(index * 5).padStart(2, '0')}</span>
        <b>[${formatLogLevel(log.type)}]</b>
        <strong>${log.message}</strong>
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
    const etaEl = content.querySelector('#swap-eta');
    if (etaEl) {
      const total = Math.max(30, (swapData.hops || 3) * 40);
      const remaining = Math.max(0, total - elapsed);
      etaEl.textContent = `${Math.floor(remaining / 60)}m ${String(remaining % 60).padStart(2, '0')}s`;
    }
  }

  function updateStageFromRoute() {
    if (
      content.dataset.completed === 'true' ||
      content.dataset.failed === 'true'
    ) {
      return;
    }

    const connected = content.querySelectorAll('.route-node.connected').length;
    const connecting = content.querySelectorAll('.route-node.connecting').length;
    const animationPhase = content.querySelector('.swap-animation')?.dataset.phase;
    const stepEl = content.querySelector('#swap-step-label');
    const titleEl = content.querySelector('#swap-page-title');
    const progressEl = content.querySelector('#swap-progress-fill');
    const routeStep = Math.min(
      5,
      Math.max(1, connected + (connecting > 0 ? 1 : 0))
    );
    const phaseHeader =
      animationPhase === 'settlement'
        ? { step: 4, title: 'Routing atomic swap' }
        : animationPhase === 'contract'
          ? { step: 3, title: 'Funding HTLC contracts' }
          : null;
    const step = phaseHeader ? Math.max(routeStep, phaseHeader.step) : routeStep;

    currentStep = Math.max(currentStep, step);
    if (stepEl) stepEl.textContent = `Step ${step} of 5 · Swap in progress`;
    if (titleEl) {
      titleEl.textContent =
        phaseHeader?.title ||
        (step <= 1
          ? 'Initiating'
          : step <= 2
            ? 'Establishing Tor circuits'
            : step === 3
              ? 'Funding HTLC contracts'
              : step === 4
                ? 'Routing atomic swap'
                : 'Finalizing swap');
    }
    if (progressEl) {
      progressEl.style.width = `${Math.min(100, step * 20)}%`;
    }
  }

  function updateHopStatus(hopIndex, statusText, color) {
    const normalizedStatus = String(statusText)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    progressAnimation?.setMakerStatus(hopIndex, normalizedStatus, color);
    updateStageFromRoute();
  }

  function updateMakerVisibility(makerIndex, visible) {
    progressAnimation?.setMakerVisible(makerIndex, visible);
  }

  function markAllMakersComplete({ final = false } = {}) {
    if (!final) {
      for (let i = 0; i < swapData.makers; i++) {
        updateMakerVisibility(i, true);
        updateHopStatus(i, 'Settling...', 'orange');
      }
      return;
    }

    progressAnimation?.setComplete();
    for (let i = 0; i < swapData.makers; i++) {
      updateMakerVisibility(i, true);
      updateHopStatus(i, 'Complete', 'green');
    }
  }

  function markContractsReceivedIfComplete() {
    if (contractDataReceivedMakers.size < swapData.makers) return;

    for (let i = 0; i < swapData.makers; i++) {
      updateMakerVisibility(i, true);
      updateHopStatus(i, 'Contracts received', 'green');
    }
  }

  function markAllMakersFailed() {
    progressAnimation?.setFailed();
    for (let i = 0; i < swapData.makers; i++) {
      updateMakerVisibility(i, true);
      updateHopStatus(i, 'Failed', 'orange');
    }
  }

  function updateYouSend(active) {
    progressAnimation?.setWalletActive(active);
  }

  function updateYouReceive(active) {
    progressAnimation?.setReceiverActive(active);
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

    const relevantModules = [
      'coinswap::taker::api',
      'coinswap::taker::taproot_swap',
      'coinswap::taker::taproot_verification',
      'coinswap::wallet::api',
      'coinswap::wallet::spend',
      'coinswap::wallet::swapcoin',
      'coinswap::wallet::report',
    ];
    if (!relevantModules.includes(module)) return;

    // Add raw message to log
    addLog(message, type);

    const makerIndexMatch = message.match(/maker\s+(\d+)/i);
    const makerIndex =
      makerIndexMatch && Number.isFinite(Number(makerIndexMatch[1]))
        ? Number(makerIndexMatch[1])
        : null;
    const connectingMakerMatch = message.match(
      /Connecting to maker\s+(\d+)\s+at\s+(\S+)/i
    );
    if (connectingMakerMatch) {
      setPendingMakerAddress(
        Number(connectingMakerMatch[1]),
        connectingMakerMatch[2]
      );
    }
    const substituteMakerMatch = message.match(
      /Substituting maker\s+(\d+)\s+with spare at\s+(\S+)/i
    );
    if (substituteMakerMatch) {
      setPendingMakerAddress(
        Number(substituteMakerMatch[1]),
        substituteMakerMatch[2]
      );
    }
    const selectedMakersMatch = message.match(/Selected\s+\d+\s+makers[^:]*:\s+(.+)$/i);
    if (selectedMakersMatch) {
      selectedMakersMatch[1]
        .split(/,\s*/)
        .forEach((entry) => {
          const match = entry.match(/#(\d+)\s+(\S+?\.onion)/i);
          if (!match) return;
          const makerIdx = Number(match[1]) - 1;
          setPendingMakerAddress(makerIdx, match[2]);
          revealMakerAddress(makerIdx, match[2]);
        });
    }

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
    // Taproot: "Broadcast contract tx: <txid>"
    else if (message.includes('Broadcast contract tx')) {
      const txMatch = message.match(/([a-f0-9]{64})/i);
      if (txMatch) {
        setTransactionTxid(0, txMatch[1]);
        updateHopStatus(0, 'Broadcasting...', 'orange');
        updateMakerVisibility(0, true);
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
          updateHopStatus(slot, 'Confirmed', 'green');

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
          updateHopStatus(slot, 'Confirmed', 'green');

          // ✅ When outgoing is confirmed, light up ALL makers and mark intermediate hops as "Processing"
          if (slot === 0) {
            // Light up all makers
            for (let i = 0; i < swapData.makers; i++) {
              updateMakerVisibility(i, true);
            }
            // Mark intermediate hops as processing (hops 1 to N-1)
            for (let i = 1; i < swapData.hops - 1; i++) {
              updateHopStatus(i, 'Processing...', 'blue');
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
    // V1: Maker responded during negotiation. Only now reveal the address.
    else if (
      makerIndex !== null &&
      (message.includes('Received offer from maker') ||
        (message.includes('Maker') && message.includes('accepted swap')) ||
        message.includes('Sending ProofOfFunding to maker') ||
        (message.includes('Maker') &&
          message.includes('processed successfully')))
    ) {
      revealMakerAddress(makerIndex);
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Connected', 'green');
    }
    // V2: "All makers have responded with their outgoing keys"
    else if (
      message.includes('All makers have responded with their outgoing keys')
    ) {
      // Mark all intermediate hops as "Keys received"
      for (let i = 1; i < swapData.hops - 1; i++) {
        updateHopStatus(i, 'Keys received', 'green');
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
        updateHopStatus(lastHop, 'Receiving...', 'blue');
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
        updateHopStatus(lastHop, 'Swept', 'green');
      }
    }
    // V1: "Swaps settled successfully"
    else if (message.includes('Swaps settled successfully')) {
      markAllMakersComplete();
    }
    // V2: "Taker sweep completed successfully"
    else if (message.includes('Taker sweep completed successfully')) {
      markAllMakersComplete();
      updateYouReceive(true);
    }
    // V2: "Successfully Completed Taproot Coinswap"
    else if (message.includes('Successfully Completed Taproot Coinswap')) {
      markAllMakersComplete();
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
        updateHopStatus(i, 'Key exchange...', 'yellow');
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
      revealMakerAddress(makerIndex);
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Contracting...', 'yellow');
    }
    // V2: "Received Taproot contract data from maker N"
    else if (
      makerIndex !== null &&
      message.includes('Received Taproot contract data from maker')
    ) {
      revealMakerAddress(makerIndex);
      updateMakerVisibility(makerIndex, true);
      contractDataReceivedMakers.add(makerIndex);
      updateHopStatus(makerIndex, 'Contract received', 'yellow');
      markContractsReceivedIfComplete();
    }
    // V2: "Verified Taproot contract data from maker N"
    else if (
      makerIndex !== null &&
      message.includes('Verified Taproot contract data from maker')
    ) {
      revealMakerAddress(makerIndex);
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Contract ready', 'green');
    }
    // V2: "Received private key from maker N"
    else if (
      makerIndex !== null &&
      message.includes('Received private key from maker')
    ) {
      revealMakerAddress(makerIndex);
      updateMakerVisibility(makerIndex, true);
      updateHopStatus(makerIndex, 'Key received', 'green');
    }
    // V2: "Sending privkey to maker N and awaiting response"
    else if (
      makerIndex !== null &&
      message.includes('Sending privkey to maker') &&
      message.includes('awaiting response')
    ) {
      revealMakerAddress(makerIndex);
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
    }
    // V2: "Sweeping N completed incoming swap coins"
    else if (
      message.includes('Sweeping') &&
      message.includes('completed incoming swap coins')
    ) {
      markAllMakersComplete();
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
      addLog(`Amount: ${formatSats(swapData.amount)}`, 'info');
      addLog(`Makers: ${swapData.makers}`, 'info');

      SwapStateManager.saveSwapProgress({
        currentStep: 1,
        startTime,
        logMessages,
        transactions: swapData.transactions,
        routeMakerAddresses,
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

        if (
          swap.nativeSwapId &&
          actualSwapConfig.nativeSwapId !== swap.nativeSwapId
        ) {
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
    <div class="bg-surface rounded-lg p-6 max-w-md mx-4 border border-red-500/30">
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
        
        <div class="bg-app-bg rounded p-3 mb-3">
          <p class="text-xs text-gray-400 mb-1">Error Details:</p>
          <p class="text-sm text-red-300 font-mono break-words">${errorMessage || 'Unknown error'}</p>
        </div>
        
        <div class="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-xs text-blue-300">
          <p class="font-semibold mb-1">${icons.shieldCheck(16, 'mr-2')} Your funds are protected</p>
          <p>Recovery process has started automatically. Check your wallet for returned funds.</p>
        </div>
      </div>
      
      <button id="modal-to-swap" class="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-lg transition-colors">
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
    markAllMakersComplete({ final: true });
    updateYouReceive(true);
    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
    const completeButton = content.querySelector('#complete-button');
    completeButton.hidden = false;
    completeButton.classList.remove('hidden');

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
    const targetAmount =
      backendReport.outgoing_amount ??
      backendReport.outgoingAmount ??
      getValue('target_amount', 'targetAmount', swapData.amount || 0);
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
      const fidelityTxid =
        info.fidelity_txid ??
        info.fidelityTxid ??
        info.fidelity_bond_txid ??
        info.fidelityBondTxid ??
        info.bond_txid ??
        info.bondTxid ??
        info.fidelity_transaction ??
        info.fidelityTransaction ??
        null;
      const feeTotal = baseFee + amountRelativeFee + timeRelativeFee;
      totalMakerFees += feeTotal;

      return {
        makerIndex: idx,
        makerAddress: makerAddresses[idx] || `maker${idx + 1}`,
        baseFee,
        amountRelativeFee,
        timeRelativeFee,
        totalFee: feeTotal,
        fidelityTxid,
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
    markAllMakersComplete({ final: true });
    updateYouReceive(true);
    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
    const completeButton = content.querySelector('#complete-button');
    completeButton.hidden = false;
    completeButton.classList.remove('hidden');

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
        <div class="bg-app-bg rounded p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-300 font-medium">Locking Funds</span>
            <span class="${outgoing.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">
              ${outgoing.status === 'confirmed' ? `${icons.check(14, 'mr-1')} Confirmed` : outgoing.txid ? 'Broadcasted' : 'Pending'}
            </span>
          </div>
          ${outgoing.txid ? `<div class="font-mono text-xs text-gray-400 break-all">${outgoing.txid}</div>` : '<div class="text-gray-500 text-xs">Waiting for broadcast...</div>'}
        </div>

        <div class="bg-app-bg rounded p-3">
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
          <div class="bg-app-bg rounded p-2 text-xs opacity-50">
            <div class="flex justify-between mb-1">
              <span class="text-gray-400">Hop ${index + 1}</span>
              <span class="text-gray-500">⏳</span>
            </div>
            <div class="font-mono text-gray-500">Waiting...</div>
          </div>
        `;
          }

          return `
        <div class="bg-app-bg rounded p-2 text-xs">
          <div class="flex justify-between mb-1">
            <span class="text-gray-400">Hop ${index + 1}</span>
            <span class="${tx.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">
              ${tx.status === 'confirmed' ? icons.check(14) : tx.status === 'broadcasting' ? icons.radio(14) : icons.hourglass(14)}
            </span>
          </div>
          <div class="font-mono text-gray-300">${tx.txid ? tx.txid.substring(0, 12) + '...' : 'Pending'}</div>
          <div class="text-gray-500 mt-1">
            ${tx.fee ? `Fee: ${tx.fee} 丰` : ''}
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
    return '<div id="swap-animation-root"></div>';
  }

  function updateYouSend(active) {
    progressAnimation?.setWalletActive(active);
  }

  function updateYouReceive(active) {
    progressAnimation?.setReceiverActive(active);
  }

  function updateHeaderState(state) {
    const titleEl = content.querySelector('#swap-page-title');
    const badgeEl = content.querySelector('#swap-page-badge');
    const badgeDotEl = content.querySelector('#swap-page-badge-dot');
    const badgeTextEl = content.querySelector('#swap-page-badge-text');

    if (!titleEl) return;

    if (state === 'completed') {
      titleEl.textContent = 'Swap Complete';
      const stepLabel = content.querySelector('#swap-step-label');
      const progressFill = content.querySelector('#swap-progress-fill');
      if (stepLabel) stepLabel.textContent = 'Step 5 of 5 · Swap complete';
      if (progressFill) progressFill.style.width = '100%';
      if (!badgeEl || !badgeDotEl || !badgeTextEl) return;
      badgeEl.className =
        'flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full';
      badgeDotEl.className = 'w-2 h-2 rounded-full bg-green-400';
      badgeTextEl.className = 'text-xs text-green-400 font-medium';
      badgeTextEl.textContent = 'Complete';
      return;
    }

    if (state === 'failed') {
      titleEl.textContent = 'Coinswap Failed';
      if (!badgeEl || !badgeDotEl || !badgeTextEl) return;
      badgeEl.className =
        'flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full';
      badgeDotEl.className = 'w-2 h-2 rounded-full bg-red-400';
      badgeTextEl.className = 'text-xs text-red-400 font-medium';
      badgeTextEl.textContent = 'Failed';
    }
  }

  content.innerHTML = `
    <div class="swap-progress-page">
      <header class="swap-progress-top">
        <button id="back-to-swap" class="swap-progress-back" title="Back to swap">${icons.refreshCw(16)}</button>
        <div>
          <span id="swap-step-label">Step 1 of 5 · Swap in progress</span>
          <h2 id="swap-page-title">Initiating</h2>
          <div class="swap-progress-bar"><i id="swap-progress-fill"></i></div>
          <p id="swap-status-text">Executing swap through ${swapData.makers} makers...</p>
        </div>
        <div class="swap-progress-actions">
          <button id="complete-button" class="hidden swap-complete-btn" hidden>View Swap Report</button>
        </div>
      </header>

      <section class="swap-route-stage">
        ${buildFlowDiagram()}
      </section>

      <section class="swap-progress-stats">
        <div><span>Amount</span><strong>${formatSats(swapData.amount)}</strong></div>
        <div><span>Hops</span><strong>${swapData.hops}</strong></div>
        <div><span>Fee</span><strong>${formatSats((actualSwapConfig.networkFeeRate || 2) * 225 * Math.max(1, swapData.hops))}</strong></div>
        <div><span>ETA</span><strong id="swap-eta">2m 40s</strong></div>
        <div class="hidden"><span>Elapsed</span><strong id="elapsed-time">0:00</strong></div>
      </section>

      <section class="swap-terminal is-collapsed" id="swap-log-panel">
        <button id="swap-log-toggle" class="swap-terminal-toggle" type="button" aria-expanded="false">
          <span>Swap log</span>
          <strong id="swap-log-count">${logMessages.length}</strong>
        </button>
        <div id="log-container" class="swap-terminal-body" hidden></div>
      </section>

      <div id="transaction-list" class="hidden"></div>
    </div>
  `;

  container.appendChild(content);

  progressAnimation = createSwapProgressAnimation(
    content.querySelector('#swap-animation-root'),
    {
      amount: swapData.amount,
      makers: swapData.makers,
      hops: swapData.hops,
      fee: (actualSwapConfig.networkFeeRate || 2) * 225 * Math.max(1, swapData.hops),
      makerAddresses: routeMakerAddresses,
    }
  );

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
  content.querySelector('#swap-log-toggle').addEventListener('click', () => {
    const panel = content.querySelector('#swap-log-panel');
    const body = content.querySelector('#log-container');
    const toggle = content.querySelector('#swap-log-toggle');
    const shouldExpand = body.hidden;

    body.hidden = !shouldExpand;
    toggle.setAttribute('aria-expanded', String(shouldExpand));
    panel.classList.toggle('is-collapsed', !shouldExpand);
  });

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
