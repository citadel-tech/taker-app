// SwapStateManager - Handles all swap state persistence to localStorage

const STORAGE_KEYS = {
  ACTIVE_SWAP: 'coinswap_active_swap',
  SWAP_PROGRESS: 'coinswap_swap_progress', 
  USER_SELECTIONS: 'coinswap_user_selections',
  SWAP_HISTORY: 'coinswap_swap_history'
};

const MAX_HISTORY_ITEMS = 50; // Keep last 50 swaps

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

  // Swap History Management
  getSwapHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SWAP_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting swap history:', error);
      return [];
    }
  },

  addToSwapHistory(swapReport) {
    try {
      const history = this.getSwapHistory();
      
      // Create history entry from report
      const historyEntry = {
        id: swapReport.swapId || `swap_${Date.now()}`,
        completedAt: Date.now(),
        amount: swapReport.targetAmount || 0,
        totalOutputAmount: swapReport.totalOutputAmount || 0,
        makersCount: swapReport.makersCount || 0,
        hops: (swapReport.makersCount || 0) + 1,
        totalFee: swapReport.totalFee || 0,
        feePercentage: swapReport.feePercentage || 0,
        durationSeconds: swapReport.swapDurationSeconds || 0,
        status: 'completed',
        // Store full report for detailed view
        report: swapReport
      };
      
      // Add to beginning of array (most recent first)
      history.unshift(historyEntry);
      
      // Keep only last MAX_HISTORY_ITEMS
      if (history.length > MAX_HISTORY_ITEMS) {
        history.splice(MAX_HISTORY_ITEMS);
      }
      
      localStorage.setItem(STORAGE_KEYS.SWAP_HISTORY, JSON.stringify(history));
      console.log('Swap added to history:', historyEntry);
      
      return historyEntry;
    } catch (error) {
      console.error('Error adding to swap history:', error);
      return null;
    }
  },

  getSwapFromHistory(swapId) {
    const history = this.getSwapHistory();
    return history.find(swap => swap.id === swapId) || null;
  },

  getRecentSwaps(count = 5) {
    const history = this.getSwapHistory();
    return history.slice(0, count);
  },

  clearSwapHistory() {
    localStorage.removeItem(STORAGE_KEYS.SWAP_HISTORY);
    console.log('Swap history cleared');
  },

  // Swap Completion
  completeSwap(report = null) {
    const activeSwap = this.getActiveSwap();
    if (activeSwap) {
      activeSwap.status = 'completed';
      activeSwap.completedAt = Date.now();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SWAP, JSON.stringify(activeSwap));
    }
    
    // Add to history if report provided
    if (report) {
      this.addToSwapHistory(report);
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
      selections: this.getUserSelections(),
      history: this.getSwapHistory()
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

// Utility function to format relative time (e.g., "2 hours ago")
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  } else if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  } else if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  } else {
    return 'Just now';
  }
}

// Export default for easier importing
export default SwapStateManager;