// SwapStateManager.js - Handles persistence of swap state in localStorage

export class SwapStateManager {
  static STORAGE_KEY = 'coinswap_active_swap';
  static PROGRESS_KEY = 'coinswap_swap_progress';

  // Save swap configuration when starting a new swap
  static saveSwapConfig(swapConfig) {
    const swapData = {
      ...swapConfig,
      status: 'configured',
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(swapData));
    console.log('Swap config saved:', swapData);
  }

  // Save swap progress during execution
  static saveSwapProgress(progressData) {
    const existingSwap = this.getActiveSwap();
    if (!existingSwap) return;

    const updatedSwap = {
      ...existingSwap,
      ...progressData,
      status: 'in_progress',
      lastUpdated: Date.now()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSwap));
    localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(progressData));
    console.log('Swap progress saved:', progressData);
  }

  // Get active swap data
  static getActiveSwap() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return null;

    try {
      const swap = JSON.parse(data);
      // Check if swap is still valid (not older than 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - swap.createdAt > maxAge) {
        this.clearSwapData();
        return null;
      }
      return swap;
    } catch (error) {
      console.error('Error parsing swap data:', error);
      this.clearSwapData();
      return null;
    }
  }

  // Get swap progress data
  static getSwapProgress() {
    const data = localStorage.getItem(this.PROGRESS_KEY);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing progress data:', error);
      return null;
    }
  }

  // Check if there's an active swap
  static hasActiveSwap() {
    const swap = this.getActiveSwap();
    return swap && (swap.status === 'configured' || swap.status === 'in_progress');
  }

  // Mark swap as completed
  static completeSwap() {
    const existingSwap = this.getActiveSwap();
    if (!existingSwap) return;

    const completedSwap = {
      ...existingSwap,
      status: 'completed',
      completedAt: Date.now(),
      lastUpdated: Date.now()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(completedSwap));
    
    // Clear after a short delay to allow user to see completion
    setTimeout(() => {
      this.clearSwapData();
    }, 5000);
  }

  // Mark swap as failed
  static failSwap(errorMessage = null) {
    const existingSwap = this.getActiveSwap();
    if (!existingSwap) return;

    const failedSwap = {
      ...existingSwap,
      status: 'failed',
      errorMessage,
      failedAt: Date.now(),
      lastUpdated: Date.now()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(failedSwap));
  }

  // Clear all swap data
  static clearSwapData() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.PROGRESS_KEY);
    console.log('Swap data cleared');
  }

  // Get swap status for UI
  static getSwapStatus() {
    const swap = this.getActiveSwap();
    if (!swap) return 'none';
    return swap.status;
  }

  // Get time since swap started (for elapsed time display)
  static getElapsedTime() {
    const swap = this.getActiveSwap();
    if (!swap || !swap.createdAt) return 0;
    return Date.now() - swap.createdAt;
  }

  // Save user's manual selections for restoration
  static saveUserSelections(selections) {
    const existingSwap = this.getActiveSwap();
    if (!existingSwap) return;

    const updatedSwap = {
      ...existingSwap,
      userSelections: selections,
      lastUpdated: Date.now()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSwap));
  }

  // Get user's saved selections
  static getUserSelections() {
    const swap = this.getActiveSwap();
    return swap?.userSelections || null;
  }

  // Debug helper - get all swap data
  static debugGetAllData() {
    return {
      activeSwap: this.getActiveSwap(),
      progress: this.getSwapProgress(),
      hasActive: this.hasActiveSwap(),
      status: this.getSwapStatus()
    };
  }
}

// Helper function to format elapsed time
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