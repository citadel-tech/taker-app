/**
 * Taker Manager using bridge server
 * Handles taker operations via HTTP bridge to coinswap-napi
 * Automatically sets up Bitcoin Core wallet during initialization
 */

const BRIDGE_URL = 'http://localhost:3001/api';

export class TakerManager {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }

    async callBridge(endpoint, data = null) {
        const response = await fetch(`${BRIDGE_URL}${endpoint}`, {
            method: data ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : null
        });
        return response.json();
    }

    // Create Bitcoin Core wallet via RPC during initialization
    async createBitcoinCoreWallet() {
        console.log('🔧 Setting up Bitcoin Core wallet...');
        
        const rpcConfig = {
            host: this.config.rpc?.host || '127.0.0.1',
            port: this.config.rpc?.port || 38332,
            username: this.config.rpc?.username || 'user',
            password: this.config.rpc?.password || 'password',
        };
        
        const auth = btoa(`${rpcConfig.username}:${rpcConfig.password}`);
        const rpcUrl = `http://${rpcConfig.host}:${rpcConfig.port}/`;
        
        try {
            // First check if wallet already exists
            console.log('🔍 Checking existing Bitcoin Core wallets...');
            const listResponse = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify({
                    jsonrpc: '1.0',
                    id: 'setup-check',
                    method: 'listwallets',
                    params: []
                })
            });
            
            const listResult = await listResponse.json();
            const existingWallets = listResult.result || [];
            
            console.log('📋 Existing wallets:', existingWallets);
            
            if (existingWallets.includes('taker-wallet')) {
                console.log('✅ taker-wallet already exists');
                return { created: false, message: 'Wallet already exists' };
            }
            
            // Create the wallet
            console.log('🔧 Creating taker-wallet in Bitcoin Core...');
            const createResponse = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify({
                    jsonrpc: '1.0',
                    id: 'setup-create',
                    method: 'createwallet',
                    params: ['taker-wallet', false, false, '', false, true, false]
                })
            });
            
            const createResult = await createResponse.json();
            
            if (createResult.error) {
                // If error is "already exists" or "Database already exists", try loading instead
                if (createResult.error.message?.includes('already exists') || 
                    createResult.error.message?.includes('Database already exists')) {
                    console.log('⚠️ Wallet database exists, trying to load instead...');
                    
                    // Try to load the existing wallet
                    const loadResponse = await fetch(rpcUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Basic ${auth}`
                        },
                        body: JSON.stringify({
                            jsonrpc: '1.0',
                            id: 'setup-load',
                            method: 'loadwallet',
                            params: ['taker-wallet']
                        })
                    });
                    
                    const loadResult = await loadResponse.json();
                    if (loadResult.error) {
                        throw new Error(`Failed to load existing wallet: ${loadResult.error.message}`);
                    } else {
                        console.log('✅ taker-wallet loaded successfully');
                        return { created: false, message: 'Wallet loaded successfully' };
                    }
                } else {
                    throw new Error(`Failed to create wallet: ${createResult.error.message}`);
                }
            } else {
                console.log('✅ taker-wallet created successfully');
                return { created: true, message: 'Wallet created successfully' };
            }
            
        } catch (error) {
            console.error('❌ Bitcoin Core wallet setup failed:', error.message);
            throw new Error(`Bitcoin Core wallet setup failed: ${error.message}`);
        }
    }

async initialize() {
    try {
        console.log('🚀 Initializing Taker automatically...');

        
        // Step 1: Create taker configuration
        console.log('📋 Configuring taker...');
        const takerConfig = {
            rpc: {
                host: this.config.rpc?.host || '127.0.0.1',
                port: this.config.rpc?.port || 38332,
                username: this.config.rpc?.username || 'user',
                password: this.config.rpc?.password || 'password',
            },
            tor: {
                control_port: this.config.taker?.control_port || 9053,
                socks_port: this.config.taker?.socks_port || 9052,
                auth_password: this.config.taker?.tor_auth_password || '',
            },
            tracker_address: this.config.taker?.tracker_address || '',
        };

        // Step 2: Initialize via bridge (let it handle everything)
        console.log('📋 Initializing taker via bridge...');
        const result = await this.callBridge('/taker/initialize', takerConfig);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        this.isInitialized = true;
        console.log('✅ Taker initialized successfully');
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Failed to initialize Taker:', error);
        return { 
            success: false, 
            error: error.message,
            details: error
        };
    }
}

    async fetchOffers() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }

        const result = await this.callBridge('/taker/offers');
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.offers;
    }

    async getBalance() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }

        const result = await this.callBridge('/taker/balance');
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.balance;
    }

    async doCoinswap(amount, targetAddress = null) {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }

        console.log(`🔄 Starting coinswap for ${amount} satoshis...`);
        const result = await this.callBridge('/taker/coinswap', { amount, targetAddress });
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        console.log('✅ Coinswap completed:', result.result);
        return result.result;
    }

    isReady() {
        return this.isInitialized;
    }

    getConfig() {
        return this.config;
    }
}

// Singleton instance for global access
let globalTakerManager = null;

export function getTakerManager() {
    return globalTakerManager;
}

export function initializeTakerManager(config) {
    if (!globalTakerManager) {
        globalTakerManager = new TakerManager(config);
    }
    return globalTakerManager;
}

export function shutdownTakerManager() {
    if (globalTakerManager) {
        globalTakerManager = null;
    }
}