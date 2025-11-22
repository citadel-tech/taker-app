/**
 * Taker Manager using bridge server
 * Handles taker operations via HTTP bridge to coinswap-napi
 * Taker creates and manages wallet internally
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

    async initialize() {
        try {
            console.log('🚀 Initializing Taker...');

            const takerConfig = {
                rpc: {
                    host: this.config.rpc?.host || '127.0.0.1',
                    port: this.config.rpc?.port || 38332,
                    username: this.config.rpc?.username || 'user',
                    password: this.config.rpc?.password || 'password',
                },
                tor: {
                    control_port: this.config.tor?.control_port || null,
                    tor_auth_password: this.config.tor?.tor_auth_password || null,
                }
            };

            console.log('📋 Initializing taker via bridge...');
            const result = await this.callBridge('/taker/initialize', takerConfig);
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            this.isInitialized = true;
            console.log('✅ Taker initialized (wallet created internally)');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to initialize Taker:', error);
            return { 
                success: false, 
                error: error.message
            };
        }
    }

    async syncOfferbook() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/sync-offerbook', {});
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    }

    async fetchOffers() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/offers');
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.offerbook;
    }

    async getGoodMakers() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/good-makers');
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.makers;
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

    async getAddress() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/address', {});
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.address;
    }

    async syncWallet() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/sync', {});
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    }

    async getTransactions(count = 10, skip = 0) {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge(`/taker/transactions?count=${count}&skip=${skip}`);
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.transactions;
    }

    async getUtxos() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/utxos');
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.utxos;
    }

    async sendToAddress(address, amount) {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/send', { address, amount });
        if (!result.success) {
            throw new Error(result.error);
        }
        return result.txid;
    }

    async startCoinswap(amount, makerCount, outpoints = []) {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }

        console.log(`🔄 Starting coinswap: ${amount} sats, ${makerCount} makers`);
        const result = await this.callBridge('/taker/start-coinswap', { 
            amount, 
            makerCount, 
            outpoints 
        });
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        console.log('✅ Coinswap completed:', result.report);
        return result.report;
    }

    async recoverFromSwap() {
        if (!this.isInitialized) {
            throw new Error('Taker not initialized');
        }
        const result = await this.callBridge('/taker/recover', {});
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    }

    isReady() {
        return this.isInitialized;
    }

    getConfig() {
        return this.config;
    }
}

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