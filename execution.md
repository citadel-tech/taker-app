# Execution Plan

---

## 1. General

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Font System | Replace current awkward fonts with standard system fonts used in Android/iOS apps (e.g., Inter, SF Pro, Roboto) | `app.js`, global CSS / Tailwind config | Add `font-family: 'Inter', system-ui, -apple-system, sans-serif` to the root stylesheet. Import Inter from Google Fonts or bundle it locally. |
| Update Icon System | Replace emoji-based icons with a proper icon library (e.g., Lucide, Heroicons, or Material Icons) used in modern mobile apps | All component files — `Nav.js`, `FirstTimeSetup.js`, `Recovery.js`, `Settings.js`, `Market.js`, etc. | Install `lucide` or `heroicons`. Replace all emoji/unicode icon usages (`ðŸ"§`, `âš ï¸`, `ðŸ"`, etc.) with SVG icon components from the chosen library. |
| Display All Amounts in Sats with ₿ Symbol | Change all BTC value displays to show amounts in satoshis using comma-separated formatting and ₿ as the unit symbol | `UtxoList.js` (`satsToBtc`), `TransactionsList.js` (`formatAmount`), `SwapReport.js` (`satsToBtc`), `SwapHistory.js` (`satsToBtc`), `Wallet.js`, `Send.js`, `Receive.js`, `Market.js` | Remove `satsToBtc()` conversion calls in display output. Replace with `formatSats(sats)` that returns `sats.toLocaleString() + ' ₿'`. E.g., `1,000,000 ₿` instead of `0.01000000 BTC`. Apply globally across all components. |

---

## 2. Setup Flow — General

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Screen Title and Subtitle | Change the setup modal header title to "Coinswap Client GUI" and subtitle to "Wallet and Other Setups." | `FirstTimeSetup.js` lines 16–18 | Change `<h2>` text from `"Welcome to Coinswap Taker!"` to `"Coinswap Client GUI"`. Change `<p>` subtitle to `"Wallet and Other Setups."` |
| High-Contrast Step Indicator | Render the "Step N of 4" indicator in a high-contrast color to make it visually prominent | `FirstTimeSetup.js` line 23 (`step-indicator` span) | Style `#step-indicator` with a bright background e.g. `bg-white text-[#FF6B35] px-3 py-1 rounded-full font-bold`. |
| Upgrade Notice/Warning/Info Icons | Replace the small inline warning/info icons with larger, clearer icons from the updated icon library | `FirstTimeSetup.js` — all info/warning boxes using emoji (`âš ï¸`, `â„¹ï¸`, `ðŸ§…`, `ðŸ"‹`) | Replace emoji icons with `<svg>` icons from Lucide/Heroicons at `w-5 h-5` or `w-6 h-6`. Apply consistently across all info boxes. |
| Persist Step Data on Back Navigation | Prevent field values from resetting to defaults when navigating back to a previous step | `FirstTimeSetup.js` — `showStep()` function and the Back button handler (lines 1314–1329) | Store each step's field values in the existing `walletData` object whenever the user advances. In `showStep()`, re-populate fields from `walletData` when rendering a step that was previously completed. |

---

## 3. Setup Flow — Step 2 (Bitcoin Endpoints)

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Step 2 Title and Subtitle | Change title to "Bitcoin Endpoints" and subtitle to "Connect to a running bitcoind RPC+REST & ZMQ Ports. This is needed to sync the wallet and market data." | `FirstTimeSetup.js` lines 109–112 (`step-2` section) | Update `<h3>` to `"Bitcoin Endpoints"` and `<p>` subtitle to the new copy. |
| Replace Dual ZMQ Fields with Single ZMQ Port Field | Remove the two ZMQ full-URL inputs (`setup-zmq-rawblock`, `setup-zmq-rawtx`) and replace with a single ZMQ port number field. Prepend `tcp://127.0.0.1:` to the port value internally. | `FirstTimeSetup.js` lines 179–201 (ZMQ Notifications section), `buildConfiguration()` function | Remove both ZMQ URL inputs. Add single `<input type="number" id="setup-zmq-port" value="28332">`. In `buildConfiguration()`, construct `zmqRawBlock` and `zmqRawTx` as `` `tcp://127.0.0.1:${zmqPort}` ``. |
| Rename Test Button and Test All Three Connections | Change "Test RPC Connection" button label to "Test Node Connection" and test RPC, REST, and ZMQ endpoints in the test handler | `FirstTimeSetup.js` line 203 (`test-rpc-setup` button), `testRPCConnection()` function | Change button label to `"Test Node Connection"`. In the click handler, fire three checks: RPC via existing method, REST endpoint (e.g. `http://host:restport/`), and ZMQ port availability. Display pass/fail for each. |
| Update Notice Message | Change the info/notice text to: "Info: Don't have a running Bitcoin Node? Follow these instructions to setup your own node." with a link | `FirstTimeSetup.js` lines 209–221 (yellow info box) | Replace the existing notice text with the new copy and a hyperlink to node setup instructions. |

