# Taker App Usage Guide

This guide covers all features and functionality of the Openswap Taker App.

## Table of Contents

- [Setup and Connection](#setup-and-connection)
- [Wallet Page](#wallet-page)
- [Market Page](#market-page)
- [Swap Page](#swap-page)
- [Send Page](#send-page)
- [Receive Page](#receive-page)
- [Recovery Page](#recovery-page)
- [Settings Page](#settings-page)
- [Log Page](#log-page)

## Setup and Connection

On launch, the app walks through setup and connection configuration:

1. **Backend Selection** - Choose between an Electrum server (pre-filled with the Citadel FOSS server, or enter your own) or your own Bitcoin Core node (RPC credentials and port). The Electrum server is checked when you proceed.
2. **Tor Check** - Tor is deployed automatically by the app; the setup screen verifies it is reachable (defaults: control 9051, SOCKS 9050)
3. **Wallet Loading** - Create a new encrypted wallet (with password confirmation), load an existing one, or restore from backup JSON
4. **ZMQ Setup** - For the Bitcoin Core backend, configure real-time block and transaction notifications as part of the endpoint setup

The backend chosen here is fixed for the session and is passed to the taker at initialization; it can only be changed by re-running setup.

## Wallet Page

Your main Bitcoin wallet interface displaying:

- **Balance Overview** - Total spendable balance with real-time updates
- **Transaction History** - Chronological list of sends, receives, and openswaps
- **UTXO Management** - View and select individual UTXOs for spending or swapping
- **Quick Actions** - One-click access to send, receive, and swap functions

The wallet automatically syncs with Bitcoin Core via ZMQ notifications, providing instant updates when new transactions arrive or confirm.

## Market Page

Browse and analyze the maker marketplace:

- **Maker Discovery** - Real-time list of available makers fetched over Tor
- **Fee Comparison** - Compare maker fees, minimum/maximum swap amounts, and fidelity bonds
- **Offerbook Sync** - Refresh the maker list to see the latest offers

The market page helps you analyze available makers and their offerings. Makers with higher fidelity bonds are generally more trustworthy and less likely to DoS attack.

## Swap Page

Initiate and manage openswaps:

- **Amount Selection** - Choose swap amount in sats or BTC
- **UTXO Selection** - Auto-select optimal UTXOs or manually choose specific coins
- **Hop Configuration** - Select number of makers (hops) for enhanced privacy
- **Fee Estimation** - Preview total fees including maker fees and mining fees
- **Swap Execution** - Monitor real-time swap progress with detailed status updates

Swaps run in background worker threads, allowing you to continue using the app while swaps execute. Progress is saved and recoverable even if the app closes unexpectedly.

## Send Page

Standard Bitcoin send functionality:

- **Address Validation** - Automatic validation of Bitcoin addresses
- **Amount Input** - Flexible input in sats or BTC
- **Fee Selection** - Choose network fee rate (sats/vB)
- **UTXO Selection** - Manual coin control for advanced users
- **Transaction Preview** - Review details before broadcasting

Standard sends bypass the openswap protocol for faster transactions when privacy isn't required.

## Receive Page

Generate addresses to receive Bitcoin:

- **Address Generation** - One-click generation of new receive addresses
- **QR Codes** - Scannable QR codes for mobile wallet compatibility
- **Address History** - View all previously generated addresses and their usage
- **Address Types** - Support for P2WPKH (SegWit) and P2TR (Taproot) addresses

**CRITICAL: Never reuse addresses.** Each payment should use a freshly generated address to maintain privacy. Address reuse compromises your transaction privacy and should always be avoided.

## Recovery Page

Recover from failed swaps:

- **Automatic Detection** - Detects incomplete swaps from previous sessions
- **Contract Recovery** - Reclaim funds locked in swap contracts
- **Transaction Broadcasting** - Manually broadcast recovery transactions
- **Status Monitoring** - Track recovery transaction confirmations

Recovery is automatic in most cases, but this page provides manual control when needed.

## Settings Page

Wallet maintenance and status:

- **Wallet Backup** - Create encrypted wallet backups
- **Connection Status** - Backend in use (Bitcoin Core or Electrum server) and, for Bitcoin Core, node version, network, block height, and sync progress

Backend (Bitcoin Core/Electrum) and Tor settings are intentionally not editable here: Tor is deployed automatically by the app, and the backend can only be selected during first-time setup. Wallet password changes are not permitted.

## Log Page

Debug and troubleshoot issues:

- **Real-time Logs** - Live stream of app and protocol logs
- **Log Filtering** - Filter by severity (info, warn, error)
- **Log Export** - Save logs to file for debugging
- **Swap Diagnostics** - Detailed logs of swap execution steps

Logs are helpful for understanding swap failures or diagnosing connection issues.
