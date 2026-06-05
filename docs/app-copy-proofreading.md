
## Recovery

### Recovery Flow

Detect failed swaps and unspent contract outputs in the wallet.

Wait for the HTLC timelock to expire before spending the refund path.

Create and broadcast the recovery transaction back to your wallet.

Resume recovery on restart if the app was closed while waiting.

### Manual Recovery

If automatic recovery has not completed, run a manual recovery check. The app will scan recoverable swap contracts and attempt safe refunds.

Recovery process has started automatically. Check your wallet for returned funds.

## Settings -> Wallet Backup

Export your wallet to an encrypted file. Can be restored on any coinswap client and includes all swap history data. Always use a strong password.

Wallet Backup is an encrypted JSON file that restores your coinswap wallet in any client app.

The backup file contains all data related to swaps to restore swap histories.

The backup file can also be used to migrate your coinswap wallet from one client app to another.

Always use a strong password for the backup file, or else your seed phrase can be compromised.

Use the same password while restoring wallet from backup.

Skip encryption (not recommended)


## Send

### Address Reuse Warning

Privacy: You've sent to this address before. Reusing an address links transactions and reduces anonymity. Ask the recipient for a fresh address.


## Receive

### Address Reuse Warning

Privacy: Reusing addresses links transactions on-chain. Generate a fresh address for each payer to preserve anonymity.

## Swap -> Configure

### Initiate Swap

Route a private Bitcoin swap through multiple makers over Tor.

### Amount To Swap

Enter the amount you want to send through the swap.

### UTXO Selection

Mixing Regular and Swap UTXOs in the same transaction can compromise privacy.

### Maker Selection

Warning: If you swap with only one maker, that maker can deanonymize you. Recommended minimum makers = 2.

### Protocol

Taproot uses the v2 swap path with compatible makers. Legacy uses the v1/P2WSH path for makers that do not support Taproot.

## Swap -> Progress Stages

### Step 1 -> Initiating

Executing swap through {maker_count} makers...

### Step 2 -> Establishing Tor circuits

### Step 3 -> Funding HTLC contracts

### Step 4 -> Routing atomic swap

### Step 5 -> Finalizing swap

### Progress circle -> Text inside the center

This text appears inside the center of the progress circle.

| Process moment | Copy |
| --- | --- |
| Starting connection and maker negotiation | Handshake |
| Contract setup, funding, confirmation, and key exchange | Contract Establishment |
| Sweep and completion | Settlement |
| Failure state | Swap Failed |

### Progress circle -> Circle names

These are the names shown on the wallet and maker circles.

| Circle | Copy |
| --- | --- |
| Wallet circle | Your wallet |
| Maker circle | Maker {number} |
| Maker address placeholder | Pending |

### Progress circle -> Task text under circles

These appear under the wallet or maker circles as the task/status that circle is currently doing. Listed in process order.

| Process order | Circle | Copy |
| --- | --- | --- |
| Initial state before activity starts | Wallet and maker circles | Awaiting |
| Swap starts | First maker circle | Initializing... |
| Maker offer discovery | First maker circle | Fetching offers... |
| Maker negotiation | First maker circle | Negotiating... |
| Maker or wallet connection complete | Wallet or maker circle | Connected |
| Contract broadcast starts | Maker circle | Broadcasting... |
| Transaction seen before confirmation | Maker circle | In mempool... |
| Transaction confirmed | Maker circle | Confirmed |
| Intermediate makers become active | Maker circles | Processing... |
| Contract data is being sent | Maker circle | Contracting... |
| Contract data received | Maker circle | Contract received |
| Contract data verified | Maker circle | Contract ready |
| Private key handover starts | Maker circle | Key exchange... |
| Private key received | Maker circle | Key received |
| Contract data exchange across makers | Maker circles | Exchanging... |
| Swap route finalization | Maker circles | Finalizing... |
| Incoming contract registered | Final maker circle | Receiving... |
| Incoming contract sweep starts | Final maker circle | Sweeping... |
| Funds received by wallet | Wallet circle | Received |
| Swap completed | Maker circles | Complete |
| Recovery starts after failure | Maker circle | Recovering... |
| Swap failure | Maker circles | Failed |

### Complete

Swap Complete!

### Failed

The coinswap could not be completed. Your funds are safe and recovery has been initiated.

Your funds are protected.

Recovery process has started automatically. Check your wallet for returned funds.
