# Coinswap Taker App

## Project Overview

This is an Electron-based desktop application for conducting Bitcoin coinswaps using the Teleport protocol. The app provides a user-friendly GUI for privacy-enhanced Bitcoin transactions through atomic swaps with maker nodes.

## Architecture

### Technology Stack
- **Framework**: Electron (Node.js + Chromium)
- **Backend**: Rust (via N-API bindings through `coinswap-napi`)
- **Frontend**: Vanilla JavaScript, HTML, CSS (Tailwind)
- **IPC**: Electron's `ipcMain`/`ipcRenderer` for main-renderer communication

### Core Components

#### Main Process (`main.js`, `api1.js`)
- Manages Electron lifecycle
- Handles all IPC communication via `api1.js`
- Coordinates Rust backend through N-API bindings
- Manages wallet operations, swaps, and Bitcoin Core RPC

#### Renderer Components
All UI components are modular JavaScript files that export functions to render their respective views:

- **Wallet.js** - Main wallet view (balance, addresses, transactions)
- **Market.js** - Offerbook viewer showing available makers
- **Coinswap.js** - Swap execution interface
- **Send.js** / **Receive.js** - Bitcoin transaction management
- **Settings.js** - Configuration management (RPC, Tor, wallets)
- **FirstTimeSetup.js** - Initial configuration wizard
- **SwapReport.js** - Post-swap analytics and visualization
- **SwapHistory.js** - Historical swap records
- **Nav.js** - Navigation component
- **ConnectionStatus.js** - Bitcoin Core connection monitor

#### State Management
- **SwapStateManager.js** - Persistent swap state across restarts
- **api1State** - In-memory state for active operations

### Bitcoin Integration

The app integrates with Bitcoin Core via:
1. **RPC API** - Wallet operations (balance, transactions, UTXOs)
2. **ZMQ** - Real-time block/transaction notifications

### Privacy Features

#### Swap Protocols
- **V1 (P2WSH)** - ECDSA-based 2-of-2 multisig contracts (stable, recommended)
- **V2 (Taproot)** - MuSig2-based scriptless scripts (beta)

#### Tor Integration
- All network communication routes through Tor
- Configurable Tor control/socks ports
- Authentication support

## Key Files

### Configuration
- **setup-coinswap.js** - Builds and links the Rust N-API module
- **preload.js** - Securely exposes IPC APIs to renderer
- **package.json** - Dependencies and build scripts

### Workers
- **offerbook-worker.js** - Offloads blocking offerbook sync to separate thread

### Data Directory Structure
```
~/.coinswap/taker/
├── config.toml          # App configuration
├── wallets/             # Bitcoin wallets
│   └── taker-wallet/
├── swap_reports/        # Completed swap analytics
│   └── [wallet-name]/
│       └── [swap-id].json
├── offerbook.json       # Cached maker offers
├── swap_state.json      # Active swap state (transient)
└── debug.log           # Application logs
```

## Development Guidelines

### Code Style
- Use async/await for asynchronous operations
- Prefer descriptive variable names
- Comment complex Bitcoin/swap logic
- Use ES6+ features (arrow functions, destructuring, etc.)

### Error Handling
- Always wrap IPC calls in try-catch
- Return `{ success: boolean, error?: string }` from API handlers
- Log errors with context (`console.error('⚠️ Context:', error)`)

### UI Patterns
- All components render to a container element
- Use Tailwind utility classes for styling
- Maintain consistent color scheme (orange: `#FF6B35`, dark backgrounds)
- Show loading states during async operations
- Provide clear error messages to users

### Security Considerations
- Never log sensitive data (passwords, private keys)
- Validate all user inputs
- Use context isolation in Electron
- Encrypt wallets by default
- Sanitize file paths for wallet operations

## Common Patterns

### IPC Communication
```javascript
// Renderer
const result = await window.api.taker.getBalance();
if (result.success) {
  // Handle success
} else {
  // Handle error: result.error
}

// Main Process
ipcMain.handle('taker:getBalance', async () => {
  try {
    const balance = api1State.takerInstance.getBalance();
    return { success: true, balance };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Component Structure
```javascript
export function ComponentName(container, onComplete) {
  container.innerHTML = `/* HTML template */`;
  
  // Event handlers
  const button = container.querySelector('#button-id');
  button.addEventListener('click', async () => {
    // Handle event
    if (onComplete) onComplete(result);
  });
}
```

### State Persistence
```javascript
// Save
await window.api.swapState.save(stateObject);

// Load
const result = await window.api.swapState.load();
if (result.success) {
  const state = result.state;
}
```

## Testing Focus Areas

When reviewing code, pay special attention to:

1. **Bitcoin Transaction Safety**
   - Correct amount handling (satoshis vs BTC)
   - Fee estimation accuracy
   - UTXO selection logic
   - Address validation

2. **Swap Protocol Correctness**
   - HTLC construction and validation
   - Timeout handling
   - Recovery procedures
   - Multi-hop routing

3. **Error Recovery**
   - Wallet corruption handling
   - Network failures during swaps
   - Bitcoin Core disconnection
   - Tor connectivity issues

4. **User Experience**
   - Clear error messages
   - Loading indicators
   - Confirmation dialogs for destructive actions
   - Responsive UI during long operations

5. **Security**
   - Password handling
   - File path traversal prevention
   - RPC credential management
   - Tor anonymity preservation

## Build Process

1. Clone `coinswap-ffi` repository (Rust backend)
2. Build Rust N-API module via `setup-coinswap.js`
3. Link module to `node_modules/coinswap-napi`
4. Run Electron app with `npm start`

## Dependencies

### Critical Native Dependencies
- **coinswap-napi** - Rust bindings for coinswap protocol
- **electron** - Desktop application framework

### Key Node Modules
- **worker_threads** - For blocking operations (offerbook sync)
- **fs/path** - File system operations
- Various UI libraries (see package.json)

## Known Issues & Limitations

- Offerbook sync blocks for 30-60s (runs in worker)
- V2 (Taproot) protocol is experimental
- Requires Bitcoin Core with specific configuration
- Tor must be running and configured
- Wallet recovery requires manual intervention

## Future Improvements

- Multi-wallet support
- Hardware wallet integration
- Enhanced fee estimation
- Automated maker reputation system
- Cross-platform compatibility improvements

---

**For Reviewers**: This is a privacy-focused Bitcoin application. Security and correctness are paramount. When in doubt about Bitcoin/Lightning/swap mechanics, ask for clarification rather than making assumptions.