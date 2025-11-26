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
    getNextAddress: () => ipcRenderer.invoke('taker:getNextAddress'),
    sync: () => ipcRenderer.invoke('taker:sync'),
    syncOfferbook: () => ipcRenderer.invoke('taker:syncOfferbook'),
    getSyncStatus: (syncId) =>
      ipcRenderer.invoke('taker:getSyncStatus', syncId),
    getOffers: () => ipcRenderer.invoke('taker:getOffers'),
    getGoodMakers: () => ipcRenderer.invoke('taker:getGoodMakers'),
    getTransactions: (count, skip) =>
      ipcRenderer.invoke('taker:getTransactions', { count, skip }),
    getUtxos: () => ipcRenderer.invoke('taker:getUtxos'),
    sendToAddress: (address, amount) =>
      ipcRenderer.invoke('taker:sendToAddress', { address, amount }),
    recover: () => ipcRenderer.invoke('taker:recover'),
    isWalletEncrypted: (walletPath) =>
      ipcRenderer.invoke('taker:isWalletEncrypted', walletPath),
  },

  // Coinswap operations
  coinswap: {
    start: (params) => ipcRenderer.invoke('coinswap:start', params),
    getStatus: (swapId) => ipcRenderer.invoke('coinswap:getStatus', swapId),
  },

  // Logs
  logs: {
    get: (lines) => ipcRenderer.invoke('logs:get', lines),
  },

  // File dialogs - TOP LEVEL, NOT INSIDE TAKER!
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  restoreWallet: (data) => ipcRenderer.invoke('taker:restore', data),
  backupWallet: (data) => ipcRenderer.invoke('taker:backup', data),
});
