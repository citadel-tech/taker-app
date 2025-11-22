export function TakerInitializationComponent(container, config, onInitialized) {
    const initDiv = document.createElement('div');
    initDiv.id = 'taker-initialization';
    initDiv.className = 'fixed inset-0 bg-[#0f1419] flex items-center justify-center z-50';

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
                    <div id="step-bridge" class="flex items-center space-x-3">
                        <div id="step-bridge-icon" class="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                            <span class="text-xs text-white">1</span>
                        </div>
                        <span id="step-bridge-text" class="text-gray-400 text-sm">Connecting to bridge server</span>
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

            <div id="manual-setup" class="hidden mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p class="text-xs text-blue-400 mb-3">
                    💡 <strong>Bridge Server Not Running:</strong>
                </p>
                <div class="bg-[#0f1419] rounded p-3 font-mono text-xs text-gray-300">
                    cd server<br/>
                    node index.js
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
                const num = stepId.includes('bridge') ? '1' : '2';
                icon.innerHTML = `<span class="text-xs text-white">${num}</span>`;
                textEl.className = 'text-gray-400 text-sm';
        }
    }

    function updateProgress(percent, text) {
        document.getElementById('progress-bar').style.width = percent + '%';
        document.getElementById('progress-text').textContent = text;
    }

    function showError(message, showManualSetup = false) {
        document.getElementById('taker-status-text').textContent = 'Initialization failed';
        document.getElementById('error-message').textContent = message;
        document.getElementById('taker-error').classList.remove('hidden');
        if (showManualSetup) {
            document.getElementById('manual-setup').classList.remove('hidden');
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

    document.getElementById('retry-taker')?.addEventListener('click', () => {
        document.getElementById('taker-error').classList.add('hidden');
        document.getElementById('manual-setup').classList.add('hidden');
        startTakerInitialization();
    });

    document.getElementById('skip-taker')?.addEventListener('click', () => {
        initDiv.remove();
        if (onInitialized) onInitialized({ skipped: true });
    });

    async function startTakerInitialization() {
        try {
            updateStep('step-bridge', 'active', 'Connecting to bridge...');
            updateProgress(25, 'Checking bridge server...');

            const healthResponse = await fetch('http://localhost:3001/api/health');
            if (!healthResponse.ok) {
                throw new Error('Bridge server not running');
            }

            const health = await healthResponse.json();
            if (!health.napiLoaded) {
                throw new Error('coinswap-napi not loaded');
            }

            updateStep('step-bridge', 'complete', 'Bridge connected');
            updateStep('step-taker', 'active', 'Initializing taker...');
            updateProgress(60, 'Creating taker instance...');

            const { initializeTakerManager } = await import('./TakerManager.js');
            const takerManager = initializeTakerManager(config);

            const result = await takerManager.initialize();

            if (!result.success) {
                throw new Error(result.error);
            }

            updateStep('step-taker', 'complete', 'Taker ready (wallet created)');
            updateProgress(100, 'Initialization complete');

            showSuccess();

        } catch (error) {
            console.error('Initialization failed:', error);

            let errorMessage = error.message;
            let showManual = false;

            if (error.message.includes('Bridge server not running') || error.message.includes('fetch')) {
                errorMessage = 'Bridge server not running. Start with: node server/index.js';
                showManual = true;
            }

            updateStep('step-bridge', 'error');
            updateStep('step-taker', 'error');
            showError(errorMessage, showManual);
        }
    }

    setTimeout(startTakerInitialization, 1000);

    return initDiv;
}