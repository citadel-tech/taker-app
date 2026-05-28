import { icons } from '../../js/icons.js';

export function TakerInitializationComponent(container, config, onInitialized) {
  const initDiv = document.createElement('div');
  initDiv.id = 'taker-initialization';
  initDiv.className = 'app-loader-screen';

  initDiv.innerHTML = `
        <div class="app-loader-card">
            <div class="app-loader-head">
                <div class="app-loader-orb">
                    ${icons.loader(34)}
                </div>
                <span class="app-loader-kicker">Wallet runtime</span>
                <h2>Initializing Taker</h2>
                <p id="taker-status-text">Setting up coinswap functionality...</p>
            </div>

            <div class="app-loader-steps">
                <div id="step-tor" class="app-loader-step">
                    <div id="step-tor-icon" class="app-loader-step-icon">
                        <span>1</span>
                    </div>
                    <div>
                        <span>Network</span>
                        <strong id="step-tor-text">Checking Tor connection</strong>
                    </div>
                </div>
                <div id="step-taker" class="app-loader-step">
                    <div id="step-taker-icon" class="app-loader-step-icon">
                        <span>2</span>
                    </div>
                    <div>
                        <span>Wallet</span>
                        <strong id="step-taker-text">Initializing taker</strong>
                    </div>
                </div>
            </div>

            <div class="app-loader-progress">
                <div class="app-loader-progress-track">
                    <div id="progress-bar" class="app-loader-progress-fill" style="width: 0%"></div>
                </div>
                <p id="progress-text">Initializing...</p>
            </div>

            <div id="password-prompt" class="app-loader-form hidden">
                <label for="unlock-password-input">Wallet Password</label>
                <input 
                    type="password" 
                    id="unlock-password-input"
                    placeholder="Enter wallet password"
                />
                <div id="password-error" class="app-loader-message error compact hidden">
                    <p></p>
                </div>
                <button id="unlock-submit-btn" class="app-loader-action primary">
                    Unlock Wallet
                </button>
                <div class="app-loader-message info compact">
                    <div>
                        ${icons.lightbulb(17)}
                        <p>This is the password you set when creating your wallet.</p>
                    </div>
                </div>
            </div>

            <div id="taker-error" class="app-loader-message error hidden">
                <div>
                    ${icons.alertTriangle(18)}
                    <div>
                        <strong>Initialization failed</strong>
                        <p id="error-message"></p>
                    </div>
                </div>
                <div class="app-loader-actions">
                    <button id="retry-taker" class="app-loader-action danger">
                        Retry
                    </button>
                    <button id="skip-taker" class="app-loader-action secondary">
                        Skip Setup
                    </button>
                </div>
            </div>

            <div id="tor-setup" class="app-loader-message info hidden">
                <div>
                    ${icons.lightbulb(18)}
                    <div>
                        <strong>Tor not running</strong>
                        <p>Start the Coinswap Tor service and try again.</p>
                        <code>sudo systemctl start tor@coinswap</code>
                    </div>
                </div>
            </div>
        </div>
    `;

  container.appendChild(initDiv);

  function updateStep(stepId, status, text = null) {
    const icon = document.getElementById(`${stepId}-icon`);
    const textEl = document.getElementById(`${stepId}-text`);

    if (!icon || !textEl) return;

    icon.className = 'app-loader-step-icon';
    textEl.className = '';

    switch (status) {
      case 'active':
        icon.classList.add('is-active');
        icon.innerHTML = '<span></span>';
        if (text) textEl.textContent = text;
        textEl.classList.add('is-active');
        break;
      case 'complete':
        icon.classList.add('is-success');
        icon.innerHTML = `<span>${icons.check(13)}</span>`;
        if (text) textEl.textContent = text;
        textEl.classList.add('is-success');
        break;
      case 'error':
        icon.classList.add('is-error');
        icon.innerHTML = `<span>${icons.xCircle(13)}</span>`;
        if (text) textEl.textContent = text;
        textEl.classList.add('is-error');
        break;
      default:
        const num = stepId.includes('tor') ? '1' : stepId.includes('taker') ? '2' : '3';
        icon.innerHTML = `<span>${num}</span>`;
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

export function syncOfferbookAndWait() {
  return window.api.taker.syncOfferbookAndWait();
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

export function recoverActiveSwap() {
  return window.api.taker.recover();
}

export function getLogs(lines = 100) {
  return window.api.logs.get(lines);
}