---

## 4. Setup Flow — Step 3 (Wallet)

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Step 3 Title and Remove Subtitle | Change title to "Choose A Wallet. Or Create a New One." Remove any subtitle text. | `FirstTimeSetup.js` lines 226–229 (`step-3a` section) | Update `<h3>` text. Remove or empty the `<p class="text-gray-400">` subtitle element. |
| Remove Skip Encryption Checkbox | Remove the "Skip encryption" checkbox from the Create Wallet view. Empty password should implicitly mean unencrypted. | `FirstTimeSetup.js` lines 341–350 (`skip-encryption` checkbox), lines 1169–1183 (event listener) | Delete the `skip-encryption` checkbox HTML block and its `change` event listener. |
| Add Subtext Under Wallet Password Label | Add subtext under the "Wallet Password" header in Create Wallet: "Leaving it empty will create unencrypted wallet file" | `FirstTimeSetup.js` lines 290–314 (create password block) | After the `<label>Wallet Password</label>`, add `<p class="text-xs text-gray-500 mb-1">Leaving it empty will create unencrypted wallet file</p>`. |
| Remove No-Password Checkbox from Restore | Remove the "Backup has no password" checkbox from the Restore from Backup view. | `FirstTimeSetup.js` lines 479–488 (`restore-no-password` checkbox), lines 1227–1238 (event listener) | Delete the `restore-no-password` checkbox HTML and its `change` event listener. |
| Update Restore Note Text | Change the restore note to: "Note: Restoring will re-sync the wallet from wallet-birthday. This can take some time." | `FirstTimeSetup.js` lines 495–499 (purple info box in restore section) | Replace existing note text with the updated copy. |

---

## 5. Setup Flow — Step 4 (Tor — reorder to Step 3)

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Move Tor Setup to Step 3 | Reorder setup steps so Tor configuration is Step 3 and Wallet setup becomes Step 4 | `FirstTimeSetup.js` — `showStep()` function, step numbering logic, `currentStep` navigation, and `validateStep3()` / `buildConfiguration()` | Swap the rendering order in `showStep()`: render the Tor step (`step-4`) when `currentStep === 3` and wallet steps (`step-3a/b`) when `currentStep === 4`. Update all validation and config-building references accordingly. Update `totalSteps` if needed. |
| Update Tor Step Subtitle | Change subtitle to: "Connect with the Tor Proxy. This is needed for all network communications." | `FirstTimeSetup.js` lines 505–508 (`step-4` header section) | Update `<p>` subtitle text inside `step-4` header div. |
| Remove Subtext from Port Fields | Remove the helper subtext paragraphs under Control Port and SOCKS Port fields | `FirstTimeSetup.js` lines 524–525 and 536–537 (port subtext `<p>` tags) | Delete the `<p class="text-xs text-gray-500 mt-1">` elements under both port inputs. |
| Remove Subtext from Password Field | Remove the helper subtext under the Tor Auth Password field | `FirstTimeSetup.js` line 565 (`<p class="text-xs text-gray-500 mt-1">`) | Delete that subtext `<p>` element. |
| Update Tor Test to Check Both Ports | Ensure the Tor test button checks both SOCKS port and control port availability | `FirstTimeSetup.js` `testTorConnection()` function | Extend the test handler to validate both `setup-tor-socks-port` and `setup-tor-control-port` connections and show per-port pass/fail status in `#tor-test-result`. |
| Remove Privacy Notice | Remove the purple privacy notice box ("All maker connections go through Tor…") | `FirstTimeSetup.js` lines 574–583 (purple info box with bullet list) | Delete the entire purple privacy notice `<div>` block. |
| Add New Tor Setup Info | Add a new info message: "Info: Don't have a running Tor instance? Use these instructions to set up." with a setup link | `FirstTimeSetup.js` — Tor step section, after the test result div | Insert a new blue info box after `#tor-test-result` with the new copy and a hyperlink to Tor setup instructions. |

