/**
 * Bitcoin Core Connection Status Component
 * Shows connection progress and status while connecting to bitcoind
 */
export function ConnectionStatusComponent(container, onConnected) {
    const connectionDiv = document.createElement('div');
    connectionDiv.id = 'connection-status';
    connectionDiv.className = 'fixed inset-0 bg-[#0f1419] flex items-center justify-center z-50';

    // Initial loading state
    connectionDiv.innerHTML = `
        <div class="bg-[#1a2332] rounded-lg max-w-md w-full mx-4 p-8">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-4xl">₿</span>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">Connecting to Bitcoin Core</h2>
                <p id="connection-status-text" class="text-gray-400 text-sm">Initializing connection...</p>
            </div>

            <!-- Progress Animation -->
            <div class="mb-6">
                <div class="flex justify-center mb-4">
                    <div class="flex space-x-2">
                        <div id="dot-1" class="w-3 h-3 bg-[#FF6B35] rounded-full animate-pulse"></div>
                        <div id="dot-2" class="w-3 h-3 bg-[#FF6B35]/50 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                        <div id="dot-3" class="w-3 h-3 bg-[#FF6B35]/30 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                    </div>
                </div>
                <div class="bg-gray-700 rounded-full h-2">
                    <div id="progress-bar" class="bg-[#FF6B35] h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>
                <p id="progress-text" class="text-xs text-gray-400 mt-2 text-center">Attempt 1 of 5</p>
            </div>

            <!-- Connection Details -->
            <div id="connection-details" class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
                <h4 class="text-white text-sm font-semibold mb-2">Connection Details:</h4>
                <div class="space-y-1 text-xs text-gray-400">
                    <div class="flex justify-between">
                        <span>Host:</span>
                        <span id="rpc-host">-</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Port:</span>
                        <span id="rpc-port">-</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Network:</span>
                        <span id="rpc-network">-</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Status:</span>
                        <span id="connection-status-indicator" class="text-yellow-400">Connecting...</span>
                    </div>
                </div>
            </div>

            <!-- Error Display (hidden by default) -->
            <div id="connection-error" class="hidden mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div class="flex items-start">
                    <span class="text-red-400 mr-2">⚠️</span>
                    <div>
                        <p class="text-sm font-medium text-red-400">Connection Failed</p>
                        <p id="error-message" class="text-xs text-red-300 mt-1"></p>
                    </div>
                </div>
                <button id="retry-connection" class="mt-3 w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                    Retry Connection
                </button>
                <button id="configure-rpc" class="mt-2 w-full bg-[#242d3d] hover:bg-[#2d3748] text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm border border-gray-600">
                    Configure RPC Settings
                </button>
            </div>
        </div>
    `;

    container.appendChild(connectionDiv);

    // Update connection details from config
    function updateConnectionDetails(config) {
        if (config && config.rpc) {
            document.getElementById('rpc-host').textContent = config.rpc.host || '127.0.0.1';
            document.getElementById('rpc-port').textContent = config.rpc.port || '38332';
        }
    }

    // Update status text
    function updateStatus(text, attempt = null, maxAttempts = null) {
        document.getElementById('connection-status-text').textContent = text;
        
        if (attempt !== null && maxAttempts !== null) {
            document.getElementById('progress-text').textContent = `Attempt ${attempt} of ${maxAttempts}`;
            const progressPercent = (attempt / maxAttempts) * 100;
            document.getElementById('progress-bar').style.width = progressPercent + '%';
        }
    }

    // Show error
    function showError(message, showRetryButton = true) {
        document.getElementById('connection-status-indicator').textContent = 'Failed';
        document.getElementById('connection-status-indicator').className = 'text-red-400';
        document.getElementById('error-message').textContent = message;
        
        const errorDiv = document.getElementById('connection-error');
        errorDiv.classList.remove('hidden');
        
        if (!showRetryButton) {
            document.getElementById('retry-connection').style.display = 'none';
        }

        // Stop the pulse animation
        ['dot-1', 'dot-2', 'dot-3'].forEach(id => {
            const dot = document.getElementById(id);
            dot.classList.remove('animate-pulse');
            dot.classList.add('bg-red-400');
        });
    }

    // Show success
    function showSuccess(info) {
        document.getElementById('connection-status-text').textContent = 'Successfully connected!';
        document.getElementById('connection-status-indicator').textContent = 'Connected';
        document.getElementById('connection-status-indicator').className = 'text-green-400';
        document.getElementById('rpc-network').textContent = info.chain || 'Unknown';
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('progress-text').textContent = 'Connection established';

        // Update dots to green
        ['dot-1', 'dot-2', 'dot-3'].forEach(id => {
            const dot = document.getElementById(id);
            dot.classList.remove('animate-pulse');
            dot.classList.add('bg-green-400');
        });

        // Auto-hide after a short delay
        setTimeout(() => {
            connectionDiv.remove();
            if (onConnected) onConnected(info);
        }, 1500);
    }

    // Event handlers
    document.getElementById('retry-connection')?.addEventListener('click', () => {
        document.getElementById('connection-error').classList.add('hidden');
        document.getElementById('connection-status-indicator').textContent = 'Connecting...';
        document.getElementById('connection-status-indicator').className = 'text-yellow-400';
        
        // Restart pulse animation
        ['dot-1', 'dot-2', 'dot-3'].forEach((id, index) => {
            const dot = document.getElementById(id);
            dot.className = `w-3 h-3 bg-[#FF6B35] rounded-full animate-pulse`;
            dot.style.animationDelay = (index * 0.2) + 's';
        });

        // Trigger reconnection attempt
        startConnection();
    });

    document.getElementById('configure-rpc')?.addEventListener('click', () => {
        // Show RPC configuration (could open settings or setup modal)
        connectionDiv.remove();
        
        // Import and show setup modal
        import('./FirstTimeSetup.js').then((module) => {
            module.FirstTimeSetupModal(document.body, (config) => {
                // After config is saved, restart the connection process
                location.reload(); // Simple approach - reload the page
            });
        });
    });

    // Connection logic
    async function startConnection() {
        const { bitcoindConnection } = await import('./BitcoindConnection.js');
        
        // Update details with current config
        updateConnectionDetails(bitcoindConnection.config);
        
        updateStatus('Attempting to connect...', 1, 5);
        
        // Hook into the connection attempts for progress updates
        const originalConnection = bitcoindConnection._performConnection;
        bitcoindConnection._performConnection = async function() {
            const maxAttempts = this.maxRetryAttempts;
            let currentAttempt = 0;
            
            while (currentAttempt < maxAttempts) {
                currentAttempt++;
                updateStatus(`Connecting to Bitcoin Core...`, currentAttempt, maxAttempts);
                
                try {
                    const result = await this.testConnection();
                    
                    if (result.success) {
                        this.isConnected = true;
                        this.retryAttempts = 0;
                        console.log('✅ Connected to Bitcoin Core:', result.info);
                        
                        showSuccess(result.info);
                        return { success: true, info: result.info };
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    console.warn(`❌ Connection attempt ${currentAttempt}/${maxAttempts} failed:`, error.message);
                    
                    if (currentAttempt >= maxAttempts) {
                        showError(error.message);
                        return { 
                            success: false, 
                            error: `Failed to connect after ${maxAttempts} attempts: ${error.message}`,
                            finalError: error.message
                        };
                    }
                    
                    updateStatus(`Retrying in ${Math.ceil(this.retryDelay/1000)} seconds...`, currentAttempt, maxAttempts);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    
                    // Exponential backoff with jitter
                    this.retryDelay = Math.min(this.retryDelay * 1.5 + Math.random() * 1000, 10000);
                }
            }
        };
        
        try {
            const result = await bitcoindConnection.connect();
            if (!result.success) {
                showError(result.finalError || result.error);
            }
        } catch (error) {
            showError(error.message);
        }
    }

    // Auto-start connection
    setTimeout(startConnection, 500); // Small delay to let UI render

    return connectionDiv;
}