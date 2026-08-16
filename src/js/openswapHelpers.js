import { SATS_SYMBOL } from './price.js';

// ============================================================================
// HTML escaping
// ============================================================================

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Clipboard
// ============================================================================

// Copies text to the clipboard, falling back to a hidden textarea +
// execCommand for contexts where the Clipboard API is unavailable. Returns
// true/false; callers handle their own success/failure UI.
export async function copyToText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      console.error('Copy failed:', fallbackError);
      return false;
    }
  }
}

// ============================================================================
// Time formatting
// ============================================================================

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '0m 0s';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;
}

export function formatElapsedTime(milliseconds) {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0) return '0s';
  return formatDuration(milliseconds / 1000);
}

// timestampMs must be a millisecond epoch. Callers holding UNIX-seconds
// timestamps (Bitcoin Core time/timereceived/blocktime) must multiply by
// 1000 before calling.
export function formatRelativeTime(timestampMs) {
  if (!Number.isFinite(timestampMs)) return 'Unknown';
  const diffMs = Date.now() - timestampMs;
  if (diffMs < 0) return 'Just now';
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  return new Date(timestampMs).toLocaleDateString();
}

// ============================================================================
// Spend-type classification
// ============================================================================

// Buckets a openswap-ffi spend_type string (SeedCoin, IncomingSwapCoin,
// TimelockContract, FidelityBondCoin, etc.) into Swap/Contract/Fidelity/Regular.
export function classifySpendType(spendType = '') {
  const normalized = String(spendType || '').toLowerCase();
  if (normalized.includes('swap')) return 'Swap';
  if (normalized.includes('contract')) return 'Contract';
  if (normalized.includes('fidelity')) return 'Fidelity';
  if (normalized.includes('seed') || normalized.includes('regular')) return 'Regular';
  return 'Regular';
}

// Same classification, entered from a UTXO/tx object instead of a raw string.
export function classifyUtxoSpendType(utxoLike) {
  const spendType = utxoLike?.type ?? utxoLike?.spendInfo?.spendType ?? utxoLike?.spendType ?? '';
  return classifySpendType(spendType);
}

// Coarse Swap-vs-Regular bucket, for coin-selection filtering.
export function getUtxoKind(utxo) {
  return classifyUtxoSpendType(utxo) === 'Swap' ? 'swap' : 'regular';
}

export function getUtxoKindLabel(utxo) {
  return getUtxoKind(utxo) === 'swap' ? 'Swap' : 'Regular';
}

// ============================================================================
// Explorer URL
// ============================================================================

export const EXPLORER_BASE_URL = 'https://mempool.citadelfoss.xyz';

export function explorerTxUrl(txid) {
  return `${EXPLORER_BASE_URL}/tx/${encodeURIComponent(txid)}`;
}

export function explorerAddressUrl(address) {
  return `${EXPLORER_BASE_URL}/address/${encodeURIComponent(address)}`;
}

// ============================================================================
// Maker/swap fee formula
// ============================================================================

// totalFee = baseFee + amount*volumeRate + refundLocktime*amount*timeRate.
// refundLocktime = 20 * (totalMakers - position + 1).
// amountRelativeFeePct/timeRelativeFeePct are percentages, so divide by 100.
export function estimateMakerFee({
  baseFee = 0,
  amountRelativeFeePct = 0,
  timeRelativeFeePct = 0,
  amountSats,
  makerPosition,
  totalMakers,
}) {
  const refundLocktime = 20 * (totalMakers - makerPosition + 1);
  const volumeFee = amountSats * (amountRelativeFeePct / 100);
  const timeFee = refundLocktime * amountSats * (timeRelativeFeePct / 100);

  return {
    baseFee,
    volumeFee,
    timeFee,
    totalFee: baseFee + volumeFee + timeFee,
    refundLocktime,
  };
}

// ============================================================================
// Bitcoind RPC
// ============================================================================

export function getRpcUrl(host, port) {
  return `http://${host}:${port}`;
}

export function getRestUrl(host, port) {
  return `${getRpcUrl(host, port)}/rest/chaininfo.json`;
}