---

## 6. Wallet Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Rename Refresh Button | Change the top-right refresh button label to "Refresh" or replace it with just a circular arrow icon | `Wallet.js` — refresh/reload button | Update the button's `textContent` or `innerHTML` to `"Refresh"` or an SVG circular icon. Apply the same pattern to all other page refresh buttons (Market, Send, Receive, etc.). |

---

## 7. Wallet Page — All UTXOs

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Remove P2WPKH/P2WSH/P2TR Filter Buttons | Remove the script-type filter buttons and their associated filter logic. Show script type only as a column in the table. | `UtxoList.js` lines 175–189 (`updateFilterButtons()`), lines 155–173 (`applyFilter()`), HTML filter button block | Delete the script-type filter button HTML. Remove `activeTypeFilter` state and `applyFilter()` by script type. Keep the script type column in the table rows. |
| Add New Spend-Type Filters | Add new filter buttons: Regular UTXOs, Contract UTXOs, Swap UTXOs, Spendable UTXOs | `UtxoList.js` — `applyFilter()` function and filter button HTML | Replace old script-type filters with new spend-type filters. In `applyFilter()`, filter by `spendInfo.spendType`: Regular, Contract, Swap. "Spendable" filters for UTXOs that are not locked in contracts. |
| Remove "Filter by Script Type" Label | Remove any label text before the filter buttons | `UtxoList.js` — filter section HTML | Delete any `<span>` or `<p>` element containing "Filter by Script Type" text. |
| Rename Spend Type Column to "Type" | Rename the "Spend Type" column header to just "Type" with values Regular, Swap, or Contract | `UtxoList.js` — table header HTML and `getUtxoTypeColor()` display logic | Update column header text. In row rendering, map spendType values to simple labels: `Regular`, `Swap`, `Contract`. |
| Add Sorting: Newest and Amount | Add sort controls to sort UTXOs by newest first or by amount | `UtxoList.js` — add sort state and sort logic in `filteredUtxos` pipeline | Add `sortBy` state variable. Add two sort buttons (or a dropdown). In the rendering pipeline, sort `filteredUtxos` by `utxo.confirmations` (newest = lowest/0 first) or by `utxo.amount` descending before rendering. |

---

## 8. Wallet Page — All Transactions

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Summary Items to Received, Sent, Swaps | Change the top summary stat cards to show only: Received, Sent, Swaps — remove Total Transactions and Net Balance cards | `TransactionsList.js` lines 380–397 (stats grid) and `updateStats()` (lines 337–359) | Remove the "Total Transactions" and "Net Balance" cards from the grid. Keep or rename "Total Received", "Total Sent", and add "Total Swaps" stats card. Update `updateStats()` to populate these. |
| Remove Debug Tip Text | Remove the bottom dev/debug tip box: "Tip: Check browser console for transaction type breakdown…" | `TransactionsList.js` lines 433–436 | Delete the entire `<div class="mt-4 p-4 bg-[#0f1419]...">` tip block. |
| Add Sorting: Newest and Amount | Add sort controls for transactions — newest first and by amount | `TransactionsList.js` — `getFilteredTransactions()` and HTML header area | Transactions are already sorted newest-first via `sortTransactionsByTime()`. Add an "Amount" sort option. Add a sort toggle button in the UI. In `getFilteredTransactions()`, conditionally sort by `tx.detail.amount.sats` descending when amount sort is active. |

---

