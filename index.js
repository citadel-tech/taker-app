const { app, BrowserWindow } = require('electron');
const path = require('path');

// Add hot reload in development
try {
    require('electron-reloader')(module, {
        watchRenderer: true
    });
} catch (_) { }

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Log any errors
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    const htmlPath = path.join(__dirname, 'src', 'index.html');
    console.log('Loading file from:', htmlPath);
    
    win.loadFile(htmlPath);
    // DevTools removed - won't auto-open anymore
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});