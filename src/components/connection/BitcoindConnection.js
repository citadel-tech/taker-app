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
            const stored = localStorage.getItem('coinswap_config');
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
        
        if (!username || !password) {
            throw new Error('RPC username and password are required');
        }

        const url = `http://${host}:${port}`;
        const auth = btoa(`${username}:${password}`);
        
        const body = {
            jsonrpc: "1.0",
            id: Date.now(),
            method: method,
            params: params
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication failed - check RPC username/password');
                } else if (response.status === 404) {
                    throw new Error('Bitcoin Core RPC not found - is bitcoind running?');
                } else {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`);
            }

            return data.result;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Cannot connect to Bitcoin Core - make sure bitcoind is running and accessible');
            }
            throw error;
        }
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

    async getBalance() {
        if (!this.isConnected) {
            throw new Error('Not connected to Bitcoin Core');
        }
        return await this.makeRPCCall('getbalance');
    }

    async getNewAddress(label = '', type = 'bech32') {
        if (!this.isConnected) {
            throw new Error('Not connected to Bitcoin Core');
        }
        return await this.makeRPCCall('getnewaddress', [label, type]);
    }

    async getTransactions(count = 10) {
        if (!this.isConnected) {
            throw new Error('Not connected to Bitcoin Core');
        }
        return await this.makeRPCCall('listtransactions', ['*', count]);
    }

    async sendToAddress(address, amount, comment = '', commentTo = '') {
        if (!this.isConnected) {
            throw new Error('Not connected to Bitcoin Core');
        }
        return await this.makeRPCCall('sendtoaddress', [address, amount, comment, commentTo]);
    }

    async getBlockchainInfo() {
        if (!this.isConnected) {
            throw new Error('Not connected to Bitcoin Core');
        }
        return await this.makeRPCCall('getblockchaininfo');
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

// Utility functions
export async function ensureBitcoindConnection() {
    return await bitcoindConnection.connect();
}

export function getBitcoindConnection() {
    return bitcoindConnection;
}