## 9. Market Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Remove Top Warning Message | Remove the warning/info message currently shown at the top of the market page (if present) | `Market.js` — top of `content.innerHTML` template (~line 819) | Check for and delete any warning box HTML at the top of the market content. (Currently no explicit warning div is present; confirm and skip if not found.) |
| Remove Maker Data Row | Remove the "Maker Data" informational row if present | `Market.js` — `content.innerHTML` | Locate and remove any "Maker Data" row or info section in the market HTML template. |
| Rename "Refund Lock Time" to "Refund Locktime" | Fix the label in the Fee Calculation section | `Market.js` lines 843–851 (fee calculation box) | Change `"Refund Lock Time"` to `"Refund Locktime"` in the fee formula text. |
| Add Refund Locktime Explanation | Add text below the fee calculation box: "Refund Locktime depends on the position of a maker in swap circuit. Calculated as 20*(n+1), where n = index position of the maker in the swap circuit." | `Market.js` — after the fee calculation `<code>` block (~line 848) | Insert a new `<p class="text-gray-400 text-sm mt-3">` with the explanation text after the formula block. |
| Remove "Lower Fee means..." Text | Remove the explanatory text that starts with "Lower fees mean cheaper swaps…" | `Market.js` lines 847–850 | Delete the `<p class="text-gray-400 text-sm mt-2">Lower fees mean...` paragraph. |
| Remove Average Fee Summary Card | Remove the "Average Fee" stat card from the summary tab area | `Market.js` `updateUI()` function lines 703–718 and `calculateStats()` | Remove the Average Fee card from `statsContainer.innerHTML`. Remove `avgFee` from `calculateStats()` return value. Remove the grid column. |
| Add Total Fidelity Locked Amount Card | Add a new summary card showing total fidelity bond amount locked across all makers | `Market.js` `calculateStats()` and `updateUI()` | In `calculateStats()`, compute `totalFidelity = displayedMakers.reduce((sum, m) => sum + m.bond, 0)`. Add a new card in `statsContainer.innerHTML` displaying this value. |
| Add Nostr Relays Card | Add a summary card showing the number of Nostr relays used for market sync | `Market.js` `updateUI()` summary section | Add a "Nostr Relays" stat card. Source relay count from API (if available via `window.api.taker.getOffers()` response or a new endpoint). Display statically if API doesn't expose it yet. |
| Remove Online Makers Count Card | Remove the "Online Makers" stat card from the summary section | `Market.js` `updateUI()` lines 713–716 | Delete the "Online Makers" card from `statsContainer.innerHTML`. Remove `onlineMakers` from `calculateStats()`. |
| Rename "Maker Address" Column to "Tor Address" | Update the column header in the maker table | `Market.js` line 898 (`<div class="font-semibold">Maker Address</div>`) | Change text to `"Tor Address"`. |
| Reduce Table Header Font Size | Make all table column header text smaller so it fits in a single line | `Market.js` lines 892–905 (header grid row) | Add `text-xs` class to the header grid row or each `<div class="font-semibold">` cell. Adjust column widths if needed. |

---

## 10. Market Page — Fidelity Bond Details

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Rename "Maker Address" to "Tor Address" in Detail Modal | Update label in the fidelity bond detail modal | `Market.js` line 450 (`<p class="text-sm text-gray-400 mb-1">Maker Address</p>`) | Change label text to `"Tor Address"`. |
| Simplify Bond Summary to Three Fields | Show only: Bond Amount, Bond Status, Expires In (days estimate). Remove all other fields. | `Market.js` `viewFidelityBond()` function lines 441–548 | Remove grids for Bond Outpoint, Confirmation Height, Bond Public Key, Required Confirmations, Minimum Locktime, Certificate Expiry detail rows. Keep Bond Amount, Bond Status, and compute `expiresInDays` from `bondLocktime` (blocks ÷ 144) to show "~X days". |
| Make Bond Txid Clickable | Make the Bond Txid open mempool.space in an external browser | `Market.js` — bond modal | In the simplified bond summary, add the `bondTxid` as a clickable element: `onclick="window.open('https://mempool.space/.../tx/${maker.bondTxid}', '_blank')"` with an underline style. |
| Remove "View on Block Explorer" Button | Remove the dedicated explorer button from the bond detail modal | `Market.js` lines 529–536 (explorer button block) | Delete the `<div>` containing the "View on Block Explorer" button. |

---

