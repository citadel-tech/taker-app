const STORAGE_KEY = 'coinswap_address_history';

export const AddressStorage = {
  // Get all stored addresses
  getAllAddresses() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading addresses from storage:', error);
      return [];
    }
  },

  // Save addresses to storage
  saveAddresses(addresses) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
    } catch (error) {
      console.error('Error saving addresses to storage:', error);
    }
  },


  // Add a new address
  addAddress(addressString, type = 'P2WPKH') {
    const addresses = this.getAllAddresses();
    
    // Check if address already exists
    const existing = addresses.find(a => a.address === addressString);
    if (existing) {
      console.log('Address already exists:', addressString);
      return existing;
    }

    const newAddress = {
      address: addressString,
      type: this.detectAddressType(addressString),
      createdAt: Date.now(),
      lastUsed: null,
      used: 0,
      received: 0,
      status: 'Unused',
      label: ''
    };

    addresses.unshift(newAddress); // Add to beginning (most recent first)
    this.saveAddresses(addresses);
    console.log('✅ Address saved to storage:', addressString);
    return newAddress;
  },

  // Detect address type from address string
  detectAddressType(address) {
    if (!address) return 'Unknown';
    
    // Mainnet
    if (address.startsWith('bc1q') && address.length === 42) return 'P2WPKH';
    if (address.startsWith('bc1q') && address.length === 62) return 'P2WSH';
    if (address.startsWith('bc1p')) return 'P2TR';
    if (address.startsWith('1')) return 'P2PKH';
    if (address.startsWith('3')) return 'P2SH';
    
    // Testnet/Signet
    if (address.startsWith('tb1q') && address.length === 42) return 'P2WPKH';
    if (address.startsWith('tb1q') && address.length === 62) return 'P2WSH';
    if (address.startsWith('tb1p')) return 'P2TR';
    if (address.startsWith('m') || address.startsWith('n')) return 'P2PKH';
    if (address.startsWith('2')) return 'P2SH';
    
    // Regtest
    if (address.startsWith('bcrt1q') && address.length === 44) return 'P2WPKH';
    if (address.startsWith('bcrt1q') && address.length === 64) return 'P2WSH';
    if (address.startsWith('bcrt1p')) return 'P2TR';
    
    return 'Unknown';
  },

  // Update address usage (called when address receives funds)
  markAddressUsed(addressString, amountReceived = 0) {
    const addresses = this.getAllAddresses();
    const index = addresses.findIndex(a => a.address === addressString);
    
    if (index !== -1) {
      addresses[index].used += 1;
      addresses[index].lastUsed = Date.now();
      addresses[index].received += amountReceived;
      addresses[index].status = 'Used';
      this.saveAddresses(addresses);
      console.log('✅ Address marked as used:', addressString);
    }
  },



// Update address with arbitrary data
updateAddress(addressString, updates) {
  const addresses = this.getAllAddresses();
  const index = addresses.findIndex(a => a.address === addressString);
  
  if (index !== -1) {
    addresses[index] = { ...addresses[index], ...updates };
    if (updates.used > 0) {
      addresses[index].status = updates.used > 1 ? 'Reused' : 'Used';
    }
    this.saveAddresses(addresses);
    console.log('✅ Address updated:', addressString);
  }
},

  // Get address by string
  getAddress(addressString) {
    const addresses = this.getAllAddresses();
    return addresses.find(a => a.address === addressString);
  },

  // Get most recent address
  getMostRecentAddress() {
    const addresses = this.getAllAddresses();
    return addresses.length > 0 ? addresses[0] : null;
  },

  // Get addresses by type
  getAddressesByType(type) {
    const addresses = this.getAllAddresses();
    return addresses.filter(a => a.type === type);
  },

  // Get unused addresses
  getUnusedAddresses() {
    const addresses = this.getAllAddresses();
    return addresses.filter(a => a.used === 0);
  },

  // Get used addresses
  getUsedAddresses() {
    const addresses = this.getAllAddresses();
    return addresses.filter(a => a.used > 0);
  },

  // Update address label
  setAddressLabel(addressString, label) {
    const addresses = this.getAllAddresses();
    const index = addresses.findIndex(a => a.address === addressString);
    
    if (index !== -1) {
      addresses[index].label = label;
      this.saveAddresses(addresses);
    }
  },

  // Get statistics
  getStats() {
    const addresses = this.getAllAddresses();
    const used = addresses.filter(a => a.used > 0).length;
    const unused = addresses.filter(a => a.used === 0).length;
    const totalReceived = addresses.reduce((sum, a) => sum + a.received, 0);
    const reused = addresses.filter(a => a.used > 1).length;

    return {
      total: addresses.length,
      used,
      unused,
      reused,
      totalReceived
    };
  },

  // Format last used time for display
  formatLastUsed(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  },

  // Clear all addresses (for debugging)
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ All addresses cleared from storage');
  },

  // Export addresses to JSON
  exportToJSON() {
    const addresses = this.getAllAddresses();
    return JSON.stringify(addresses, null, 2);
  },

  // Import addresses from JSON
  importFromJSON(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (Array.isArray(imported)) {
        const existing = this.getAllAddresses();
        const newAddresses = imported.filter(
          imp => !existing.find(ex => ex.address === imp.address)
        );
        const merged = [...newAddresses, ...existing];
        this.saveAddresses(merged);
        return { success: true, imported: newAddresses.length };
      }
      return { success: false, error: 'Invalid format' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};


export default AddressStorage;