import { formatSats } from '../../js/price.js';

const WALLET_CACHE_KEY = 'wallet_data_cache';

function saveWalletToCache(balance, transactions, utxos) {
  try {
    localStorage.setItem(
      WALLET_CACHE_KEY,
      JSON.stringify({
        balance,
        transactions,
        utxos,
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    console.error('Failed to save wallet cache:', err);
  }
}

export async function WalletComponent(container) {
  let allTransactions = [];
  let allUtxos = [];
  let txFilter = 'all';
  let txSort = 'newest';
  const txSortDirection = {
    newest: 'desc',
    amount: 'desc',
  };
  let utxoFilter = 'all';

  async function fetchBalance() {
    const data = await window.api.taker.getBalance();
    if (!data.success) throw new Error(data.error);
    return data.balance;
  }

  async function fetchTransactions(count = 50, skip = 0) {
    try {
      const data = await window.api.taker.getTransactions(count, skip);
      if (data.success) return data.transactions || [];
      throw new Error(data.error);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  }

  async function fetchUtxos() {
    try {
      const data = await window.api.taker.getUtxos();
      if (data.success) return data.utxos || [];
      throw new Error(data.error);
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
      return [];
    }
  }

  async function syncWalletState() {
    const result = await window.api.taker.sync();
    if (!result?.success) {
      throw new Error(result?.error || 'Wallet sync failed');
    }
  }

  function compactId(value, left = 12, right = 8) {
    const id =
      typeof value === 'object' && value?.value
        ? value.value
        : String(value || '');
    if (id.length <= left + right + 3) return id;
    return `${id.substring(0, left)}...${id.substring(id.length - right)}`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  }

  function getSpendTypeDisplay(spendType = '') {
    const type = spendType.toLowerCase();
    if (type.includes('seed') || type.includes('regular')) return 'Regular';
    if (type.includes('swap')) return 'Swap';
    if (type.includes('contract')) return 'Contract';
    if (type.includes('fidelity')) return 'Fidelity';
    return spendType || 'Unknown';
  }

  function getScriptType(utxoData) {
    const utxo = utxoData.utxo || {};
    const spendInfo = utxoData.spendInfo || {};
    const scriptHex = utxo.script_pub_key?.hex || utxo.scriptPubKey?.hex || '';
    const address = utxo.address || '';
    const spendType = (spendInfo.spendType || '').toLowerCase();

    if (scriptHex.startsWith('5120') && scriptHex.length === 68)
      return 'taproot';
    if (address.startsWith('bc1p') || address.startsWith('tb1p'))
      return 'taproot';
    if (scriptHex.startsWith('0014') || scriptHex.startsWith('0020'))
      return 'segwit';
    if (address.startsWith('bc1q') || address.startsWith('tb1q'))
      return 'segwit';
    if (spendType.includes('swap') || spendType.includes('contract'))
      return 'segwit';
    return 'segwit';
  }

  function getTransactionType(transaction) {
    const category = (transaction.detail?.category || '').toLowerCase();
    const label = (transaction.detail?.label || '').toLowerCase();

    if (
      label.includes('swap') ||
      label.includes('swapcoin') ||
      label.includes('coinswap') ||
      label.includes('watchonly_swapcoin') ||
      label.includes('contract') ||
      label.includes('htlc') ||
      category.includes('swap')
    ) {
      return 'swap';
    }

    if (category.includes('receive')) return 'received';
    if (category.includes('send')) return 'sent';
    return (transaction.detail?.amount?.sats || 0) >= 0 ? 'received' : 'sent';
  }

  function openMempool(txid) {
    const url = `http://170.75.166.88:8080/tx/${txid}`;
    if (typeof require !== 'undefined') {
      try {
        const { shell } = require('electron');
        shell.openExternal(url);
        return;
      } catch (error) {
        console.warn('Falling back to browser open:', error);
      }
    }
    window.open(url, '_blank');
  }

  function setButtonState(groupSelector, activeValue, dataName) {
    content.querySelectorAll(groupSelector).forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset[dataName] === activeValue
      );
    });
  }

  function renderSatsAmount(selector, sats) {
    const target = content.querySelector(selector);
    if (!target) return;

    target.innerHTML =
      `<span class="app-card-amount-number">${Math.round(
        Number(sats || 0)
      ).toLocaleString()}</span>` +
      '<span class="app-card-amount-unit">sats</span>';
  }

  function calculateUtxoStats() {
    const regular = allUtxos.filter(
      (u) => getSpendTypeDisplay(u.spendInfo?.spendType) === 'Regular'
    ).length;
    const contract = allUtxos.filter(
      (u) => getSpendTypeDisplay(u.spendInfo?.spendType) === 'Contract'
    ).length;
    const swap = allUtxos.filter(
      (u) => getSpendTypeDisplay(u.spendInfo?.spendType) === 'Swap'
    ).length;
    const spendable = allUtxos.filter((u) =>
      ['Regular', 'Swap'].includes(getSpendTypeDisplay(u.spendInfo?.spendType))
    ).length;
    const confirmed = allUtxos.filter(
      (u) => (u.utxo?.confirmations || 0) > 0
    ).length;

    return {
      total: allUtxos.length,
      confirmed,
      unconfirmed: allUtxos.length - confirmed,
      regular,
      contract,
      swap,
      spendable,
    };
  }

  function getFilteredUtxos() {
    if (utxoFilter === 'all') return [...allUtxos];
    if (utxoFilter === 'spendable') {
      return allUtxos.filter((utxo) =>
        ['Regular', 'Swap'].includes(
          getSpendTypeDisplay(utxo.spendInfo?.spendType)
        )
      );
    }

    return allUtxos.filter(
      (utxo) =>
        getSpendTypeDisplay(utxo.spendInfo?.spendType).toLowerCase() ===
        utxoFilter
    );
  }

  function renderUtxos() {
    const stats = calculateUtxoStats();
    content.querySelector('#utxo-count').textContent = `${stats.total} unspent`;
    content.querySelector('#utxo-total').textContent = stats.total;
    content.querySelector('#utxo-confirmed').textContent = stats.confirmed;
    content.querySelector('#utxo-unconfirmed').textContent = stats.unconfirmed;
    content.querySelector('[data-utxo-count="all"]').textContent = stats.total;
    content.querySelector('[data-utxo-count="regular"]').textContent =
      stats.regular;
    content.querySelector('[data-utxo-count="contract"]').textContent =
      stats.contract;
    content.querySelector('[data-utxo-count="swap"]').textContent = stats.swap;
    content.querySelector('[data-utxo-count="spendable"]').textContent =
      stats.spendable;

    const list = content.querySelector('#app-utxo-list');
    const rows = getFilteredUtxos().slice(0, 7);

    if (!rows.length) {
      list.innerHTML =
        '<div class="app-empty">No UTXOs match this filter.</div>';
      return;
    }

    list.innerHTML = rows
      .map((utxoData) => {
        const utxo = utxoData.utxo || {};
        const txid =
          typeof utxo.txid === 'object' ? utxo.txid.value : utxo.txid;
        const type = getSpendTypeDisplay(utxoData.spendInfo?.spendType);
        const scriptType = getScriptType(utxoData);
        return `
          <button class="app-utxo-row" data-txid="${txid || ''}" type="button">
            <span class="app-utxo-main">
              <span class="app-mono app-id">${compactId(txid, 12, 4)}:${utxo.vout ?? 0}</span>
              <span class="app-amount positive">${formatSats(utxo.amount)}</span>
            </span>
            <span class="app-pill-stack">
              <span class="app-pill ${scriptType}">${scriptType === 'taproot' ? 'Taproot' : 'SegWit'}</span>
              <span class="app-pill ${type.toLowerCase()}">${type}</span>
            </span>
            <span class="app-address">
              ${compactId(utxo.address || 'No address', 10, 6)}
            </span>
            <span class="app-icon-action" aria-label="Open transaction">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </span>
          </button>
        `;
      })
      .join('');
  }

  function getFilteredTransactions() {
    let rows = [...allTransactions];
    if (txFilter !== 'all') {
      rows = rows.filter((tx) => getTransactionType(tx) === txFilter);
    }

    if (txSort === 'amount') {
      const direction = txSortDirection.amount === 'asc' ? 1 : -1;
      return rows.sort(
        (a, b) =>
          (Math.abs(a.detail?.amount?.sats || 0) -
            Math.abs(b.detail?.amount?.sats || 0)) *
          direction
      );
    }

    const direction = txSortDirection.newest === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const timeA = a.info?.time || a.info?.timereceived || 0;
      const timeB = b.info?.time || b.info?.timereceived || 0;
      return (timeA - timeB) * direction;
    });
  }

  function renderTransactions() {
    const list = content.querySelector('#app-tx-list');
    const rows = getFilteredTransactions().slice(0, 7);
    content.querySelector('#tx-count').textContent = `${rows.length} total`;

    if (!rows.length) {
      list.innerHTML =
        '<div class="app-empty">No transactions match this filter.</div>';
      return;
    }

    list.innerHTML = rows
      .map((tx) => {
        const type = getTransactionType(tx);
        const isReceive = (tx.detail?.amount?.sats || 0) >= 0;
        const txid =
          typeof tx.info?.txid === 'object'
            ? tx.info.txid.value
            : tx.info?.txid;
        const amount = tx.detail?.amount?.sats || 0;
        const confirmations = tx.info?.confirmations || 0;
        const timestamp = tx.info?.time || tx.info?.timereceived;
        const directionClass = isReceive ? 'in' : 'out';
        const amountPrefix = amount >= 0 ? '+' : '-';

        return `
          <button class="app-tx-row ${directionClass}" data-txid="${txid || ''}" type="button">
            <span class="app-tx-icon">${isReceive ? '+' : '-'}</span>
            <span class="app-tx-mid">
              <span class="app-mono app-id">${compactId(txid, 16, 8)}</span>
              <span class="app-tx-meta">
                <span class="app-conf ${confirmations >= 6 ? 'full' : ''}">${Math.min(confirmations, 6)}/6 conf</span>
                ${type === 'swap' ? '<span class="app-conf swap">Swap</span>' : ''}
              </span>
            </span>
            <span class="app-tx-right">
              <span class="app-amount ${isReceive ? 'positive' : 'negative'}">${amountPrefix}${formatSats(Math.abs(amount))}</span>
              <span class="app-time">${formatDate(timestamp)}</span>
            </span>
            <span class="app-icon-action" aria-label="Open transaction">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </span>
          </button>
        `;
      })
      .join('');
  }

  function sortArrow(direction) {
    const path =
      direction === 'asc' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7';
    return `
      <span class="app-sort-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="${path}" /></svg>
      </span>
    `;
  }

  function updateSortButtons() {
    content.querySelectorAll('#tx-sort-tabs button').forEach((button) => {
      const sort = button.dataset.sort;
      const isActive = sort === txSort;
      button.classList.toggle('active', isActive);
      button.innerHTML = `${sort === 'newest' ? 'Newest' : 'Amount'} ${sortArrow(txSortDirection[sort])}`;
      const orderLabel =
        sort === 'newest'
          ? txSortDirection[sort] === 'desc'
            ? 'newest to oldest'
            : 'oldest to newest'
          : txSortDirection[sort] === 'desc'
            ? 'high to low'
            : 'low to high';
      button.setAttribute('aria-label', `Sort by ${sort}, ${orderLabel}`);
    });
  }

  async function updateBalance() {
    const balance = await fetchBalance();
    const spendable = Number(balance.spendable || 0);
    const total =
      Number(balance.regular || 0) +
      Number(balance.swap || 0) +
      Number(balance.contract || 0);
    const share = total > 0 ? Math.min(100, (spendable / total) * 100) : 0;

    renderSatsAmount('#spendable-balance', balance.spendable);
    renderSatsAmount('#swap-balance', balance.swap);
    renderSatsAmount('#regular-balance', balance.regular);
    renderSatsAmount('#contract-balance', balance.contract);
    content.querySelector('#balance-share').textContent =
      `${share.toFixed(1)}%`;
    content.querySelector('#balance-share-bar').style.width = `${share}%`;

    return balance;
  }

  async function updateUtxos() {
    const txConfMap = new Map();
    try {
      const txData = await fetchTransactions(200, 0);
      for (const tx of txData || []) {
        const txid =
          typeof tx.info?.txid === 'object'
            ? tx.info.txid.value
            : tx.info?.txid;
        txConfMap.set(txid, tx.info?.confirmations || 0);
      }
    } catch (error) {
      console.warn('Could not build transaction confirmation map:', error);
    }

    const rawUtxos = await fetchUtxos();
    allUtxos = rawUtxos.map((entry) => {
      const txid =
        typeof entry.utxo?.txid === 'object'
          ? entry.utxo.txid.value
          : entry.utxo?.txid;
      const liveConfs = txConfMap.get(txid);
      if (liveConfs !== undefined) {
        return { ...entry, utxo: { ...entry.utxo, confirmations: liveConfs } };
      }
      return entry;
    });

    renderUtxos();
    return allUtxos;
  }

  async function updateTransactions() {
    allTransactions = await fetchTransactions(50, 0);
    renderTransactions();
    return allTransactions;
  }

  async function refreshAllData() {
    const refreshBtn = content.querySelector('#refresh-all-btn');
    const refreshText = refreshBtn.querySelector('span');
    refreshBtn.disabled = true;
    refreshBtn.classList.add('loading');
    refreshText.textContent = 'Refreshing';

    try {
      localStorage.removeItem(WALLET_CACHE_KEY);
      try {
        await syncWalletState();
      } catch (syncErr) {
        console.warn(
          'Wallet sync failed, refreshing data anyway:',
          syncErr.message
        );
      }

      const [balance, transactions, utxos] = await Promise.all([
        updateBalance(),
        updateTransactions(),
        updateUtxos(),
      ]);

      if (balance) saveWalletToCache(balance, transactions, utxos);
      content.querySelector('#last-updated').textContent =
        'Last updated just now';
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      refreshText.textContent = 'Refresh';
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('loading');
    }
  }

  const content = document.createElement('div');
  content.id = 'wallet-content';
  content.className = 'app-page';

  let walletInfo = { walletName: 'Wallet', walletPath: "m/84'/0'/0'" };
  try {
    const info = await window.api.taker.getWalletInfo();
    if (info.success) walletInfo = info;
  } catch (error) {
    console.error('Failed to get wallet info:', error);
  }

  content.innerHTML = `
    <header class="app-head">
      <div>
        <h2>Wallet</h2>
        <div class="app-meta">
          <span>${walletInfo.walletName || 'Native SegWit'}</span>
          <span>.</span>
          <span>${walletInfo.walletPath || "m/84'/0'/0'"}</span>
          <span>.</span>
          <span id="last-updated">Synced just now</span>
        </div>
      </div>
      <div class="app-actions">
        <button id="lock-wallet-btn" class="app-button ghost" type="button">Lock</button>
        <button id="refresh-all-btn" class="app-button primary" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 8M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-14 5.3L4 16M4 20v-4h4"/></svg>
          <span>Refresh</span>
        </button>
      </div>
    </header>

    <section class="app-balances" aria-label="Wallet balances">
      <article class="app-balance-card hero">
        <span class="app-accent"></span>
        <span class="app-card-label">Balance</span>
        <div class="app-card-value"><span id="spendable-balance"><span class="app-card-amount-number">0</span><span class="app-card-amount-unit">sats</span></span></div>
        <p>Total available</p>
        <div class="app-share">
          <span id="balance-share">0.0%</span>
          <span class="app-share-track"><span id="balance-share-bar"></span></span>
          <span>of total</span>
        </div>
      </article>
      <article class="app-balance-card info">
        <span class="app-accent"></span>
        <span class="app-card-label">Swaps</span>
        <div class="app-card-value"><span id="swap-balance"><span class="app-card-amount-number">0</span><span class="app-card-amount-unit">sats</span></span></div>
        <p>Reserved for swaps</p>
      </article>
      <article class="app-balance-card wallet">
        <span class="app-accent"></span>
        <span class="app-card-label">Wallet</span>
        <div class="app-card-value"><span id="regular-balance"><span class="app-card-amount-number">0</span><span class="app-card-amount-unit">sats</span></span></div>
        <p>Regular wallet coins</p>
      </article>
      <article class="app-balance-card warning">
        <span class="app-accent"></span>
        <span class="app-card-label">Contracts</span>
        <div class="app-card-value"><span id="contract-balance"><span class="app-card-amount-number">0</span><span class="app-card-amount-unit">sats</span></span></div>
        <p>In active contracts</p>
      </article>
    </section>

    <section class="app-lower">
      <article class="app-panel utxos">
        <header class="app-panel-head">
          <div>
            <h3>UTXOs</h3>
            <span id="utxo-count">0 unspent</span>
          </div>
        </header>
        <div class="app-panel-body">
          <div class="app-metrics">
            <div><span>Total UTXOs</span><strong id="utxo-total">0</strong></div>
            <div><span>Confirmed</span><strong id="utxo-confirmed" class="positive">0</strong></div>
            <div><span>Unconfirmed</span><strong id="utxo-unconfirmed" class="warning">0</strong></div>
          </div>
          <div class="app-tabs" id="utxo-tabs">
            <button class="active" data-filter="all" type="button">All <span data-utxo-count="all">0</span></button>
            <button data-filter="regular" type="button">Regular <span data-utxo-count="regular">0</span></button>
            <button data-filter="contract" type="button">Contract <span data-utxo-count="contract">0</span></button>
            <button data-filter="swap" type="button">Swap <span data-utxo-count="swap">0</span></button>
            <button data-filter="spendable" type="button">Spendable <span data-utxo-count="spendable">0</span></button>
          </div>
          <div class="app-utxo-head">
            <span>Txid . Amount</span>
            <span>Script . Type</span>
            <span>Address</span>
            <span></span>
          </div>
          <div class="app-list" id="app-utxo-list"></div>
        </div>
        <footer class="app-panel-foot">
          <button id="view-all-utxos" type="button">View all UTXOs -></button>
          <span id="utxo-updated">Last updated just now</span>
        </footer>
      </article>

      <article class="app-panel transactions">
        <header class="app-panel-head compact">
          <div>
            <h3>Recent transactions</h3>
            <span id="tx-count">0 total</span>
          </div>
          <div class="app-panel-controls">
            <div class="app-tabs" id="tx-tabs">
              <button class="active" data-filter="all" type="button">All</button>
              <button data-filter="received" type="button">Received</button>
              <button data-filter="sent" type="button">Sent</button>
              <button data-filter="swap" type="button">Swaps</button>
            </div>
            <div class="app-tabs sort" id="tx-sort-tabs">
              <button class="active" data-sort="newest" type="button">Newest ${sortArrow(txSortDirection.newest)}</button>
              <button data-sort="amount" type="button">Amount ${sortArrow(txSortDirection.amount)}</button>
            </div>
          </div>
        </header>
        <div class="app-panel-body">
          <div class="app-list tx" id="app-tx-list"></div>
        </div>
        <footer class="app-panel-foot">
          <button id="view-all-transactions" type="button">View all transactions -></button>
          <span>Live wallet</span>
        </footer>
      </article>
    </section>
  `;

  container.appendChild(content);

  window.openTxOnMempool = openMempool;
  updateSortButtons();

  content
    .querySelector('#refresh-all-btn')
    .addEventListener('click', refreshAllData);

  content.querySelector('#utxo-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    utxoFilter = button.dataset.filter;
    setButtonState('#utxo-tabs button', utxoFilter, 'filter');
    renderUtxos();
  });

  content.querySelector('#tx-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    txFilter = button.dataset.filter;
    setButtonState('#tx-tabs button', txFilter, 'filter');
    renderTransactions();
  });

  content.querySelector('#tx-sort-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-sort]');
    if (!button) return;
    const nextSort = button.dataset.sort;
    if (txSort === nextSort) {
      txSortDirection[nextSort] =
        txSortDirection[nextSort] === 'desc' ? 'asc' : 'desc';
    } else {
      txSort = nextSort;
    }
    updateSortButtons();
    renderTransactions();
  });

  content.querySelector('#app-utxo-list').addEventListener('click', (event) => {
    const row = event.target.closest('[data-txid]');
    if (row?.dataset.txid) openMempool(row.dataset.txid);
  });

  content.querySelector('#app-tx-list').addEventListener('click', (event) => {
    const row = event.target.closest('[data-txid]');
    if (row?.dataset.txid) openMempool(row.dataset.txid);
  });

  content.querySelector('#view-all-utxos').addEventListener('click', () => {
    import('./UtxoList.js').then((module) => {
      container.innerHTML = '';
      module.UtxoListComponent(container);
    });
  });

  content
    .querySelector('#view-all-transactions')
    .addEventListener('click', () => {
      import('./TransactionsList.js').then((module) => {
        container.innerHTML = '';
        module.TransactionsListComponent(container);
      });
    });

  try {
    await syncWalletState();
  } catch (syncErr) {
    console.warn(
      'Initial wallet sync failed, proceeding anyway:',
      syncErr.message
    );
  }

  const [balance, transactions, utxos] = await Promise.all([
    updateBalance(),
    updateTransactions(),
    updateUtxos(),
  ]);

  if (balance) saveWalletToCache(balance, transactions, utxos);
}