export function getZmqAddress(port) {
  return `tcp://127.0.0.1:${port}`;
}

export async function makeRPCCall({ host, port, username, password }, method, params = []) {
  if (!username || !password) {
    throw new Error('RPC username and password are required');
  }

  let response;
  try {
    response = await fetch(getRpcUrl(host, port), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({ jsonrpc: '1.0', id: Date.now(), method, params }),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Cannot connect to Bitcoin Core - make sure bitcoind is running and accessible');
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Authentication failed - check RPC username/password');
    if (response.status === 403) throw new Error('Access forbidden - check rpcallowip in bitcoin.conf');
    if (response.status === 404) throw new Error('Bitcoin Core RPC not found - is bitcoind running?');
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(`RPC Error: ${data.error.message}`);
  return data.result;
}

// ============================================================================
// Swap protocol normalization
// ============================================================================

// api1.js keeps a synced copy — it's CommonJS, no bundler to share this
// module with the main process.
//
// fallbackIsTaproot only applies when value is unrecognized. A known value,
// including 'Legacy P2WSH', always wins.
export function normalizeSwapProtocol(value, fallbackIsTaproot = false) {
  switch (value) {
    case 'v2':
    case 'Taproot':
      return 'Taproot';
    case 'Unified':
      return 'Unified';
    case 'v1':
    case 'Legacy':
    case 'Legacy P2WSH':
      return 'Legacy';
    default:
      return fallbackIsTaproot ? 'Taproot' : 'Legacy';
  }
}

// Adapts the display string to 'v1'/'v2', for Swap.js. 'Unified' reads as 'v2'.
export function toProtocolVersionValue(value, fallbackIsTaproot = false) {
  return normalizeSwapProtocol(value, fallbackIsTaproot) === 'Legacy' ? 'v1' : 'v2';
}

// ============================================================================
// Address type detection
// ============================================================================

// scriptHex is checked first when available — it's exact and disambiguates
// P2WPKH/P2WSH, unlike address prefix/length alone.
export function detectAddressType(address, fallbackSpendType = '', scriptHex = '') {
  const hex = String(scriptHex || '').toLowerCase();
  if (hex.startsWith('5120') && hex.length === 68) return 'P2TR';
  if (hex.startsWith('0020') && hex.length === 68) return 'P2WSH';
  if (hex.startsWith('0014') && hex.length === 44) return 'P2WPKH';
  if (hex.startsWith('a914') && hex.length === 46) return 'P2SH';
  if (hex.startsWith('76a914') && hex.length === 50) return 'P2PKH';

  const addr = String(address || '');
  const bech32 = addr.match(/^(bc|tb|bcrt)1([a-z0-9]+)$/i);
  if (bech32) {
    const witnessChar = bech32[2][0].toLowerCase();
    if (witnessChar === 'q') return addr.length > 50 ? 'P2WSH' : 'P2WPKH';
    if (witnessChar === 'p') return 'P2TR';
  }

  if (addr.startsWith('3') || addr.startsWith('2')) return 'P2SH';
  if (addr.startsWith('1') || addr.startsWith('m') || addr.startsWith('n')) return 'P2PKH';

  const spendType = String(fallbackSpendType || '').toLowerCase();
  if (spendType.includes('swap') || spendType.includes('contract')) return 'P2WSH';
  return 'P2WPKH';
}

export function getDerivationPath(type, index = '-') {
  if (type === 'P2TR') return `m/86'/0'/0'/0/${index}`;
  if (type === 'P2SH' || type === 'P2PKH') return `m/49'/0'/0'/0/${index}`;
  return `m/84'/0'/0'/0/${index}`;
}

// ============================================================================
// String truncation
// ============================================================================

export function truncateMiddle(value, { start = 12, end = 8, ellipsis = '…' } = {}) {
  const str = typeof value === 'string' ? value : String(value ?? '');
  if (!str) return str;
  if (str.length <= start + end + ellipsis.length) return str;
  return `${str.slice(0, start)}${ellipsis}${str.slice(-end)}`;
}

// Splits a host[:port] endpoint, optionally strips .onion and the port, and
// truncates the host with truncateMiddle.
export function formatTorEndpoint(
  value,
  { start = 12, end = 8, ellipsis = '…', stripOnion = false, keepPort = false } = {}
) {
  const text = String(value ?? '').trim();
  if (!text) return 'unknown';
  const noScheme = text.replace(/^https?:\/\//i, '').replace(/^tcp:\/\//i, '').split('/')[0];
  const separatorIndex = noScheme.lastIndexOf(':');
  let host = separatorIndex !== -1 ? noScheme.slice(0, separatorIndex) : noScheme;
  const port = separatorIndex !== -1 ? noScheme.slice(separatorIndex + 1) : '';
  if (stripOnion) host = host.replace(/\.onion$/i, '');
  const truncatedHost = truncateMiddle(host, { start, end, ellipsis });
  return keepPort && port ? `${truncatedHost}:${port}` : truncatedHost;
}

// ============================================================================
// Amount-unit display
// ============================================================================

export function hasUsdPrice(btcPrice) {
  return Number.isFinite(Number(btcPrice)) && Number(btcPrice) > 0;
}

export function getAmountUnitLabel(unit) {
  if (unit === 'sats') return SATS_SYMBOL;
  return unit.toUpperCase();
}

export function getAmountConversionLabels(amountSats, selectedUnit, btcPrice) {
  const labels = [];
  const btcAmount = amountSats / 100000000;

  if (selectedUnit !== 'sats') {
    labels.push(`= ${Math.round(amountSats || 0).toLocaleString()} ${SATS_SYMBOL}`);
  }
  if (selectedUnit !== 'btc') {
    labels.push(`= ${btcAmount.toFixed(8)} BTC`);
  }
  if (selectedUnit !== 'usd' && hasUsdPrice(btcPrice)) {
    labels.push(`$${(btcAmount * btcPrice).toFixed(2)} USD`);
  } else if (selectedUnit !== 'usd') {
    labels.push('USD price unavailable');
  }

  return labels;
}

// ============================================================================
// UTXO selection totals
// ============================================================================

// Stale indices (e.g. after availableUtxos is refreshed mid-selection) are
// skipped rather than throwing.
export function sumSelectedUtxos(selectedIndexes, availableUtxos) {
  return selectedIndexes.reduce((sum, index) => {
    const utxo = availableUtxos[index];
    return sum + (utxo ? utxo.amount : 0);
  }, 0);
}

// ============================================================================
// Password visibility toggle
// ============================================================================

// Expects buttonEl to contain two icon elements marked data-eye="show" and
// data-eye="hide"; toggles their "hidden" class alongside inputEl's type.
export function wirePasswordToggle(inputEl, buttonEl) {
  if (!inputEl || !buttonEl) return;
  const showIcon = buttonEl.querySelector('[data-eye="show"]');
  const hideIcon = buttonEl.querySelector('[data-eye="hide"]');
  buttonEl.addEventListener('click', () => {
    const isHidden = inputEl.type === 'password';
    inputEl.type = isHidden ? 'text' : 'password';
    showIcon?.classList.toggle('hidden', isHidden);
    hideIcon?.classList.toggle('hidden', !isHidden);
    const label = isHidden ? 'Hide password' : 'Show password';
    buttonEl.setAttribute('aria-label', label);
    buttonEl.setAttribute('title', label);
    inputEl.focus();
  });
}

// ============================================================================
// Toast notifications
// ============================================================================

const activeToasts = [];

export function showToast(message, { className = 'app-toast top', duration = 2500, html = false, fade = true } = {}) {
  const el = document.createElement('div');
  el.className = className;
  if (html) el.innerHTML = message;
  else el.textContent = message;

  const offset = activeToasts.length * 56;
  el.style.transform = `translateY(${offset}px)`;
  document.body.appendChild(el);
  activeToasts.push(el);

  setTimeout(() => {
    const remove = () => {
      el.remove();
      const idx = activeToasts.indexOf(el);
      if (idx !== -1) activeToasts.splice(idx, 1);
    };
    if (fade) {
      el.style.opacity = '0';
      setTimeout(remove, 300);
    } else {
      remove();
    }
  }, duration);
}
