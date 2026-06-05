/**
 * Bitcoin Core Connection Status Component
 * Shows connection progress and status while connecting to bitcoind
 */
import { icons } from '../../js/icons.js';

export function ConnectionStatusComponent(container, onConnected) {
    const connectionDiv = document.createElement('div');
    connectionDiv.id = 'connection-status';
    connectionDiv.className = 'app-loader-screen';

    // Initial loading state
    connectionDiv.innerHTML = `
        <div class="app-loader-card">
            <div class="app-loader-head">
                <div class="app-loader-orb bitcoin">
                    <span>₿</span>
                </div>
                <span class="app-loader-kicker">Node connection</span>
                <h2>Connecting to Bitcoin Core</h2>
                <p id="connection-status-text">Initializing connection...</p>
            </div>

            <div class="app-loader-progress">
                <div class="app-loader-dots" aria-hidden="true">
                    <div id="dot-1" class="loader-dot"></div>
                    <div id="dot-2" class="loader-dot" style="animation-delay: 0.2s"></div>
                    <div id="dot-3" class="loader-dot" style="animation-delay: 0.4s"></div>
                </div>
                <div class="app-loader-progress-track">
                    <div id="progress-bar" class="app-loader-progress-fill" style="width: 0%"></div>
                </div>
                <p id="progress-text">Attempt 1 of 5</p>
            </div>

            <div id="connection-details" class="app-loader-details">
                <div class="app-loader-section-head">
                    <span>Connection details</span>
                    <strong id="connection-status-indicator" class="loader-status-value is-pending">Connecting</strong>
                </div>
                <div class="app-loader-detail-grid">
                    <div>
                        <span>Host</span>
                        <strong id="rpc-host">-</strong>
                    </div>
                    <div>
                        <span>Port</span>
                        <strong id="rpc-port">-</strong>
                    </div>
                    <div>
                        <span>Network</span>
                        <strong id="rpc-network">-</strong>
                    </div>
                </div>
            </div>

            <div id="connection-error" class="app-loader-message error hidden">
                <div>
                    ${icons.alertTriangle(18)}
                    <div>
                        <strong>Connection failed</strong>
                        <p id="error-message"></p>
                    </div>
                </div>
                <button id="retry-connection" class="app-loader-action danger">
                    Retry Connection
                </button>
                <button id="configure-rpc" class="app-loader-action secondary">
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
        document.getElementById('connection-status-indicator').className = 'loader-status-value is-error';
        document.getElementById('error-message').textContent = message;
        
        const errorDiv = document.getElementById('connection-error');
        errorDiv.classList.remove('hidden');
        
        if (!showRetryButton) {
            document.getElementById('retry-connection').style.display = 'none';
        }

        // Stop the pulse animation
        ['dot-1', 'dot-2', 'dot-3'].forEach(id => {
            const dot = document.getElementById(id);
            dot.classList.add('is-error');
        });
    }

    // Show success
    function showSuccess(info) {
        document.getElementById('connection-status-text').textContent = 'Successfully connected!';
        document.getElementById('connection-status-indicator').textContent = 'Connected';
        document.getElementById('connection-status-indicator').className = 'loader-status-value is-success';
        document.getElementById('rpc-network').textContent = info.chain || 'Unknown';
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('progress-text').textContent = 'Connection established';

        // Update dots to green
        ['dot-1', 'dot-2', 'dot-3'].forEach(id => {
            const dot = document.getElementById(id);
            dot.classList.add('is-success');
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
        document.getElementById('connection-status-indicator').className = 'loader-status-value is-pending';
        
        // Restart pulse animation
        ['dot-1', 'dot-2', 'dot-3'].forEach((id, index) => {
            const dot = document.getElementById(id);
            dot.className = 'loader-dot';
            dot.style.animationDelay = (index * 0.2) + 's';
        });

        // Trigger reconnection attempt
        startConnection();
    });

    document.getElementById('configure-rpc')?.addEventListener('click', () => {
        // Show RPC configuration (could open settings or setup modal)
        connectionDiv.remove();
        
        // Import and show setup modal
        import('../settings/FirstTimeSetup.js').then((module) => {
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
            if (result.alreadyConnected) {
                // Connection existed before our patch was in place — verify and proceed
                const check = await bitcoindConnection.testConnection();
                if (check.success) {
                    showSuccess(check.info);
                } else {
                    bitcoindConnection.disconnect();
                    startConnection(); // retry from scratch
                }
            } else if (!result.success) {
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
