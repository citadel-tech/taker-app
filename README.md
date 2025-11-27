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

1. **Bitcoin Core** - Fully synced node with RPC and ZMQ enabled (non-pruned, `-txindex=1` and `blockfilterindex=1`)
2. **Tor** - Required for anonymous maker discovery ([setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/tor.md))
3. **Node.js** (v18 or higher)
4. **Rust toolchain** - Install from [rustup.rs](https://rustup.rs/)

**Alternative**: Use the [Coinswap Docker setup](https://github.com/citadel-tech/coinswap/blob/master/docs/docker.md) for a pre-configured environment.

## Quick Start

```bash
git clone https://github.com/citadel-tech/taker-app.git
cd taker-app
npm install
npm run dev
```

## Bitcoin Core Configuration

Add to your `bitcoin.conf`:

### For Signet (Mutinynet)

```conf
[signet]
signetchallenge=512102f7561d208dd9ae99bf497273e16f389bdbd6c4742ddb8e6b216e64fa2928ad8f51ae
addnode=45.79.52.207:38333
dnsseed=0
signetblocktime=30

server=1
rpcuser=user
rpcpassword=password
rpcport=38332
rpcbind=127.0.0.1
rpcallowip=127.0.0.1

zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28332

txindex=1
blockfilterindex=1
```

### For Regtest

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

After updating `bitcoin.conf`, restart Bitcoin Core.

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
