# Coinswap Taker App

A desktop application for performing private Bitcoin coinswaps.

## Prerequisites

- Node.js (v18+)
- Rust toolchain
- Bitcoin Core (with RPC and ZMQ enabled)

## Setup

```bash
git clone https://github.com/citadel-tech/taker-app.git
cd taker-app
npm install
npm run dev
```


## Bitcoin Core Configuration

here is my `bitcoin.conf`:
```
[signet]
signetchallenge=0014c9e9f8875a25c3cc6d99ad3e5fd54254d00fed44
rpcuser=user
rpcpassword=password
fallbackfee=0.00001000
server=1
txindex=1
blockfilterindex=1
addnode=172.81.178.3:38333
rpcport=38332
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28333

# Regtest
[regtest]
rpcuser=user
rpcpassword=password
fallbackfee=0.00001000
server=1
txindex=1
blockfilterindex=1
rpcport=18443
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:283323

```


Note: on initial start, there will be a popup that ask for all the ports and settings. configure them based on your own configuration. 