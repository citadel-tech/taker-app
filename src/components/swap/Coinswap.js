import { SwapStateManager, formatElapsedTime } from './SwapStateManager.js';

export function CoinswapComponent(container, swapConfig) {
  const content = document.createElement('div');
  content.id = 'coinswap-content';

  const existingSwap = SwapStateManager.getActiveSwap();
  const savedProgress = SwapStateManager.getSwapProgress();

  let actualSwapConfig;
  let shouldStartNew = true;
  
  if (existingSwap && existingSwap.status === 'in_progress' && savedProgress) {
    actualSwapConfig = existingSwap;
    shouldStartNew = false;
  } else {
    actualSwapConfig = swapConfig;
  }

  let currentStep = savedProgress ? savedProgress.currentStep || 0 : 0;
  let startTime = savedProgress ? savedProgress.startTime : (actualSwapConfig.startTime || Date.now());
  let logMessages = savedProgress ? savedProgress.logMessages || [] : [];

  const swapData = {
    amount: actualSwapConfig.amount,
    makers: actualSwapConfig.makers,
    hops: actualSwapConfig.hops,
    transactions: savedProgress?.transactions || [],
  };

  for (let i = 0; i < swapData.hops; i++) {
    swapData.transactions.push({
      id: `tx${i}`,
      txid: '',
      status: 'pending',
      confirmations: 0,
      timestamp: null,
      fee: Math.floor(Math.random() * 500) + 300,
      maker: i === 0 ? null : swapConfig.selectedMakers ? swapConfig.selectedMakers[i - 1].address : `maker${i}`,
      size: 250 + Math.floor(Math.random() * 100),
    });
  }

  const makerColors = ['#FF6B35', '#3B82F6', '#A855F7', '#06B6D4', '#10B981'];

  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    logMessages.unshift({ timestamp, message, type });
    if (logMessages.length > 50) logMessages.pop();
    const logContainer = content.querySelector('#log-container');
    if (logContainer) updateLogs();
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
    logContainer.innerHTML = logMessages.map(log => `
      <div class="text-xs font-mono mb-1">
        <span class="text-gray-500">[${log.timestamp}]</span>
        <span class="${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'}">${log.message}</span>
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

  function startSwap() {
    if (shouldStartNew && currentStep === 0) {
      currentStep = 1;
      addLog('Starting coinswap protocol...', 'info');
      addLog(`Swapping ${(swapData.amount / 100000000).toFixed(8)} BTC through ${swapData.makers} makers`, 'info');
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
    if (currentStep > 0 && currentStep <= swapData.hops) {
      processHop(currentStep - 1);
    }
  }

  function processHop(hopIndex) {
    if (hopIndex >= swapData.transactions.length) {
      completeSwap();
      return;
    }

    const tx = swapData.transactions[hopIndex];
    const hopNum = hopIndex + 1;

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
      addLog(`Hop ${hopNum}: Transaction broadcast ${tx.txid.substring(0, 16)}...`, 'success');
      if (tx.maker) addLog(`Hop ${hopNum}: Connected to maker ${tx.maker.substring(0, 20)}...`, 'info');
      updateUI();
      saveProgress();

      let confirmCount = 0;
      const confirmInterval = setInterval(() => {
        confirmCount++;
        tx.confirmations = confirmCount;
        addLog(`Hop ${hopNum}: Confirmation ${confirmCount}/3 received`, 'info');
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
    content.querySelector('#swap-status-text').className = 'text-2xl font-bold text-green-400';
    content.querySelector('#complete-button').classList.remove('hidden');
    SwapStateManager.completeSwap();
    if (window.appManager) window.appManager.stopBackgroundSwapManager();
  }

  function viewSwapReport() {
    import('./SwapReport.js').then((module) => {
      container.innerHTML = '';
      const mockReport = {
        swapId: actualSwapConfig.swapId || 'mock-' + Date.now(),
        swapDurationSeconds: (Date.now() - startTime) / 1000,
        targetAmount: swapData.amount,
        totalInputAmount: swapData.amount,
        totalOutputAmount: swapData.amount - 1000,
        makersCount: swapData.makers,
        makerAddresses: swapData.transactions.filter(tx => tx.maker).map(tx => tx.maker),
        totalFundingTxs: swapData.transactions.length,
        fundingTxidsByHop: swapData.transactions.map(tx => [tx.txid]),
        totalFee: 1000,
        totalMakerFees: 700,
        miningFee: 300,
        feePercentage: (1000 / swapData.amount) * 100,
        makerFeeInfo: swapData.transactions.filter(tx => tx.maker).map((tx, idx) => ({
          makerIndex: idx,
          makerAddress: tx.maker,
          baseFee: 100,
          amountRelativeFee: 200,
          timeRelativeFee: 100,
          totalFee: 400
        })),
        inputUtxos: [swapData.amount],
        outputRegularUtxos: [swapData.amount - 1000],
        outputSwapUtxos: []
      };
      module.SwapReportComponent(container, mockReport);
    });
  }

  function generateFakeTxid() {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  function updateUI() {
    // Update node boxes
    swapData.transactions.forEach((tx, index) => {
      const youSend = content.querySelector('#you-send');
      const youReceive = content.querySelector('#you-receive');
      const maker = content.querySelector(`#maker-${index + 1}`);
      const hop = content.querySelector(`#hop-${index}`);

      if (tx.status === 'broadcasting') {
        if (youSend) youSend.style.opacity = '1';
        if (maker) {
          maker.style.opacity = '0.7';
          maker.style.filter = 'blur(2px)';
        }
        if (hop) {
          hop.querySelector('.hop-status').textContent = 'Sending...';
          hop.querySelector('.hop-status').className = 'hop-status text-xs text-yellow-400 font-bold';
        }
      } else if (tx.status === 'confirming') {
        if (maker) {
          maker.style.opacity = '1';
          maker.style.filter = 'blur(0)';
        }
        if (hop) {
          hop.querySelector('.hop-status').textContent = '🔓 BREAKING LINK';
          hop.querySelector('.hop-status').className = 'hop-status text-xs text-orange-400 font-bold animate-pulse';
        }
      } else if (tx.status === 'confirmed') {
        if (maker) {
          maker.style.opacity = '1';
          maker.style.filter = 'blur(0)';
        }
        if (hop) {
          hop.querySelector('.hop-status').textContent = '✓ Link Broken';
          hop.querySelector('.hop-status').className = 'hop-status text-xs text-green-400 font-bold';
        }
        if (index === swapData.transactions.length - 1) {
          if (youReceive) youReceive.style.opacity = '1';
        }
      }
    });

    updateTxList();
  }

  function updateTxList() {
    const txList = content.querySelector('#transaction-list');
    if (!txList) return;

    const txHtml = swapData.transactions.filter(tx => tx.txid).map((tx, index) => `
      <div class="bg-[#0f1419] rounded p-2 text-xs">
        <div class="flex justify-between mb-1">
          <span class="text-gray-400">Hop ${index + 1}</span>
          <span class="${tx.status === 'confirmed' ? 'text-green-400' : 'text-yellow-400'}">
            ${tx.status === 'confirmed' ? '✓' : '⏳'}
          </span>
        </div>
        <div class="font-mono text-gray-300">${tx.txid.substring(0, 12)}...${tx.txid.substring(52)}</div>
        <div class="text-gray-500 mt-1">${tx.confirmations}/3 confirmations</div>
      </div>
    `).join('');

    txList.innerHTML = txHtml || '<p class="text-sm text-gray-500">Waiting for transactions...</p>';
  }

  function buildFlowDiagram() {
    return `
      <div class="flex items-center justify-center gap-4 px-8">
        <!-- You Send -->
        <div id="you-send" class="text-center transition-all" style="opacity: 0.5;">
          <div class="w-24 h-24 bg-[#FF6B35] rounded-xl flex items-center justify-center mb-2 shadow-lg">
            <span class="text-2xl text-white font-bold">You</span>
          </div>
          <div class="text-xs text-gray-400">Your Old Coins</div>
          <div class="text-xs font-mono text-white mt-1">${(swapData.amount / 100000000).toFixed(4)} BTC</div>
        </div>

        ${Array.from({ length: swapData.hops }, (_, i) => {
          const color = makerColors[i % makerColors.length];
          return `
            <!-- Arrow to Hop ${i + 1} -->
            <div class="flex items-center">
              <svg width="60" height="40" style="overflow: visible;">
                <defs>
                  <marker id="arrow-${i}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="${color}" />
                  </marker>
                </defs>
                <line x1="0" y1="20" x2="60" y2="20" stroke="${color}" stroke-width="2" marker-end="url(#arrow-${i})" opacity="0.5"/>
              </svg>
            </div>

            <!-- Hop ${i + 1} Status -->
            <div id="hop-${i}" class="flex flex-col items-center gap-2">
              <div class="text-center px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg min-w-[140px]">
                <div class="hop-status text-xs text-gray-500 font-bold">Pending...</div>
              </div>
              ${i < swapData.hops - 1 ? `
                <div id="maker-${i + 1}" class="text-center transition-all mt-2" style="opacity: 0.3; filter: blur(4px);">
                  <div class="w-20 h-20 rounded-lg flex items-center justify-center mb-1 shadow-lg" style="background: ${color};">
                    <span class="text-xl text-white font-bold">M${i + 1}</span>
                  </div>
                  <div class="text-xs text-gray-400">Maker ${i + 1}</div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}

        <!-- Final Arrow -->
        <div class="flex items-center">
          <svg width="60" height="40" style="overflow: visible;">
            <defs>
              <marker id="arrow-final" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#10B981" />
              </marker>
            </defs>
            <line x1="0" y1="20" x2="60" y2="20" stroke="#10B981" stroke-width="2" marker-end="url(#arrow-final)" opacity="0.5"/>
          </svg>
        </div>

        <!-- You Receive -->
        <div id="you-receive" class="text-center transition-all" style="opacity: 0.3;">
          <div class="w-24 h-24 bg-green-500 rounded-xl flex items-center justify-center mb-2 shadow-lg">
            <span class="text-2xl text-white font-bold">You</span>
          </div>
          <div class="text-xs text-gray-400">Your New Coins</div>
          <div class="text-xs font-mono text-white mt-1">${(swapData.amount / 100000000).toFixed(4)} BTC</div>
        </div>
      </div>

      <div class="text-center mt-6">
        <div class="inline-block bg-blue-500/10 border border-blue-500/30 rounded-lg px-6 py-2">
          <span class="text-blue-300 text-sm">Each hop breaks the transaction link between your old and new coins</span>
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

    <div class="bg-[#1a2332] rounded-lg p-8 mb-6">
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
      <div id="log-container" class="bg-[#0f1419] rounded p-3 h-32 overflow-y-auto font-mono text-xs"></div>
    </div>

    <button id="complete-button" class="hidden w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg">
      View Swap Report →
    </button>
  `;

  container.appendChild(content);

  content.querySelector('#back-to-swap').addEventListener('click', () => {
    import('./Swap.js').then(module => {
      container.innerHTML = '';
      module.SwapComponent(container);
    });
  });

  content.querySelector('#complete-button').addEventListener('click', viewSwapReport);

  if (logMessages.length > 0) updateLogs();

  if (savedProgress && savedProgress.currentStep > 0) {
    setInterval(updateElapsedTime, 1000);
    updateUI();
    if (currentStep <= swapData.hops) {
      setTimeout(() => processHop(currentStep - 1), 1000);
    }
  } else if (shouldStartNew) {
    setTimeout(() => startSwap(), 500);
  }
}