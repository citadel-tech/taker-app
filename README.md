# Coinswap Taker App

A desktop application for performing private Bitcoin swaps using the [Coinswap Protocol](https://github.com/citadel-tech/coinswap).

## What is a Taker?

In the Coinswap protocol, a **Taker** is a Bitcoin user who initiates atomic swaps to enhance their transaction privacy. The Taker app acts as a Bitcoin wallet with coinswap capabilities, allowing you to:

- Swap your Bitcoin UTXOs with multiple makers simultaneously
- Break transaction graph analysis through multi-hop routing
- Maintain complete custody of your funds throughout the swap
- Earn privacy without trusting any third party

Unlike traditional Bitcoin transactions that create an on-chain trail, coinswaps mix your coins through multiple makers, making it significantly harder to trace the origin and destination of funds.

## Screenshots

### Wallet

![Wallet Screenshot](/screenshot/wallet.png)

### Swap Page

![Swap Screenshot](/screenshot/swap.png)

### Ongoing Swap

![Ongoing Swap Screenshot](/screenshot/swap1.png)

### Swap Report

![Swap Report Screenshot](/screenshot/report1.png)



## Prerequisites

### Required

The Taker app requires the following components to operate:

1. **Bitcoin Core (Mutinynet)** - A fully synced Mutinynet node with proper RPC and ZMQ configuration
   - See the [Bitcoin Core setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/bitcoind.md) for detailed instructions

2. **Tor** - Required for anonymous maker discovery and privacy
   - See the [Tor setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/tor.md) for configuration instructions

3. **Node.js** (v18 or higher) - Only required for building from source

4. **Rust toolchain** - Only required for building from source
   - Install from [rustup.rs](https://rustup.rs/)

### Alternative: Docker Setup

If you prefer a pre-configured environment, you can use Docker Compose to spin up Tor, Bitcoin Core (Mutinynet), and maker services automatically.

See the [Docker setup guide](https://github.com/citadel-tech/coinswap/blob/master/docs/docker.md) for instructions.

### Build from Source
```bash
# Clone the repository
git clone https://github.com/citadel-tech/taker-app.git
cd taker-app

# Install dependencies and setup native modules
# Note: First-time setup compiles Rust code and may take 2-3 minutes
npm install

# Start development mode
npm run dev
```

## Architecture

Built with Electron, Vanilla JavaScript, and Tailwind CSS. The app communicates with the Coinswap protocol through [coinswap-ffi](https://github.com/citadel-tech/coinswap-ffi), which provides native Rust performance for cryptographic operations and protocol handling.

### Native Module Setup

The app uses `coinswap-napi`, a Node.js native addon that wraps the Rust coinswap implementation. This is automatically built and linked during installation:

1. `npm install` triggers the `prepare` script
2. `setup-coinswap.js` clones [coinswap-ffi](https://github.com/citadel-tech/coinswap-ffi)
3. The native module is compiled and symlinked to `node_modules/coinswap-napi`

If you encounter issues with the native module, manually run:
```bash
npm run setup:coinswap
```

## Usage

See the [Usage Guide](docs/usage.md) for detailed instructions on:

- Wallet management and setup
- Browsing the maker marketplace
- Executing coinswaps
- Sending and receiving Bitcoin
- Recovery procedures

## Building for Production

### Prerequisites

Before creating a production build, ensure you have installed all dependencies:
```bash
npm install
```

This will automatically:
- Install Node.js dependencies
- Clone and build the coinswap native module (first build may take 2-3 minutes)
- Build production CSS

### Create Distribution Build
```bash
npm run dist
```

This creates production-ready packages in the `dist/` directory:
- `TakerApp-1.0.0.AppImage` - Portable executable for all Linux distributions
- `taker-app_1.0.0_amd64.snap` - Optional snap package

### Using the AppImage
```bash
# Make executable (one-time)
chmod +x dist/TakerApp-1.0.0.AppImage

# Run directly
./dist/TakerApp-1.0.0.AppImage
```

**Optional desktop integration:**
```bash
# Integrate with application menu
./dist/TakerApp-1.0.0.AppImage --appimage-integrate

# Remove integration
./dist/TakerApp-1.0.0.AppImage --appimage-unintegrate
```

**Extract and inspect:**
```bash
./dist/TakerApp-1.0.0.AppImage --appimage-extract
cd squashfs-root
./TakerApp
```

### Build Optimization

- **Native Module**: Production builds use release-optimized Rust binaries (`--release` flag) for better performance and reduced memory usage
- **ASAR**: Currently disabled to ensure native module compatibility
- **CSS**: Tailwind processes only the classes used in your app for minimal bundle size

## Development

### Development Mode

For development with hot-reload:
```bash
npm run dev
```

This runs:
- Tailwind CSS in watch mode
- Electron in development mode with live reloading

### Development Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies and setup native modules |
| `npm run dev` | Start app in development mode with hot-reload |
| `npm run setup:coinswap` | Clone/update and build the coinswap native module |
| `npm run build:css` | Build Tailwind CSS for production |
| `npm run dist` | Create production build (AppImage + Snap) |
| `npm start` | Start Electron without hot-reload |

### Troubleshooting

**AppImage won't run**
```bash
# Check if FUSE is available
which fusermount

# If missing, install FUSE2
sudo apt install fuse libfuse2

# Or extract and run directly
./TakerApp-1.0.0.AppImage --appimage-extract
./squashfs-root/TakerApp
```

**Error: Cannot find module 'coinswap-napi'**
```bash
npm install
```

**Native module fails to load**
```bash
# Rebuild the native module
cd coinswap-ffi/coinswap-js
npm run build
cd ../..
npm run setup:coinswap
```

**Build takes a long time**

The first build compiles Rust code which can take 2-3 minutes. This is normal. Subsequent builds will be faster as most dependencies are cached.

## Contributing

Contributions are welcome! To contribute:

- **Report Bugs** - Open an issue with reproduction steps
- **Suggest Features** - Propose improvements via issues
- **Submit Code** - Fork, create a feature branch, and submit a PR

### Development Guidelines

- Test changes on both Signet and Regtest before submitting
- Ensure `npm run dist` succeeds before submitting PRs
- For protocol-level changes, contribute to the [core Coinswap library](https://github.com/citadel-tech/coinswap)

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