## 11. Send Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Page Title to "Send" | Ensure the page title is simply "Send" | `Send.js` — page header | Confirm `<h2>` text is `"Send"`. Update if it says something else. |
| Bug Fix: Manual UTXO Selection — Change Amount and Remaining Balance | Fix bug where Change Amount and Remaining Balance are not displayed when UTXOs are manually selected | `Send.js` — `updateSummary()` function and manual UTXO selection flow | In `updateSummary()`, ensure the `selectionMode === 'manual'` branch correctly computes and renders `changeAmount = selectedUtxosTotal - totalToSend - fee` and `remainingBalance = availableBalance - selectedUtxosTotal`. Check that summary DOM elements are not hidden when in manual mode. |
| Calculate and Display Estimated Time | Replace "Est. Time" with a real estimate: for mainnet/testnet use fee-based block estimation; for signet hardcode 30 secs; for regtest show "N/A" | `Send.js` — summary section, `updateSummary()` | Detect the network from `bitcoinNetwork` config. For mainnet/testnet: compute `estimatedBlocks = 1` (at selected fee rate) and display `~10 min`. For signet: display `"~30 sec"`. For regtest: display `"N/A"`. |
| Remove RBF Toggle | Remove the RBF (Replace-By-Fee) option since it is disabled for all transactions | `Send.js` — RBF checkbox/toggle in HTML and its logic | Delete the RBF checkbox HTML element and any associated state or logic. |
| Remove "Sign first… then broadcast" Info | Remove the info text "Sign first… then broadcast" from the UI | `Send.js` — info box HTML | Locate and delete the info box containing this text. |

---

## 12. Receive Page — All Addresses

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Remove "Total Addresses" Stat Card | Remove the Total Addresses stat card since it always equals Used Addresses | `AddressList.js` lines 211–215 (Total Addresses card in stats grid) | Delete that stat card `<div>` block. Update grid from `grid-cols-4` to `grid-cols-3`. |
| Replace Filter by Address Type with Spend-Type Filters | Remove address-type filters (P2WPKH, P2TR etc.) and replace with: Regular, Contract, Swap | `AddressList.js` lines 230–260 (filter section), `getFilteredAddresses()`, `detectAddressType()` | Update `currentFilter` values to `regular`, `contract`, `swap`. Update `getFilteredAddresses()` to filter by address spend type (sourced from the API response or address metadata) instead of script type. Update filter button labels. |
| Remove Privacy Tip | Remove the privacy tip text from the All Addresses view | `AddressList.js` — any privacy tip element in the address list HTML | Locate and delete any privacy tip info box in the `render()` HTML output. |
| Bug Fix: Unknown Address Types | Fix the bug where some address types display as "Unknown" — address type should always be determinable | `AddressList.js` lines 50–58 (`detectAddressType()`), `Receive.js` lines 145–153 | Extend `detectAddressType()` to handle regtest/signet prefixes (`bcrt1p` for P2TR, `tb1p` for testnet P2TR, `bcrt1q` for regtest P2WPKH). Add fallback from UTXO spend type data if address prefix matching fails. |
| Remove Status Column | Remove the Status column from the address table since unused addresses are not shown | `AddressList.js` — table header and row rendering with `getStatusInfo()` | Delete the Status column from table headers. Remove the status badge from each address row. Remove `getStatusInfo()` call from render. |

---

