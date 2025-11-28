const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerAPI1, api1State } = require('./api1');

console.log('MAIN.JS __dirname:', __dirname);
console.log('PRELOAD PATH:', path.join(__dirname, 'preload.js'));
console.log(
  'Does preload exist?',
  require('fs').existsSync(path.join(__dirname, 'preload.js'))
);

// Add hot reload in development
try {
  require('electron-reloader')(module, {
    watchRenderer: true,
  });
} catch (_) {}

/**
 * Create the main application window
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'assets/icon.png'),
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  const htmlPath = path.join(__dirname, 'src', 'index.html');
  console.log('Loading file from:', htmlPath);

  win.loadFile(htmlPath);

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('localStorage.clear();');
    console.log('🧹 localStorage cleared');
  });

  // Clear swap state on startup
  try {
    const stateFile = path.join(api1State.DATA_DIR, 'swap_state.json');
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
      console.log('🧹 Swap state cleared');
    }
  } catch (error) {
    console.warn('⚠️ Could not clear swap state:', error.message);
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

/**
 * App lifecycle
 */

app.whenReady().then(async () => {
  console.log('🚀 Electron app starting...');
  
  // Register API v1 handlers
  registerAPI1();
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

console.log('🚀 API v1-enabled Electron app starting...');