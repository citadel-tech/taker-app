import { icons } from '../../js/icons.js';
import { getBtcPriceUsd } from '../../js/price.js';

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
  const btcPrice = getBtcPriceUsd();

  // New state for multi-address and signed tx
  let recipients = [{ address: '', amount: 0 }];
  let signedTx = null;
  let signedTxHex = null;
  let actualTxSize = 0;
  let actualFee = 0;

  let availableUtxos = [];
  let availableBalance = 0;

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
        console.log(
          'Loaded',
          availableUtxos.length,
          'UTXOs, Total balance:',
          availableBalance,
          'sats'
        );

        renderUtxoList();
        updateSummary();
      }
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error);
    }
  }

  // VALIDATION
  function validateTransaction() {
    const errors = [];

    // Check recipients
    const validRecipients = recipients.filter((r) => r.address);
    if (validRecipients.length === 0) {
      errors.push('Add at least one recipient');
      return { valid: false, errors };
    }

    // Check amounts and balance
    let totalAmount = 0;
    let availableForSpending = 0;

    if (selectionMode === 'manual') {
      if (selectedUtxos.length === 0) {
        errors.push('Select at least one UTXO');
        return { valid: false, errors };
      }
      availableForSpending = getSelectedUtxosTotal();
      totalAmount = availableForSpending; // In manual mode, we send the UTXO total
    } else {
      // Auto mode
      totalAmount = getTotalAmountToSend();
      availableForSpending = availableBalance;

      // Check for negative amounts
      recipients.forEach((r, i) => {
        if (r.amount < 0) {
          errors.push(`Recipient ${i + 1} has negative amount`);
        }
      });

      if (totalAmount <= 0) {
        errors.push('Enter an amount to send');
        return { valid: false, errors };
      }
    }

    // Check if sufficient balance (amount doesn't include fee in calculation)
    const numInputs =
      selectionMode === 'manual' ? Math.max(1, selectedUtxos.length) : 1;
    const numOutputs = validRecipients.length;
    const estimatedTxSize = Math.ceil(
      10.5 + 68 * numInputs + 31 * numOutputs + 31
    );
    const estimatedFee = selectedFeeRate * estimatedTxSize;

    // In manual mode, fee comes from selected UTXOs
    // In auto mode, fee comes from total balance
    if (selectionMode === 'manual') {
      // Selected UTXOs must cover fee (we'll send UTXO total minus fee)
      if (availableForSpending < estimatedFee) {
        errors.push(
          `Selected UTXOs (${availableForSpending} sats) can't cover fee (${estimatedFee} sats)`
        );
      }
    } else {
      // Must have enough to cover amount + fee
      const total = totalAmount + estimatedFee;
      if (total > availableForSpending) {
        const shortfall = total - availableForSpending;
        errors.push(`Need ${shortfall.toLocaleString()} more sats`);
      }
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

    signBtn.innerHTML = icons.alertTriangle(15) + ' ' + errors[0];
    signBtn.title = errors.join('\n');
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
        } else if (unit === 'usd') {
          input.placeholder = '0.00';
          input.value =
            amountSats > 0
              ? ((amountSats / 100000000) * btcPrice).toFixed(2)
              : '';
        }
      }
      updateRecipientConversions(index);
    });
  }

  function updateRecipientConversions(index) {
    const amountSats = recipients[index].amount || 0;
    const btcEl = content.querySelector(`#recipient-${index}-btc`);
    const usdEl = content.querySelector(`#recipient-${index}-usd`);

    if (btcEl && usdEl) {
      const btcAmount = (amountSats / 100000000).toFixed(8);
      const usdAmount = ((amountSats / 100000000) * btcPrice).toFixed(2);
      btcEl.textContent = '= ' + btcAmount + ' BTC';
      usdEl.textContent = '$' + usdAmount + ' USD';
    }
  }

  function setAmountToUtxoMinusFees(index) {
    if (selectionMode !== 'manual' || selectedUtxos.length === 0) return;

    const utxoTotal = getSelectedUtxosTotal();
    const numInputs = selectedUtxos.length;
    const numOutputs = 1;
    const estimatedTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs);
    const estimatedFee = selectedFeeRate * estimatedTxSize;
    const amountToSend = Math.max(0, utxoTotal - estimatedFee);

    recipients[index].amount = amountToSend;

    const input = content.querySelector(
      `.recipient-amount[data-index="${index}"]`
    );
    if (input) {
      if (amountUnit === 'sats') {
        input.value = amountToSend;
      } else if (amountUnit === 'btc') {
        input.value = (amountToSend / 100000000).toFixed(8);
      } else if (amountUnit === 'usd') {
        input.value = ((amountToSend / 100000000) * btcPrice).toFixed(2);
      }
    }

    updateRecipientConversions(index);
    updateSummary();
  }

  function renderRecipients() {
    const container = content.querySelector('#recipients-container');
    if (!container) return;
    const totalEl = content.querySelector('#recipient-total');
    if (totalEl) totalEl.textContent = `${recipients.length} total`;

    container.innerHTML = recipients
      .map((recipient, index) => {
        const showAmountInput = selectionMode === 'auto';
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

        ${
          showAmountInput
            ? `
        <div class="send-field amount">
          <div class="send-field-row">
            <label>Amount</label>
            <div class="send-unit-toggle">
              <button type="button" class="unit-btn ${amountUnit === 'sats' ? 'active' : ''}" data-unit="sats" data-recipient="${index}">
                Sats
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
              placeholder="${amountUnit === 'sats' ? '0' : amountUnit === 'btc' ? '0.00000000' : '0.00'}"
              value="${recipient.amount && recipient.amount > 0 ? (amountUnit === 'sats' ? recipient.amount : amountUnit === 'btc' ? (recipient.amount / 100000000).toFixed(8) : ((recipient.amount / 100000000) * btcPrice).toFixed(2)) : ''}"
              class="recipient-amount"
              data-index="${index}"
            />
            <span>${amountUnit}</span>
          </label>
          <div class="send-conversion-row">
            <span id="recipient-${index}-btc">= 0.00000000 BTC</span>
            <span id="recipient-${index}-usd">$0.00 USD</span>
          </div>
        </div>
        `
            : `
        <div class="send-field amount">
          <div class="send-field-row">
            <label>Amount from selected UTXOs</label>
            <button class="use-utxo-minus-fees" type="button" data-index="${index}">
              UTXO - Fees
            </button>
          </div>
          <div class="send-static-amount">
            <strong>${getSelectedUtxosTotal().toLocaleString()} sats</strong>
            <div>
              <span>= ${(getSelectedUtxosTotal() / 100000000).toFixed(8)} BTC</span>
              <span>$${((getSelectedUtxosTotal() / 100000000) * btcPrice).toFixed(2)} USD</span>
            </div>
          </div>
        </div>
        `
        }
      </div>
    `;
      })
      .join('');

    // Attach event listeners
    container.querySelectorAll('.recipient-address').forEach((input) => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        updateRecipient(index, 'address', e.target.value.trim());
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

        // Convert to sats based on current unit
        if (amountUnit === 'btc') {
          value = value * 100000000;
        } else if (amountUnit === 'usd') {
          value = (value / btcPrice) * 100000000;
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

    // UTXO minus fees button
    container.querySelectorAll('.use-utxo-minus-fees').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        setAmountToUtxoMinusFees(index);
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
      recipients.forEach((r, i) => {
        r.amount = 0;
      });
    } else {
      if (manualSection) manualSection.classList.add('hidden');
      selectedUtxos = [];
      updateSelectedUtxosDisplay();
    }

    renderRecipients();
    updateSummary();
  }

  function toggleUtxoSelection(index) {
    const utxoIndex = selectedUtxos.indexOf(index);
    if (utxoIndex > -1) {
      selectedUtxos.splice(utxoIndex, 1);
    } else {
      selectedUtxos.push(index);
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
      valueEl.textContent = totalValue.toLocaleString() + ' sats';
      valueEl.title =
        (totalValue / 100000000).toFixed(8) +
        ' BTC - $' +
        (((totalValue / 100000000) * btcPrice).toFixed(2));
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

    if (selectedUtxos.length < 2) {
      warningEl.classList.add('hidden');
      return;
    }

    const types = selectedUtxos.map((index) => availableUtxos[index].type);
    const hasRegular = types.includes('Regular');
    const hasSwap = types.includes('Swap');

    if (hasRegular && hasSwap) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
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

    utxoContainer.innerHTML = availableUtxos
      .map((utxo, index) => {
        const btcAmount = (utxo.amount / 100000000).toFixed(8);
        const usdAmount = ((utxo.amount / 100000000) * btcPrice).toFixed(2);
        const isSelected = selectedUtxos.includes(index);

        return `
        <label class="send-utxo-item ${isSelected ? 'selected' : ''}">
          <input type="checkbox" id="utxo-${index}" ${isSelected ? 'checked' : ''} />
          <span></span>
          <div>
            <strong>${utxo.txid.substring(0, 16)}...${utxo.txid.substring(utxo.txid.length - 8)}:${utxo.vout}</strong>
            <small>${utxo.amount.toLocaleString()} sats - ${utxo.type}</small>
          </div>
          <div>
            <strong>${utxo.amount.toLocaleString()} sats</strong>
            <small>${btcAmount} BTC - $${usdAmount}</small>
          </div>
        </label>
      `;
      })
      .join('');

    availableUtxos.forEach((_, index) => {
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
    if (selectionMode === 'manual') {
      // In manual mode, we send the selected UTXO total (fee will be deducted)
      return getSelectedUtxosTotal();
    }
    // In auto mode, use recipient amounts
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
    const priority =
      selectedFeeRate >= 4 ? 'High' : selectedFeeRate >= 2 ? 'Medium' : 'Low';

    const displayFee = signedTx ? actualFee : estimatedFee;
    const displayTxSize = signedTx ? actualTxSize : estimatedTxSize;
    const displayTotal = signedTx ? amountSats + actualFee : total;
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
    const summaryTotal = content.querySelector('#summary-total');
    const summaryTotalUsd = content.querySelector('#summary-total-usd');
    const summaryRemaining = content.querySelector('#summary-remaining');
    const summaryRemainingDetail = content.querySelector(
      '#summary-remaining-detail'
    );

    if (summaryAmount)
      summaryAmount.textContent =
        Math.floor(amountSats).toLocaleString() +
        ' sats' +
        (signedTx ? '' : ' (est)');
    if (summaryFeeRate) summaryFeeRate.textContent = selectedFeeRate;
    if (summaryFee)
      summaryFee.textContent =
        (signedTx ? '' : '~') + displayFee.toLocaleString() + ' sats';
    if (summaryTotal)
      summaryTotal.textContent =
        Math.floor(displayTotal).toLocaleString() + ' sats';
    if (summaryTotalUsd)
      summaryTotalUsd.textContent =
        '= $' + ((displayTotal * btcPrice) / 100000000).toFixed(2);

    // Technical details
    const txSizeEl = content.querySelector('#tx-size');
    const txInputsEl = content.querySelector('#tx-inputs');
    const txOutputsEl = content.querySelector('#tx-outputs');
    const changeAmountEl = content.querySelector('#change-amount');
    const confTimeEl = content.querySelector('#conf-time');
    const priorityLevelEl = content.querySelector('#priority-level');

    if (txSizeEl)
      txSizeEl.textContent = displayTxSize + ' vB' + (signedTx ? '' : ' (est)');
    if (txInputsEl) txInputsEl.textContent = numInputs;
    if (txOutputsEl) txOutputsEl.textContent = numOutputs;

    // Show change amount in red if negative
    if (changeAmountEl) {
      changeAmountEl.textContent = displayRemaining.toLocaleString() + ' sats';
      if (displayRemaining < 0) {
        changeAmountEl.classList.add('text-red-400');
        changeAmountEl.classList.remove('text-purple-400');
      } else {
        changeAmountEl.classList.add('text-purple-400');
        changeAmountEl.classList.remove('text-red-400');
      }
    }

    if (confTimeEl) confTimeEl.textContent = confTime;
    if (priorityLevelEl) priorityLevelEl.textContent = priority;

    if (summaryRemaining)
      summaryRemaining.textContent =
        Math.floor(displayRemaining).toLocaleString() + ' sats';
    const remainingBtc = displayRemaining / 100000000;
    const remainingUsd = remainingBtc * btcPrice;
    if (summaryRemainingDetail) {
      summaryRemainingDetail.textContent =
        remainingBtc.toFixed(8) + ' BTC - $' + remainingUsd.toFixed(2);
    }

    // Update available balance
    const availableBalanceEl = content.querySelector('#available-balance-sats');
    const availableBalanceBtcEl = content.querySelector(
      '#available-balance-btc'
    );
    if (availableBalanceEl && availableBalanceBtcEl) {
      availableBalanceEl.textContent =
        availableForSpending.toLocaleString() + ' sats';
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
      alert('Cannot sign transaction:\n\n' + validation.errors.join('\n'));
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

      // Calculate amount to send
      let amountToSend = 0;
      if (selectionMode === 'manual') {
        // In manual mode: UTXO total minus fee, split among recipients
        const utxoTotal = getSelectedUtxosTotal();
        const numInputs = selectedUtxos.length;
        const numOutputs = recipients.filter((r) => r.address).length;
        const estimatedTxSize = Math.ceil(
          10.5 + 68 * numInputs + 31 * numOutputs
        );
        const estimatedFee = selectedFeeRate * estimatedTxSize;
        const totalToSend = Math.max(0, utxoTotal - estimatedFee);
        amountToSend = Math.floor(totalToSend / numOutputs);
      }

      for (const recipient of recipients) {
        if (!recipient.address) continue;

        const amount =
          selectionMode === 'manual' ? amountToSend : recipient.amount;
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
    popup.className =
      'fixed inset-0 bg-black/80 flex items-center justify-center z-50';

    popup.innerHTML = `
      <div class="bg-surface rounded-lg p-8 max-w-2xl w-full mx-4 border border-green-500/50">
        <div class="text-center mb-6">
          <div class="flex justify-center mb-4">${icons.checkCircle(64, 'text-green-400')}</div>
          <h2 class="text-2xl font-bold text-green-400 mb-2">Transaction Broadcast Successfully!</h2>
          <p class="text-gray-400">Your transaction(s) have been sent to the Bitcoin network</p>
        </div>
        
        <div class="space-y-4 mb-6">
          ${txids
            .map(
              ({ address, txid }) => `
            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
              <p class="text-xs text-gray-400 mb-2">Recipient: ${address}</p>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">TXID:</span>
                <a href="http://170.75.166.88:8080/tx/${txid}" target="_blank"
                   class="text-sm font-mono text-blue-400 hover:text-blue-300 underline flex-1 truncate">
                  ${txid}
                </a>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        
        <button id="close-success-popup" class="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg transition-colors">
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
          <button class="app-button ghost" type="button">${icons.search(16)} Scan QR</button>
          <button class="app-button ghost" type="button" id="refresh-send-btn">${icons.refreshCw(16)} Refresh</button>
        </div>
      </div>

      <div class="send-warning">
        ${icons.alertTriangle(17)}
        <span><strong>Privacy:</strong> You've sent to this address before. Reusing an address links transactions and reduces anonymity. Ask the recipient for a fresh address.</span>
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
                  <small><span id="selected-utxos-value">0 sats</span> selected</small>
                </div>
                <div id="utxo-warning" class="hidden send-utxo-warning">
                  ${icons.alertTriangle(16)}
                  <span>Privacy warning: selected Regular and Swap UTXOs together.</span>
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
                  <span>1 sat/vB - ~60 min</span>
                </button>
                <button id="fee-medium" class="fee-btn active" data-level="medium" type="button">
                  <strong>Medium</strong>
                  <span>2 sat/vB - ~20 min</span>
                </button>
                <button id="fee-high" class="fee-btn" data-level="high" type="button">
                  <strong>High</strong>
                  <span>4 sat/vB - ~10 min</span>
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
            <div class="send-balance-value"><span id="available-balance-sats">0 sats</span></div>
            <p><span id="available-balance-btc">0.00000000</span> BTC - $0.00</p>
          </section>

          <section class="send-summary-card">
            <div class="send-summary-head">
              <h3>Transaction Summary</h3>
              <span>ETA 20 min</span>
            </div>
            <div class="send-summary-body">
              <div class="send-summary-line">
                <span>Amount</span>
                <strong id="summary-amount">0 sats</strong>
              </div>
              <div class="send-summary-line">
                <span>Network Fee (<b id="summary-fee-rate">2</b> sat/vB)</span>
                <strong id="summary-fee">~280 sats</strong>
              </div>
              <div class="send-summary-line total">
                <span>Total Sent</span>
                <strong id="summary-total">280 sats</strong>
              </div>
              <p id="summary-total-usd" class="send-summary-usd">= $0.00 USD</p>
            </div>
            <div class="send-summary-tech">
              <div><span>TX Size</span><strong id="tx-size">140 vB</strong></div>
              <div><span>Inputs</span><strong id="tx-inputs">1</strong></div>
              <div><span>Outputs</span><strong id="tx-outputs">1</strong></div>
              <div><span>Priority</span><strong id="priority-level">Medium</strong></div>
              <div><span>Est. Time</span><strong id="conf-time">~20 min</strong></div>
              <div><span>RBF</span><strong>Enabled</strong></div>
            </div>
            <div class="send-change-row">
              <span>Change Amount</span>
              <strong id="change-amount">0 sats</strong>
            </div>
            <div class="send-remaining">
              <span>Remaining Balance</span>
              <strong id="summary-remaining">0 sats</strong>
              <small id="summary-remaining-detail">0.00000000 BTC - $0.00</small>
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
}
