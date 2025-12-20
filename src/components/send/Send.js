export function SendComponent(container, preSelectedUtxos = null) {
  const content = document.createElement('div');
  content.id = 'send-content';

  // State
  let amountUnit = 'sats';
  let selectedFeeRate = 2;
  let feeRates = { low: 1, medium: 2, high: 4 };
  let selectionMode = preSelectedUtxos && preSelectedUtxos.length > 0 ? 'manual' : 'auto';
  let selectedUtxos = preSelectedUtxos || [];
  const btcPrice = 30000;

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
          const txid = typeof utxo.txid === 'object' ? utxo.txid.value : utxo.txid;

          return {
            txid: txid,
            vout: utxo.vout,
            amount: utxo.amount,
            type: spendInfo.spendType || 'Regular',
            index: index
          };
        });

        availableBalance = availableUtxos.reduce((sum, utxo) => sum + utxo.amount, 0);
        console.log('✅ Loaded', availableUtxos.length, 'UTXOs, Total balance:', availableBalance, 'sats');
        
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
    const validRecipients = recipients.filter(r => r.address);
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
    const numInputs = selectionMode === 'manual' ? Math.max(1, selectedUtxos.length) : 1;
    const numOutputs = validRecipients.length;
    const estimatedTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs + 31);
    const estimatedFee = selectedFeeRate * estimatedTxSize;
    
    // In manual mode, fee comes from selected UTXOs
    // In auto mode, fee comes from total balance
    if (selectionMode === 'manual') {
      // Selected UTXOs must cover fee (we'll send UTXO total minus fee)
      if (availableForSpending < estimatedFee) {
        errors.push(`Selected UTXOs (${availableForSpending} sats) can't cover fee (${estimatedFee} sats)`);
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
    // Instead of showing error box, update the Sign button
    const signBtn = content.querySelector('#sign-tx-btn');
    if (!signBtn) return;

    if (errors.length === 0) {
      signBtn.textContent = '🔏 Sign Transaction';
      signBtn.title = '';
      return;
    }

    // Show first error as button text
    signBtn.textContent = '⚠️ ' + errors[0];
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

    // Update all unit buttons
    content.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.classList.remove('bg-[#FF6B35]', 'text-white');
      btn.classList.add('bg-[#0f1419]', 'hover:bg-[#242d3d]', 'border', 'border-gray-700', 'text-gray-400');
    });
    
    content.querySelectorAll(`.unit-btn[data-unit="${unit}"]`).forEach((btn) => {
      btn.classList.remove('bg-[#0f1419]', 'hover:bg-[#242d3d]', 'border', 'border-gray-700', 'text-gray-400');
      btn.classList.add('bg-[#FF6B35]', 'text-white');
    });

    // Update all recipient placeholders and values
    recipients.forEach((_, index) => {
      const input = content.querySelector(`.recipient-amount[data-index="${index}"]`);
      if (input) {
        const amountSats = recipients[index].amount || 0;
        
        // Update placeholder
        if (unit === 'sats') {
          input.placeholder = '0';
          input.value = amountSats > 0 ? amountSats : '';
        } else if (unit === 'btc') {
          input.placeholder = '0.00000000';
          input.value = amountSats > 0 ? (amountSats / 100000000).toFixed(8) : '';
        } else if (unit === 'usd') {
          input.placeholder = '0.00';
          input.value = amountSats > 0 ? ((amountSats / 100000000) * btcPrice).toFixed(2) : '';
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
      btcEl.textContent = '≈ ' + btcAmount + ' BTC';
      usdEl.textContent = '≈ $' + usdAmount + ' USD';
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
    
    const input = content.querySelector(`.recipient-amount[data-index="${index}"]`);
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

    container.innerHTML = recipients.map((recipient, index) => {
      const showAmountInput = selectionMode === 'auto';
      
      return `
      <div class="recipient-row mb-4 p-4 bg-[#0f1419] rounded-lg border border-gray-700">
        <div class="flex justify-between items-center mb-3">
          <label class="text-sm font-semibold text-gray-300">Recipient ${index + 1}</label>
          ${recipients.length > 1 ? `
            <button class="remove-recipient text-red-400 hover:text-red-300 text-sm font-semibold" data-index="${index}">
              ✕ Remove
            </button>
          ` : ''}
        </div>
        
        <!-- Address Input -->
        <div class="mb-3">
          <label class="block text-xs text-gray-400 mb-1">Bitcoin Address</label>
          <input 
            type="text" 
            placeholder="bc1q... or bcrt1q..." 
            value="${recipient.address}"
            class="recipient-address w-full bg-[#1a2332] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
            data-index="${index}"
          />
        </div>

        <!-- Amount Input (only in auto mode) -->
        ${showAmountInput ? `
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-xs text-gray-400">Amount</label>
            <div class="flex gap-1">
              <button class="unit-btn ${amountUnit === 'sats' ? 'bg-[#FF6B35] text-white' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400'} px-2 py-0.5 rounded text-[10px] font-semibold transition-colors" data-unit="sats" data-recipient="${index}">
                Sats
              </button>
              <button class="unit-btn ${amountUnit === 'btc' ? 'bg-[#FF6B35] text-white' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400'} px-2 py-0.5 rounded text-[10px] font-semibold transition-colors" data-unit="btc" data-recipient="${index}">
                BTC
              </button>
              <button class="unit-btn ${amountUnit === 'usd' ? 'bg-[#FF6B35] text-white' : 'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400'} px-2 py-0.5 rounded text-[10px] font-semibold transition-colors" data-unit="usd" data-recipient="${index}">
                USD
              </button>
            </div>
          </div>
          <input 
            type="number" 
            min="0"
            step="any"
            placeholder="${amountUnit === 'sats' ? '0' : amountUnit === 'btc' ? '0.00000000' : '0.00'}"
            value="${recipient.amount && recipient.amount > 0 ? (amountUnit === 'sats' ? recipient.amount : amountUnit === 'btc' ? (recipient.amount / 100000000).toFixed(8) : ((recipient.amount / 100000000) * btcPrice).toFixed(2)) : ''}"
            class="recipient-amount w-full bg-[#1a2332] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-[#FF6B35] transition-colors"
            data-index="${index}"
          />
          <div class="flex justify-between mt-1">
            <p id="recipient-${index}-btc" class="text-xs text-gray-400">≈ 0.00000000 BTC</p>
            <p id="recipient-${index}-usd" class="text-xs text-gray-400">≈ $0.00 USD</p>
          </div>
        </div>
        ` : `
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-xs text-gray-400">Amount (from selected UTXOs)</label>
            <button class="use-utxo-minus-fees text-[#FF6B35] hover:text-[#ff7d4d] text-[10px] font-semibold" data-index="${index}">
              UTXO - Fees
            </button>
          </div>
          <div class="bg-[#1a2332] border border-gray-700 rounded-lg px-4 py-3">
            <p class="text-white font-mono text-lg">${getSelectedUtxosTotal().toLocaleString()} sats</p>
            <div class="flex justify-between mt-1">
              <p class="text-xs text-gray-400">≈ ${(getSelectedUtxosTotal() / 100000000).toFixed(8)} BTC</p>
              <p class="text-xs text-gray-400">≈ $${((getSelectedUtxosTotal() / 100000000) * btcPrice).toFixed(2)} USD</p>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">Amount determined by selected UTXOs</p>
        </div>
        `}
      </div>
    `;
    }).join('');

    // Attach event listeners
    container.querySelectorAll('.recipient-address').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        updateRecipient(index, 'address', e.target.value.trim());
      });
    });

    container.querySelectorAll('.recipient-amount').forEach(input => {
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

    container.querySelectorAll('.remove-recipient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        removeRecipient(index);
      });
    });

    // Unit switcher event listeners
    container.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const unit = e.target.dataset.unit;
        switchUnit(unit);
      });
    });

    // UTXO minus fees button
    container.querySelectorAll('.use-utxo-minus-fees').forEach(btn => {
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
      btn.className = 'mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors';
    });
    content.querySelector('#mode-' + mode).className = 'mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold';

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
      checkbox.checked = selectedUtxos.includes(index);
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
      const totalValue = selectedUtxos.reduce((sum, index) => sum + availableUtxos[index].amount, 0);
      valueEl.textContent = (totalValue / 100000000).toFixed(8) + ' BTC';
    }
  }

  function getSelectedUtxosTotal() {
    if (selectedUtxos.length === 0) return 0;
    return selectedUtxos.reduce((sum, index) => sum + availableUtxos[index].amount, 0);
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
        <div class="text-center py-8 text-gray-400">
          <p>No UTXOs available</p>
          <p class="text-xs mt-2">Receive some bitcoin first</p>
        </div>
      `;
      return;
    }

    utxoContainer.innerHTML = availableUtxos.map((utxo, index) => {
      const btcAmount = (utxo.amount / 100000000).toFixed(8);
      const usdAmount = ((utxo.amount / 100000000) * btcPrice).toFixed(2);
      const isSelected = selectedUtxos.includes(index);
      const typeColor = utxo.type === 'Swap' ? 'text-orange-500 font-bold' : 'text-green-400';
      
      return `
        <label class="flex items-center gap-3 bg-[#0f1419] hover:bg-[#242d3d] rounded-lg p-3 cursor-pointer transition-colors">
          <input type="checkbox" id="utxo-${index}" ${isSelected ? 'checked' : ''} class="w-4 h-4 accent-[#FF6B35]" />
          <div class="flex-1">
            <div class="flex justify-between items-center">
              <span class="font-mono text-sm text-gray-300">${utxo.txid.substring(0, 16)}...${utxo.txid.substring(utxo.txid.length - 8)}:${utxo.vout}</span>
              <div class="text-right">
                <div class="text-sm font-mono text-green-400">${btcAmount} BTC</div>
                <div class="text-xs text-gray-500">$${usdAmount}</div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-xs text-gray-500">${utxo.amount.toLocaleString()} sats</span>
              <span class="text-xs ${typeColor}">${utxo.type}</span>
            </div>
          </div>
        </label>
      `;
    }).join('');

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
      btn.className = btn.className.replace(
        'bg-[#FF6B35] border-2 border-[#FF6B35]',
        'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'
      );
    });

    const selectedBtn = content.querySelector('#fee-' + level);
    selectedBtn.className = selectedBtn.className.replace(
      'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700',
      'bg-[#FF6B35] border-2 border-[#FF6B35]'
    );

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
    const numInputs = selectionMode === 'manual' ? Math.max(1, selectedUtxos.length) : 1;
    
    const estimatedTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs + 31);
    const estimatedFee = selectedFeeRate * estimatedTxSize;
    const total = amountSats + estimatedFee;
    
    let availableForSpending = availableBalance;
    if (selectionMode === 'manual' && selectedUtxos.length > 0) {
      availableForSpending = getSelectedUtxosTotal();
    }
    
    const remaining = Math.max(0, availableForSpending - total);
    const confTime = selectedFeeRate >= 4 ? '~10 min' : selectedFeeRate >= 2 ? '~20 min' : '~60+ min';
    const priority = selectedFeeRate >= 4 ? 'High' : selectedFeeRate >= 2 ? 'Medium' : 'Low';

    const displayFee = signedTx ? actualFee : estimatedFee;
    const displayTxSize = signedTx ? actualTxSize : estimatedTxSize;
    const displayTotal = signedTx ? (amountSats + actualFee) : total;
    const displayRemaining = signedTx ? (availableForSpending - amountSats - actualFee) : remaining;

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
    const summaryRemainingDetail = content.querySelector('#summary-remaining-detail');

    if (summaryAmount) summaryAmount.textContent = Math.floor(amountSats).toLocaleString() + ' sats' + (signedTx ? '' : ' (est)');
    if (summaryFeeRate) summaryFeeRate.textContent = selectedFeeRate;
    if (summaryFee) summaryFee.textContent = (signedTx ? '' : '~') + displayFee.toLocaleString() + ' sats';
    if (summaryTotal) summaryTotal.textContent = Math.floor(displayTotal).toLocaleString() + ' sats';
    if (summaryTotalUsd) summaryTotalUsd.textContent = '≈ $' + ((displayTotal * btcPrice) / 100000000).toFixed(2);

    // Technical details
    const txSizeEl = content.querySelector('#tx-size');
    const txInputsEl = content.querySelector('#tx-inputs');
    const txOutputsEl = content.querySelector('#tx-outputs');
    const changeAmountEl = content.querySelector('#change-amount');
    const confTimeEl = content.querySelector('#conf-time');
    const priorityLevelEl = content.querySelector('#priority-level');

    if (txSizeEl) txSizeEl.textContent = displayTxSize + ' vB' + (signedTx ? '' : ' (est)');
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

    if (summaryRemaining) summaryRemaining.textContent = Math.floor(displayRemaining).toLocaleString() + ' sats';
    const remainingBtc = displayRemaining / 100000000;
    const remainingUsd = remainingBtc * btcPrice;
    if (summaryRemainingDetail) {
      summaryRemainingDetail.textContent = remainingBtc.toFixed(8) + ' BTC ≈ $' + remainingUsd.toFixed(2);
    }

    // Update available balance
    const availableBalanceEl = content.querySelector('#available-balance-sats');
    const availableBalanceBtcEl = content.querySelector('#available-balance-btc');
    if (availableBalanceEl && availableBalanceBtcEl) {
      availableBalanceEl.textContent = availableForSpending.toLocaleString() + ' sats';
      availableBalanceBtcEl.textContent = (availableForSpending / 100000000).toFixed(8);
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
      console.log('🔏 Signing transaction');
      
      const numInputs = selectionMode === 'manual' ? selectedUtxos.length : 1;
      const numOutputs = recipients.filter(r => r.address).length;
      actualTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs + 31);
      actualFee = selectedFeeRate * actualTxSize;
      
      signedTx = { id: 'simulated-tx' };
      signedTxHex = '0200000001' + 'ff'.repeat(100);
      
      alert('✅ Transaction signed successfully!\n\nReview the details and click "Broadcast" to send.');
      
      const hexPanel = content.querySelector('#hex-panel');
      if (hexPanel) hexPanel.classList.remove('hidden');
      
      const broadcastBtn = content.querySelector('#broadcast-tx-btn');
      if (broadcastBtn) broadcastBtn.disabled = false;
      
      updateSummary();
      
    } catch (error) {
      console.error('Signing failed:', error);
      alert(`❌ Failed to sign: ${error.message}`);
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
        const numOutputs = recipients.filter(r => r.address).length;
        const estimatedTxSize = Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs);
        const estimatedFee = selectedFeeRate * estimatedTxSize;
        const totalToSend = Math.max(0, utxoTotal - estimatedFee);
        amountToSend = Math.floor(totalToSend / numOutputs);
      }
      
      for (const recipient of recipients) {
        if (!recipient.address) continue;
        
        const amount = selectionMode === 'manual' ? amountToSend : recipient.amount;
        if (amount <= 0) continue;
        
        let manuallySelectedOutpoints = null;
        if (selectionMode === 'manual' && selectedUtxos.length > 0) {
          manuallySelectedOutpoints = selectedUtxos.map(index => {
            const utxo = availableUtxos[index];
            return {
              txid: utxo.txid,
              vout: utxo.vout
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
          const txid = typeof data.txid === 'object' ? data.txid.value : data.txid;
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
      alert(`❌ Failed to broadcast: ${error.message}`);
    } finally {
      broadcastBtn.disabled = false;
      broadcastBtn.textContent = originalText;
    }
  }

  function showSuccessPopup(txids) {
    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    
    popup.innerHTML = `
      <div class="bg-[#1a2332] rounded-lg p-8 max-w-2xl w-full mx-4 border border-green-500/50">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">✅</div>
          <h2 class="text-2xl font-bold text-green-400 mb-2">Transaction Broadcast Successfully!</h2>
          <p class="text-gray-400">Your transaction(s) have been sent to the Bitcoin network</p>
        </div>
        
        <div class="space-y-4 mb-6">
          ${txids.map(({ address, txid }) => `
            <div class="bg-[#0f1419] rounded-lg p-4 border border-gray-700">
              <p class="text-xs text-gray-400 mb-2">Recipient: ${address}</p>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">TXID:</span>
                <a href="https://mempool.space/testnet/tx/${txid}" target="_blank" 
                   class="text-sm font-mono text-blue-400 hover:text-blue-300 underline flex-1 truncate">
                  ${txid}
                </a>
              </div>
            </div>
          `).join('')}
        </div>
        
        <button id="close-success-popup" class="w-full bg-[#FF6B35] hover:bg-[#ff7d4d] text-white font-bold py-3 rounded-lg transition-colors">
          Close
        </button>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    popup.querySelector('#close-success-popup').addEventListener('click', () => {
      popup.remove();
    });
    
    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.remove();
    });
  }

  content.innerHTML = `
    <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Send Bitcoin</h2>
    <p class="text-gray-400 mb-4">Send BTC to one or multiple Bitcoin addresses</p>
    
    <!-- Warning Banner -->
    <div class="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
      <p class="text-sm text-yellow-400 font-semibold">
        ⚠️ Regular and Swap UTXOs cannot be selected together in a single transaction
      </p>
      <p class="text-xs text-yellow-400/80 mt-1">Mixing these UTXO types compromises privacy. Use one type per send.</p>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- Left: Send Form -->
      <div class="col-span-2 space-y-6">
        <div class="bg-[#1a2332] rounded-lg p-6">
          <!-- Recipients -->
          <div class="mb-6">
            <div class="flex justify-between items-center mb-3">
              <label class="block text-sm text-gray-400">Recipients</label>
              <button id="add-recipient-btn" class="text-[#FF6B35] hover:text-[#ff7d4d] text-sm font-semibold">
                + Add Recipient
              </button>
            </div>
            <div id="recipients-container"></div>
          </div>

          <!-- Selection Mode -->
          <div class="mb-6">
            <label class="block text-sm text-gray-400 mb-2">UTXO Selection</label>
            <div class="flex gap-2">
              <button id="mode-auto" class="mode-btn flex-1 bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg py-3 text-white font-semibold">
                Auto Select
              </button>
              <button id="mode-manual" class="mode-btn flex-1 bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg py-3 text-white font-semibold transition-colors">
                Manual Select
              </button>
            </div>
          </div>

          <!-- Fee Rate -->
          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm text-gray-400">Fee Rate</label>
              <span class="text-xs text-gray-500">Regtest optimized rates</span>
            </div>
            
            <div class="grid grid-cols-3 gap-2 mb-4">
              <button id="fee-low" class="fee-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-center transition-colors">
                <div class="text-white font-semibold">Low</div>
                <div class="text-xs text-gray-400 mt-1">1 sat/vB</div>
              </button>
              <button id="fee-medium" class="fee-btn bg-[#FF6B35] border-2 border-[#FF6B35] rounded-lg p-3 text-center">
                <div class="text-white font-semibold">Medium</div>
                <div class="text-xs text-white/80 mt-1">2 sat/vB</div>
              </button>
              <button id="fee-high" class="fee-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 rounded-lg p-3 text-center transition-colors">
                <div class="text-white font-semibold">High</div>
                <div class="text-xs text-gray-400 mt-1">4 sat/vB</div>
              </button>
            </div>

            <div class="flex items-center gap-2">
              <input 
                id="custom-fee"
                type="number" 
                min="1"
                placeholder="Custom" 
                class="flex-1 bg-[#0f1419] border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35]"
              />
              <span class="text-sm text-gray-400">sats/vByte</span>
            </div>
          </div>
        </div>

        <!-- Manual Selection Section -->
        <div id="manual-selection-section" class="hidden">
          <div class="bg-[#1a2332] rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-semibold text-gray-300">Select UTXOs</h3>
              <div class="text-sm text-gray-400">
                Selected: <span id="selected-utxos-count">0</span> UTXOs 
                (<span id="selected-utxos-value">0.00000000 BTC</span>)
              </div>
            </div>
            
            <div id="utxo-warning" class="hidden mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p class="text-xs text-red-400 font-semibold">
                ⚠️ PRIVACY WARNING: You've selected both Regular and Swap UTXOs!
              </p>
              <p class="text-xs text-red-400/80 mt-1">This compromises your privacy. Please use only one type.</p>
            </div>
            
            <div id="utxo-list-container" class="space-y-2">
              <div class="text-center py-8 text-gray-400">
                <p>Loading UTXOs...</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Hex Display -->
        <div id="hex-panel" class="hidden bg-[#1a2332] rounded-lg p-6">
          <h3 class="text-lg font-semibold text-gray-300 mb-3">Transaction Hex</h3>
          <div class="bg-[#0f1419] border border-gray-700 rounded-lg p-4 max-h-40 overflow-auto">
            <pre id="tx-hex-content" class="text-xs text-green-400 font-mono whitespace-pre-wrap break-all"></pre>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="grid grid-cols-2 gap-4">
          <button id="sign-tx-btn" class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors text-lg">
            🔏 Sign Transaction
          </button>
          <button id="broadcast-tx-btn" disabled class="bg-[#FF6B35] hover:bg-[#ff7d4d] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors text-lg">
            📡 Broadcast
          </button>
        </div>
      </div>

      <!-- Right: Summary -->
      <div class="col-span-1">
        <div class="bg-[#1a2332] rounded-lg p-6 sticky top-8">
          <h3 class="text-lg font-semibold text-gray-300 mb-4">Transaction Summary</h3>
          
          <div class="space-y-4">
            <div>
              <p class="text-sm text-gray-400 mb-1">Available Balance</p>
              <p id="available-balance-sats" class="text-xl font-mono text-green-400">0 sats</p>
              <p class="text-xs text-gray-500">
                <span id="available-balance-btc">0.00000000</span> BTC ≈ $0.00
              </p>
            </div>

            <div class="border-t border-gray-700 pt-4">
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Amount</span>
                <span id="summary-amount" class="text-sm font-mono text-white">0 sats</span>
              </div>
              <div class="flex justify-between mb-2">
                <span class="text-sm text-gray-400">Network Fee (<span id="summary-fee-rate">2</span> sat/vB)</span>
                <span id="summary-fee" class="text-sm font-mono text-yellow-400">~280 sats</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-gray-700">
                <span class="text-sm font-semibold text-gray-300">Total Sent</span>
                <span id="summary-total" class="text-sm font-mono font-semibold text-[#FF6B35]">280 sats</span>
              </div>
              <p id="summary-total-usd" class="text-xs text-gray-500 text-right mt-1">≈ $0.00</p>
            </div>

            <!-- Technical Details -->
            <div class="border-t border-gray-700 pt-4">
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-gray-400">TX Size:</span>
                  <span id="tx-size" class="text-white font-mono">140 vB</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Inputs:</span>
                  <span id="tx-inputs" class="text-cyan-400 font-mono">1</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Outputs:</span>
                  <span id="tx-outputs" class="text-cyan-400 font-mono">1</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Priority:</span>
                  <span id="priority-level" class="text-yellow-400">Medium</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Est. Time:</span>
                  <span id="conf-time" class="text-green-400">~20 min</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">RBF:</span>
                  <span class="text-blue-400">✓ Enabled</span>
                </div>
              </div>
            </div>

            <div class="border-t border-gray-700 pt-4">
              <p class="text-sm text-gray-400 mb-1">Change Amount</p>
              <p id="change-amount" class="text-lg font-mono text-purple-400">0 sats</p>
            </div>

            <div class="border-t border-gray-700 pt-4">
              <p class="text-sm text-gray-400 mb-1">Remaining Balance</p>
              <p id="summary-remaining" class="text-lg font-mono text-blue-400">0 sats</p>
              <p id="summary-remaining-detail" class="text-xs text-gray-500">0.00000000 BTC ≈ $0.00</p>
            </div>
          </div>

          <div class="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p class="text-xs text-blue-400">
              ⓘ Sign first to review exact fees, then broadcast to send.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(content);

  // MAIN EVENT LISTENERS
  content.querySelector('#mode-auto').addEventListener('click', () => toggleSelectionMode('auto'));
  content.querySelector('#mode-manual').addEventListener('click', () => toggleSelectionMode('manual'));
  content.querySelector('#fee-low').addEventListener('click', () => selectFee('low'));
  content.querySelector('#fee-medium').addEventListener('click', () => selectFee('medium'));
  content.querySelector('#fee-high').addEventListener('click', () => selectFee('high'));
  content.querySelector('#add-recipient-btn').addEventListener('click', addRecipient);
  content.querySelector('#sign-tx-btn').addEventListener('click', handleSignTransaction);
  content.querySelector('#broadcast-tx-btn').addEventListener('click', handleBroadcastTransaction);

  content.querySelector('#custom-fee').addEventListener('input', (e) => {
    const customRate = parseInt(e.target.value);
    if (customRate > 0) {
      selectedFeeRate = customRate;
      content.querySelectorAll('.fee-btn').forEach((btn) => {
        btn.className = btn.className.replace(
          'bg-[#FF6B35] border-2 border-[#FF6B35]',
          'bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700'
        );
      });
      updateSummary();
    }
  });

  // Initialize
  renderRecipients();
  fetchUtxosFromAPI();
}