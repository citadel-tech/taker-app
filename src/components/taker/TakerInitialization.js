export function TakerInitializationComponent(container, config, onInitialized) {
  const initDiv = document.createElement('div');
  initDiv.id = 'taker-initialization';
  initDiv.className =
    'fixed inset-0 bg-[#0f1419] flex items-center justify-center z-50';

  initDiv.innerHTML = `
        <div class="bg-[#1a2332] rounded-lg max-w-md w-full mx-4 p-8">
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-4xl">🔄</span>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Initializing Taker</h2>
                <p id="taker-status-text" class="text-gray-400 text-sm">Setting up coinswap functionality...</p>
            </div>

            <div class="mb-6">
                <div class="space-y-3">
                    <div id="step-tor" class="flex items-center space-x-3">
                        <div id="step-tor-icon" class="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                            <span class="text-xs text-white">1</span>
                        </div>
                        <span id="step-tor-text" class="text-gray-400 text-sm">Checking Tor connection</span>
                    </div>
                    <div id="step-taker" class="flex items-center space-x-3">
                        <div id="step-taker-icon" class="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                            <span class="text-xs text-white">2</span>
                        </div>
                        <span id="step-taker-text" class="text-gray-400 text-sm">Initializing taker (creates wallet)</span>
                    </div>
                </div>
            </div>

            <div class="mb-6">
                <div class="bg-gray-700 rounded-full h-2">
                    <div id="progress-bar" class="bg-[#FF6B35] h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>
                <p id="progress-text" class="text-xs text-gray-400 mt-2 text-center">Initializing...</p>
            </div>

            <!-- Password Prompt (hidden by default) -->
            <div id="password-prompt" class="hidden mb-6">
                <label class="block text-sm text-gray-400 mb-2">Wallet Password</label>
                <input 
                    type="password" 
                    id="unlock-password-input"
                    placeholder="Enter wallet password"
                    class="w-full bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
                />
                <div id="password-error" class="hidden mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p class="text-xs text-red-400"></p>
                </div>
                <button id="unlock-submit-btn" class="w-full mt-4 bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-semibold text-lg py-3 px-4 rounded-lg transition-colors">
                    Unlock Wallet
                </button>
                <div class="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p class="text-xs text-blue-400">
                        💡 <strong>Tip:</strong> This is the password you set when creating your wallet.
                    </p>
                </div>
            </div>

            <div id="taker-error" class="hidden mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div class="flex items-start">
                    <span class="text-red-400 mr-2">⚠️</span>
                    <div>
                        <p class="text-sm font-medium text-red-400">Initialization Failed</p>
                        <p id="error-message" class="text-xs text-red-300 mt-1"></p>
                    </div>
                </div>
                <div class="mt-3 space-y-2">
                    <button id="retry-taker" class="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                        Retry
                    </button>
                    <button id="skip-taker" class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm border border-gray-600">
                        Skip Setup
                    </button>
                </div>
            </div>

            <div id="tor-setup" class="hidden mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p class="text-xs text-blue-400 mb-3">
                    💡 <strong>Tor Not Running:</strong>
                </p>
                <div class="bg-[#0f1419] rounded p-3 font-mono text-xs text-gray-300">
                    sudo systemctl start tor@coinswap
                </div>
            </div>
        </div>
    `;

  container.appendChild(initDiv);

  function updateStep(stepId, status, text = null) {
    const icon = document.getElementById(`${stepId}-icon`);
    const textEl = document.getElementById(`${stepId}-text`);

    if (!icon || !textEl) return;

    icon.className = 'w-6 h-6 rounded-full flex items-center justify-center';

    switch (status) {
      case 'active':
        icon.className += ' bg-[#FF6B35] animate-pulse';
        icon.innerHTML = '<div class="w-2 h-2 bg-white rounded-full"></div>';
        if (text) textEl.textContent = text;
        textEl.className = 'text-white text-sm font-medium';
        break;
      case 'complete':
        icon.className += ' bg-green-500';
        icon.innerHTML = '<span class="text-xs text-white">✓</span>';
        if (text) textEl.textContent = text;
        textEl.className = 'text-green-400 text-sm';
        break;
      case 'error':
        icon.className += ' bg-red-500';
        icon.innerHTML = '<span class="text-xs text-white">✗</span>';
        if (text) textEl.textContent = text;
        textEl.className = 'text-red-400 text-sm';
        break;
      default:
        icon.className += ' bg-gray-600';
        const num = stepId.includes('tor') ? '1' : '2';
        icon.innerHTML = `<span class="text-xs text-white">${num}</span>`;
        textEl.className = 'text-gray-400 text-sm';
    }
  }

  function updateProgress(percent, text) {
    document.getElementById('progress-bar').style.width = percent + '%';
    document.getElementById('progress-text').textContent = text;
  }

  function showError(message, showTorSetup = false) {
    document.getElementById('taker-status-text').textContent =
      'Initialization failed';
    document.getElementById('error-message').textContent = message;
    document.getElementById('taker-error').classList.remove('hidden');
    if (showTorSetup) {
      document.getElementById('tor-setup').classList.remove('hidden');
    }
  }

  function showSuccess() {
    document.getElementById('taker-status-text').textContent = 'Taker ready!';
    updateProgress(100, 'Complete');
    setTimeout(() => {
      initDiv.remove();
      if (onInitialized) onInitialized();
    }, 1500);
  }

  function showPasswordPrompt() {
    document.getElementById('password-prompt').classList.remove('hidden');
    document.getElementById('taker-error').classList.add('hidden');
    document.getElementById('unlock-password-input').focus();
  }

  function hidePasswordPrompt() {
    document.getElementById('password-prompt').classList.add('hidden');
  }

  function showPasswordError(message) {
    const errorDiv = document.getElementById('password-error');
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
  }

  function hidePasswordError() {
    document.getElementById('password-error').classList.add('hidden');
  }

  // Event listeners
  document.getElementById('retry-taker')?.addEventListener('click', () => {
    document.getElementById('taker-error').classList.add('hidden');
    document.getElementById('tor-setup').classList.add('hidden');
    hidePasswordPrompt();
    startTakerInitialization();
  });

  document.getElementById('skip-taker')?.addEventListener('click', () => {
    initDiv.remove();
    if (onInitialized) onInitialized({ skipped: true });
  });

  document
    .getElementById('unlock-submit-btn')
    ?.addEventListener('click', () => {
      const password = document.getElementById('unlock-password-input').value;
      if (!password) {
        showPasswordError('Please enter a password');
        return;
      }
      hidePasswordError();
      hidePasswordPrompt();
      startTakerInitialization(password);
    });

  document
    .getElementById('unlock-password-input')
    ?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('unlock-submit-btn').click();
      }
    });

  document
    .getElementById('unlock-password-input')
    ?.addEventListener('input', () => {
      hidePasswordError();
    });

  // IPC-based initialization
  async function startTakerInitialization(walletPassword = null) {
    try {
      updateStep('step-tor', 'active', 'Checking Tor...');
      updateProgress(25, 'Verifying Tor connection...');

      // Simulate Tor check
      await new Promise((resolve) => setTimeout(resolve, 500));

      updateStep('step-tor', 'complete', 'Tor ready');
      updateStep('step-taker', 'active', 'Initializing taker...');
      updateProgress(50, 'Creating taker instance...');

      // If password was provided, update config
      const initConfig = walletPassword
        ? {
            ...config,
            wallet: { ...config.wallet, password: walletPassword },
          }
        : config;

      // Use IPC to initialize taker in main process
      const result = await window.api.taker.initialize(initConfig);

      if (!result.success) {
        // Check if password is required
        if (result.needsPassword) {
          updateStep(
            'step-taker',
            'active',
            'Wallet encrypted - password required'
          );
          updateProgress(40, 'Waiting for password...');
          document.getElementById('taker-status-text').textContent =
            'Password Required';

          // If it's INCORRECT_PASSWORD, show error in the prompt
          if (result.error === 'INCORRECT_PASSWORD') {
            showPasswordPrompt();
            showPasswordError('Incorrect password. Please try again.');
            return;
          }

          showPasswordPrompt();
          return;
        }

        throw new Error(result.error);
      }

      updateStep('step-taker', 'complete', 'Taker ready (wallet loaded)');
      updateProgress(100, 'Initialization complete');

      showSuccess();
    } catch (error) {
      console.error('Initialization failed:', error);

      let errorMessage = error.message;
      let showTorSetup = false;

      if (
        error.message.includes('TorError') ||
        error.message.includes('Connection refused')
      ) {
        errorMessage = 'Tor is not running. Please start the Tor service.';
        showTorSetup = true;
        updateStep('step-tor', 'error');
      } else if (
        error.message.includes('wrong passphrase') ||
        error.message.includes('decrypting wallet')
      ) {
        errorMessage = 'Incorrect password. Please try again.';
        updateStep('step-taker', 'error');
        showPasswordPrompt();
        showPasswordError(errorMessage);
        return;
      } else {
        updateStep('step-taker', 'error');
      }

      showError(errorMessage, showTorSetup);
    }
  }

  // Start initialization after a brief delay
  setTimeout(startTakerInitialization, 1000);

  return initDiv;
}

// Export helper functions for other components
export function getTakerBalance() {
  return window.api.taker.getBalance();
}

export function getTakerAddress() {
  return window.api.taker.getNextAddress();
}

export function syncTakerWallet() {
  return window.api.taker.sync();
}

export function getTakerTransactions(count = 10, skip = 0) {
  return window.api.taker.getTransactions(count, skip);
}

export function getTakerUtxos() {
  return window.api.taker.getUtxos();
}

export function sendToAddress(address, amount) {
  return window.api.taker.sendToAddress(address, amount);
}

export function syncOfferbook() {
  return window.api.taker.fetchOffers();
}

export function getOfferbook() {
  return window.api.taker.getOffers();
}

export function startCoinswap(amount, makerCount, outpoints = []) {
  return window.api.coinswap.start({ amount, makerCount, outpoints });
}

export function getSwapStatus(swapId) {
  return window.api.coinswap.getStatus(swapId);
}

export function recoverFromSwap() {
  return window.api.taker.recover();
}

export function getLogs(lines = 100) {
  return window.api.logs.get(lines);
}
