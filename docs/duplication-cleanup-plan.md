# Dead Code & Duplication Cleanup Plan

## Scope

Covers the app's own source: `main.js`, `preload.js`, `api1.js`, `openswap-worker.js`, and everything under `src/`. Renderer components load as native ES modules (`src/index.html` does `<script type="module" src="js/app.js">`, every component uses plain `import`/`export`) — **there is no bundler**, so consolidating duplicated logic into shared modules is a pure file-move, not a build-config change.

**Out of scope:** `openswap-ffi/` is a separate, git-ignored repo (`citadel-foss/openswap-ffi`) cloned in by `setup-openswap.js` — it is not part of this repo's history and shouldn't be touched here. It has its own, worse, duplication problem (the N-API and UniFFI bindings hand-duplicate the same wrapper logic and have already drifted — different error models, different field types, different defaults). That's a separate upstream fix; flagging it here only so it isn't accidentally folded into this cleanup's scope.

This plan also doesn't re-litigate the security/correctness issues surfaced during the code read (plaintext credentials in `localStorage`, the simulated "Sign Transaction" step, in-memory-only active-swap tracking that doesn't survive a restart). Those are correctness bugs, not duplication/dead-code — worth their own pass.

---

## Part 1 — Delete outright

Things with zero functional dependents. No behavior changes, no migration needed — just removal.

**Status: items 1-8 done** (removed in the working tree, not yet staged/committed).

| # | What | Where | Evidence | Status |
|---|------|-------|----------|--------|
| 1 | `TransactionsListComponent` | `src/components/wallet/TransactionsList.js` (522 lines) | `grep -rn "TransactionsListComponent" src/` matches only its own definition. Not in `app.js`'s component map, not imported by `Wallet.js`. Superseded by `Wallet.js`'s inline transaction panel, which reimplements the same filter/sort/format logic instead of importing from here. | ✅ Removed |
| 2 | `UtxoListComponent` | `src/components/wallet/UtxoList.js` (675 lines) | Same: zero importers anywhere in `src/`. Its "Send Selected" / "Swap Selected" buttons import `Send.js`/`Swap.js` with a manual-UTXO-selection handoff that is itself unreachable now, since nothing routes to this component. | ✅ Removed |
| 3 | `showPasswordPrompt()` | `src/js/app.js:174-~310` (~140 lines) | Defined once, called nowhere (`grep -n "showPasswordPrompt(" src/js/app.js` shows only the `async function` line). `TakerInitializationComponent` (`src/components/taker/TakerInitialization.js`) already renders its own inline password prompt on `needsPassword`/`wrongPassword` — this is the abandoned first version of that flow. | ✅ Removed (+ now-unused `icons` import in `app.js`) |
| 4 | Passthrough helper exports | `src/components/taker/TakerInitialization.js:388-435` — `getTakerBalance`, `getTakerAddress`, `syncTakerWallet`, `getTakerTransactions`, `getTakerUtxos`, `sendToAddress`, `syncOfferbookAndWait`, `getOfferbook`, `startOpenswap`, `getSwapStatus`, `recoverActiveSwap`, `getLogs` | Only `TakerInitializationComponent` is imported from this file anywhere else in `src/` (`grep -n "from '.*TakerInitialization.js'"`). These are unused **and** actively wrong if anyone did reach for them: the exported `sendToAddress(address, amount)` takes 2 args, but the real call site in `Send.js` passes `(address, amount, feeRate, manuallySelectedOutpoints)` — a stale duplicate signature, not just dead weight. | ✅ Removed |
| 5 | One copy of `updateYouSend`/`updateYouReceive` | `src/components/swap/Openswap.js:399-405` and `:1154-1160` | Byte-identical function bodies declared twice in the same component scope. The second silently shadows the first (not a syntax error — duplicate `function` declarations in the same scope are legal, just confusing). Delete the first pair, keep the one co-located with the other `update*` header-state helpers at `:1154`. | ✅ Removed (first copy) |
| 6 | `wallet_data_cache` localStorage write | `src/components/wallet/Wallet.js` (`WALLET_CACHE_KEY`, written after every load) | `grep -rn "wallet_data_cache" src/` shows only the write site. Nothing reads it back. Pure dead write — remove the cache-set call and the constant. | ✅ Removed |
| 7 | `btc-price-updated` CustomEvent | `src/js/price.js:82` | Only occurrence in the entire `src/` tree is the `dispatchEvent` call itself — no `addEventListener('btc-price-updated', ...)` anywhere. Dead event; the price value is already consumed synchronously via `refreshBtcPriceUsd()`'s return value / cache, so this was probably an abandoned reactive-update mechanism. | ✅ Removed |
| 8 | `SwapStateManager.SWAP_HISTORY` bucket | `src/components/swap/SwapStateManager.js:7,155-207` (`completeSwap`, `getSwapHistory`, `clearHistory`) | Written by `Openswap.js:816` on every swap completion (including the synthetic `getDefaultReport()` fallback), but `SwapHistory.js` — the actual history UI — reads exclusively from `window.api.swapReports.getAll()` (disk-backed report files), never from this localStorage bucket. `getSwapHistory()` has no callers. This is a second, silently-drifting swap-history store that nothing reads. Removing it also removes one source of "which report is authoritative" confusion. | ✅ Removed (also fixed the now-dangling `getSwapHistory()` reference inside `getStorageInfo()`) |

