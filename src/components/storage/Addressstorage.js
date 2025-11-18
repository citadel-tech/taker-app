// Address storage utility for tracking generated addresses locally
export const AddressStorage = {
  STORAGE_KEY: 'coinswap_addresses',
  
  // Get all stored addresses
  getAllAddresses() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load addresses from storage:', error);
      return [];
    }
  },
  
  // Save a new address
  saveAddress(address) {
    try {
      const addresses = this.getAllAddresses();
      
      // Check if address already exists
      const existing = addresses.find(a => a.address === address);
      if (existing) {
        // Update usage count and last used time
        existing.used++;
        existing.lastUsed = new Date().toISOString();
      } else {
        // Add new address
        addresses.push({
          address: address,
          type: this.detectAddressType(address),
          used: 0,
          received: 0,
          lastUsed: null,
          createdAt: new Date().toISOString(),
          status: addresses.length === 0 ? 'Current' : 'Unused'
        });
        
        // Update previous current address to used
        addresses.forEach(a => {
          if (a.status === 'Current' && a.address !== address) {
            a.status = 'Used';
          }
        });
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(addresses));
      return addresses;
    } catch (error) {
      console.error('Failed to save address:', error);
      return this.getAllAddresses();
    }
  },
  
  // Update address with transaction info
  updateAddressStats(address, amount, confirmations = 0) {
    try {
      const addresses = this.getAllAddresses();
      const addr = addresses.find(a => a.address === address);
      
      if (addr) {
        addr.received += amount;
        addr.used = addr.used || 1;
        addr.lastUsed = new Date().toISOString();
        addr.lastTxConfirmations = confirmations;
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(addresses));
      }
      
      return addresses;
    } catch (error) {
      console.error('Failed to update address stats:', error);
      return this.getAllAddresses();
    }
  },
  
  // Detect address type based on prefix
  detectAddressType(address) {
    if (!address) return 'Unknown';
    
    // Testnet/Signet addresses
    if (address.startsWith('tb1q')) {
      // Check length to distinguish between P2WPKH and P2WSH
      return address.length === 42 ? 'P2WPKH' : 'P2WSH';
    } else if (address.startsWith('tb1p')) {
      return 'P2TR';
    }
    
    // Mainnet addresses
    if (address.startsWith('bc1q')) {
      return address.length === 42 ? 'P2WPKH' : 'P2WSH';
    } else if (address.startsWith('bc1p')) {
      return 'P2TR';
    }
    
    // Legacy addresses
    if (address.startsWith('1')) return 'P2PKH';
    if (address.startsWith('3') || address.startsWith('2')) return 'P2SH';
    
    return 'Unknown';
  },
  
  // Get current (most recent unused) address
  getCurrentAddress() {
    const addresses = this.getAllAddresses();
    return addresses.find(a => a.status === 'Current') || addresses[addresses.length - 1];
  },
  
  // Get address statistics
  getStats() {
    const addresses = this.getAllAddresses();
    return {
      total: addresses.length,
      used: addresses.filter(a => a.used > 0).length,
      reused: addresses.filter(a => a.used > 1).length,
      totalReceived: addresses.reduce((sum, a) => sum + a.received, 0)
    };
  },
  
  // Format time for display
  formatLastUsed(isoString) {
    if (!isoString) return 'Never';
    
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
};