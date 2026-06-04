const PRICE_CACHE_KEY = 'btc_usd_price_cache';
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const COINBASE_SPOT_PRICE_URL =
  'https://api.coinbase.com/v2/prices/BTC-USD/spot';

let btcPriceUsd = loadCachedPrice() || null;
let inFlightRefresh = null;

function loadCachedPrice({ allowStale = false } = {}) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const cached = JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || 'null');
    if (!cached || typeof cached !== 'object') return null;

    const price = Number(cached.usd);
    const timestamp = Number(cached.timestamp);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) {
      return null;
    }

    if (!allowStale && Date.now() - timestamp > PRICE_CACHE_TTL_MS) return null;
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

export function hasBtcPriceUsd() {
  return Number.isFinite(btcPriceUsd) && btcPriceUsd > 0;
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
  const timeout = setTimeout(() => controller.abort(), 5000);

  inFlightRefresh = fetch(COINBASE_SPOT_PRICE_URL, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Coinbase price request failed: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const usd = Number(data?.data?.amount);
      if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error('Coinbase price response did not include data.amount');
      }

      btcPriceUsd = usd;
      saveCachedPrice(usd);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('btc-price-updated', { detail: { usd } }));
      }
      return btcPriceUsd;
    })
    .catch((error) => {
      const stalePrice = loadCachedPrice({ allowStale: true });
      if (stalePrice) {
        btcPriceUsd = stalePrice;
        console.warn('Using stale cached BTC/USD price:', error);
        return btcPriceUsd;
      }

      btcPriceUsd = null;
      console.warn('BTC/USD price unavailable:', error);
      return btcPriceUsd;
    })
    .finally(() => {
      clearTimeout(timeout);
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}

export function formatSats(sats = 0) {
  return `${Math.round(Number(sats || 0)).toLocaleString()} 丰`;
}
