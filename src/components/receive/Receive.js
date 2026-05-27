import { icons } from '../../js/icons.js';
import { formatSats } from '../../js/price.js';

export function ReceiveComponent(container) {
  const content = document.createElement('div');
  content.id = 'receive-content';

  let currentAddress = null;
  let isGenerating = false;
  let currentAddressData = null;

  content.innerHTML = `
    <div class="app-page receive-page">
      <div class="app-head receive-head">
        <div>
          <h2>Receive Bitcoin</h2>
          <p class="receive-subtitle">Generate a fresh address to receive BTC</p>
        </div>
        <button id="share-request" class="app-button ghost">
          ${icons.link(16)} Share request
        </button>
      </div>

      <div class="receive-layout">
        <section class="receive-main-card">
          <div class="receive-card-head">
            <h3>Your Bitcoin Address</h3>
            <div id="address-type-tabs" class="receive-type-tabs">
              <span data-type="P2TR">P2TR</span>
              <span data-type="P2WPKH">P2WPKH</span>
              <span data-type="LEGACY">Legacy</span>
            </div>
          </div>

          <div class="receive-card-body">
            <div class="receive-qr-frame">
              <span class="corner top-left"></span>
              <span class="corner top-right"></span>
              <span class="corner bottom-left"></span>
              <span class="corner bottom-right"></span>
              <div id="qr-container" class="receive-qr">
                <div class="receive-empty-qr">
                  ${icons.inbox(42)}
                  <strong>No address loaded</strong>
                  <span>Generate a receive address below.</span>
                </div>
              </div>
            </div>

            <div class="receive-address-strip">
              <span id="current-address">No address loaded</span>
              <button id="copy-address" disabled>
                ${icons.copy(15)} Copy
              </button>
            </div>

            <div class="receive-meta-row">
              <div>
                <span id="address-type-badge" class="receive-chip">--</span>
                <span id="address-derivation" class="receive-chip">m/86'/0'/0'/0/-</span>
                <span class="receive-muted">Gap-limit - 20 ahead</span>
              </div>
              <button id="view-mempool" disabled>View on mempool ${icons.externalLink(12)}</button>
            </div>

            <div class="receive-request-row">
              <span>Request specific amount</span>
              <div class="receive-unit-toggle">
                <button class="active" type="button">Sats</button>
                <button type="button">BTC</button>
              </div>
            </div>

            <label class="receive-input-wrap">
              <input id="request-amount" type="number" min="0" step="1" placeholder="0">
              <span>Sats</span>
            </label>

            <div class="receive-note-row">
              <input id="request-note" type="text" placeholder="Add a label or note (e.g. invoice 1042)">
              <span>BIP21</span>
            </div>

            <button id="generate-new" class="app-button primary lg receive-generate">
              <span class="generate-text">${icons.refreshCw(16)} Generate New Address</span>
              <span class="generate-loading hidden">${icons.loader(16, 'animate-spin')} Generating...</span>
            </button>
          </div>
        </section>

        <aside class="receive-side">
          <div class="receive-privacy">
            ${icons.alertTriangle(17)}
            <p><strong>Privacy:</strong> Reusing addresses links transactions on-chain. Generate a fresh address for each payer to preserve anonymity.</p>
          </div>

          <section class="receive-panel">
            <div class="receive-panel-head">
              <h3>Address Status</h3>
            </div>
            <div id="address-status" class="receive-status-list">
              <div><span>Generated</span><strong id="generation-time">-</strong></div>
              <div><span>Derivation index</span><strong id="derivation-index">-</strong></div>
              <div><span>Times used</span><strong id="usage-count">-</strong></div>
              <div><span>Total received</span><strong id="total-received">-</strong></div>
              <div><span>Status</span><strong id="address-status-text">-</strong></div>
            </div>
          </section>

          <section class="receive-panel">
            <div class="receive-panel-head">
              <h3>Recent Addresses</h3>
              <span id="total-addresses">0 total</span>
            </div>
            <div id="recent-addresses" class="receive-recent-list">
              <div class="receive-empty-list">No addresses generated yet</div>
            </div>
            <button id="view-all-addresses" class="receive-view-all">View all addresses -></button>
          </section>
        </aside>
      </div>
    </div>
  `;

  container.appendChild(content);

  const currentAddressEl = content.querySelector('#current-address');
  const copyButton = content.querySelector('#copy-address');
  const generateButton = content.querySelector('#generate-new');
  const generateText = content.querySelector('.generate-text');
  const generateLoading = content.querySelector('.generate-loading');
  const qrContainer = content.querySelector('#qr-container');
  const generationTime = content.querySelector('#generation-time');
  const usageCount = content.querySelector('#usage-count');
  const totalReceived = content.querySelector('#total-received');
  const addressTypeBadge = content.querySelector('#address-type-badge');
  const addressStatusText = content.querySelector('#address-status-text');
  const derivationIndex = content.querySelector('#derivation-index');
  const addressDerivation = content.querySelector('#address-derivation');
  const recentAddressesEl = content.querySelector('#recent-addresses');
  const totalAddressesEl = content.querySelector('#total-addresses');
  const shareButton = content.querySelector('#share-request');
  const viewMempoolButton = content.querySelector('#view-mempool');

  async function getNextAddress() {
    return await window.api.taker.getNextAddress();
  }

  function generateQR(text) {
    const size = 340;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=000000&margin=12`;

    qrContainer.innerHTML = `
      <img
        src="${qrApiUrl}"
        alt="QR Code for ${text}"
        onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'receive-empty-qr\\'><strong>QR generation failed</strong><span>${text.substring(0, 22)}...</span></div>'"
      />
    `;
  }

  function detectAddressType(address, fallbackSpendType = '') {
    if (
      address.startsWith('bc1q') ||
      address.startsWith('tb1q') ||
      address.startsWith('bcrt1q')
    ) {
      return address.length > 50 ? 'P2WSH' : 'P2WPKH';
    }
    if (
      address.startsWith('bc1p') ||
      address.startsWith('bcrt1p') ||
      address.startsWith('tb1p')
    ) {
      return 'P2TR';
    }
    if (address.startsWith('3') || address.startsWith('2')) return 'P2SH';
    if (
      address.startsWith('1') ||
      address.startsWith('m') ||
      address.startsWith('n')
    ) {
      return 'P2PKH';
    }

    const spendType = String(fallbackSpendType || '').toLowerCase();
    if (spendType.includes('contract') || spendType.includes('swap'))
      return 'P2WSH';
    return 'P2WPKH';
  }

  function getDerivationPath(type, index = '-') {
    if (type === 'P2TR') return `m/86'/0'/0'/0/${index}`;
    if (type === 'P2SH' || type === 'P2PKH') return `m/49'/0'/0'/0/${index}`;
    return `m/84'/0'/0'/0/${index}`;
  }

  async function getAddressesFromTransactions() {
    try {
      const result = await window.api.taker.getTransactions(100, 0);

      if (!result.success || !result.transactions) {
        return [];
      }

      const addressMap = new Map();

      result.transactions.forEach((tx) => {
        const category = (tx.detail.category || '').toLowerCase();

        if (category === 'receive' || category === '"receive"') {
          const addr = tx.detail.address?.address || tx.detail.address;

          if (addr) {
            if (!addressMap.has(addr)) {
              addressMap.set(addr, {
                address: addr,
                used: 0,
                received: 0,
                createdAt: (tx.info.blocktime || tx.info.time) * 1000,
                type: detectAddressType(addr),
                lastUsed: (tx.info.blocktime || tx.info.time) * 1000,
              });
            }

            const addrData = addressMap.get(addr);
            addrData.used++;
            addrData.received += tx.detail.amount?.sats || 0;
            addrData.lastUsed = Math.max(
              addrData.lastUsed,
              (tx.info.blocktime || tx.info.time) * 1000
            );
          }
        }
      });

      return Array.from(addressMap.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      );
    } catch (error) {
      console.error('Failed to get addresses from transactions:', error);
      return [];
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    copyButton.innerHTML = `${icons.check(15)} Copied`;
    copyButton.classList.add('copied');
    setTimeout(() => {
      copyButton.innerHTML = `${icons.copy(15)} Copy`;
      copyButton.classList.remove('copied');
    }, 1800);
  }

  function updateTypeTabs(type) {
    const tabType = type === 'P2PKH' || type === 'P2SH' ? 'LEGACY' : type;
    content.querySelectorAll('#address-type-tabs span').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.type === tabType);
    });
  }

  function updateAddressStatus(addressData) {
    currentAddressData = addressData;

    if (!addressData) {
      generationTime.textContent = '-';
      usageCount.textContent = '-';
      totalReceived.textContent = '-';
      addressStatusText.textContent = '-';
      addressStatusText.className = '';
      addressTypeBadge.textContent = '--';
      derivationIndex.textContent = '-';
      addressDerivation.textContent = "m/86'/0'/0'/0/-";
      updateTypeTabs(null);
      return;
    }

    const createdDate = new Date(addressData.createdAt);
    const index = addressData.index ?? addressData.derivationIndex ?? '-';
    generationTime.textContent = createdDate.toLocaleTimeString();
    derivationIndex.textContent = index === '-' ? '-' : `#${index}`;
    usageCount.textContent = addressData.used.toString();
    totalReceived.textContent = formatSats(addressData.received);

    if (addressData.used === 0) {
      addressStatusText.textContent = 'Unused';
      addressStatusText.className = 'warning';
    } else if (addressData.used === 1) {
      addressStatusText.textContent = 'Used once';
      addressStatusText.className = 'positive';
    } else {
      addressStatusText.textContent = `Used ${addressData.used} times`;
      addressStatusText.className = 'primary';
    }

    addressTypeBadge.textContent =
      addressData.type === 'P2PKH' || addressData.type === 'P2SH'
        ? `${addressData.type} - Legacy`
        : addressData.type;
    addressDerivation.textContent = getDerivationPath(addressData.type, index);
    updateTypeTabs(addressData.type);
  }

  async function updateRecentAddresses() {
    const addresses = await getAddressesFromTransactions();

    if (
      currentAddress &&
      !addresses.find((a) => a.address === currentAddress)
    ) {
      addresses.unshift({
        address: currentAddress,
        used: 0,
        received: 0,
        createdAt: currentAddressData?.createdAt || Date.now(),
        type: detectAddressType(currentAddress),
        lastUsed: null,
        index: currentAddressData?.index ?? 5,
      });
    }

    totalAddressesEl.textContent = `${addresses.length} total`;

    if (addresses.length === 0) {
      recentAddressesEl.innerHTML = `
        <div class="receive-empty-list">No addresses found in transactions yet</div>
      `;
      return;
    }

    recentAddressesEl.innerHTML = addresses
      .slice(0, 5)
      .map((addr) => {
        const isCurrent = addr.address === currentAddress;
        const compactAddress = `${addr.address.substring(0, 14)}...${addr.address.substring(addr.address.length - 8)}`;
        return `
          <button class="receive-recent-item ${isCurrent ? 'current' : ''}" data-address="${addr.address}">
            <span>
              <strong>${compactAddress}</strong>
              <small>${addr.type} - ${addr.used > 0 ? `Used ${addr.used}x` : 'Unused'}${isCurrent ? ' - Current' : ''}</small>
            </span>
            <span>
              <strong>${formatSats(addr.received)}</strong>
              <small>${isCurrent ? 'Current' : ''}</small>
            </span>
          </button>
        `;
      })
      .join('');

    recentAddressesEl
      .querySelectorAll('.receive-recent-item')
      .forEach((item) => {
        item.addEventListener('click', () => {
          selectAddress(item.dataset.address);
        });
      });
  }

  async function selectAddress(addressString) {
    currentAddress = addressString;
    currentAddressEl.textContent = addressString;
    copyButton.disabled = false;
    viewMempoolButton.disabled = false;
    generateQR(addressString);

    const addresses = await getAddressesFromTransactions();
    const addressData = addresses.find((a) => a.address === addressString) || {
      address: addressString,
      used: 0,
      received: 0,
      createdAt: Date.now(),
      type: detectAddressType(addressString),
      index: 5,
    };
    updateAddressStatus(addressData);
    updateRecentAddresses();
  }

  async function generateNewAddress() {
    if (isGenerating) return;

    isGenerating = true;
    generateButton.disabled = true;
    generateText.classList.add('hidden');
    generateLoading.classList.remove('hidden');

    qrContainer.innerHTML = `
      <div class="receive-empty-qr">
        ${icons.loader(42, 'animate-spin')}
        <strong>Generating address...</strong>
      </div>
    `;

    try {
      const result = await getNextAddress();

      if (!result.success || !result.address) {
        throw new Error(result.error || 'Failed to generate address');
      }

      const addressString =
        typeof result.address === 'string'
          ? result.address
          : result.address.address;
      const addressType =
        result.addressType || detectAddressType(addressString);
      const addressData = {
        address: addressString,
        used: 0,
        received: 0,
        createdAt: Date.now(),
        type: addressType,
        index: result.index ?? 5,
      };

      currentAddress = addressString;
      currentAddressEl.textContent = addressString;
      copyButton.disabled = false;
      viewMempoolButton.disabled = false;
      generateQR(addressString);
      updateAddressStatus(addressData);
      updateRecentAddresses();
    } catch (error) {
      console.error('Address generation failed:', error);
      currentAddressEl.textContent = `Error: ${error.message}`;
      qrContainer.innerHTML = `
        <div class="receive-empty-qr error">
          ${icons.xCircle(42)}
          <strong>Address generation failed</strong>
          <span>${error.message}</span>
        </div>
      `;
    } finally {
      isGenerating = false;
      generateButton.disabled = false;
      generateText.classList.remove('hidden');
      generateLoading.classList.add('hidden');
    }
  }

  async function initialize() {
    try {
      await updateRecentAddresses();
      updateAddressStatus(null);
    } catch (error) {
      console.error('Initialization failed:', error);
      currentAddressEl.textContent = 'Failed to initialize';
      qrContainer.innerHTML = `
        <div class="receive-empty-qr error">
          ${icons.xCircle(42)}
          <strong>Initialization failed</strong>
        </div>
      `;
    }
  }

  copyButton.addEventListener('click', () => {
    if (currentAddress) {
      copyToClipboard(currentAddress);
    }
  });

  shareButton.addEventListener('click', () => {
    if (currentAddress) {
      copyToClipboard(`bitcoin:${currentAddress}`);
    } else {
      generateNewAddress();
    }
  });

  viewMempoolButton.addEventListener('click', () => {
    if (currentAddress) {
      window.open(`https://mempool.space/address/${currentAddress}`, '_blank');
    }
  });

  generateButton.addEventListener('click', generateNewAddress);

  const viewAllButton = content.querySelector('#view-all-addresses');
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      import('./AddressList.js')
        .then((module) => {
          container.innerHTML = '';
          module.AddressListComponent(container);
        })
        .catch((err) => {
          console.error('Failed to load AddressList:', err);
          alert('Address list feature loading...');
        });
    });
  }

  initialize();

  return content;
}
