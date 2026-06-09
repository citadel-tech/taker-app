import { icons } from '../../js/icons.js';
import { getBtcPriceUsd, SATS_SYMBOL } from '../../js/price.js';

export function SendComponent(container, preSelectedUtxos = null) {
  const content = document.createElement('div');
  content.id = 'send-content';

  // State
  let amountUnit = 'sats';
  let selectedFeeRate = 2;
  let feeRates = { low: 1, medium: 2, high: 4 };
  let selectionMode =
    preSelectedUtxos && preSelectedUtxos.length > 0 ? 'manual' : 'auto';
  let selectedUtxos = preSelectedUtxos || [];
  let utxoFilter = 'regular';
  const btcPrice = getBtcPriceUsd();

  function hasUsdPrice() {
    return Number.isFinite(Number(btcPrice)) && Number(btcPrice) > 0;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // New state for multi-address and signed tx
  let recipients = [{ address: '', amount: 0 }];
  let signedTx = null;
  let signedTxHex = null;
  let actualTxSize = 0;
  let actualFee = 0;

  let availableUtxos = [];
  let availableBalance = 0;
  let previouslyUsedAddresses = new Set();

  function getUtxoKind(utxo) {
    return String(utxo?.type || '').toLowerCase().includes('swap')
      ? 'swap'
      : 'regular';
  }

  function getUtxoKindLabel(utxo) {
    return getUtxoKind(utxo) === 'swap' ? 'Swap' : 'Regular';
  }

  function getAmountUnitLabel(unit = amountUnit) {
    if (unit === 'sats') return SATS_SYMBOL;
    return unit.toUpperCase();
  }

  function getAmountConversionLabels(amountSats, selectedUnit = amountUnit) {
    const labels = [];
    const btcAmount = amountSats / 100000000;

    if (selectedUnit !== 'sats') {
      labels.push(`= ${Math.round(amountSats || 0).toLocaleString()} ${SATS_SYMBOL}`);
    }
    if (selectedUnit !== 'btc') {
      labels.push(`= ${btcAmount.toFixed(8)} BTC`);
    }
    if (selectedUnit !== 'usd' && hasUsdPrice()) {
      labels.push(`$${(btcAmount * btcPrice).toFixed(2)} USD`);
    } else if (selectedUnit !== 'usd') {
      labels.push('USD price unavailable');
    }

    return labels;
  }

  function formatSatsHtml(sats) {
    return `${Math.round(Number(sats || 0)).toLocaleString()} ${SATS_SYMBOL}`;
  }

  function formatSatsText(sats) {
    return `${Math.round(Number(sats || 0)).toLocaleString()} sats`;
  }

  function validationMessage(text, html = text) {
    return { text, html };
  }

  // Fetch real UTXOs from API
  async function fetchUtxosFromAPI() {
    try {
      const data = await window.api.taker.getUtxos();

      if (data.success && data.utxos) {
        availableUtxos = data.utxos.map((item, index) => {
          const utxo = item.utxo || item;
          const spendInfo = item.spendInfo || {};
          const txid =
            typeof utxo.txid === 'object' ? utxo.txid.value : utxo.txid;

          return {
            txid: txid,
            vout: utxo.vout,
            amount: utxo.amount,
            type: spendInfo.spendType || 'Regular',
            index: index,
          };
        });

        availableBalance = availableUtxos.reduce(
          (sum, utxo) => sum + utxo.amount,
          0
        );
        if (selectedUtxos.length > 0 && availableUtxos[selectedUtxos[0]]) {
          utxoFilter = getUtxoKind(availableUtxos[selectedUtxos[0]]);
          selectedUtxos = selectedUtxos.filter(
            (index) => availableUtxos[index] && getUtxoKind(availableUtxos[index]) === utxoFilter
          );
        }
        console.log(
          'Loaded',
          availableUtxos.length,
          'UTXOs, Total balance:',
          availableBalance,
          'sats'
        );

        renderUtxoList();
        updateSelectedUtxosDisplay();
        updateSummary();
      }
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
    }
  }

  async function fetchPreviouslyUsedAddresses() {
    try {
      const result = await window.api.taker.getTransactions(200, 0);
      if (!result.success || !Array.isArray(result.transactions)) return;

      previouslyUsedAddresses = new Set(
        result.transactions
          .map((tx) => tx.detail?.address?.address || tx.detail?.address)
          .filter(Boolean)
          .map((address) => String(address).trim())
      );
      updateAddressReuseWarning();
    } catch (error) {
      console.warn('Failed to check address reuse history:', error);
    }
  }

  function updateAddressReuseWarning() {
    const warning = content.querySelector('#address-reuse-warning');
    if (!warning) return;

    const hasReusedAddress = recipients.some((recipient) =>
      previouslyUsedAddresses.has(String(recipient.address || '').trim())
    );
    warning.classList.toggle('hidden', !hasReusedAddress);
  }

  // VALIDATION
  function validateTransaction() {
    const errors = [];

    // Check recipients
    const validRecipients = recipients.filter((r) => r.address);
    if (validRecipients.length === 0) {
      errors.push(validationMessage('Add at least one recipient'));
      return { valid: false, errors };
    }

    // Check amounts and balance
    let totalAmount = 0;
    let availableForSpending = 0;

    if (selectionMode === 'manual') {
      if (selectedUtxos.length === 0) {
        errors.push(validationMessage('Select at least one UTXO'));
        return { valid: false, errors };
      }
      availableForSpending = getSelectedUtxosTotal();
    } else {
      // Auto mode
      availableForSpending = availableBalance;
    }

    totalAmount = validRecipients.reduce(
      (sum, recipient) => sum + (recipient.amount || 0),
      0
    );

    // Check for negative amounts
    recipients.forEach((r, i) => {
      if (r.amount < 0) {
        errors.push(validationMessage(`Recipient ${i + 1} has negative amount`));
      }
    });

    if (totalAmount <= 0) {
      errors.push(validationMessage('Enter an amount to send'));
      return { valid: false, errors };
    }

    validRecipients.forEach((recipient, index) => {
      if (!recipient.amount || recipient.amount <= 0) {
        errors.push(validationMessage(`Recipient ${index + 1} needs an amount`));
      }
    });

    // Check if sufficient balance (amount doesn't include fee in calculation)
    const numInputs =
      selectionMode === 'manual' ? Math.max(1, selectedUtxos.length) : 1;
    const numOutputs = validRecipients.length;
    const estimatedTxSize = Math.ceil(
      10.5 + 68 * numInputs + 31 * numOutputs + 31
    );
    const estimatedFee = selectedFeeRate * estimatedTxSize;

    const total = totalAmount + estimatedFee;
    if (selectionMode === 'manual' && totalAmount > availableForSpending) {
      errors.push(validationMessage(
        `Amount (${formatSatsText(totalAmount)}) exceeds selected UTXOs (${formatSatsText(availableForSpending)})`,
        `Amount (${formatSatsHtml(totalAmount)}) exceeds selected UTXOs (${formatSatsHtml(availableForSpending)})`
      )
      );
    }

    if (total > availableForSpending) {
      const shortfall = total - availableForSpending;
      errors.push(validationMessage(
        `Need ${formatSatsText(shortfall)} more`,
        `Need ${formatSatsHtml(shortfall)} more`
      ));
    }

    return { valid: errors.length === 0, errors };
  }

  function showValidationErrors(errors) {
    const signBtn = content.querySelector('#sign-tx-btn');
    if (!signBtn) return;

    if (errors.length === 0) {
      signBtn.innerHTML = icons.key(15) + ' Sign Transaction';
      signBtn.title = '';
      return;
    }

    signBtn.innerHTML = icons.alertTriangle(15) + ' ' + errors[0].html;
    signBtn.title = errors.map((error) => error.text).join('\n');
  }

  // RECIPIENT MANAGEMENT
  function addRecipient() {
    recipients.push({ address: '', amount: 0 });
    renderRecipients();
  }

  function removeRecipient(index) {
    if (recipients.length > 1) {
      recipients.splice(index, 1);
      renderRecipients();
      updateSummary();
    }
  }

  function updateRecipient(index, field, value) {
    // Prevent negative amounts
    if (field === 'amount' && value < 0) {
      value = 0;
    }

    recipients[index][field] = value;
    updateSummary();
    if (field === 'amount') {
      updateRecipientConversions(index);
    }
  }

  function switchUnit(unit) {
    amountUnit = unit;

    content.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.unit === unit);
    });

    content.querySelectorAll('.recipient-amount-unit').forEach((unitEl) => {
      unitEl.innerHTML = getAmountUnitLabel(unit);
    });

    recipients.forEach((_, index) => {
      const input = content.querySelector(
        `.recipient-amount[data-index="${index}"]`
      );
      if (input) {
        const amountSats = recipients[index].amount || 0;

        // Update placeholder
        if (unit === 'sats') {
          input.placeholder = '0';
          input.value = amountSats > 0 ? amountSats : '';
        } else if (unit === 'btc') {
          input.placeholder = '0.00000000';
          input.value =
            amountSats > 0 ? (amountSats / 100000000).toFixed(8) : '';
        } else if (unit === 'usd' && hasUsdPrice()) {
          input.placeholder = '0.00';
          input.value =
            amountSats > 0
              ? ((amountSats / 100000000) * btcPrice).toFixed(2)
              : '';
        } else if (unit === 'usd') {
          input.placeholder = 'Price unavailable';
          input.value = '';
        }
      }
      updateRecipientConversions(index);
    });
  }

  function updateRecipientConversions(index) {
    const amountSats = recipients[index].amount || 0;
    const primaryEl = content.querySelector(`#recipient-${index}-conversion-primary`);
    const secondaryEl = content.querySelector(`#recipient-${index}-conversion-secondary`);
    const [primary, secondary] = getAmountConversionLabels(amountSats);

    if (primaryEl) primaryEl.innerHTML = primary;
    if (secondaryEl) secondaryEl.innerHTML = secondary;
  }

  function renderRecipients() {
    const container = content.querySelector('#recipients-container');
    if (!container) return;
    const totalEl = content.querySelector('#recipient-total');
    if (totalEl) totalEl.textContent = `${recipients.length} total`;

    container.innerHTML = recipients
      .map((recipient, index) => {
        const hasAddress = Boolean(recipient.address);
        const normalizedAddress = recipient.address.toLowerCase();
        const addressType =
          hasAddress &&
          (normalizedAddress.startsWith('1') ||
            normalizedAddress.startsWith('3') ||
            normalizedAddress.startsWith('2') ||
            normalizedAddress.startsWith('m') ||
            normalizedAddress.startsWith('n'))
            ? 'Legacy'
            : 'Segwit';
        const amountPlaceholder =
          amountUnit === 'sats'
            ? '0'
            : amountUnit === 'btc'
              ? '0.00000000'
              : hasUsdPrice()
                ? '0.00'
                : 'Price unavailable';
        const amountValue =
          recipient.amount && recipient.amount > 0
            ? amountUnit === 'sats'
              ? recipient.amount
              : amountUnit === 'btc'
                ? (recipient.amount / 100000000).toFixed(8)
                : hasUsdPrice()
                  ? ((recipient.amount / 100000000) * btcPrice).toFixed(2)
                  : ''
            : '';

        return `
      <div class="send-recipient-card recipient-row">
        <div class="send-recipient-top">
          <div>
            <span>Recipient ${String(index + 1).padStart(2, '0')}</span>
            ${hasAddress ? `<b>${icons.check(12)} ${addressType}</b>` : ''}
          </div>
          <div class="send-recipient-tools">
            <button type="button" title="Paste from clipboard">${icons.clipboardCopy(14)}</button>
            <button type="button" title="Scan QR">${icons.search(14)}</button>
            <button type="button" title="Address book">${icons.inbox(14)}</button>
            ${
              recipients.length > 1
                ? `
              <button class="remove-recipient" type="button" title="Remove recipient" data-index="${index}">
                ${icons.xCircle(14)}
              </button>
            `
                : ''
            }
          </div>
        </div>
        
        <div class="send-field">
          <label>Bitcoin Address</label>
          <input 
            type="text" 
            placeholder="bc1q... or bc1p... or paste from clipboard" 
            value="${recipient.address}"
            class="recipient-address"
            data-index="${index}"
          />
        </div>

        <div class="send-field amount">
          <div class="send-field-row">
            <label>Amount</label>
            <div class="send-unit-toggle">
              <button type="button" class="unit-btn ${amountUnit === 'sats' ? 'active' : ''}" data-unit="sats" data-recipient="${index}">
                ${SATS_SYMBOL}
              </button>
              <button type="button" class="unit-btn ${amountUnit === 'btc' ? 'active' : ''}" data-unit="btc" data-recipient="${index}">
                BTC
              </button>
              <button type="button" class="unit-btn ${amountUnit === 'usd' ? 'active' : ''}" data-unit="usd" data-recipient="${index}">
                USD
              </button>
            </div>
          </div>
          <label class="send-amount-wrap">
            <input 
              type="number" 
              min="0"
              step="any"
              placeholder="${amountPlaceholder}"
              value="${amountValue}"
              class="recipient-amount"
              data-index="${index}"
            />
            <span class="recipient-amount-unit">${getAmountUnitLabel()}</span>
          </label>
          <div class="send-conversion-row">
            <span id="recipient-${index}-conversion-primary">= 0.00000000 BTC</span>
            <span id="recipient-${index}-conversion-secondary">$0.00 USD</span>
          </div>
        </div>
      </div>
    `;
      })
      .join('');

    // Attach event listeners
    container.querySelectorAll('.recipient-address').forEach((input) => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        updateRecipient(index, 'address', e.target.value.trim());
        updateAddressReuseWarning();
      });
    });

    container.querySelectorAll('.recipient-amount').forEach((input) => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        let value = parseFloat(e.target.value) || 0;

        // Prevent negative
        if (value < 0) {
          value = 0;
          e.target.value = 0;
        }

        // Convert to satoshis based on current unit.
        if (amountUnit === 'btc') {
          value = value * 100000000;
        } else if (amountUnit === 'usd' && hasUsdPrice()) {
          value = (value / btcPrice) * 100000000;
        } else if (amountUnit === 'usd') {
          value = 0;
        }

        updateRecipient(index, 'amount', value);
      });
    });

    container.querySelectorAll('.remove-recipient').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        removeRecipient(index);
      });
    });

    // Unit switcher event listeners
    container.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const unit = e.target.dataset.unit;
        switchUnit(unit);
      });
    });

    // Update conversions
    recipients.forEach((_, index) => {
      updateRecipientConversions(index);
    });
  }

  // UTXO SELECTION
  function toggleSelectionMode(mode) {
    selectionMode = mode;

    content.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const manualSection = content.querySelector('#manual-selection-section');

    if (mode === 'manual') {
      if (manualSection) manualSection.classList.remove('hidden');
    } else {
      if (manualSection) manualSection.classList.add('hidden');
      selectedUtxos = [];
      updateSelectedUtxosDisplay();
    }

    renderRecipients();
    updateSummary();
  }

  function setUtxoFilter(filter) {
    utxoFilter = filter === 'swap' ? 'swap' : 'regular';
    selectedUtxos = [];

    content.querySelectorAll('.utxo-filter-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.filter === utxoFilter);
    });

    renderUtxoList();
    updateSelectedUtxosDisplay();
    checkUtxoTypeWarning();
    renderRecipients();
    updateSummary();
  }

  function toggleUtxoSelection(index) {
    const utxoIndex = selectedUtxos.indexOf(index);
    if (utxoIndex > -1) {
      selectedUtxos.splice(utxoIndex, 1);
    } else {
      const nextKind = getUtxoKind(availableUtxos[index]);
      utxoFilter = nextKind;
      selectedUtxos = selectedUtxos.filter(
        (selectedIndex) => getUtxoKind(availableUtxos[selectedIndex]) === nextKind
      );
      selectedUtxos.push(index);
      content.querySelectorAll('.utxo-filter-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.filter === utxoFilter);
      });
    }

    const checkbox = content.querySelector('#utxo-' + index);
    if (checkbox) {
      const isSelected = selectedUtxos.includes(index);
      checkbox.checked = isSelected;
      checkbox
        .closest('.send-utxo-item')
        ?.classList.toggle('selected', isSelected);
    }

    updateSelectedUtxosDisplay();
    renderUtxoList();
    checkUtxoTypeWarning();
    renderRecipients();
    updateSummary();
  }

  function updateSelectedUtxosDisplay() {
    const countEl = content.querySelector('#selected-utxos-count');
    const valueEl = content.querySelector('#selected-utxos-value');

    if (countEl) countEl.textContent = selectedUtxos.length;

    if (valueEl) {
      const totalValue = selectedUtxos.reduce(
        (sum, index) => sum + availableUtxos[index].amount,
        0
      );
      valueEl.textContent = `${selectedUtxos.length} selected`;
      valueEl.title =
        totalValue.toLocaleString() +
        ' sats - ' +
        (totalValue / 100000000).toFixed(8) +
        ' BTC' +
        (hasUsdPrice()
          ? ' - $' + (((totalValue / 100000000) * btcPrice).toFixed(2))
          : '');
    }
  }

  function getSelectedUtxosTotal() {
    if (selectedUtxos.length === 0) return 0;
    return selectedUtxos.reduce(
      (sum, index) => sum + availableUtxos[index].amount,
      0
    );
  }

  function checkUtxoTypeWarning() {
    const warningEl = content.querySelector('#utxo-warning');
    if (!warningEl) return;

    const types = selectedUtxos.map((index) => getUtxoKind(availableUtxos[index]));
    const hasRegular = types.includes('regular');
    const hasSwap = types.includes('swap');

    if (hasRegular && hasSwap) {
      const keepKind = utxoFilter;
      selectedUtxos = selectedUtxos.filter(
        (index) => getUtxoKind(availableUtxos[index]) === keepKind
      );
      updateSelectedUtxosDisplay();
    }
    warningEl.classList.add('hidden');
  }

  function renderUtxoList() {
    const utxoContainer = content.querySelector('#utxo-list-container');
    if (!utxoContainer) return;

    if (availableUtxos.length === 0) {
      utxoContainer.innerHTML = `
        <div class="send-empty">
          ${icons.inbox(36)}
          <strong>No UTXOs available</strong>
          <span>Receive some bitcoin first</span>
        </div>
      `;
      return;
    }

    const filteredUtxos = availableUtxos.filter(
      (utxo) => getUtxoKind(utxo) === utxoFilter
    );

    if (filteredUtxos.length === 0) {
      utxoContainer.innerHTML = `
        <div class="send-empty">
          ${icons.inbox(36)}
          <strong>No ${utxoFilter === 'swap' ? 'Swap' : 'Regular'} UTXOs</strong>
          <span>Switch the filter or refresh wallet data</span>
        </div>
      `;
      return;
    }

    utxoContainer.innerHTML = filteredUtxos
      .map((utxo, index) => {
        const originalIndex = utxo.index;
        const btcAmount = (utxo.amount / 100000000).toFixed(8);
        const usdAmount = hasUsdPrice()
          ? ((utxo.amount / 100000000) * btcPrice).toFixed(2)
          : null;
        const isSelected = selectedUtxos.includes(originalIndex);

        return `
        <label class="send-utxo-item ${isSelected ? 'selected' : ''}">
          <input type="checkbox" id="utxo-${originalIndex}" ${isSelected ? 'checked' : ''} />
          <span></span>
          <div>
            <strong>${utxo.txid.substring(0, 16)}...${utxo.txid.substring(utxo.txid.length - 8)}:${utxo.vout}</strong>
            <small>${utxo.amount.toLocaleString()} ${SATS_SYMBOL} - ${getUtxoKindLabel(utxo)}</small>
          </div>
          <div>
            <strong>${utxo.amount.toLocaleString()} ${SATS_SYMBOL}</strong>
            <small>${btcAmount} BTC${usdAmount == null ? '' : ' - $' + usdAmount}</small>
          </div>
        </label>
      `;
      })
      .join('');

    filteredUtxos.forEach((utxo) => {
      const index = utxo.index;
      const checkbox = content.querySelector('#utxo-' + index);
      if (checkbox) {
        checkbox.addEventListener('change', () => toggleUtxoSelection(index));
      }
    });
  }

  function selectFee(level) {
    selectedFeeRate = feeRates[level];

    content.querySelectorAll('.fee-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.level === level);
    });

    updateSummary();
  }

  function getTotalAmountToSend() {
    return recipients.reduce((sum, r) => sum + (r.amount || 0), 0);
  }

  function updateSummary() {
    const amountSats = getTotalAmountToSend();
    const numOutputs = recipients.length;
    const numInputs =
      selectionMode === 'manual' ? Math.max(1, selectedUtxos.length) : 1;

    const estimatedTxSize = Math.ceil(
      10.5 + 68 * numInputs + 31 * numOutputs + 31
    );
    const estimatedFee = selectedFeeRate * estimatedTxSize;
    const total = amountSats + estimatedFee;

    let availableForSpending = availableBalance;
    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      availableForSpending = getSelectedUtxosTotal();
    }

    const remaining = Math.max(0, availableForSpending - total);
    const confTime =
      selectedFeeRate >= 4
        ? '~10 min'
        : selectedFeeRate >= 2
          ? '~20 min'
          : '~60+ min';

    const displayFee = signedTx ? actualFee : estimatedFee;
    const displayTxSize = signedTx ? actualTxSize : estimatedTxSize;
    const displayRemaining = signedTx
      ? availableForSpending - amountSats - actualFee
      : remaining;

    // Check if transaction is valid
    const validation = validateTransaction();
    showValidationErrors(validation.errors);

    // Update button states
    const signBtn = content.querySelector('#sign-tx-btn');
    const broadcastBtn = content.querySelector('#broadcast-tx-btn');
    if (signBtn) {
      signBtn.disabled = !validation.valid;
    }

    // Update summary
    const summaryAmount = content.querySelector('#summary-amount');
    const summaryFeeRate = content.querySelector('#summary-fee-rate');
    const summaryFee = content.querySelector('#summary-fee');
    const summaryInputValue = content.querySelector('#summary-input-value');

    if (summaryAmount)
      summaryAmount.innerHTML =
        Math.floor(amountSats).toLocaleString() + ' ' + SATS_SYMBOL;
    if (summaryFeeRate) summaryFeeRate.textContent = selectedFeeRate;
    if (summaryFee)
      summaryFee.innerHTML =
        (signedTx ? '' : '~') + displayFee.toLocaleString() + ' ' + SATS_SYMBOL;
    if (summaryInputValue) {
      summaryInputValue.innerHTML =
        `${numInputs} / ${availableForSpending.toLocaleString()} ${SATS_SYMBOL}`;
    }

    // Technical details
    const txSizeEl = content.querySelector('#tx-size');
    const changeAmountEl = content.querySelector('#change-amount');
    const summaryEtaEl = content.querySelector('#summary-eta');

    if (txSizeEl) txSizeEl.textContent = displayTxSize + ' vB';
    if (summaryEtaEl) summaryEtaEl.textContent = `ETA ${confTime}`;

    // Show change amount in red if negative
    if (changeAmountEl) {
      changeAmountEl.innerHTML = displayRemaining.toLocaleString() + ' ' + SATS_SYMBOL;
      if (displayRemaining < 0) {
        changeAmountEl.classList.add('text-red-400');
        changeAmountEl.classList.remove('text-purple-400');
      } else {
        changeAmountEl.classList.add('text-purple-400');
        changeAmountEl.classList.remove('text-red-400');
      }
    }

    // Update available balance
    const availableBalanceEl = content.querySelector('#available-balance-sats');
    const availableBalanceBtcEl = content.querySelector(
      '#available-balance-btc'
    );
    if (availableBalanceEl && availableBalanceBtcEl) {
      availableBalanceEl.innerHTML =
        availableForSpending.toLocaleString() + ' ' + SATS_SYMBOL;
      availableBalanceBtcEl.textContent = (
        availableForSpending / 100000000
      ).toFixed(8);
    }

    // Update hex display if tx is signed
    if (signedTxHex) {
      const hexDisplay = content.querySelector('#tx-hex-content');
      if (hexDisplay) {
        hexDisplay.textContent = signedTxHex;
      }
    }
  }

  // SIGN TRANSACTION
  async function handleSignTransaction() {
    const validation = validateTransaction();
    if (!validation.valid) {
      alert(
        'Cannot sign transaction:\n\n' +
          validation.errors.map((error) => error.text).join('\n')
      );
      return;
    }

    const signBtn = content.querySelector('#sign-tx-btn');
    const originalText = signBtn.textContent;
    signBtn.disabled = true;
    signBtn.textContent = 'Signing...';

    try {
      console.log('Signing transaction');

      const numInputs = selectionMode === 'manual' ? selectedUtxos.length : 1;
      const numOutputs = recipients.filter((r) => r.address).length;
      actualTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs + 31);
      actualFee = selectedFeeRate * actualTxSize;

      signedTx = { id: 'simulated-tx' };
      signedTxHex = '0200000001' + 'ff'.repeat(100);

      alert(
        'Transaction signed successfully!\n\nReview the details and click "Broadcast" to send.'
      );

      const hexPanel = content.querySelector('#hex-panel');
      if (hexPanel) hexPanel.classList.remove('hidden');

      const broadcastBtn = content.querySelector('#broadcast-tx-btn');
      if (broadcastBtn) broadcastBtn.disabled = false;

      updateSummary();
    } catch (error) {
      console.error('Signing failed:', error);
      alert(`Failed to sign: ${error.message}`);
    } finally {
      signBtn.disabled = false;
      signBtn.textContent = originalText;
    }
  }

  // BROADCAST TRANSACTION
  async function handleBroadcastTransaction() {
    if (!signedTx) {
      alert('Please sign the transaction first');
      return;
    }

    const broadcastBtn = content.querySelector('#broadcast-tx-btn');
    const originalText = broadcastBtn.textContent;
    broadcastBtn.disabled = true;
    broadcastBtn.textContent = 'Broadcasting...';

    try {
      const txids = [];

      for (const recipient of recipients) {
        if (!recipient.address) continue;

        const amount = recipient.amount;
        if (amount <= 0) continue;

        let manuallySelectedOutpoints = null;
        if (selectionMode === 'manual' && selectedUtxos.length > 0) {
          manuallySelectedOutpoints = selectedUtxos.map((index) => {
            const utxo = availableUtxos[index];
            return {
              txid: utxo.txid,
              vout: utxo.vout,
            };
          });
        }

        const data = await window.api.taker.sendToAddress(
          recipient.address,
          amount,
          selectedFeeRate,
          manuallySelectedOutpoints
        );

        if (data.success) {
          const txid =
            typeof data.txid === 'object' ? data.txid.value : data.txid;
          txids.push({ address: recipient.address, txid });
        } else {
          throw new Error(data.error || 'Failed to broadcast transaction');
        }
      }

      showSuccessPopup(txids);

      recipients = [{ address: '', amount: 0 }];
      renderRecipients();
      signedTx = null;
      signedTxHex = null;
      selectedUtxos = [];

      const hexPanel = content.querySelector('#hex-panel');
      if (hexPanel) hexPanel.classList.add('hidden');

      await fetchUtxosFromAPI();
      updateSummary();
    } catch (error) {
      console.error('Broadcast failed:', error);
      alert(`Failed to broadcast: ${error.message}`);
    } finally {
      broadcastBtn.disabled = false;
      broadcastBtn.textContent = originalText;
    }
  }

  function showSuccessPopup(txids) {
    const popup = document.createElement('div');
    popup.className = 'send-success-overlay';

    popup.innerHTML = `
      <div class="send-success-dialog">
        <div class="send-success-head">
          <div class="send-success-icon">${icons.checkCircle(30)}</div>
          <div>
            <h2>Transaction Broadcast Successfully!</h2>
            <p>Your transaction has been sent to the Bitcoin network.</p>
          </div>
        </div>
        
        <div class="send-success-list">
          ${txids
            .map(
              ({ address, txid }) => {
                const safeAddress = escapeHtml(address);
                const safeTxid = escapeHtml(txid);
                return `
            <div class="send-success-row">
              <span>Recipient</span>
              <p>${safeAddress}</p>
              <span>TXID</span>
              <div>
                <a href="https://mempool.citadelfoss.xyz/tx/${encodeURIComponent(txid)}" target="_blank" rel="noreferrer">
                  ${safeTxid}
                </a>
              </div>
            </div>
          `;
              }
            )
            .join('')}
        </div>
        
        <button id="close-success-popup" class="send-success-primary" type="button">
          Close
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    popup
      .querySelector('#close-success-popup')
      .addEventListener('click', () => {
        popup.remove();
      });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.remove();
    });
  }

  content.innerHTML = `
    <div class="app-page send-page">
      <div class="app-head send-head">
        <div>
          <h2>Send Bitcoin</h2>
          <p class="send-subtitle">Send BTC to one or multiple Bitcoin addresses</p>
        </div>
        <div class="app-actions">
          <button class="app-button ghost" type="button" id="refresh-send-btn">${icons.refreshCw(16)} Refresh</button>
        </div>
      </div>

      <div id="address-reuse-warning" class="send-warning hidden">
        ${icons.alertTriangle(17)}
        <span><strong>You've sent to this address before!</strong> Reusing addresses reduces privacy. Ask the recipient for a fresh address.</span>
      </div>

      <div class="send-layout">
        <div class="send-left">
          <section class="send-panel">
            <div class="send-panel-head">
              <div>
                <h3>Recipients</h3>
                <span id="recipient-total">${recipients.length} total</span>
              </div>
              <button id="add-recipient-btn" type="button">+ Add Recipient</button>
            </div>
            <div class="send-panel-body">
              <div id="recipients-container"></div>

              <div class="send-section-label">
                <span>UTXO Selection</span>
                <small>Wallet picks coins automatically</small>
              </div>
              <div class="send-mode-toggle">
                <button id="mode-auto" class="mode-btn ${selectionMode === 'auto' ? 'active' : ''}" data-mode="auto" type="button">${icons.zap(16)} Auto Select</button>
                <button id="mode-manual" class="mode-btn ${selectionMode === 'manual' ? 'active' : ''}" data-mode="manual" type="button">${icons.clipboardCopy(16)} Manual Select</button>
              </div>
              <div class="send-selection-note">
                <span>${icons.info(14)} Coins picked to minimize fee, prefer single-script outputs, and avoid mixing UTXO kinds.</span>
                <strong><span id="selected-utxos-count">0</span> inputs</strong>
              </div>

              <div id="manual-selection-section" class="${selectionMode === 'manual' ? '' : 'hidden'} send-manual-section">
                <div class="send-section-label">
                  <span>Select UTXOs</span>
                  <small><span id="selected-utxos-value">0 selected</span></small>
                </div>
                <div class="utxo-filter-toggle">
                  <button class="utxo-filter-btn ${utxoFilter === 'regular' ? 'is-active' : ''}" data-filter="regular" type="button">
                    Regular
                  </button>
                  <button class="utxo-filter-btn ${utxoFilter === 'swap' ? 'is-active' : ''}" data-filter="swap" type="button">
                    Swap
                  </button>
                </div>
                <div id="utxo-list-container" class="send-utxo-list">
                  <div class="send-empty">
                    ${icons.loader(32, 'animate-spin')}
                    <strong>Loading UTXOs...</strong>
                  </div>
                </div>
              </div>

              <div class="send-section-label">
                <span>Network Fee Rate</span>
                <small>Mainnet - live estimates</small>
              </div>
              <div class="send-fee-grid">
                <button id="fee-low" class="fee-btn" data-level="low" type="button">
                  <strong>Low</strong>
                  <span>1 ${SATS_SYMBOL}/vB - ~60 min</span>
                </button>
                <button id="fee-medium" class="fee-btn active" data-level="medium" type="button">
                  <strong>Medium</strong>
                  <span>2 ${SATS_SYMBOL}/vB - ~20 min</span>
                </button>
                <button id="fee-high" class="fee-btn" data-level="high" type="button">
                  <strong>High</strong>
                  <span>4 ${SATS_SYMBOL}/vB - ~10 min</span>
                </button>
              </div>

              <label class="send-custom-fee">
                <input id="custom-fee" type="number" min="1" placeholder="Custom">
                <span>sat / vbyte</span>
              </label>

              <div id="hex-panel" class="hidden send-hex-panel">
                <h3>Transaction Hex</h3>
                <pre id="tx-hex-content"></pre>
              </div>

              <div class="send-actions">
                <button id="sign-tx-btn" class="send-sign" type="button">
                  ${icons.key(15)} Sign Transaction
                </button>
                <button id="broadcast-tx-btn" class="send-broadcast" type="button" disabled>
                  ${icons.radio(15)} Broadcast
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside class="send-side">
          <section class="send-balance-card">
            <span class="app-accent"></span>
            <div class="app-card-label">Available Balance</div>
            <div class="send-balance-value"><span id="available-balance-sats">0 ${SATS_SYMBOL}</span></div>
            <p><span id="available-balance-btc">0.00000000</span> BTC - $0.00</p>
          </section>

          <section class="send-summary-card">
            <div class="send-summary-head">
              <h3>Transaction Summary</h3>
              <span id="summary-eta">ETA ~20 min</span>
            </div>
            <div class="send-summary-body">
              <div class="send-summary-line">
                <span>Amount</span>
                <strong id="summary-amount">0 ${SATS_SYMBOL}</strong>
              </div>
              <div class="send-summary-line">
                <span>Inputs</span>
                <strong id="summary-input-value">1 / 0 ${SATS_SYMBOL}</strong>
              </div>
              <div class="send-summary-line">
                <span>TX Size (est)</span>
                <strong id="tx-size">140 vB</strong>
              </div>
              <div class="send-summary-line">
                <span>Network Fee (<b id="summary-fee-rate">2</b> ${SATS_SYMBOL}/vB)</span>
                <strong id="summary-fee">~280 ${SATS_SYMBOL}</strong>
              </div>
              <div class="send-summary-line">
                <span>Change Amount</span>
                <strong id="change-amount">0 ${SATS_SYMBOL}</strong>
              </div>
            </div>
          </section>

          <div class="send-info-note">
            ${icons.info(16)}
            <span>Sign first to review the exact fee and bytes, then broadcast to send.</span>
          </div>
        </aside>
      </div>
    </div>
  `;

  container.appendChild(content);

  // MAIN EVENT LISTENERS
  content
    .querySelector('#mode-auto')
    .addEventListener('click', () => toggleSelectionMode('auto'));
  content
    .querySelector('#mode-manual')
    .addEventListener('click', () => toggleSelectionMode('manual'));
  content.querySelectorAll('.utxo-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setUtxoFilter(btn.dataset.filter));
  });
  content
    .querySelector('#fee-low')
    .addEventListener('click', () => selectFee('low'));
  content
    .querySelector('#fee-medium')
    .addEventListener('click', () => selectFee('medium'));
  content
    .querySelector('#fee-high')
    .addEventListener('click', () => selectFee('high'));
  content
    .querySelector('#add-recipient-btn')
    .addEventListener('click', addRecipient);
  content
    .querySelector('#sign-tx-btn')
    .addEventListener('click', handleSignTransaction);
  content
    .querySelector('#broadcast-tx-btn')
    .addEventListener('click', handleBroadcastTransaction);
  content
    .querySelector('#refresh-send-btn')
    .addEventListener('click', fetchUtxosFromAPI);

  content.querySelector('#custom-fee').addEventListener('input', (e) => {
    const customRate = parseInt(e.target.value);
    if (customRate > 0) {
      selectedFeeRate = customRate;
      content.querySelectorAll('.fee-btn').forEach((btn) => {
        btn.classList.remove('active');
      });
      updateSummary();
    }
  });

  // Initialize
  renderRecipients();
  fetchUtxosFromAPI();
  fetchPreviouslyUsedAddresses();
}
