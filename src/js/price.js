const PRICE_CACHE_KEY = 'btc_usd_price_cache';
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_BTC_USD = 50000;
const MEMPOOL_PRICE_URL = 'https://mempool.space/api/v1/prices';

let btcPriceUsd = loadCachedPrice() || FALLBACK_BTC_USD;
let inFlightRefresh = null;

function loadCachedPrice() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const cached = JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || 'null');
    if (!cached || typeof cached !== 'object') return null;

    const price = Number(cached.usd);
    const timestamp = Number(cached.timestamp);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) {
      return null;
    }

    if (Date.now() - timestamp > PRICE_CACHE_TTL_MS) return null;
    return price;
  } catch (error) {
    console.warn('Failed to load BTC price cache:', error);
    return null;
  }
}

function saveCachedPrice(usd) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      PRICE_CACHE_KEY,
      JSON.stringify({
        usd,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.warn('Failed to save BTC price cache:', error);
  }
}

export function getBtcPriceUsd() {
  return btcPriceUsd;
}

export async function refreshBtcPriceUsd({ force = false } = {}) {
  if (!force) {
    const cachedPrice = loadCachedPrice();
    if (cachedPrice) {
      btcPriceUsd = cachedPrice;
      return btcPriceUsd;
    }
  }

  if (inFlightRefresh) return inFlightRefresh;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  inFlightRefresh = fetch(MEMPOOL_PRICE_URL, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`mempool price request failed: ${response.status}`);
      }
      return response.json();
    })
    .then((prices) => {
      const usd = Number(prices?.USD);
      if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error('mempool price response did not include USD');
      }

      btcPriceUsd = usd;
      saveCachedPrice(usd);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('btc-price-updated', { detail: { usd } }));
      }
      return btcPriceUsd;
    })
    .catch((error) => {
      console.warn('Using fallback BTC/USD price:', error);
      return btcPriceUsd;
    })
    .finally(() => {
      clearTimeout(timeout);
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}

export function formatSats(sats = 0) {
  return `${Math.round(Number(sats || 0)).toLocaleString()} sats`;
}
