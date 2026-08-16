const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - exposes secure IPC APIs to renderer process
 * This is the only way the renderer can communicate with the main process
 */

contextBridge.exposeInMainWorld('api', {
  // Taker initialization and management
  taker: {
    initialize: (config) => ipcRenderer.invoke('taker:initialize', config),
    getBalance: () => ipcRenderer.invoke('taker:getBalance'),
    getNextAddress: (addressType) =>
      ipcRenderer.invoke('taker:getNextAddress', addressType),
    sync: () => ipcRenderer.invoke('taker:sync'),
    syncOfferbookAndWait: () =>
      ipcRenderer.invoke('taker:syncOfferbookAndWait'),
    pollMaker: (address) => ipcRenderer.invoke('taker:pollMaker', address),
    removeMaker: (address) => ipcRenderer.invoke('taker:removeMaker', address),
    getSyncStatus: (syncId) =>
      ipcRenderer.invoke('taker:getSyncStatus', syncId),
    getOffers: () => ipcRenderer.invoke('taker:getOffers'),
    checkSwapLiquidity: () => ipcRenderer.invoke('taker:checkSwapLiquidity'),
    getTransactions: (count, skip) =>
      ipcRenderer.invoke('taker:getTransactions', { count, skip }),
    getUtxos: () => ipcRenderer.invoke('taker:getUtxos'),
    sendToAddress: (address, amount, feeRate, manuallySelectedOutpoints) =>
      ipcRenderer.invoke('taker:sendToAddress', {
        address,
        amount,
        feeRate,
        manuallySelectedOutpoints,
      }),
    recover: () => ipcRenderer.invoke('taker:recover'),
    getRecoveryStatus: () => ipcRenderer.invoke('taker:getRecoveryStatus'),
    getWalletInfo: () => ipcRenderer.invoke('taker:getWalletInfo'),
    getCurrentSyncState: () => ipcRenderer.invoke('taker:getCurrentSyncState'),
    getProtocol: () => ipcRenderer.invoke('taker:getProtocol'),
    getSwapProgress: (nativeSwapId) =>
      ipcRenderer.invoke('taker:getSwapProgress', nativeSwapId),
    verifyDeniability: (swapId) =>
      ipcRenderer.invoke('taker:verifyDeniability', swapId),
  },

  // Openswap operations
  openswap: {
    start: (params) => ipcRenderer.invoke('openswap:start', params),
    getStatus: (swapId) => ipcRenderer.invoke('openswap:getStatus', swapId),
  },

  // Logs
  logs: {
    get: (lines) => ipcRenderer.invoke('logs:get', lines),
  },

  swapReports: {
    getAll: () => ipcRenderer.invoke('swapReports:getAll'),
    get: (swapId) => ipcRenderer.invoke('swapReports:get', swapId),
  },

  swapState: {
    save: (state) => ipcRenderer.invoke('swapState:save', state),
    load: () => ipcRenderer.invoke('swapState:load'),
  },

  shell: {
    showItemInFolder: (path) =>
      ipcRenderer.invoke('shell:showItemInFolder', path),
  },

  app: {
    getVersionInfo: () => ipcRenderer.invoke('app:getVersionInfo'),
  },

  // File dialogs - TOP LEVEL, NOT INSIDE TAKER!
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  restoreWallet: (data) => ipcRenderer.invoke('taker:restore', data),
  backupWallet: (data) => ipcRenderer.invoke('taker:backup', data),
  testTcpPort: (config) => ipcRenderer.invoke('network:testTcpPort', config),
  getTorBootstrapStatus: (config) =>
    ipcRenderer.invoke('network:getTorBootstrapStatus', config),
});