## 13. Swap Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Remove "You Can Only Swap With..." Notice | Remove the obsolete notice about swap restrictions | `Swap.js` — top of content HTML template | Locate and delete the notice box with this text. |
| Add Minimum Hop Warning | Add: "Warning: If swap with only one maker, the maker can deanonymize you. Recommended minimum hop = 2." | `Swap.js` — top of content HTML, after the removed notice | Insert a yellow warning box `<div>` with the new warning text. |
| Rename "Selection Mode" to "Select UTXOs" | Rename the UTXO selection mode label | `Swap.js` — UTXO selection section HTML | Change any label/header text reading "Selection Mode" to "Select UTXOs". |
| Bug Fix: Max Swap Amount Calculation | Fix the max swap amount bug — it should be `max(regular_balance, swap_balance) - 3000 sats` using the same logic as `taker::api::check_swap_liquidity` | `Swap.js` — `fetchUtxos()` and swap amount max calculation. `api1.js` — add a new API call | Add a new IPC-exposed function in `api1.js` that calls `taker::api::check_swap_liquidity` (or equivalent). In `Swap.js`, call this to get the correct max swappable amount. Display it as the upper bound for the amount input. |
| High-Contrast Available Makers Display | Make the "Available Makers" count bigger and brighter/high-contrast | `Swap.js` — available makers display element | Increase font size to `text-2xl` or `text-3xl`, use `text-[#FF6B35]` or `text-white font-bold` styling. |
| Rename "Available Balance" to "Swappable Balance" | Update the label in Swap Summary | `Swap.js` — swap summary section HTML | Change label text from `"Available Balance"` to `"Swappable Balance"`. |
| Add Selected Makers' Addresses to Summary | Display the Tor addresses of selected makers in the Swap Summary | `Swap.js` — swap summary section | Add a "Selected Makers" row in the summary. Populate with `.address` from each selected maker object in `availableMakers`. |
| Update Estimated Time Calculation | Compute estimated swap time as `BlockInterval * nHops` reflecting current network block time | `Swap.js` — swap summary `estimatedTime` calculation | Determine block interval from network config (signet=30s, mainnet=600s, regtest=0). Compute `estimatedTime = blockInterval * numberOfHops` and display in minutes/seconds. |
| Improve Maker Fee Estimation | Calculate exact maker fees per hop position using the deterministic formula instead of a rough estimate | `Swap.js` — maker fee display in summary | For each maker at hop position `i`, compute fee as `baseFee + amount * volumeFeePct + refundLocktime(i) * amount * timeFeePct` where `refundLocktime(i) = 20 * (i + 1)`. Sum across all hops. Display exact value in sats. |
| Add Number of Funding Transactions | Display the number of funding transactions in the Swap Summary | `Swap.js` — swap summary | Add a "Funding Txs" row. Value = `numberOfHops` (one funding tx per hop). |
| Add Funding Tx Average Size | Display funding tx average size in the Swap Summary (assume 2 inputs, rest is deterministic) | `Swap.js` — swap summary | Compute `avgFundingTxSize` based on 2 inputs + deterministic output structure (approx 250–400 vB). Display in the summary. |
| Calculate and Display Exact Network Fee | Show exact network fee as `nFundingTx * avgTxSize * feeRate` | `Swap.js` — swap summary | Add "Network Fee" row. Compute as `numberOfHops * avgFundingTxSize * networkFeeRate`. Display in sats. |
| Remove "Privacy Benefits" Info Box | Remove the info box about privacy benefits from the swap initiation screen | `Swap.js` — swap summary or initiation section | Locate and delete the info box with "Privacy Benefits" text. |

---

## 14. Swap Page — Recent Swaps / Swap History

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Expand Recent Swaps to Full Table Layout on Main Swap Page | Replace the compact Recent Swaps section with a full table layout directly on the Swap page. Remove the separate Swap History page navigation. | `Swap.js` — recent swaps section at bottom, `SwapHistory.js` | In `Swap.js`, replace the "Recent Swaps" collapsed section with the full table layout from `SwapHistoryComponent`. Inline the history display rather than navigating to `SwapHistory.js`. |
| Move Swap History Data to Main Swap Page | All history data (stats + list) should live on the main swap page | `Swap.js`, `SwapHistory.js` | Call `loadSwapHistory()` within `SwapComponent` and render summary stats + swap rows inline on the main swap page. |
| Rename "Total Volume" to "Total Amount" | Update the stat label in swap history summary | `SwapHistory.js` line 226 | Change `"Total Volume"` text to `"Total Amount"`. |
| Replace "Avg Hops" with "Avg Fee Paid" | Remove the avg hops metric and replace with avg fee paid | `SwapHistory.js` lines 181–186 (`avgHops` calculation) and lines 232–235 (display card) | Remove `avgHops` calculation. Compute `avgFeePaid = totalFees / totalSwaps`. Update the stat card label to `"Avg Fee Paid"` and display in sats. |
| Remove "Clear History" Button | Remove the Clear History button — swap history must always be preserved | `SwapHistory.js` lines 204–211 (conditional Clear History button), lines 265–276 (event listener) | Delete the Clear History button HTML and its click event listener. |
| Include Failed Swaps in History | Show failed swap histories in addition to completed ones | `SwapHistory.js` line 14 (`.filter(report => report.status === 'completed')`) | Remove the `.filter()` that excludes non-completed swaps. Add a status badge (e.g. "Failed" in red) in the row rendering to visually distinguish failed swaps. Confirm failed swap data is available from `window.api.swapReports.getAll()`. |
| Categorise Swaps by Protocol | Group or label swaps by their protocol (Legacy P2WSH vs Taproot) | `SwapHistory.js` — row rendering in `buildSwapHistoryList()` | Add a protocol badge (e.g. "Legacy" / "Taproot") to each swap row derived from `report.protocol` or equivalent field. Consider grouping rows by protocol with a section header if the field is available. |

