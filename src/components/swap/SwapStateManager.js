// SwapStateManager - Handles all swap state persistence to filesystem

const STORAGE_KEYS = {
  ACTIVE_SWAP: 'active_swap',
  SWAP_PROGRESS: 'swap_progress',
  USER_SELECTIONS: 'user_selections',
  SWAP_HISTORY: 'swap_history',
};

const MAX_HISTORY_ITEMS = 50; // Keep last 50 swaps

export const SwapStateManager = {
  // Swap Configuration Management
  async saveSwapConfig(swapConfig) {
    const swapData = {
      ...swapConfig,
      status: 'configured',
      createdAt: Date.now(),
    };

    const state = await this.loadState();
    state[STORAGE_KEYS.ACTIVE_SWAP] = swapData;
    delete state[STORAGE_KEYS.SWAP_PROGRESS];
    await this.saveState(state);

    console.log('Swap config saved:', swapData);
  },

  async getActiveSwap() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.ACTIVE_SWAP] || null;
    } catch (error) {
      console.error('Error getting active swap:', error);
      return null;
    }
  },

  async hasActiveSwap() {
    const activeSwap = await this.getActiveSwap();
    if (!activeSwap) return false;

    const isActive =
      activeSwap.status === 'in_progress' || activeSwap.status === 'configured';

    // Check if configured swap is stale
    if (activeSwap.status === 'configured') {
      const age = Date.now() - activeSwap.createdAt;
      if (age > 15 * 60 * 1000) {
        console.log(
          '🧹 Clearing stale configured swap from hasActiveSwap check'
        );
        await this.clearSwapData();
        return false;
      }
    }

    return isActive;
  },

  // Swap Progress Management
  async saveSwapProgress(progressData) {
    const state = await this.loadState();
    const activeSwap = state[STORAGE_KEYS.ACTIVE_SWAP];
    const scopedProgress = { ...progressData };

    if (activeSwap?.swapId && !scopedProgress.swapId) {
      scopedProgress.swapId = activeSwap.swapId;
    }
    if (activeSwap?.nativeSwapId && !scopedProgress.nativeSwapId) {
      scopedProgress.nativeSwapId = activeSwap.nativeSwapId;
    }

    if (
      scopedProgress.swapId &&
      activeSwap?.swapId &&
      scopedProgress.swapId !== activeSwap.swapId
    ) {
      const error = new Error('Swap progress swapId does not match active swap');
      console.error('Refusing to save swap progress:', error.message);
      throw error;
    }

    if (
      scopedProgress.nativeSwapId &&
      activeSwap?.nativeSwapId &&
      scopedProgress.nativeSwapId !== activeSwap.nativeSwapId
    ) {
      const error = new Error(
        'Swap progress nativeSwapId does not match active swap'
      );
      console.error('Refusing to save swap progress:', error.message);
      throw error;
    }

    state[STORAGE_KEYS.SWAP_PROGRESS] = scopedProgress;

    console.log('Swap progress saved:', {
      status: scopedProgress.status || 'in_progress',
      currentStep: scopedProgress.currentStep,
      logCount: Array.isArray(scopedProgress.logMessages)
        ? scopedProgress.logMessages.length
        : 0,
    });

    // Also update the active swap status
    if (activeSwap) {
      activeSwap.status = scopedProgress.status || 'in_progress';
      activeSwap.currentStep = scopedProgress.currentStep;
      activeSwap.lastUpdated = Date.now();
      state[STORAGE_KEYS.ACTIVE_SWAP] = activeSwap;
    }

    await this.saveState(state);
  },

  async getSwapProgress() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.SWAP_PROGRESS] || null;
    } catch (error) {
      console.error('Error getting swap progress:', error);
      return null;
    }
  },

  // User Selections Management
  async saveUserSelections(selections) {
    const state = await this.loadState();
    state[STORAGE_KEYS.USER_SELECTIONS] = selections;
    await this.saveState(state);

    console.log('User selections saved:', selections);
  },

  async getUserSelections() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.USER_SELECTIONS] || null;
    } catch (error) {
      console.error('Error getting user selections:', error);
      return null;
    }
  },

  async clearUserSelections() {
    const state = await this.loadState();
    delete state[STORAGE_KEYS.USER_SELECTIONS];
    await this.saveState(state);

    console.log('User selections cleared');
  },

  // Swap Completion
  async completeSwap(report = null) {
    const state = await this.loadState();

    // Add to history if report provided
    if (report) {
      const history = state[STORAGE_KEYS.SWAP_HISTORY] || [];

      const historyEntry = {
        id: report.swapId || `swap_${Date.now()}`,
        completedAt: Date.now(),
        amount: report.totalOutputAmount || report.targetAmount || 0,
        totalOutputAmount: report.totalOutputAmount || 0,
        makersCount: report.makersCount || 0,
        hops: (report.makersCount || 0) + 1,
        totalFee: report.totalFee || 0,
        feePercentage: report.feePercentage || 0,
        durationSeconds: report.swapDurationSeconds || 0,
        status: 'completed',
        protocol: report.protocol || (report.isTaproot ? 'Taproot' : 'Legacy'),
        isTaproot: Boolean(report.isTaproot),
        protocolVersion: report.protocolVersion || (report.isTaproot ? 2 : 1),
        report: report,
      };

      history.unshift(historyEntry);
      if (history.length > MAX_HISTORY_ITEMS) {
        history.splice(MAX_HISTORY_ITEMS);
      }

      state[STORAGE_KEYS.SWAP_HISTORY] = history;
    }

    // ✅ CLEAR active swap and progress completely
    delete state[STORAGE_KEYS.ACTIVE_SWAP];
    delete state[STORAGE_KEYS.SWAP_PROGRESS];

    await this.saveState(state);
    console.log('Swap marked as completed and cleared from active state');
  },

  async getSwapHistory() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.SWAP_HISTORY] || [];
    } catch (error) {
      console.error('Error getting swap history:', error);
      return [];
    }
  },

  async clearSwapHistory() {
    const state = await this.loadState();
    delete state[STORAGE_KEYS.SWAP_HISTORY];
    await this.saveState(state);

    console.log('Swap history cleared');
  },

  // Clear all swap data
  async clearSwapData() {
    const state = await this.loadState();
    delete state[STORAGE_KEYS.ACTIVE_SWAP];
    delete state[STORAGE_KEYS.SWAP_PROGRESS];
    delete state[STORAGE_KEYS.USER_SELECTIONS];
    await this.saveState(state);

    console.log('Swap data cleared');
  },

  // Utility function for debugging
  async getStorageInfo() {
    return {
      activeSwap: await this.getActiveSwap(),
      progress: await this.getSwapProgress(),
      selections: await this.getUserSelections(),
      history: await this.getSwapHistory(),
    };
  },

  // Get elapsed time for active swap
  async getElapsedTime() {
    const progress = await this.getSwapProgress();
    if (!progress || !progress.startTime) return 0;
    return Math.max(0, Date.now() - progress.startTime);
  },

  async loadState() {
    try {
      const result = await window.api.swapState.load();
      if (result.success && result.state) {
        return result.state;
      }
      return {};
    } catch (error) {
      console.error('Failed to load state:', error);
      return {};
    }
  },

  async saveState(state) {
    try {
      await window.api.swapState.save(state);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  },
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
