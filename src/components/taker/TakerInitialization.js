export function TakerInitializationComponent(container, config, onInitialized) {
    const initDiv = document.createElement('div');
    initDiv.id = 'taker-initialization';
    initDiv.className = 'fixed inset-0 bg-[#0f1419] flex items-center justify-center z-50';

    initDiv.innerHTML = `
        <div class="bg-[#1a2332] rounded-lg max-w-md w-full mx-4 p-8">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-4xl">🔄</span>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Initializing Taker</h2>
                <p id="taker-status-text" class="text-gray-400 text-sm">Setting up coinswap functionality...</p>
            </div>

            <!-- Progress Steps -->
            <div class="mb-6">
                <div class="space-y-3">
                    <div id="step-tor" class="flex items-center space-x-3">
                        <div id="step-tor-icon" class="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                            <span class="text-xs text-white">1</span>
                        </div>
                        <span id="step-tor-text" class="text-gray-400 text-sm">Connecting to Tor network</span>
                    </div>
                    <div id="step-tracker" class="flex items-center space-x-3">
                        <div id="step-tracker-icon" class="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                            <span class="text-xs text-white">2</span>
                        </div>
                        <span id="step-tracker-text" class="text-gray-400 text-sm">Connecting to tracker</span>
                    </div>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="mb-6">
                <div class="bg-gray-700 rounded-full h-2">
                    <div id="progress-bar" class="bg-[#FF6B35] h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>
                <p id="progress-text" class="text-xs text-gray-400 mt-2 text-center">Initializing...</p>
            </div>

            <!-- Error Display (hidden by default) -->
            <div id="taker-error" class="hidden mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div class="flex items-start">
                    <span class="text-red-400 mr-2">⚠️</span>
                    <div>
                        <p class="text-sm font-medium text-red-400">Taker Initialization Failed</p>
                        <p id="error-message" class="text-xs text-red-300 mt-1"></p>
                    </div>
                </div>
                <div class="mt-3 space-y-2">
                    <button id="retry-taker" class="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                        Retry Initialization
                    </button>
                    <button id="skip-taker" class="w-full bg-[#242d3d] hover:bg-[#2d3748] text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm border border-gray-600">
                        Skip Taker Setup
                    </button>
                </div>
            </div>

            <!-- Manual Setup Option -->
            <div id="manual-setup" class="hidden mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p class="text-xs text-blue-400 mb-3">
                    💡 <strong>Manual Setup Required:</strong> Check Tor and tracker connectivity
                </p>
                <div class="bg-[#0f1419] rounded p-3 font-mono text-xs text-gray-300">
                    sudo systemctl start tor<br/>
                    curl --socks5-hostname 127.0.0.1:9050 http://tracker.onion:8080
                </div>
            </div>
        </div>
    `;

    container.appendChild(initDiv);

    // Update step status
    function updateStep(stepId, status, text = null) {
        const icon = document.getElementById(`${stepId}-icon`);
        const textEl = document.getElementById(`${stepId}-text`);

        // Add null checks
        if (!icon || !textEl) {
            console.warn(`Step element not found: ${stepId}`);
            return;
        }

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
                icon.innerHTML = '<span class="text-xs text-white">' + (stepId.includes('tor') ? '1' : '2') + '</span>';
                textEl.className = 'text-gray-400 text-sm';
        }
    }

    // Update progress
    function updateProgress(percent, text) {
        document.getElementById('progress-bar').style.width = percent + '%';
        document.getElementById('progress-text').textContent = text;
    }

    // Show error
    function showError(message, showManualSetup = false) {
        document.getElementById('taker-status-text').textContent = 'Initialization failed';
        document.getElementById('error-message').textContent = message;
        document.getElementById('taker-error').classList.remove('hidden');

        if (showManualSetup) {
            document.getElementById('manual-setup').classList.remove('hidden');
        }
    }

    // Show success and transition
    function showSuccess() {
        document.getElementById('taker-status-text').textContent = 'Taker ready for coinswaps!';
        updateProgress(100, 'Initialization complete');

        setTimeout(() => {
            initDiv.remove();
            if (onInitialized) onInitialized();
        }, 2000);
    }

    // Event handlers
    document.getElementById('retry-taker')?.addEventListener('click', () => {
        document.getElementById('taker-error').classList.add('hidden');
        document.getElementById('manual-setup').classList.add('hidden');
        startTakerInitialization();
    });

    document.getElementById('skip-taker')?.addEventListener('click', () => {
        initDiv.remove();
        if (onInitialized) onInitialized({ skipped: true });
    });

    // Main initialization logic
    async function startTakerInitialization() {
        try {
            // Step 1: Load TakerManager (no more NAPI imports!)
            updateStep('step-tor', 'active', 'Loading taker module...');
            updateProgress(25, 'Connecting to bridge server...');

            // Test bridge server connection
            const healthResponse = await fetch('http://localhost:3001/api/health');
            if (!healthResponse.ok) {
                throw new Error('Bridge server not running. Start: node server/index.js');
            }

            const health = await healthResponse.json();
            if (!health.napiLoaded) {
                throw new Error('coinswap-napi not loaded in bridge server');
            }

            // Import our TakerManager wrapper (which now uses HTTP)
            const { initializeTakerManager } = await import('../taker/TakerManager.js');

            updateStep('step-tor', 'active', 'Configuring taker...');
            updateProgress(50, 'Setting up taker configuration...');

            const takerManager = initializeTakerManager(config);

            // Step 2: Initialize taker via bridge
            updateStep('step-tor', 'active', 'Initializing taker...');
            updateProgress(75, 'Starting taker instance...');

            const result = await takerManager.initialize();

            if (!result.success) {
                throw new Error(result.error);
            }

            updateStep('step-tor', 'complete', 'Tor connection established');
            updateStep('step-tracker', 'complete', 'Tracker connected');

            showSuccess();

        } catch (error) {
            console.error('Taker initialization failed:', error);

            let errorMessage = error.message;
            let showManual = false;

            if (error.message.includes('Bridge server not running')) {
                errorMessage = 'Bridge server not running. Please start: node server/index.js';
                showManual = true;
            } else if (error.message.includes('fetch')) {
                errorMessage = 'Cannot connect to bridge server. Check if it\'s running on port 3001.';
                showManual = true;
            } else {
                errorMessage = `Initialization failed: ${error.message}`;
            }

            updateStep('step-tor', 'error');
            updateStep('step-tracker', 'error');
            showError(errorMessage, showManual);
        }
    }

    // Auto-start initialization
    setTimeout(startTakerInitialization, 1000);

    return initDiv;
}