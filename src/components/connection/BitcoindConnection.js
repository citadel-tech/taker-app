import { makeRPCCall } from '../../js/openswapHelpers.js';

/**
 * Bitcoin Core RPC Connection Manager
 * Handles connection to bitcoind and manages connection state
 */
export class BitcoindConnection {
    constructor(config = null) {
        this.config = config || this.getStoredConfig();
        this.isConnected = false;
        this.connectionPromise = null;
        this.retryAttempts = 0;
        this.maxRetryAttempts = 5;
        this.retryDelay = 2000; // Start with 2 seconds
        
        // Default to signet port if not specified
        if (this.config && this.config.rpc && !this.config.rpc.port) {
            this.config.rpc.port = 38332; // Signet default
        }
    }

    getStoredConfig() {
        try {
            const stored = localStorage.getItem('openswap_config');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error reading stored config:', error);
            return null;
        }
    }

    async makeRPCCall(method, params = []) {
        if (!this.config || !this.config.rpc) {
            throw new Error('No RPC configuration found');
        }

        const { host = '127.0.0.1', port = 38332, username, password } = this.config.rpc;
        return makeRPCCall({ host, port, username, password }, method, params);
    }

    async testConnection() {
        try {
            const info = await this.makeRPCCall('getblockchaininfo');
            const networkInfo = await this.makeRPCCall('getnetworkinfo');
            
            return {
                success: true,
                info: {
                    chain: info.chain,
                    blocks: info.blocks,
                    version: networkInfo.version,
                    subversion: networkInfo.subversion
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async connect() {
        // If already connected, return immediately
        if (this.isConnected) {
            return { success: true, alreadyConnected: true };
        }

        // If connection is in progress, return the existing promise
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this._performConnection();
        const result = await this.connectionPromise;
        this.connectionPromise = null;
        
        return result;
    }

    async _performConnection() {
        console.log('🔌 Attempting to connect to Bitcoin Core...');
        
        while (this.retryAttempts < this.maxRetryAttempts) {
            try {
                const result = await this.testConnection();
                
                if (result.success) {
                    this.isConnected = true;
                    this.retryAttempts = 0;
                    console.log('✅ Connected to Bitcoin Core:', result.info);
                    
                    // Verify we're on the expected network (signet)
                    if (result.info.chain !== 'signet') {
                        console.warn('⚠️  Warning: Connected to', result.info.chain, 'network, expected signet');
                    }
                    
                    return { success: true, info: result.info };
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                this.retryAttempts++;
                console.warn(`❌ Connection attempt ${this.retryAttempts}/${this.maxRetryAttempts} failed:`, error.message);
                
                if (this.retryAttempts >= this.maxRetryAttempts) {
                    console.error('💀 Max retry attempts reached, connection failed');
                    return { 
                        success: false, 
                        error: `Failed to connect after ${this.maxRetryAttempts} attempts: ${error.message}`,
                        finalError: error.message
                    };
                }
                
                console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                
                // Exponential backoff with jitter
                this.retryDelay = Math.min(this.retryDelay * 1.5 + Math.random() * 1000, 10000);
            }
        }
    }

    disconnect() {
        this.isConnected = false;
        this.retryAttempts = 0;
        this.retryDelay = 2000;
        console.log('🔌 Disconnected from Bitcoin Core');
    }

    updateConfig(newConfig) {
        this.config = newConfig;
        this.disconnect(); // Force reconnection with new config
    }
}

// Global connection instance
export const bitcoindConnection = new BitcoindConnection();