**Net removal: ~1,340+ lines** across items 1-2 alone, plus the smaller dead blocks in 3-8.

---

## Part 1b — More dead code found in a follow-up sweep

**Status: items 9-17 done** (removed in the working tree, not yet staged/committed).

After Part 1 landed, a broader sweep — every exported symbol in `src/` cross-checked for call sites, plus a diff of `ipcMain.handle(...)` channels in `api1.js` against what `preload.js` actually exposes and what the renderer actually calls — turned up more unused code. **None of this is a knock-on effect of the Part 1 deletions** (re-verified: nothing in the edited files became newly orphaned); it's pre-existing dead code the first, component-focused pass didn't cover.

Note on the two most surprising-looking entries (9 and 13): in both cases the *feature* works fine — a different, actually-wired function in the same file does the real work. Item 9 is a spare pass-through wrapper around the `bitcoindConnection` singleton (which is what's actually imported and used elsewhere). Item 13 is a spare aggregate-stats helper sitting next to `loadSwapHistory()`/`buildSwapHistoryMarkup()`/`openSwapReport()`, which are the three exports from that file that are actually used to load and render history.

| # | What | Where | Evidence |
|---|------|-------|----------|
| 9 | `ensureBitcoindConnection()` | `src/components/connection/BitcoindConnection.js:221` | One-line pass-through (`return await bitcoindConnection.connect()`). Zero call sites — every consumer already imports the `bitcoindConnection` singleton directly and drives connection/retry logic on it (see `ConnectionStatusComponent`). |
| 10 | `getBitcoindConnection()` | `src/components/connection/BitcoindConnection.js:225` | One-line pass-through (`return bitcoindConnection`). Zero call sites — same reason as #9, nobody needs a getter for something they already import by name. |
| 11 | `hasBtcPriceUsd()` | `src/js/price.js:48` | Zero call sites anywhere in `src/`. |
| 12 | Whole file pair: `SatsAmount.tsx` + `SatsAmount.css` | `src/components/ui/` | A React/TSX component (`import type { HTMLAttributes } from "react"`, JSX syntax) in a project with **no React, no TypeScript compiler, no bundler** (`package.json` has none of `react`/`typescript`/`vite`/`webpack`/`babel`) — nothing in this app is even capable of loading a `.tsx` file. Not imported anywhere; `Wallet.js` has its own unrelated same-named `renderSatsAmount()` function. `SatsAmount.css` isn't pulled into `styles/input.css`/`output.css` either. Almost certainly a leftover from an abandoned React prototype. |
| 13 | `summarizeSwapHistory()` | `src/components/swap/SwapHistory.js:300` | Zero call sites. Computes aggregate stats (total/completed/failed swap counts, total amount, total fees, avg fee) — looks like it was written for a stats-card header that was never built into `SwapHistoryComponent`'s UI, or was cut later. |
| 14 | `taker:shutdown` IPC handler | `api1.js:1811` (`registerTakerHandlers`) | Registered via `ipcMain.handle`, but **never exposed in `preload.js`** (confirmed by diffing every `ipcMain.handle('...')` channel in `api1.js` against every `ipcRenderer.invoke('...')` channel in `preload.js` — this is the only one-sided entry) — so the renderer has no way to call it. `main.js`'s `before-quit` handler also doesn't call the underlying shutdown logic directly. Fully unreachable. *(Related but separate from "unused code": this also means the taker instance is never explicitly shut down when the app quits — a correctness gap, not addressed by this cleanup.)* |
| 15 | `preferences:get` / `preferences:set` IPC handlers + `window.api.preferences.{get,set}` | `api1.js` (`registerTakerHandlers`), `preload.js` | A whole unused feature — zero renderer call sites for `window.api.preferences.*`. App config round-trips through `localStorage['openswap_config']` instead; the one real preference the app has (`logLevel`) is read/written via `store.get('logLevel')`/`store.set('logLevel', ...)` directly inside the main process, bypassing this IPC pair entirely. |
| 16 | `taker:isWalletEncrypted` IPC handler + `window.api.taker.isWalletEncrypted` | `api1.js`, `preload.js` | Has a real backend implementation, but zero renderer call sites. The actual encrypted/unencrypted detection happens inline via `preflightExistingWallet()` during `taker:initialize` instead. |
| 17 | `taker:getGoodMakers` IPC handler + `window.api.taker.getGoodMakers` | `api1.js`, `preload.js` | Zero renderer call sites — superseded by `taker:getOffers`, which does its own good/bad/unresponsive categorization inline. |

---

## Part 1c — Third pass: broader sweep (main process, renderer, Rust) + independent cross-check of Parts 1/1b

**Status: item 18 fixed (not just deleted — see below), items 20-26 done. Item 19 (`About.js`) still open — awaiting a decision on wire-in vs. delete.**

Done in two halves, per explicit ask: (1) an independent fresh dead-code sweep — three parallel agents covering main-process/IPC, renderer components, and `tor-manager`'s Rust code, each told not to trust the prior findings and to look again from scratch; (2) a from-scratch verification that Parts 1 and 1b didn't break anything — a mechanical script cross-checking every `import`/`export` across all 23 first-party ES module files against actual exports (zero mismatches), plus a repo-wide grep for all 17 previously-removed identifiers (zero real leftover references). **Conclusion: Parts 1 and 1b did not break anything.**

The fresh sweep did turn up more findings. Every item below was independently re-verified with my own grep/read after the agents reported it — one agent claim (`buildCircularFlowHtml` being "live") from the very first exploration pass turned out to be wrong and is corrected here.

### Not dead code — a real bug (pre-existing, unrelated to Parts 1/1b) — ✅ Fixed

| # | What | Where | Detail |
|---|------|-------|--------|
| 18 | `stopPeriodicSync()` call to a nonexistent function | `api1.js:1644`, inside `taker:initialize`'s "shutdown old instance" branch | Threw a `ReferenceError` every time. Confirmed via `git log -S"function stopPeriodicSync"` that commit `adffef5` ("update api for sync") deleted the function definition and the periodic-offerbook-sync feature it managed, but missed this one leftover call site. The throw was caught by a silent `try/catch`, which meant the two lines after it — clearing the old wallet-sync interval and calling `safelyShutdownTaker()` on the old native Taker instance — never ran. **Fix applied:** replaced the dead call with a new, working `stopPeriodicOfferbookRefresh()`, paired with a new `startPeriodicOfferbookRefresh()` that runs every 15 minutes alongside `startPeriodicWalletSync()`. Per explicit direction: this does **not** re-trigger `syncOfferbookAndWait()` (the actual network sync — the Rust backend already keeps `offerbook.json` current on its own); it's a disk-only re-read via the existing `getOfferbookSnapshot()` helper, for main-process-side logging/observability. Reused the already-existing but previously-dead `api1State.syncState.periodicInterval` field instead of adding new state. Confirmed via `git diff HEAD -- api1.js` (at the time) that this bug predated the current session entirely — not something Part 1/1b touched or introduced. |

### A judgment call, not a pure deletion

| # | What | Where | Detail |
|---|------|-------|--------|
| 19 | `About.js` is fully unreachable | Registered in `app.js`'s component map (`about: AboutComponent`), but `Nav.js`'s nav-item list (`wallet, market, send, receive, swap, recovery, log, settings`) never includes `'about'` | A complete, working page with no way to navigate to it — no nav button, no link anywhere in the app. **Decision: keep as-is.** The app doesn't have an About page wired in yet; whether it's needed is undecided, so leaving the component in place unlinked rather than deleting or wiring it up. |

### Confirmed dead — ✅ Removed

| # | What | Where | Evidence |
|---|------|-------|----------|
| 20 | 3 more dead preload/IPC surfaces | `taker.testTorConnection`, `taker.setupLogging`, `swapState.clear` (`api1.js` + `preload.js`) | Each has a real `ipcMain.handle` backing it, but zero renderer call sites. `testTorConnection`: the renderer's own `testTorConnection()` functions in `Settings.js`/`FirstTimeSetup.js` call `window.api.testTcpPort` instead. `setupLogging`: the actual logging setup happens inline via `TakerClass.setupLogging?.(...)` directly inside `taker:initialize` (api1.js:~1730), bypassing this IPC channel. `swapState.clear`: `SwapStateManager.js` only ever calls `.load()`/`.save()`. |
| 21 | `SwapStateManager.js` dead exports | `export default SwapStateManager` (every importer uses the named import instead), `clearUserSelections()`, `getStorageInfo()` | Confirmed zero call sites for the latter two beyond their own definitions; confirmed every importer (`app.js`, `Swap.js`, `Openswap.js`, `Nav.js`) uses `{ SwapStateManager }`, never a default import. |
| 22 | 5 unused `BitcoindConnection` wrapper methods | `getBalance()`, `getNewAddress()`, `getTransactions()`, `sendToAddress()`, `getBlockchainInfo()` in `src/components/connection/BitcoindConnection.js` | Zero call sites anywhere (`grep -rn "bitcoindConnection\.<method>\b" src/` → no matches for any of the 5). The app talks to bitcoind via `window.api.taker.*` IPC instead; only `connect`/`testConnection`/`disconnect`/`_performConnection`/`.config` on this class are actually used. |
| 23 | Dead local variables | `Openswap.js`: `lastLogLine` (:40), `currentHop` (:96), `makerColors` (:158, unrelated to the differently-scoped, actually-used `makerColors` in `SwapReport.js`) — `SwapReport.js`: `makeReportEntry` (:856), `displaySwapId` (:1431) — `FirstTimeSetup.js`: `iconShield` (:16, never inserted into any template — `iconWarning`/`iconInfo` are used, this one isn't), `setChecked` (:713, local helper inside `restoreFormData()`, never invoked — only `setValue` is actually called there) | Each confirmed via grep: only the declaration line matches, zero other references in the file. Removing `Openswap.js`'s `setPendingMakerAddress`/`markContractsReceivedIfComplete` (item 24) also orphaned `contractDataReceivedMakers` (a `Set` only ever read by the deleted function, never written anywhere) — removed that too as a direct knock-on. |
| 24 | Dead local functions | `Openswap.js`: `setPendingMakerAddress` (:201), `markContractsReceivedIfComplete` (:382), `setTransactionConfirmed` (:497) — `SwapReport.js`: `buildUtxoRowsHtml` (:506), `truncateTxid` (:620), `getReportInfoLines` (:1124), **`buildCircularFlowHtml`** (:1138) — `Swap.js`: `renderMakerCandidates` (:585) | Each confirmed via grep: only the definition line matches. Note on `buildCircularFlowHtml`: the very first exploration pass (start of this whole cleanup effort) described this as a live "circular Swap Partners diagram." Re-checked now — the actual "Swap Partners" section in `SwapReport.js` (~:1487-1495) calls `buildMakersHtml()`, a different function. `buildCircularFlowHtml` was genuinely dead (~290 lines); the earlier characterization was wrong. |
| 25 | 10 unused icons | `src/js/icons.js`: `arrowUpCircle`, `package`, `lock`, `keyRound`, `link`, `handshake`, `receipt`, `circleDollarSign`, `folder` (distinct from `folderOpen`, which IS used), `pauseCircle` | Each spot-verified: `grep -rn "icons\.<name>(" src/` outside `icons.js` itself → 0 hits. Removed both the `icons.<name>` entry and its corresponding lucide import line for each. |
| 26 | ~30 orphaned CSS selectors | `src/styles/input.css` — recovery-UI leftovers, `.app-spinner`, `.app-progress`/`.app-progress-bar`, `.app-share`/`.app-share-track`, `.app-card-head`, `.app-kicker`, `.app-open-icon`, `.app-pill-stack`, `.app-spec`, `.maker-candidates`, `.maker-popup-privacy`, `.pending-receive`, `.send-static-amount`, `.send-utxo-warning`, `.use-utxo-minus-fees`, `.settings-checkbox-row`, `.settings-modal-actions`, `.settings-note`, `.swap-auto-note`, `.swap-complete-btn`, `.swap-history-panel`, `.swap-history-stats`, `.swap-net-badge`, `.swap-progress-actions`, `.swap-progress-bar`, `.swap-report-utxo-group`, `.swap-report-utxo-head` | Removed. **Caught one false positive before deleting:** `.address-badge.is-gray`/`.is-purple` (originally listed alongside these) are actually **live** — `AddressList.js` builds the class dynamically via `` `is-${getTypeColor(addr.type)}` ``, and `getTypeColor()` returns `'purple'` for P2TR and falls back to `'gray'` for unrecognized types. Left those two untouched; everything else in this item was independently re-verified (static grep, no dynamic construction found) before removal. Where a dead class shared a rule with still-live classes in a comma-separated selector list (e.g. `.swap-config-card, .swap-balance-card, .swap-summary-card, .swap-history-panel {`), only the dead entry was trimmed from the list, not the whole rule. |

### Not worth its own action

`loadSwapHistory` and `buildSwapHistoryMarkup` in `SwapHistory.js` are exported but only ever called from within that same file — not dead (they're both exercised), just an unnecessary `export` keyword on each. Skipping this; too minor to warrant a separate edit.

### Checked and clean

- `tor-manager/src/main.rs` (Rust, part of this repo unlike `openswap-ffi`): a fresh full sweep — every struct field, enum variant, function, and env var — found nothing unused. `cargo build` also produces zero dead-code warnings.
- `api1.js`'s ~40 top-level helper functions and all 11 `api1State` fields: every one has a live call site.
- IPC channel parity: all 37 `ipcMain.handle(...)` channels in `api1.js` have a matching `ipcRenderer.invoke(...)` in `preload.js` (the 3 in item 20 are "wired" end-to-end between main/preload but dead one level further out, at the renderer).

---

## Part 2 — Consolidate duplicated logic

These aren't dead — they're independently reimplemented in 2-4 places, drifting from each other in small, dangerous ways. Each cluster below gets one shared module.

### 2.1 Protocol name normalization (v1/v2 ↔ Legacy/Taproot/Unified) — **highest priority**

Four separate implementations, each with different fallback rules:

| Location | Function | Notably different behavior |
|---|---|---|
| `api1.js:979` | `normalizeSwapProtocol(value, fallbackIsTaproot)` | Main-process source of truth; returns `'Legacy' \| 'Taproot' \| 'Unified'`. |
| `src/components/swap/Swap.js:190` | `normalizeProtocolValue(protocol)` | Simpler mapping, returns `'v1'/'v2'` machine values instead of display strings. |
| `src/components/swap/Openswap.js:11` | `normalizeProtocol(value, fallbackIsTaproot)` | Near-copy of `api1.js`'s version. |
| `src/components/swap/SwapReport.js:13` | `normalizeProtocol(value, fallbackIsTaproot)` | Another near-copy. |

**Why this is the riskiest duplication:** a bug fix or new protocol value (e.g. a future third swap protocol) applied to one copy and missed in the other three will cause the UI to mislabel which protocol a swap actually ran — wrong fee math, wrong badge, wrong compatibility filtering in `Market.js`/`Swap.js`.

**Fix:** create `src/js/protocol.js` exporting one `normalizeProtocol(value, fallbackIsTaproot)` (the `api1.js` version is the most complete — start from that). Renderer files import it directly (native ESM, no build step needed). `api1.js` runs in the main process, which is CommonJS (`require`) not ESM — either convert `src/js/protocol.js` to a dual CJS/ESM-safe module (plain function, no top-level `import`/`export` ambiguity — a `module.exports` + `exports.default` shim), or keep a thin `api1.js`-local copy and add a code comment pointing at `src/js/protocol.js` as the canonical definition it must stay in sync with. Given this is the single highest-risk drift point, prefer the shared-module route even if it means a small CJS/ESM interop shim.

### 2.2 Maker/swap fee formula

`totalFee = baseFee + amount * volumeRate + refundLocktime * amount * timeRate`, where `refundLocktime = 20 * (totalMakers - position + 1)`.

| Location | Purpose |
|---|---|
| `src/components/market/Market.js:43` `calculateMakerFee()` | Estimates fee for offerbook display, before a swap starts. |
| `src/components/swap/Swap.js:597` `calculateFees()` | Estimates fee during swap configuration. |
| `src/components/swap/Openswap.js:822` `transformSwapReport()` (fee block around `:888-961`) | Derives fee breakdown for a completed/in-progress swap's report. |
| `src/components/swap/SwapReport.js` fee block (`:555-597`) | Same derivation, for the standalone report viewer. |

**Fix:** extract the pure formula into `src/js/fees.js`: `estimateMakerFee({baseFee, amountRelativeFeePct, timeRelativeFeePct, amountSats, makerPosition, totalMakers})`. `Market.js` and `Swap.js` (pre-swap estimation) call it directly. `Openswap.js`/`SwapReport.js` (post-hoc report derivation) have a different job — reconciling an actual backend report against this formula as a fallback — so they should call the same `estimateMakerFee` for their fallback branch rather than re-deriving the constant `20 * (...)` locally, but keep their report-parsing logic (snake_case/camelCase reconciliation) where it is; that part isn't the same concern as the fee math and shouldn't be merged.

### 2.3 Bitcoind RPC connectivity test helpers

| Location | Functions |
|---|---|
| `src/components/settings/Settings.js:166,170,174,184,398,464` | `getRpcUrl`, `getRestUrl`, `getZmqAddress`, `renderConnectionResults`, `makeRPCCall`, `testBitcoindConnection` |
| `src/components/settings/FirstTimeSetup.js:568,572,576,580` | `getRpcUrl`, `getRestUrl`, `getZmqAddress`, `renderConnectionResults` (same names, copy-pasted bodies) |
| `src/components/connection/BitcoindConnection.js` | A *third*, more robust implementation as a class (`BitcoindConnection`) with retry/backoff (5 attempts, capped exponential backoff) — neither of the two copies above reuses it. |

**Fix:** `BitcoindConnection.js`'s class is the best-engineered of the three (it already has retry/backoff and is exported as a singleton `bitcoindConnection`). Make it the single source: export its URL-building helpers (`getRpcUrl`/`getRestUrl`/`getZmqAddress`) as standalone functions from `src/js/bitcoind.js` (or directly from `BitcoindConnection.js`, re-exported), and have `Settings.js`/`FirstTimeSetup.js` import them instead of hand-rolling their own. Their "Test Connection" button handlers can keep their own UI rendering (`renderConnectionResults` differs slightly per screen's DOM) but should call through the shared URL builders and, ideally, `bitcoindConnection`'s own test method instead of a third hand-rolled `fetch` + Basic-Auth implementation.

### 2.4 Address-type / derivation-path detection

| Location | Functions |
|---|---|
| `src/components/receive/Receive.js:212,242` | `detectAddressType`, `getDerivationPath` |
| `src/components/receive/AddressList.js:75` | `detectAddressType` (own copy) |
| `src/components/wallet/Wallet.js:103` | `getScriptType` (same purpose, different name) |
| `src/components/wallet/UtxoList.js` | another copy — moot once Part 1 item 2 deletes this file |

Each has slightly different prefix-matching fallback rules per the earlier read-through (e.g., disagreement on how to classify P2WSH vs P2WPKH by address length).

**Fix:** one `src/js/address.js` exporting `detectAddressType(address, fallbackSpendType)` and `getDerivationPath(type, index)`. Reconcile the differing fallback heuristics once, in one place, rather than picking one copy arbitrarily — this is user-facing correctness (wrong address-type labels), so worth a quick manual diff of the three implementations during migration, not just a mechanical dedupe.

### 2.5 Hardcoded block-explorer URL

`https://mempool.citadelfoss.xyz` is hardcoded independently in 11 places across 8 files:

`Openswap.js:1073`, `Receive.js:530`, `Wallet.js:145`, `SwapReport.js:1554,1566`, `AddressList.js:327`, `UtxoList.js:604` (dead, removed in Part 1), `TransactionsList.js:448` (dead, removed in Part 1), `Send.js:960`, `Market.js:510`.

Separately, `Swap.js:532` calls `https://mempool.citadelfoss.xyz/api/v1/fees/recommended` as a **live fee-rate API** — this one is a functional dependency, not just a UI link, and is a distinct concern from the explorer-link duplication (worth flagging to whoever owns this instance: the app's fee estimation depends on a single private third-party server with no fallback).

**Fix:** `src/js/explorer.js` exporting `EXPLORER_BASE_URL` and a helper `explorerTxUrl(txid)` / `explorerAddressUrl(address)`. All 9 remaining (post-deletion) call sites import from there. This doesn't fix the "not configurable / wrong-network" problem by itself, but it turns a 9-site find-and-replace into a 1-line change if that's tackled later, and is worth doing as part of this pass since it's touched anyway.

### 2.6 Transaction size/fee estimate formula (single file, 3x)

`src/components/send/Send.js:220, 722, 838` all independently compute `size = 10.5 + 68 * numInputs + 31 * numOutputs + 31` then `fee = feeRate * size`, in `validateTransaction()`, `updateSummary()`, and `handleSignTransaction()` respectively.

**Fix:** extract to a single `estimateTxSize(numInputs, numOutputs)` / `estimateFee(feeRate, numInputs, numOutputs)` pair at the top of `Send.js` (no need for a shared cross-file module here — this one's contained to a single file). Low risk, quick win.

### 2.7 Redundant swap-state polling

`src/components/Nav.js:75` (`updateInterval`) and `src/js/app.js:45` (`backgroundSwapManager`) each run an independent 1-second `setInterval` polling `SwapStateManager`/`hasActiveSwap()`. Not identical code, but two timers doing the same class of work with no shared state or coordination.

**Fix:** lower priority than the above (not silently-drifting logic, just wasted timers). When touching `Nav.js`/`app.js` for other reasons, consolidate into one interval that updates both the nav "elapsed" chip and the background-manager state, or have one dispatch a custom event the other listens for.

---

## Proposed new shared-module layout

```
src/js/
  protocol.js    — normalizeProtocol()            (2.1)
  fees.js        — estimateMakerFee()              (2.2)
  bitcoind.js    — getRpcUrl/getRestUrl/getZmqAddress, re-exported from BitcoindConnection.js (2.3)
  address.js     — detectAddressType/getDerivationPath (2.4)
  explorer.js    — EXPLORER_BASE_URL, explorerTxUrl/explorerAddressUrl (2.5)
```

All plain ESM, all imported the same way existing files already import `price.js`/`icons.js` — no new build tooling.

---

## Execution plan

Ordered by risk (lowest first) and independence, so each phase can land and be sanity-checked before the next starts. Per `CLAUDE.md`'s orchestration protocol, phases 2-4 are 5+ independent files each and should be split across parallel agents; phase 1 and 5 are small/coupled enough for a single agent.

| Phase | Work | Files touched | Agent count |
|---|---|---|---|
| **1. Delete dead code** | Part 1, items 1-8 | `TransactionsList.js` (delete), `UtxoList.js` (delete), `app.js`, `TakerInitialization.js`, `Openswap.js`, `Wallet.js`, `price.js`, `SwapStateManager.js` | 1 (small, mechanical, low risk of touching live logic) |
| **2. Low-risk consolidations** | 2.5 (explorer URL), 2.6 (tx size formula), 2.7 (polling) | `explorer.js` (new) + 9 call sites; `Send.js` internal; `Nav.js`/`app.js` | 2 (explorer-URL sweep is independent of tx-size/polling work) |
| **3. Medium-risk consolidations** | 2.3 (RPC test helpers), 2.4 (address-type detection) | `bitcoind.js` (new), `Settings.js`, `FirstTimeSetup.js`, `BitcoindConnection.js`; `address.js` (new), `Receive.js`, `AddressList.js`, `Wallet.js` | 2 (each cluster is a self-contained domain) |
| **4. High-risk consolidation** | 2.1 (protocol normalization) — do last, alone, with focused manual review | `protocol.js` (new), `api1.js`, `Swap.js`, `Openswap.js`, `SwapReport.js` | 1 (touches the main process + 3 renderer files; needs a single owner to reconcile the fallback-behavior differences correctly, not a mechanical find-replace) |
| **5. Fee-formula consolidation** | 2.2 — do after phase 4 since `Openswap.js`/`SwapReport.js` fee blocks are entangled with the protocol fields they also normalize | `fees.js` (new), `Market.js`, `Swap.js`, `Openswap.js`, `SwapReport.js` | 1 |

**Why protocol normalization is phase 4, not phase 1:** it's the one place where "just pick one copy and delete the rest" is wrong — the four implementations have genuinely different fallback semantics (string vs. machine-value returns, different default-when-ambiguous behavior). Reconciling them requires reading all four call sites' expectations, not just running a diff. Doing it last, alone, means whoever does it isn't also juggling five other unrelated file changes.

## Verification per phase

- **Phase 1:** `grep` for the removed identifiers repo-wide to confirm zero remaining references, then launch the app (`npm run dev`) and click through Wallet → Send → Receive → Market → Swap → Settings to confirm nothing 404s on a missing import.
- **Phases 2-3:** for each consolidated helper, spot-check one call site per file before/after (e.g. same address in `Receive.js` and `AddressList.js` should still classify identically) since these are exactly the places where the copies had silently diverged — a mechanical dedupe could accidentally standardize on the *wrong* one of two disagreeing behaviors.
- **Phase 4:** manually walk all four original implementations' behavior against a matrix of inputs (`'v1'`, `'v2'`, `'Legacy'`, `'Taproot'`, `'Unified'`, `undefined`, with `fallbackIsTaproot` true/false) before picking the merged behavior, since this is exactly the kind of drift that's invisible until a specific protocol/fallback combination hits it in production.
- **Phase 5:** compare a real completed swap report's rendered fee breakdown before/after in `SwapReport.js` and `SwapHistory.js`.

Per `CLAUDE.md`: run `npx prettier --write` on all touched files after each phase, and `npm run build` (Tailwind + no bundler to fail on) as the final check — there's no `.rs` involved in this cleanup, so `cargo fmt`/`cargo build` don't apply here.

---

## Part 1d — Dedicated CSS/design sweep

**Status: 2 more dead-code items found and removed. Design-token debt found and documented below, not yet fixed (separate issue, own section).**

Requested as a standalone pass focused on `src/styles/input.css` (~8,300 lines), on the hunch that a hand-styled, AI-assisted Electron app like this one would have accumulated unused CSS. Method: a script extracted every custom class selector in the file (528 of them) and cross-checked each against literal usage anywhere in `src/` (JS + `index.html`), then every result was manually re-verified before deletion — this codebase has at least one real dynamic-class-construction site (see below), so a plain "no literal match" signal isn't sufficient on its own.

### Confirmed dead — ✅ Removed

| # | What | Where | Evidence |
|---|------|-------|----------|
| 27 | `.route-line` / `.route-line.is-active` | `src/styles/input.css` (SVG route styling) | The live class is `.route-segment` (with `.base`/`.active`/`.funding-pending`/etc. modifiers), used throughout `SwapProgressAnimation.js`. `route-line` only survives as part of an **SVG element ID** pattern (`id="route-line-${index}"`), which is a different thing from a CSS class — nothing ever applies `class="route-line"`. |
| 28 | `.swap-report-utxo-row` + its `strong`/`span`/`em` child rules | `src/styles/input.css` | A direct knock-on effect of Part 1c item 24: this class was only ever rendered by `buildUtxoRowsHtml()` in `SwapReport.js`, which was deleted as dead code in that pass without checking what CSS it fed. Caught here and cleaned up. |

**False positive caught and correctly left alone:** `.address-badge.is-gray` / `.is-purple` were flagged by the same script but are **live** — `AddressList.js` builds the class dynamically via `` `is-${getTypeColor(addr.type)}` ``, and `getTypeColor()` returns `'purple'` for P2TR addresses and falls back to `'gray'` for unrecognized types (see Part 1c item 26 for the original catch). This is the one confirmed dynamic-class-construction site in the codebase found so far — worth keeping in mind for any future CSS audit here.

### Not addressed here: 10 classes with split rule definitions

Not dead code (both halves are live), but a code-organization smell worth naming: `.swap-summary-card`, `.swap-fee-box div`, `.swap-summary-card h3`, `.swap-amount-meta button`, `.swap-picker`, `.hop-count-btn span`, `.swap-you-receive strong`, `.swap-reports-panel`, `.send-success-row a`, `.swap-failure-error span` each have their styling defined across **two separate, non-adjacent rule blocks** in `input.css` rather than one, outside of legitimate `@media` responsive overrides. Looks like copy-paste-driven additions over time rather than edits to the original rule. Not touched in this pass — flagging for whoever eventually does a readability/consolidation pass on the stylesheet, but it's not incorrect or wasteful the way dead code is.

---

## Part 1e — Non-code cruft (npm deps, static assets)

**Status: done.**

Prompted by a direct question ("is there anything else to remove?") — checked two categories not covered by any prior pass: `package.json` dependencies and static assets (fonts, images).

| # | What | Where | Evidence |
|---|------|-------|----------|
| 29 | `package.json.tmp` | repo root | Contained a standalone `{ "dependencies": { "openswap-napi": "file:./openswap-ffi/openswap-napi" }, "overrides": {...} }` block. Confirmed dead three ways: `setup-openswap.js` (what `npm run prepare` actually runs on `npm install`) never references `package.json` at all; no script anywhere constructs a `.tmp` filename dynamically; and it's a stale file (April, vs. `package.json`'s July) committed to git back in `ad5d097 "market and log fix, start setup"` — an early manual experiment with file-dependency wiring for the native module, superseded by `setup-openswap.js`'s symlink approach and never cleaned up. |
| 30 | 11 of 16 font files in `src/styles/fonts/webfonts/` | `JetBrainsMono-Italic`, `-BoldItalic`, `-ExtraBoldItalic`, `-MediumItalic`, `-SemiBoldItalic`, `-Light`, `-LightItalic`, `-ExtraLight`, `-ExtraLightItalic`, `-Thin`, `-ThinItalic` | Only 5 of the 16 shipped weight/style variants (`Regular`, `Medium`, `SemiBold`, `Bold`, `ExtraBold`) are ever declared via `@font-face` in `input.css` — the other 11 can never load in a browser without a matching `@font-face` rule, so they were pure byte-weight with zero effect on every dev checkout and every packaged build. |

Checked and found clean in this pass: all `dependencies`/`devDependencies` in `package.json` map to real usage (`electron-store` used in `api1.js`, `lucide` used via deep imports in `icons.js`, every `devDependency` backs an actual npm script); `assets/openswap.png` is the live app icon referenced from `main.js`.

---

## Design Token Debt (separate issue — tracked here, not yet fixed)

Explicitly called out as distinct from the dead-code cleanup above: this isn't leftover garbage, it's an **abandoned design system** — someone set up a proper token scale and then never migrated the actual styles onto it. 13 of the 34 CSS custom properties defined in `input.css`'s `:root`/`@theme` block are never consumed anywhere via `var(...)`:

| Token(s) | Value(s) | Status |
|---|---|---|
| `--app-space-1` through `--app-space-8` (6 tokens) | 4px / 8px / 12px / 16px / 24px / 32px | Entire spacing scale unused. Every `margin`/`padding`/`gap` in the file uses hand-typed pixel values instead of referencing this scale. |
| `--app-radius-sm`, `--app-radius-md`, `--app-radius-lg`, `--app-radius-xl` | 8px / 12px / 16px / 20px | Unused. Notably, their sibling `--app-radius-pill` (999px, same token family) **is** used — 25+ times — so the pill radius got adopted but the rest of the scale didn't. |
| `--color-secondary` | `#1c1d23` | Unused directly. Its sibling `--color-secondary-hover` is used constantly, but the base color never is. |
| `--font-family-mono` | `'JetBrains Mono', monospace` | Dead duplicate — `--app-font-mono` (used 142 times) is what the codebase actually settled on, apparently after a naming-convention migration (`--font-family-*` → `--app-font-*`) that never cleaned up the old declaration. |
| `--app-nav-orange-soft` | `rgba(232, 80, 2, 0.14)` | Unused. Sibling `--app-nav-orange-hover` is used once. |

**Why this is tracked separately rather than folded into Part 1d's deletions:** removing unused *code* (dead functions, orphaned files, unreachable IPC handlers) has zero behavioral ambiguity — nothing was using it, so nothing changes. Removing unused *design tokens* is a different kind of decision: it could mean simply deleting cruft, or it could mean the intended fix is the opposite — actually adopting the token scale by rewriting the hardcoded pixel values throughout the file to reference `--app-space-*`/`--app-radius-*` instead. That's a real design/engineering call, not a mechanical cleanup, so it's being tracked here for a dedicated future pass rather than folded into this one.

---

## Summary of everything found across Parts 1-1d

- **Part 1** — Delete outright (verified zero dependents via grep): two fully orphaned components (`TransactionsList.js`, `UtxoList.js`, ~1,200 lines), a dead password-prompt flow in `app.js`, unused/stale passthrough exports in `TakerInitialization.js`, a duplicate function pair in `Openswap.js`, a write-only cache in `Wallet.js`, a dead custom event in `price.js`, and a silently-unread `SWAP_HISTORY` localStorage bucket.
- **Part 1b** — 9 more dead exports/handlers found via a full exported-symbol + IPC-channel audit.
- **Part 1c** — A real pre-existing bug (`stopPeriodicSync()` referencing a deleted function — fixed, not just deleted, with working periodic-offerbook-refresh logic), a judgment call left alone (`About.js` — kept), and 7 more confirmed-dead items (IPC surfaces, `SwapStateManager` exports, `BitcoindConnection` methods, dead vars/functions across `Openswap.js`/`SwapReport.js`/`FirstTimeSetup.js`/`Swap.js`, unused icons, ~30 orphaned CSS selectors).
- **Part 1d** — A dedicated CSS sweep found 2 more dead selectors (one a knock-on of an earlier deletion) and, separately, 13 unused design tokens representing an abandoned spacing/radius scale — tracked as its own future fix, not deleted yet.
- **Part 1e** — Non-code cruft: a stale, git-committed `package.json.tmp` from an abandoned early approach to wiring the native module, and 11 of 16 shipped font files that no `@font-face` rule ever references.
- **Part 2** (not yet started) — Consolidate duplicated logic, ranked by risk: protocol normalization (4 copies, highest priority), maker/swap fee formula (4 copies), bitcoind RPC test helpers (3 copies), address-type detection (3-4 copies), hardcoded explorer URL (11 sites), tx-size formula (3x in one file), redundant polling (2 files).
