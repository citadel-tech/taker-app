# Coinswap Taker App

A desktop application for performing private Bitcoin swaps using the [Coinswap Protocol](https://github.com/citadel-tech/coinswap).

## What is a Taker?

In the Coinswap protocol, a **Taker** is a Bitcoin user who initiates atomic swaps to enhance their transaction privacy. The Taker app acts as a Bitcoin wallet with coinswap capabilities, allowing you to:

- Swap your Bitcoin UTXOs with multiple makers simultaneously
- Break transaction graph analysis through multi-hop routing
- Maintain complete custody of your funds throughout the swap
- Earn privacy without trusting any third party

Unlike traditional Bitcoin transactions that create an on-chain trail, coinswaps mix your coins through multiple makers, making it significantly harder to trace the origin and destination of funds.

## Prerequisites

### Required

The Taker app requires the following components to operate:

1. **Bitcoin Core (Mutinynet)** - A fully synced Mutinynet node with proper RPC and ZMQ configuration
   - See the [Bitcoin Core setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/bitcoind.md) for detailed instructions

2. **Tor** - Required for anonymous maker discovery and privacy
   - See the [Tor setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/tor.md) for configuration instructions

3. **Node.js** (v18 or higher)

4. **Rust toolchain** - Install from [rustup.rs](https://rustup.rs/)

### Alternative: Docker Setup

If you prefer a pre-configured environment, you can use Docker Compose to spin up Tor, Bitcoin Core (Mutinynet), and maker services automatically.

See the [Docker setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/docker.md) for instructions.

## Quick Start
```bash
git clone https://github.com/citadel-tech/taker-app.git
cd taker-app
npm install
npm run dev
```

## Architecture

Built with Electron, Vanilla JavaScript, and Tailwind CSS. The app communicates with the Coinswap protocol through [coinswap-ffi](https://github.com/citadel-tech/coinswap-ffi), providing native Rust performance for cryptographic operations and protocol handling.

## Usage

See the [Usage Guide](docs/usage.md) for detailed instructions on:

- Wallet management and setup
- Browsing the maker marketplace
- Executing coinswaps
- Sending and receiving Bitcoin
- Recovery procedures

## Contributing

Contributions are welcome! To contribute:

- **Report Bugs** - Open an issue with reproduction steps
- **Suggest Features** - Propose improvements via issues
- **Submit Code** - Fork, create a feature branch, and submit a PR

Test changes on both Signet and Regtest before submitting. For protocol-level changes, contribute to the [core Coinswap library](https://github.com/citadel-tech/coinswap).

**Questions?** Join our [Discord server](https://discord.gg/Wz42hVmrrK).

## Security

Report security issues on our [Discord](https://discord.gg/Wz42hVmrrK) or email security@citadel.tech.

**⚠️ Important**: This software is experimental. Do not use on mainnet with real funds.

## License

Dual-licensed under MIT or Apache 2.0 at your option.

## Community

- **Discord** - [Join our server](https://discord.gg/Wz42hVmrrK)
- **GitHub Issues** - Report bugs and request features
- **Core Library** - [Coinswap protocol implementation](https://github.com/citadel-tech/coinswap)

---

**⚠️ Warning**: Experimental software under active development. Mainnet use is **NOT recommended**.