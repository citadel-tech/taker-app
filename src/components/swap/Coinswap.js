import { SwapStateManager } from './SwapStateManager.js';
import { icons } from '../../js/icons.js';
import { formatSats } from '../../js/price.js';
import { createSwapProgressAnimation } from './SwapProgressAnimation.js';

export async function CoinswapComponent(container, swapConfig) {
  if (typeof window !== 'undefined' && window.__coinswapProgressCleanup) {
    window.__coinswapProgressCleanup();
  }

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
  const storedProgress = await SwapStateManager.getSwapProgress();

  let actualSwapConfig;
  let savedProgress = null;
  let shouldStartNew = true;

  let pollInterval = null;
  let logPollInterval = null;
  let cborPollInterval = null;
  let elapsedInterval = null;
  let lastLogLine = '';
  let processedLogs = new Set();
  let progressAnimation = null;

  function cleanupProgressScreen() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (logPollInterval) {
      clearInterval(logPollInterval);
      logPollInterval = null;
    }
    if (cborPollInterval) {
      clearInterval(cborPollInterval);
      cborPollInterval = null;
    }
    if (elapsedInterval) {
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    }
    if (
      typeof window !== 'undefined' &&
      window.__coinswapProgressCleanup === cleanupProgressScreen
    ) {
      window.__coinswapProgressCleanup = null;
    }
  }

  if (typeof window !== 'undefined') {
    window.__coinswapProgressCleanup = cleanupProgressScreen;
  }

  function progressBelongsToSwap(progress, swap) {
    if (!progress || !swap || !progress.swapId) return false;
    return (
      progress.swapId === swap.swapId || progress.swapId === swap.nativeSwapId
    );
  }

  if (
    existingSwap &&
    existingSwap.status === 'in_progress' &&
    progressBelongsToSwap(storedProgress, existingSwap)
  ) {
    actualSwapConfig = existingSwap;
    savedProgress = storedProgress;
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
  const pendingMakerAddresses = Array.from(
    { length: swapData.makers },
    () => null
  );
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
      swapId: actualSwapConfig.swapId,
      nativeSwapId: actualSwapConfig.nativeSwapId,
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
      if (
        text.includes('swap report') ||
        text.includes('generating swap report')
      ) {
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
    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const minutes = Math.floor(elapsed / 60);
    const hours = Math.floor(minutes / 60);
    const seconds = elapsed % 60;
    const timeEl = content.querySelector('#elapsed-time');
    if (timeEl) {
      timeEl.textContent =
        hours > 0
          ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          : `${minutes}:${String(seconds).padStart(2, '0')}`;
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
    const connecting = content.querySelectorAll(
      '.route-node.connecting'
    ).length;
    const animationPhase =
      content.querySelector('.swap-animation')?.dataset.phase;
    const stepEl = content.querySelector('#swap-step-label');
    const titleEl = content.querySelector('#swap-page-title');
    const progressEl = content.querySelector('#swap-progress-fill');
    const routeStatuses = Array.from(
      content.querySelectorAll('.route-node .route-status')
    ).map((node) => String(node.textContent || '').toLowerCase());
    const isSweeping = routeStatuses.some(
      (status) => /sweep|complete|settled/.test(status) || status === 'received'
    );
    const isKeyHandover = routeStatuses.some((status) =>
      /key|exchange|final|receiving/.test(status)
    );
    const routeStep = Math.min(
      4,
      Math.max(1, connected + (connecting > 0 ? 1 : 0))
    );
    const phaseHeader = isSweeping
      ? { step: 4, title: 'Sweeping the Contract' }
      : isKeyHandover
        ? { step: 3, title: 'Handing Over Key Materials' }
        : animationPhase === 'contract'
          ? { step: 2, title: 'Establishing Contract Txs' }
          : null;
    const step = phaseHeader
      ? Math.max(routeStep, phaseHeader.step)
      : routeStep;

    currentStep = Math.max(currentStep, step);
    if (stepEl) stepEl.textContent = `Step ${step} of 4 · Swap in progress`;
    if (titleEl) {
      titleEl.textContent =
        phaseHeader?.title ||
        (step <= 1
          ? 'Handshake'
          : step === 2
            ? 'Establishing Contract Txs'
            : step === 3
              ? 'Handing Over Key Materials'
              : 'Sweeping the Contract');
    }
    if (progressEl) {
      progressEl.style.width = `${Math.min(100, step * 25)}%`;
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
      updateHopStatus(i, 'Contract received', 'green');
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

  // Map per-maker CBOR flags (from buildMakerProgress) to a display label + color.
  function makerStatusFromCbor(p) {
    if (!p) return null;
    if (p.privkeyForwarded) return { label: 'Finalizing...', color: 'yellow' };
    if (p.privkeyReceived)  return { label: 'Key received', color: 'green' };
    if (p.swapcoinCreated)  return { label: 'Contract ready', color: 'green' };
    if (p.makerContractReceived) return { label: 'Contract received', color: 'yellow' };
    if (p.contractDataSent) return { label: 'Contracting...', color: 'yellow' };
    if (p.connected)        return { label: 'Connected', color: 'green' };
    if (p.negotiated)       return { label: 'Negotiated', color: 'yellow' };
    return null;
  }

  // Apply a live CBOR snapshot to the animation without touching log parsing.
  function applyProgressFromCbor(cbor) {
    if (!cbor || content.dataset.completed === 'true' || content.dataset.failed === 'true') return;

    const { phase, makers = [], outgoingContractTxids = [] } = cbor;

    // Activate wallet node as soon as the swap has moved past discovery
    if (phase && phase !== 'MakersDiscovered') {
      updateYouSend(true);
    }

    // Reveal maker addresses and status from CBOR flags
    makers.forEach((m, i) => {
      if (i >= swapData.makers) return;
      if (m.address) revealMakerAddress(i, m.address);
      const s = makerStatusFromCbor(m);
      if (s) {
        updateMakerVisibility(i, true);
        updateHopStatus(i, s.label, s.color);
      }
    });

    // Surface the outgoing contract txid once we have it
    if (outgoingContractTxids.length > 0 && !swapData.transactions[0]?.txid) {
      setTransactionTxid(0, outgoingContractTxids[0]);
    }

    // Phase-level overrides: receiver active when keys have been forwarded
    if (phase === 'PrivkeysForwarded') {
      updateYouReceive(true);
    }
  }

  // Start polling the CBOR tracker every 2s to drive the animation.
  // Called as soon as nativeSwapId is known (worker may set it seconds after start).
  function startCborTracking(nativeSwapId) {
    if (cborPollInterval) return;
    cborPollInterval = setInterval(async () => {
      try {
        const result = await window.api.taker.getSwapProgress(nativeSwapId);
        if (result.success && result.swap) applyProgressFromCbor(result.swap);
      } catch (err) {
        console.error('CBOR poll error:', err);
      }
    }, 2000);
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

  // Animation is now driven by CBOR polling (startCborTracking).
  // This function only feeds the log terminal panel.
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

    const type = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'info';
    addLog(message, type);
  }

  function startSwap() {
    if (shouldStartNew && currentStep === 0) {
      console.log('🚀 Starting REAL coinswap polling');

      const swapId = actualSwapConfig.swapId;
      if (!swapId) {
        addLog('Error: No swap ID found', 'error');
        return;
      }

      startTime = Date.now();
      actualSwapConfig.startTime = startTime;
      currentStep = 1;
      updateElapsedTime();
      addLog('Coinswap started...', 'info');
      addLog(`Swap ID: ${swapId}`, 'info');
      if (actualSwapConfig.nativeSwapId) {
        addLog(`Backend Swap ID: ${actualSwapConfig.nativeSwapId}`, 'info');
      }
      addLog(`Amount: ${formatSats(swapData.amount)}`, 'info');
      addLog(`Makers: ${swapData.makers}`, 'info');

      SwapStateManager.saveSwapProgress({
        swapId,
        nativeSwapId: actualSwapConfig.nativeSwapId,
        currentStep: 1,
        startTime,
        logMessages,
        transactions: swapData.transactions,
        routeMakerAddresses,
        status: 'in_progress',
      });

      if (window.appManager) window.appManager.startBackgroundSwapManager();
    }

    if (!elapsedInterval) {
      elapsedInterval = setInterval(updateElapsedTime, 1000);
    }
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
          startCborTracking(swap.nativeSwapId);
        }

        if (swap.status === 'prepared') {
          addLog('Swap prepared, starting execution...', 'info');
          return;
        }

        if (swap.status === 'completed') {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (logPollInterval) {
            clearInterval(logPollInterval);
            logPollInterval = null;
          }
          if (cborPollInterval) {
            clearInterval(cborPollInterval);
            cborPollInterval = null;
          }

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
          if (cborPollInterval) {
            clearInterval(cborPollInterval);
            cborPollInterval = null;
          }

          if (content.dataset.failed === 'true') return;
          content.dataset.failed = 'true';

          addLog('Swap failed: ' + swap.error, 'error');
          updateHeaderState('failed');
          markAllMakersFailed();

          await SwapStateManager.saveSwapProgress({
            ...(await SwapStateManager.getSwapProgress()),
            swapId,
            nativeSwapId: actualSwapConfig.nativeSwapId,
            status: 'failed',
            error: swap.error,
          });

          // Show failure modal
          showFailureModal(swap.error);

          // Trigger recovery
          triggerRecovery();
          cleanupProgressScreen();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }

  function showFailureModal(errorMessage) {
    const modal = document.createElement('div');
    modal.className = 'swap-failure-overlay';
    modal.innerHTML = `
    <section class="swap-failure-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-failure-title">
      <header class="swap-failure-head">
        <div class="swap-failure-icon">${icons.xCircle(18)}</div>
        <div>
          <h3 id="swap-failure-title">Swap failed</h3>
          <span>Recovery started</span>
        </div>
      </header>

      <p class="swap-failure-copy">
        The coinswap could not be completed. Your funds are safe and recovery has been initiated. Check your wallet for returned funds.
      </p>

      <div class="app-status-row ok swap-failure-status">
        <span class="indicator">${icons.shieldCheck(11)}</span>
        <span class="label">RECOVERY</span>
        <span class="message">Wallet recovery is running</span>
      </div>

      <div class="swap-failure-error">
        <span>Error details</span>
        <pre>${escapeHtml(errorMessage || 'Unknown error')}</pre>
      </div>

      <div class="swap-failure-actions">
        <button id="modal-to-swap" class="app-button primary" type="button">
        Back to Swap Page
        </button>
      </div>
    </section>
  `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-to-swap').addEventListener('click', () => {
      modal.remove();
      cleanupProgressScreen();

      SwapStateManager.clearSwapData()
        .then(() => import('./Swap.js'))
        .then((module) => {
          container.innerHTML = '';
          module.SwapComponent(container);
        })
        .catch((error) => {
          console.error('⚠️ Failed to reload swap flow:', error);
          alert(
            'Could not reload the swap page. Please restart the app and check recovery from your wallet.'
          );
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
    const completeButton = content.querySelector('#complete-button');
    completeButton.hidden = false;
    completeButton.classList.remove('hidden');

    const normalizedReport = transformSwapReport(report);
    const transformedReport = {
      ...report,
      ...normalizedReport,
      report: {
        ...(report?.report || report || {}),
        ...normalizedReport,
      },
    };
    transformedReport.protocol = swapProtocol;
    transformedReport.isTaproot = swapProtocol === 'Taproot';
    transformedReport.protocolVersion = swapProtocol === 'Taproot' ? 2 : 1;
    transformedReport.nativeSwapId =
      transformedReport.nativeSwapId || actualSwapConfig.nativeSwapId || null;
    transformedReport.appSwapId =
      transformedReport.appSwapId || actualSwapConfig.swapId || null;

    actualSwapConfig.swapReport = transformedReport;

    await SwapStateManager.saveSwapProgress({
      ...(await SwapStateManager.getSwapProgress()),
      swapId: actualSwapConfig.swapId,
      nativeSwapId: actualSwapConfig.nativeSwapId,
      status: 'completed',
      report: transformedReport,
    });

    await SwapStateManager.completeSwap(transformedReport);

    if (window.appManager) window.appManager.stopBackgroundSwapManager();
    cleanupProgressScreen();
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
    const completeButton = content.querySelector('#complete-button');
    completeButton.hidden = false;
    completeButton.classList.remove('hidden');

    const defaultReport = getDefaultReport();
    await SwapStateManager.completeSwap(defaultReport);
    actualSwapConfig.swapReport = defaultReport;

    if (window.appManager) window.appManager.stopBackgroundSwapManager();
    cleanupProgressScreen();
  }

  async function loadBestSwapReportForView() {
    const fallbackReport = actualSwapConfig.swapReport || getDefaultReport();
    const ids = [
      fallbackReport.swapId,
      fallbackReport.nativeSwapId,
      fallbackReport.appSwapId,
      actualSwapConfig.swapId,
      actualSwapConfig.nativeSwapId,
    ].filter(Boolean);

    for (const id of [...new Set(ids.map(String))]) {
      try {
        const result = await window.api.swapReports.get(id);
        if (!result.success || !result.report) continue;
        return {
          ...result.report,
          ...result.report.report,
          protocol: result.report.protocol ?? fallbackReport.protocol ?? 'v1',
          isTaproot:
            result.report.isTaproot ?? fallbackReport.isTaproot ?? false,
          protocolVersion:
            result.report.protocolVersion ??
            fallbackReport.protocolVersion ??
            1,
        };
      } catch (error) {
        console.warn('Full swap report lookup failed:', error);
      }
    }

    return fallbackReport;
  }

  function viewSwapReport() {
    import('./SwapReport.js').then(async (module) => {
      container.innerHTML = '';
      const report = await loadBestSwapReportForView();
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
      if (stepLabel) stepLabel.textContent = 'Step 4 of 4 · Swap complete';
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
          <span id="swap-step-label">Step 1 of 4 · Swap in progress</span>
          <h2 id="swap-page-title">Handshake</h2>
          <div class="swap-progress-bar"><i id="swap-progress-fill"></i></div>
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
        <div><span>Elapsed</span><strong id="elapsed-time">0:00</strong></div>
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
      fee:
        (actualSwapConfig.networkFeeRate || 2) *
        225 *
        Math.max(1, swapData.hops),
      makerAddresses: routeMakerAddresses,
    }
  );

  content.querySelector('#back-to-swap').addEventListener('click', () => {
    cleanupProgressScreen();
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
  updateElapsedTime();
  updateTxList();
  if (logMessages.length > 0) updateLogs();

  if (savedProgress && savedProgress.currentStep > 0) {
    if (!elapsedInterval) {
      elapsedInterval = setInterval(updateElapsedTime, 1000);
    }
    startPollingSwapStatus();
    startPollingLogs();
  } else if (shouldStartNew) {
    setTimeout(() => startSwap(), 500);
  }
}
