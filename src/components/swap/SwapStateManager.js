// SwapStateManager - Handles all swap state persistence to localStorage

const STORAGE_KEYS = {
  ACTIVE_SWAP: 'coinswap_active_swap',
  SWAP_PROGRESS: 'coinswap_swap_progress', 
  USER_SELECTIONS: 'coinswap_user_selections'
};

export const SwapStateManager = {
  // Swap Configuration Management
  saveSwapConfig(swapConfig) {
    const swapData = {
      ...swapConfig,
      status: 'configured',
      createdAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SWAP, JSON.stringify(swapData));
    console.log('Swap config saved:', swapData);
  },

  getActiveSwap() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SWAP);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting active swap:', error);
      return null;
    }
  },

  hasActiveSwap() {
    const activeSwap = this.getActiveSwap();
    return activeSwap && (activeSwap.status === 'in_progress' || activeSwap.status === 'configured');
  },

  // Swap Progress Management
  saveSwapProgress(progressData) {
    localStorage.setItem(STORAGE_KEYS.SWAP_PROGRESS, JSON.stringify(progressData));
    console.log('Swap progress saved:', progressData);
    
    // Also update the active swap status
    const activeSwap = this.getActiveSwap();
    if (activeSwap) {
      activeSwap.status = progressData.status || 'in_progress';
      activeSwap.currentStep = progressData.currentStep;
      activeSwap.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SWAP, JSON.stringify(activeSwap));
    }
  },

  getSwapProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SWAP_PROGRESS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting swap progress:', error);
      return null;
    }
  },

  // User Selections Management
  saveUserSelections(selections) {
    localStorage.setItem(STORAGE_KEYS.USER_SELECTIONS, JSON.stringify(selections));
    console.log('User selections saved:', selections);
  },

  getUserSelections() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_SELECTIONS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting user selections:', error);
      return null;
    }
  },

  clearUserSelections() {
    localStorage.removeItem(STORAGE_KEYS.USER_SELECTIONS);
    console.log('User selections cleared');
  },

  // Swap Completion
  completeSwap() {
    const activeSwap = this.getActiveSwap();
    if (activeSwap) {
      activeSwap.status = 'completed';
      activeSwap.completedAt = Date.now();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SWAP, JSON.stringify(activeSwap));
    }
    
    // Clear progress data but keep active swap for history
    localStorage.removeItem(STORAGE_KEYS.SWAP_PROGRESS);
    console.log('Swap marked as completed');
  },

  // Clear all swap data
  clearSwapData() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SWAP);
    localStorage.removeItem(STORAGE_KEYS.SWAP_PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.USER_SELECTIONS);
    console.log('Swap data cleared');
  },

  // Utility function for debugging
  getStorageInfo() {
    return {
      activeSwap: this.getActiveSwap(),
      progress: this.getSwapProgress(),
      selections: this.getUserSelections()
    };
  },

  // Get elapsed time for active swap
  getElapsedTime() {
    const progress = this.getSwapProgress();
    if (!progress || !progress.startTime) return 0;
    return Date.now() - progress.startTime;
  }
};

// Utility function to format elapsed time
export function formatElapsedTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Export default for easier importing
export default SwapStateManager;