---

## 15. Coinswap Report

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Update Subtitle | Change subtitle to: "View Detailed Swap Data." | `SwapReport.js` — page header subtitle | Add or update `<p>` subtitle in the report header. |
| Change "Back To Wallet" to "Back to Swaps" | Update the back navigation button label | `SwapReport.js` — back button HTML and `app.js` navigation target (line 19 references `wallet`) | Change button text to `"Back to Swaps"`. Update the `onclick` handler to navigate to the Swap page instead of the Wallet page. |
| Rename "Transaction Flow" to "Swap Circuit" | Change the section heading | `SwapReport.js` — swap flow/circuit section heading | Change `"Transaction Flow"` text to `"Swap Circuit"`. |
| Replace Link Icon Before "Transaction Flow" | Replace the link/chain icon with a circuit-style icon | `SwapReport.js` — icon before the Transaction Flow heading | Replace the link icon SVG with a circuit SVG icon (e.g. from Lucide `Circuit` or a custom SVG). |
| Fix Swap Graphics Alignment | Fix overlapping graphics and misaligned arrows in the swap circuit diagram | `SwapReport.js` — swap diagram/graphics HTML and CSS | Audit the diagram container. Use `flexbox` or `grid` layout with explicit widths. Center arrows using `margin: auto` or `absolute` positioning within their containers. |
| Update Taproot Privacy Info Box | Update the info box just below the swap graphics with new content | `SwapReport.js` — Taproot info box HTML | Replace content with: "Save Money: Lesser Fees than V1 swaps." / "Efficient: Combined tapscript with Musig2 + HTLC leaves." / "Anonymity Set — Legacy: All P2WSH UTXOs." / "Anonymity Set — Taproot: All Taproot Single Sig UTXOs." |
| Bug Fix: On-Chain Txs Count | Fix the bug showing wrong on-chain tx count (showing 2 for a 3-hop swap) | `SwapReport.js` — `report.totalFundingTxs` rendering | Verify `totalFundingTxs` is being read from the correct field in the report object (check both camelCase and snake_case variants in the normalization block lines 25–52). Ensure the display uses `report.totalFundingTxs` correctly. |
| Remove Funding Tx Info Box | Remove the info box from the Funding Transactions section | `SwapReport.js` — Funding Transactions section | Locate and delete the info box HTML within the Funding Transactions area. |
| Remove Privacy Details from Funding Tx Section | Remove "Privacy Details" subsection from Funding Transactions | `SwapReport.js` — Funding Transactions section | Delete the Privacy Details element from the funding transactions section. |
| Simplify UTXO Summary to Two Items | Show only: Outgoing Regular/Swap UTXOs and Incoming Swap UTXOs. Remove everything else. | `SwapReport.js` — UTXO Summary section | Remove all other UTXO detail rows. Keep only two rows: "Outgoing Regular/Swap UTXOs" (determine type from wallet data) and "Incoming Swap UTXOs". Populate from `report.inputUtxos` and `report.outputSwapUtxos`. |
| Rename "Done" Button to "Back to Swaps" | Update the final/done button label and navigation | `SwapReport.js` — done/close button | Change button text from any "Done..." variant to `"Back to Swaps"` and update click handler to navigate to the Swap page. |

---

## 16. Recovery Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Reorder Layout: How Recovery Works as Main Text | Move "How Recovery Works" to be the primary/first content on the page | `Recovery.js` lines 35–61 (How Recovery Works block) | Restructure layout to place the How Recovery Works section at the top of the page, not in a side column. |
| Move Recovery Stats to Main Summary View | Elevate Recovery Stats to be the primary summary section visible at the top | `Recovery.js` lines 64–80 (Recovery Stats block) | Move Recovery Stats block to be prominently displayed below the How Recovery Works text, as a horizontal summary bar. |
| Move Trigger Recovery to Top-Right Button | Replace the current centered/embedded layout of the manual recovery button with a top-right corner button | `Recovery.js` lines 25–28 (`manual-recovery-btn`) | Move the recovery button HTML to a top-right position using `absolute top-4 right-4` or a header flexbox row. Update styling to a standard top-action button. |
| Update "How Recovery Works" Copy | Replace the current step-list text with the new copy | `Recovery.js` lines 37–54 (numbered steps) | Replace step text with: (1) "The Recovery routine detects failed swaps, waits for HTLC timelock expiry then creates and broadcasts a refund transaction back to wallet." (2) "It might take several hours for timelock to expire." (3) "Recovery is automatically triggered for any unspent swap contract transactions at wallet startup. If you still see pending recoveries here, use the Trigger Recovery button to manually trigger a recovery." (4) "While waiting for recovery the app can be safely closed. Recovery will resume in next restart." (5) "Always ensure to not have very old pending recoveries. That can put your funds at risk." |

