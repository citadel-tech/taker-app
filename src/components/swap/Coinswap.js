import { SwapStateManager, formatElapsedTime } from './SwapStateManager.js';

export function CoinswapComponent(container, swapConfig) {
  const content = document.createElement('div');
  content.id = 'coinswap-content';

  // STATE
  let currentStep = 0;
  let startTime = swapConfig.startTime || Date.now();
  let logMessages = swapConfig.logMessages || [];
  
  // Restore progress from localStorage if available
  const savedProgress = SwapStateManager.getSwapProgress();
  if (savedProgress) {
    currentStep = savedProgress.currentStep || 0;
    startTime = savedProgress.startTime || startTime;
    logMessages = savedProgress.logMessages || [];
  }

  const swapData = {
    amount: swapConfig.amount,
    makers: swapConfig.makers,
    hops: swapConfig.hops,
    transactions: savedProgress?.transactions || [],
  };

  // Initialize transactions if not restored from saved state
  if (!savedProgress?.transactions || savedProgress.transactions.length === 0) {
    for (let i = 0; i < swapData.hops; i++) {
      swapData.transactions.push({
        id: `tx${i}`,
        txid: '',
        status: 'pending',
        confirmations: 0,
        timestamp: null,
        fee: Math.floor(Math.random() * 500) + 300,
        maker:
          i === 0
            ? null
            : swapConfig.selectedMakers
              ? swapConfig.selectedMakers[i - 1].address
              : `maker${i}`,
        size: 250 + Math.floor(Math.random() * 100),
      });
    }
  }

  const makerColors = ['#FF6B35', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];

  // FUNCTIONS

  function saveProgress() {
    const progressData = {
      currentStep,
      startTime,
      logMessages,
      transactions: swapData.transactions,
      lastUpdated: Date.now()
    };
    SwapStateManager.saveSwapProgress(progressData);
  }

  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    logMessages.unshift({ timestamp, message, type });
    if (logMessages.length > 50) logMessages.pop();

    const logContainer = content.querySelector('#log-container');
    if (logContainer) {
      updateLogs();
    }
    
    // Save progress whenever log is updated
    saveProgress();
  }

  function updateLogs() {
    const logContainer = content.querySelector('#log-container');
    logContainer.innerHTML = logMessages
      .map(
        (log) => `
            <div class="text-xs font-mono mb-1">
                <span class="text-gray-500">[${log.timestamp}]</span>
                <span class="${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'}">${log.message}</span>
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
    if (timeEl) {
      timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  function startSwap() {
    if (currentStep === 0) {
      currentStep = 1;
      addLog('Starting coinswap protocol...', 'info');
      addLog(
        `Swapping ${(swapData.amount / 100000000).toFixed(8)} BTC through ${swapData.makers} makers`,
        'info'
      );
      
      // Mark swap as in progress
      SwapStateManager.saveSwapProgress({
        currentStep: 1,
        startTime,
        logMessages,
        transactions: swapData.transactions,
        status: 'in_progress'
      });
    }
    
    setInterval(updateElapsedTime, 1000);
    processHop(currentStep - 1);
  }

  function processHop(hopIndex) {
    if (hopIndex >= swapData.transactions.length) {
      completeSwap();
      return;
    }

    const tx = swapData.transactions[hopIndex];
    const hopNum = hopIndex + 1;

    // Skip if this hop is already completed
    if (tx.status === 'confirmed') {
      currentStep++;
      saveProgress();
      setTimeout(() => processHop(hopIndex + 1), 100);
      return;
    }

    addLog(`Hop ${hopNum}/${swapData.hops}: Preparing transaction...`, 'info');

    tx.status = 'broadcasting';
    updateUI();
    saveProgress();

    setTimeout(() => {
      tx.txid = generateFakeTxid();
      tx.timestamp = Date.now();
      tx.status = 'confirming';
      addLog(
        `Hop ${hopNum}: Transaction broadcast ${tx.txid.substring(0, 16)}...`,
        'success'
      );
      if (tx.maker) {
        addLog(
          `Hop ${hopNum}: Connected to maker ${tx.maker.substring(0, 20)}...`,
          'info'
        );
      }
      updateUI();
      saveProgress();

      let confirmCount = 0;
      const confirmInterval = setInterval(() => {
        confirmCount++;
        tx.confirmations = confirmCount;
        addLog(
          `Hop ${hopNum}: Confirmation ${confirmCount}/3 received`,
          'info'
        );
        updateUI();
        saveProgress();

        if (confirmCount >= 3) {
          clearInterval(confirmInterval);
          tx.status = 'confirmed';
          addLog(`Hop ${hopNum}: Transaction confirmed!`, 'success');
          updateUI();
          saveProgress();

          setTimeout(() => {
            currentStep++;
            processHop(hopIndex + 1);
          }, 1000);
        }
      }, 2000);
    }, 1000);
  }

  function completeSwap() {
    addLog('All hops completed successfully!', 'success');
    addLog('Coinswap protocol finished. Funds received.', 'success');
    content.querySelector('#swap-status-text').textContent = 'Swap Complete!';
    content.querySelector('#swap-status-text').className =
      'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');
    
    // Mark swap as completed and clear saved state
    SwapStateManager.completeSwap();
  }

  function generateFakeTxid() {
    return Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  function updateUI() {
    swapData.transactions.forEach((tx, index) => {
      const arrow = content.querySelector(`#arrow-${index}`);
      const arrowFill = content.querySelector(`#arrow-fill-${index}`);
      const arrowHead = content.querySelector(`#arrow-head-${index}`);

      if (tx.status === 'pending') {
        arrow.style.opacity = '0.3';
        arrowFill.style.width = '0%';
        arrowHead.style.opacity = '0.3';
      } else if (tx.status === 'broadcasting') {
        arrow.style.opacity = '1';
        arrowFill.style.width = '30%';
        arrowHead.style.opacity = '0.5';
      } else if (tx.status === 'confirming') {
        arrow.style.opacity = '1';
        const progress = (tx.confirmations / 3) * 100;
        arrowFill.style.width = progress + '%';
        arrowHead.style.opacity = '0.7';
      } else if (tx.status === 'confirmed') {
        arrow.style.opacity = '1';
        arrowFill.style.width = '100%';
        arrowHead.style.opacity = '1';
      }
    });

    swapData.transactions.forEach((tx, index) => {
      const makerBox = content.querySelector(`#maker-${index + 1}`);
      if (!makerBox) return;

      if (tx.status === 'pending') {
        makerBox.style.filter = 'blur(8px)';
        makerBox.style.opacity = '0.3';
      } else if (tx.status === 'broadcasting' || tx.status === 'confirming') {
        makerBox.style.filter = 'blur(4px)';
        makerBox.style.opacity = '0.6';
      } else if (tx.status === 'confirmed') {
        makerBox.style.filter = 'blur(0)';
        makerBox.style.opacity = '1';
      }
    });

    swapData.transactions.forEach((tx, index) => {
      const statusEl = content.querySelector(`#tx-status-${index}`);
      const confsEl = content.querySelector(`#tx-confs-${index}`);

      if (tx.status === 'pending') {
        statusEl.textContent = 'Pending';
        statusEl.className = 'text-xs text-gray-500';
      } else if (tx.status === 'broadcasting') {
        statusEl.textContent = 'Broadcasting...';
        statusEl.className = 'text-xs text-yellow-400';
      } else if (tx.status === 'confirming') {
        statusEl.textContent = 'Confirming';
        statusEl.className = 'text-xs text-blue-400';
        confsEl.textContent = `${tx.confirmations}/3 confirmations`;
      } else if (tx.status === 'confirmed') {
        statusEl.textContent = 'Confirmed ✓';
        statusEl.className = 'text-xs text-green-400';
        confsEl.textContent = `${tx.confirmations} confirmations`;
      }
    });

    updateTxList();
  }

  function updateTxList() {
    const txList = content.querySelector('#transaction-list');
    if (!txList) return;

    const txHtml = swapData.transactions
      .filter((tx) => tx.txid)
      .map(
        (tx, index) => `
                <div class="bg-[#0f1419] rounded-lg p-3 hover:bg-[#242d3d] transition-colors cursor-pointer tx-item" data-tx-index="${index}">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="text-xs text-gray-400">Hop ${index + 1}</p>
                            <p class="font-mono text-xs text-white">${tx.txid.substring(0, 16)}...</p>
                        </div>
                        <span class="text-xs px-2 py-1 rounded ${tx.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">
                            ${tx.status === 'confirmed' ? 'Confirmed' : 'Confirming'}
                        </span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-500">Fee: ${tx.fee} sats</span>
                        <span class="text-gray-500">Size: ${tx.size} vB</span>
                        <span class="text-gray-500">${tx.confirmations} confs</span>
                    </div>
                </div>
            `
      )
      .join('');

    if (txHtml) {
      txList.innerHTML = txHtml;

      // Add click handlers
      txList.querySelectorAll('.tx-item').forEach((el) => {
        el.addEventListener('click', () => {
          const index = parseInt(el.dataset.txIndex);
          showTxDetails(index);
        });
      });
    }
  }

  function showTxDetails(index) {
    const tx = swapData.transactions[index];
    if (!tx.txid) {
      alert('Transaction not yet broadcast');
      return;
    }

    const modal = content.querySelector('#tx-modal');
    const modalContent = content.querySelector('#modal-content');

    const timeSince = tx.timestamp
      ? Math.floor((Date.now() - tx.timestamp) / 1000)
      : 0;
    const minutes = Math.floor(timeSince / 60);
    const seconds = timeSince % 60;

    modalContent.innerHTML = `
            <div class="bg-[#1a2332] rounded-lg p-6 max-w-2xl w-full">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold text-white">Transaction Details - Hop ${index + 1}</h3>
                    <button id="close-modal" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <p class="text-sm text-gray-400 mb-1">Transaction ID</p>
                        <div class="bg-[#0f1419] rounded p-2">
                            <p class="font-mono text-xs text-white break-all">${tx.txid}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Status</p>
                            <p class="text-sm font-semibold ${tx.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">${tx.status === 'confirmed' ? 'Confirmed' : 'Confirming'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Confirmations</p>
                            <p class="text-sm font-semibold text-white">${tx.confirmations}/3</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Time Ago</p>
                            <p class="text-sm font-semibold text-white">${minutes}m ${seconds}s</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Network Fee</p>
                            <p class="font-mono text-sm text-yellow-400">${tx.fee} sats</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400 mb-1">Size</p>
                            <p class="text-sm text-white">${tx.size} vBytes</p>
                        </div>
                    </div>
                    
                    <div>
                        <p class="text-sm text-gray-400 mb-1">Amount</p>
                        <p class="font-mono text-lg text-white">${(swapData.amount / 100000000).toFixed(8)} BTC</p>
                        <p class="text-xs text-gray-500">${swapData.amount.toLocaleString()} sats</p>
                    </div>
                    
                    ${
                      tx.maker
                        ? `
                    <div>
                        <p class="text-sm text-gray-400 mb-1">Maker Address</p>
                        <div class="bg-[#0f1419] rounded p-2">
                            <p class="font-mono text-xs text-white break-all">${tx.maker}</p>
                        </div>
                    </div>
                    `
                        : `
                    <div>
                        <p class="text-sm text-gray-400 mb-1">Transaction Type</p>
                        <p class="text-sm text-white">Initial funding transaction (Taker → Maker 1)</p>
                    </div>
                    `
                    }
                    
                    <button id="view-explorer" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold py-3 rounded-lg transition-colors">
                        View in Mempool.space →
                    </button>
                </div>
            </div>
        `;

    modal.classList.remove('hidden');

    content.querySelector('#close-modal').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    content.querySelector('#view-explorer').addEventListener('click', () => {
      if (typeof require !== 'undefined') {
        const { shell } = require('electron');
        shell.openExternal(`https://mempool.space/tx/${tx.txid}`);
      } else {
        window.open(`https://mempool.space/tx/${tx.txid}`, '_blank');
      }
    });
  }

  function buildFlowDiagram() {
    let html = '<div class="flex items-center justify-between relative">';

    html += `
            <div class="flex flex-col items-center" style="flex: 0 0 120px;">
                <div class="w-24 h-24 bg-[#FF6B35] rounded-lg flex items-center justify-center mb-2">
                    <span class="text-2xl text-white font-bold">You</span>
                </div>
                <p class="text-xs text-gray-400 text-center">Taker</p>
                <p class="text-xs font-mono text-white mt-1">${(swapData.amount / 100000000).toFixed(4)} BTC</p>
            </div>
        `;

    for (let i = 0; i < swapData.hops; i++) {
      const color = makerColors[i % makerColors.length];

      html += `
                <div id="arrow-${i}" class="flex-1 relative h-2 mx-4 cursor-pointer hover:h-3 transition-all" style="opacity: 0.3;">
                    <div class="absolute inset-0 bg-gray-700 rounded"></div>
                    <div id="arrow-fill-${i}" class="absolute inset-0 rounded transition-all duration-1000" style="width: 0%; background-color: ${color};"></div>
                    <div id="arrow-head-${i}" class="absolute right-0 top-1/2 -translate-y-1/2 transition-opacity" style="opacity: 0.3; width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 8px solid ${color};"></div>
                    <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-center">
                        <div id="tx-status-${i}" class="text-xs text-gray-500">Pending</div>
                        <div id="tx-confs-${i}" class="text-xs text-gray-500"></div>
                    </div>
                </div>
            `;

      if (i < swapData.hops - 1) {
        html += `
                    <div id="maker-${i + 1}" class="flex flex-col items-center transition-all duration-500" style="flex: 0 0 120px; filter: blur(8px); opacity: 0.3;">
                        <div class="w-24 h-24 rounded-lg flex items-center justify-center mb-2" style="background-color: ${color};">
                            <span class="text-2xl text-white font-bold">M${i + 1}</span>
                        </div>
                        <p class="text-xs text-gray-400 text-center">Maker ${i + 1}</p>
                        <p class="text-xs font-mono text-white mt-1">${swapData.transactions[i + 1]?.maker?.substring(0, 6) || 'maker'}...</p>
                    </div>
                `;
      }
    }

    html += `
            <div class="flex flex-col items-center" style="flex: 0 0 120px;">
                <div class="w-24 h-24 bg-green-500 rounded-lg flex items-center justify-center mb-2">
                    <span class="text-2xl text-white font-bold">You</span>
                </div>
                <p class="text-xs text-gray-400 text-center">Taker</p>
                <p class="text-xs font-mono text-white mt-1">${(swapData.amount / 100000000).toFixed(4)} BTC</p>
            </div>
        `;

    html += '</div>';
    return html;
  }

  // UI

  content.innerHTML = `
        <div class="mb-6">
            <button id="back-to-swap" class="text-gray-400 hover:text-white transition-colors mb-4">
                ← Back to Configuration
            </button>
            <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap in Progress</h2>
            <p id="swap-status-text" class="text-gray-400 text-xl">Executing swap through ${swapData.makers} makers...</p>
            ${savedProgress ? `<p class="text-blue-400 text-sm mt-2">⚡ Restored from saved progress (${formatElapsedTime(Date.now() - savedProgress.startTime)} ago)</p>` : ''}
        </div>

        <!-- Flow Diagram -->
        <div class="bg-[#1a2332] rounded-lg p-8 mb-6">
            ${buildFlowDiagram()}
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-3 gap-6 mb-6">
            <!-- Left: Swap Progress -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-4">Swap Progress</h3>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-400">Amount</span>
                        <span class="text-sm font-mono text-white">${(swapData.amount / 100000000).toFixed(8)} BTC</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-400">Makers</span>
                        <span class="text-sm text-white">${swapData.makers}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-400">Hops</span>
                        <span class="text-sm text-cyan-400">${swapData.hops}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-400">Elapsed Time</span>
                        <span id="elapsed-time" class="text-sm text-yellow-400">0:00</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-gray-400">Est. Total Time</span>
                        <span class="text-sm text-gray-400">${swapData.hops * 5} min</span>
                    </div>
                </div>
            </div>

            <!-- Middle: Transaction List -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-4">Transactions</h3>
                <div id="transaction-list" class="space-y-2 max-h-64 overflow-y-auto">
                    <p class="text-sm text-gray-500">Waiting for transactions...</p>
                </div>
            </div>

            <!-- Right: Status Messages -->
            <div class="bg-[#1a2332] rounded-lg p-6">
                <h3 class="text-xl font-semibold text-gray-300 mb-4">Status</h3>
                <div class="space-y-3 mb-4">
                    <div class="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p class="text-sm text-blue-400">
                            ℹ Do not close this window
                        </p>
                    </div>
                    <div class="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p class="text-sm text-purple-400">
                            🔒 Funds protected by HTLCs
                        </p>
                    </div>
                    ${savedProgress ? `
                    <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p class="text-sm text-green-400">
                            💾 Progress automatically saved
                        </p>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <!-- Live Log -->
        <div class="bg-[#1a2332] rounded-lg p-6">
            <h3 class="text-xl font-semibold text-gray-300 mb-4">Live Activity Log</h3>
            <div id="log-container" class="bg-[#0f1419] rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
                <p class="text-gray-500 text-xs">Initializing...</p>
            </div>
        </div>

        <!-- Complete Button -->
        <button id="complete-button" class="hidden w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg transition-colors text-lg">
            View Swap Report →
        </button>

        <!-- Transaction Modal -->
        <div id="tx-modal" class="hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div id="modal-content"></div>
        </div>
    `;

  container.appendChild(content);

  // EVENT LISTENERS

  content.querySelector('#back-to-swap').addEventListener('click', () => {
    // Save current progress before navigating away
    saveProgress();
    import('./Swap.js').then((module) => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  for (let i = 0; i < swapData.hops; i++) {
    content
      .querySelector(`#arrow-${i}`)
      .addEventListener('click', () => showTxDetails(i));
  }

  // Initialize logs if restored
  if (logMessages.length > 0) {
    updateLogs();
  }

  // Auto-start or continue the swap process
  if (savedProgress && savedProgress.currentStep > 0) {
    setInterval(updateElapsedTime, 1000);
    updateUI();
    // Continue from where we left off
    if (currentStep <= swapData.hops) {
      setTimeout(() => processHop(currentStep - 1), 1000);
    }
  } else {
    setTimeout(() => startSwap(), 500);
  }
}