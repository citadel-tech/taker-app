# Coinswap Taker App

A desktop application for performing private Bitcoin swaps using the [Coinswap Protocol](https://github.com/citadel-tech/coinswap).

## What is a Taker?

In the Coinswap protocol, a **Taker** is a Bitcoin user who initiates atomic swaps to enhance their transaction privacy. The Taker app acts as a Bitcoin wallet with coinswap capabilities, allowing you to:

- Swap your Bitcoin UTXOs with multiple makers simultaneously
- Break transaction graph analysis through multi-hop routing
- Maintain complete custody of your funds throughout the swap
- Earn privacy without trusting any third party

Unlike traditional Bitcoin transactions that create an on-chain trail, coinswaps mix your coins through multiple makers, making it significantly harder to trace the origin and destination of funds. The Taker coordinates the entire swap process while makers provide liquidity and routing services for a small fee.

## Prerequisites

### Required

1. **Bitcoin Core** - Fully synced node with RPC and ZMQ enabled
   - Non-pruned node
   - `-txindex=1` and `blockfilterindex=1` enabled
   - Can run on Signet (recommended for testing) or Regtest

2. **Tor** - Required for all network operations
   - Download from [torproject.org](https://www.torproject.org/download/)
   - Used for anonymous maker discovery and communication
   - See [Tor configuration guide](https://github.com/citadel-tech/coinswap/blob/master/docs/tor.md)

3. **Node.js** (v18 or higher)
   - Required to run the Electron application

4. **Rust toolchain** 
   - Required to build the native bindings
   - Install from [rustup.rs](https://rustup.rs/)

### Alternative: Using Docker

If you prefer not to manage Bitcoin Core and Tor separately, use the [Coinswap Docker setup](https://github.com/citadel-tech/coinswap/blob/master/docs/docker.md) which provides a pre-configured environment.

## Setup

Clone and run the Taker App:

```bash
git clone https://github.com/citadel-tech/taker-app.git
cd taker-app
npm install
npm run dev
```

## Bitcoin Core Configuration

Add the following to your `bitcoin.conf`:

### For Signet (Mutinynet)

```conf
[signet]
# Mutinynet default signet parameters
signetchallenge=512102f7561d208dd9ae99bf497273e16f389bdbd6c4742ddb8e6b216e64fa2928ad8f51ae
addnode=45.79.52.207:38333
dnsseed=0
signetblocktime=30

# RPC Configurations
server=1
rpcuser=user
rpcpassword=password
rpcport=38332
rpcbind=127.0.0.1
rpcallowip=127.0.0.1

# ZMQ Configurations for real-time notifications
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28332

# Required indexes
txindex=1
blockfilterindex=1
```

### For Regtest (Local Testing)

```conf
[regtest]
fallbackfee=0.00001000
server=1
rpcuser=user
rpcpassword=password
rpcport=18442
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28332
txindex=1
blockfilterindex=1
```

After updating `bitcoin.conf`, restart Bitcoin Core for changes to take effect.

## Architecture

The Taker App is built with:

- **Electron** - Cross-platform desktop framework
- **Vanilla JavaScript** - UI components and state management
- **Tailwind CSS** - Modern, utility-first styling
- **coinswap-napi** - Native Rust bindings via [coinswap-ffi](https://github.com/citadel-tech/coinswap-ffi)

### Native Bindings (FFI)

The app communicates with the Coinswap protocol through [coinswap-ffi](https://github.com/citadel-tech/coinswap-ffi), a Foreign Function Interface that wraps the core [Coinswap library](https://github.com/citadel-tech/coinswap) written in Rust. This architecture provides:

- **Performance** - Native Rust code for cryptographic operations and protocol handling
- **Security** - Memory-safe Rust implementation of sensitive wallet operations
- **Cross-platform** - N-API bindings work seamlessly across Windows, macOS, and Linux

The FFI layer exposes wallet management, coinswap execution, maker discovery, and transaction handling through a clean JavaScript API consumed by the Electron main process.

## Usage

### Setup and Connection

On each launch, the app loads your configuration:

1. **Bitcoin Core Connection** - Configure RPC credentials and port
2. **Tor Configuration** - Set control and SOCKS ports (defaults: 9051, 9050)
3. **Wallet Loading** - Opens your existing encrypted wallet, prompts creation, or allows restoration from seed
4. **ZMQ Setup** - Configure real-time block and transaction notifications

The setup page allows you to review and update your configuration at any time.

### Wallet Page

Your main Bitcoin wallet interface displaying:

- **Balance Overview** - Total spendable balance with real-time updates
- **Transaction History** - Chronological list of sends, receives, and coinswaps
- **UTXO Management** - View and select individual UTXOs for spending or swapping
- **Quick Actions** - One-click access to send, receive, and swap functions

The wallet automatically syncs with Bitcoin Core via ZMQ notifications, providing instant updates when new transactions arrive or confirm.

### Market Page

Browse and analyze the maker marketplace:

- **Maker Discovery** - Real-time list of available makers fetched over Tor
- **Fee Comparison** - Compare maker fees, minimum/maximum swap amounts, and fidelity bonds
- **Offerbook Sync** - Refresh the maker list to see the latest offers

The market page helps you analyze available makers and their offerings. Makers with higher fidelity bonds are generally more trustworthy and less likely to DoS attack.

### Swap Page

Initiate and manage coinswaps:

- **Amount Selection** - Choose swap amount in sats or BTC
- **UTXO Selection** - Auto-select optimal UTXOs or manually choose specific coins
- **Hop Configuration** - Select number of makers (hops) for enhanced privacy
- **Fee Estimation** - Preview total fees including maker fees and mining fees
- **Swap Execution** - Monitor real-time swap progress with detailed status updates

Swaps run in background worker threads, allowing you to continue using the app while swaps execute. Progress is saved and recoverable even if the app closes unexpectedly.

### Send Page

Standard Bitcoin send functionality:

- **Address Validation** - Automatic validation of Bitcoin addresses
- **Amount Input** - Flexible input in sats or BTC
- **Fee Selection** - Choose network fee rate (sats/vB)
- **UTXO Selection** - Manual coin control for advanced users
- **Transaction Preview** - Review details before broadcasting

Standard sends bypass the coinswap protocol for faster transactions when privacy isn't required.

### Receive Page

Generate addresses to receive Bitcoin:

- **Address Generation** - One-click generation of new receive addresses
- **QR Codes** - Scannable QR codes for mobile wallet compatibility
- **Address History** - View all previously generated addresses and their usage
- **Address Types** - Support for P2WPKH (SegWit) and P2TR (Taproot) addresses

**CRITICAL: Never reuse addresses.** Each payment should use a freshly generated address to maintain privacy. Address reuse compromises your transaction privacy and should always be avoided.

### Recovery Page

Recover from failed swaps:

- **Automatic Detection** - Detects incomplete swaps from previous sessions
- **Contract Recovery** - Reclaim funds locked in swap contracts
- **Transaction Broadcasting** - Manually broadcast recovery transactions
- **Status Monitoring** - Track recovery transaction confirmations

Recovery is automatic in most cases, but this page provides manual control when needed.

### Settings Page

Configure app and Bitcoin Core connection:

- **RPC Configuration** - Bitcoin Core connection settings
- **Tor Configuration** - Control port, SOCKS port, and authentication
- **ZMQ Configuration** - Real-time notification endpoints
- **Wallet Backup** - Create encrypted wallet backups
- **Connection Testing** - Verify Bitcoin Core and Tor connectivity

Settings are persisted locally and can be updated at any time without restarting the app.

### Log Page

Debug and troubleshoot issues:

- **Real-time Logs** - Live stream of app and protocol logs
- **Log Filtering** - Filter by severity (info, warn, error)
- **Log Export** - Save logs to file for debugging
- **Swap Diagnostics** - Detailed logs of swap execution steps

Logs are helpful for understanding swap failures or diagnosing connection issues.

## Contributing

Contributions to the Taker App are welcome! This app is a frontend for the [Coinswap protocol](https://github.com/citadel-tech/coinswap), providing a user-friendly interface for coinswap operations.

### How to Contribute

- **Report Bugs** - Open an issue describing the problem, steps to reproduce, and your environment
- **Suggest Features** - Propose new functionality or UI improvements via issues
- **Improve Documentation** - Help clarify setup instructions, usage guides, or code comments
- **Submit Code** - Fork the repo, create a feature branch, and submit a pull request

### Development Guidelines

- Test your changes on both Signet and Regtest before submitting
- Follow the existing code style and project structure
- Keep UI changes consistent with the current design language
- For protocol-level changes, contribute to the [core Coinswap library](https://github.com/citadel-tech/coinswap) instead

### Questions?

Join our [Discord server](https://discord.gg/Wz42hVmrrK) to discuss development, ask questions, or get help with contributions.

## Security

If you discover a security issue, please reach out on our [Discord server](https://discord.gg/Wz42hVmrrK) or email security@citadel.tech so we can address it quickly.

**⚠️ Important**: This software is experimental and under active development. Please do not use it on mainnet with real funds.

## License

This project is licensed under:
- MIT License ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)

at your option.

## Community

- **Discord** - Join our [Discord server](https://discord.gg/Wz42hVmrrK) for real-time discussions
- **GitHub Issues** - Report bugs and request features
- **GitHub Discussions** - Ask questions and share ideas
- **Core Library** - Contribute to the [Coinswap protocol implementation](https://github.com/citadel-tech/coinswap)

---

**⚠️ Warning**: This software is experimental and under active development. Mainnet use is strictly **NOT recommended**. Use at your own risk.