---

## 17. Log Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Remove Bottom-Right Info Text | Remove the performance warning info box at the bottom right of the Log page | `Log.js` lines 216–221 (yellow performance warning box) | Delete the `<div class="bg-yellow-500/10 border border-yellow-500/30...">` warning block. |

---

## 18. Settings Page

| Task Name | Task Description | Code Site | Suggested Code Change |
|-----------|-----------------|-----------|----------------------|
| Replace Wallet Backup Description with Single Text Block | Replace bullet-point backup tips with a single consolidated description paragraph | `Settings.js` lines 26–37 (blue tips info box) | Replace the tips `<ul>` block with a single `<p>` containing: "Wallet Backup is an encrypted json file that restores your coinswap wallet in any client app. The backup file contains all data related to swaps to restore swap histories. The backup file can also be used to migrate your coinswap wallet from one client app to another. Always use a strong password for the backup file, or else your seed phrase can be compromised. Use the same password while restoring wallet from backup." |
| Consolidate Taker Config into Single Compact Section | Merge all Taker configuration options (Tor, Bitcoin RPC, ZMQ) into one compact section | `Settings.js` lines 40–285 (separate Taker Config, Bitcoin Core RPC, ZMQ sections) | Combine Tor config, Bitcoin RPC config, and ZMQ config into a single "Node & Network Configuration" section. Use a compact grid layout instead of large spaced-out blocks. |
| Add Test Tor Button | Add a "Test Tor" button that checks both control and SOCKS ports | `Settings.js` — Tor Configuration section | Add a `<button id="test-tor-btn">Test Tor</button>`. In its click handler, test both `tor-control-port-input` and `tor-socks-port-input` connections and display per-port pass/fail results. |
| Rename Bitcoin Test Button to "Test Bitcoind" and Test RPC + REST + ZMQ | Rename the test button and expand its test to cover RPC, REST, and ZMQ | `Settings.js` lines 199–201 (`test-connection-btn`) | Change button label to `"Test Bitcoind"`. Extend the test handler to check RPC, REST endpoint, and ZMQ port. Display individual pass/fail for each. |
| Remove Connect and Disconnect Buttons | Remove the Connect and Disconnect buttons from the Bitcoin settings | `Settings.js` lines 203–210 (`connect-btn`, `disconnect-btn`) | Delete both button HTML elements and their event listeners. |
| Remove Refresh Status Button | Remove the "Refresh Status" button | `Settings.js` lines 212–214 (`refresh-status-btn`) | Delete the Refresh Status button HTML and its event listener. |
| Replace Dual ZMQ Fields with Single ZMQ Port Field | Replace the two full ZMQ URL inputs with a single ZMQ port number field | `Settings.js` lines 228–254 (ZMQ Endpoints section) | Remove `zmq-rawblock-input` and `zmq-rawtx-input` full URL fields. Add single `<input type="number" id="zmq-port-input" value="28332">`. Construct full URLs internally when saving settings. |
| Add `rest=1` to Bitcoin.conf Reference | Add the `rest=1` setting to the complete bitcoin.conf reference block | `Settings.js` lines 292–332 (`full-config-preview`) | Insert `rest=1` line in the `[signet]` and `[regtest]` sections of the conf reference block. |
| Remove All Other Info Boxes from Settings | Remove all remaining info/tip boxes from the Settings page (ZMQ warning, blue tips, etc.) | `Settings.js` — all `<div class="bg-...-500/10 border border-...-500/30">` info boxes outside the retained ones | Audit and delete all info/warning boxes in Settings except the retained backup description text and any error state boxes needed for functionality. |
