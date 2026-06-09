import { icons } from '../../js/icons.js';
import { formatSats, SATS_SYMBOL } from '../../js/price.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactTxid(txid = '') {
  const text = String(txid || '');
  if (text.length <= 20) return text || '-';
  return `${text.slice(0, 12)}...${text.slice(-8)}`;
}

function formatRecoveryError(error = '') {
  const message = String(error || 'Recovery failed');
  if (message.includes('No persisted swapcoins found for recovery')) {
    return 'No persisted recovery data was found. There is nothing for the recovery command to broadcast.';
  }
  return message.replace(/^Recover error:\s*/i, '');
}

function isStillTimelocked(item) {
  const currentHeight = Number(item?.currentHeight);
  const unlockBlock = Number(item?.unlockBlock);
  if (!Number.isFinite(currentHeight) || !Number.isFinite(unlockBlock) || unlockBlock <= 0) {
    return true;
  }
  return currentHeight < unlockBlock;
}

export function RecoveryComponent(container) {
  const content = document.createElement('div');
  content.id = 'recovery-content';
  content.className = 'app-page recovery-page';

  async function triggerRecovery() {
    try {
      return await window.api.taker.recover();
    } catch (error) {
      console.error('Recovery failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function loadRecoveryStatus() {
    try {
      const result = await window.api.taker.getRecoveryStatus();
      return result.success ? result.recovery : null;
    } catch (error) {
      console.error('Failed to load recovery status:', error);
      return null;
    }
  }

  function renderPendingRecoveries(recovery) {
    const list = content.querySelector('#pending-recovery-list');
    const pendingCountEl = content.querySelector('#pending-count');
    const totalRecoveredEl = content.querySelector('#total-recovered');
    const recoveryRateEl = content.querySelector('#recovery-rate');
    const recoverySourceEl = content.querySelector('#recovery-source-note');
    const recoveryActionNoteEl = content.querySelector('#recovery-action-note');
    const recoveryButton = content.querySelector('#manual-recovery-btn');
    const recoveryButtonLabel = recoveryButton?.querySelector('.button-label');
    if (!list) return;

    const allPending = Array.isArray(recovery?.pending) ? recovery.pending : [];
    const pending = allPending.filter(isStillTimelocked);
    const totalPendingAmount = pending.reduce(
      (sum, item) => sum + (Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0),
      0
    );
    const recoveredCount = Number(recovery?.recoveredCount || 0);
    const canTriggerRecovery = Boolean(recovery?.canTriggerRecovery);
    const hasWalletRecoveryStoreCount = recovery?.walletRecoveryStoreCount != null;

    pendingCountEl.textContent = String(pending.length);
    totalRecoveredEl.innerHTML = recoveredCount > 0 ? `${recoveredCount} swaps` : formatSats(0);
    recoveryRateEl.textContent = pending.length > 0
      ? canTriggerRecovery
        ? 'Wallet ready'
        : hasWalletRecoveryStoreCount
          ? 'Store empty'
          : 'Tracked only'
      : 'Clear';
    recoverySourceEl.textContent =
      recovery?.source === 'debug-log'
        ? 'Status inferred from wallet debug log. The recovery command needs persisted swapcoin data.'
        : recovery?.statusNote || '';
    if (recoveryActionNoteEl) {
      recoveryActionNoteEl.textContent = canTriggerRecovery
        ? 'Broadcasts refund transactions for persisted failed swaps.'
        : pending.length > 0
          ? 'Override retry is available, but the wallet currently reports no recovery swapcoins.'
          : 'Manual recovery can retry the native wallet recovery command.';
    }
    if (recoveryButton) {
      recoveryButton.disabled = false;
      recoveryButton.title = canTriggerRecovery
        ? 'Trigger recovery for persisted failed swaps'
        : 'Force a retry of the native wallet recovery command';
    }
    if (recoveryButtonLabel) {
      recoveryButtonLabel.textContent = canTriggerRecovery
        ? 'Trigger Recovery'
        : 'Force Recovery Retry';
    }

    if (!pending.length) {
      list.innerHTML = `
        <div class="recovery-empty-state">
          ${icons.shieldCheck(22)}
          <div>
            <strong>No pending recovery</strong>
            <span>${recoveredCount > 0 ? `${recoveredCount} previously failed swap${recoveredCount > 1 ? 's have' : ' has'} been recovered.` : 'No failed swaps require recovery.'}</span>
          </div>
        </div>
      `;
      return;
    }

    const fromTracker = recovery?.source === 'swap-tracker';

    list.innerHTML = `
      <div class="recovery-pending-summary">
        <span>Pending recovery</span>
        <strong>${formatSats(totalPendingAmount)}</strong>
      </div>
      ${pending
        .map((item) => {
          const amountHtml =
            Number.isFinite(item.amount) && item.amount > 0
              ? formatSats(item.amount)
              : 'Amount unavailable';

          if (fromTracker) {
            const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
            const phase = item.failedAtPhase ? escapeHtml(item.failedAtPhase) : '';
            const reason = item.failureReason ? escapeHtml(item.failureReason) : '';
            const hasBlocks = item.blocksRemaining != null;
            const statusText = item.status === 'ready'
              ? canTriggerRecovery
                ? 'Wallet recovery data found'
                : 'Tracked failed swap - wallet recovery store empty'
              : hasBlocks
                ? `${Number(item.blocksRemaining).toLocaleString()} blocks remaining`
                : 'Awaiting timelock recovery';
            return `
              <article class="recovery-pending-item">
                <div class="recovery-pending-main">
                  <span>${escapeHtml(statusText)}</span>
                  <strong>${amountHtml}</strong>
                  <small title="${escapeHtml(item.txid || '')}">${escapeHtml(compactTxid(item.txid))}</small>
                </div>
                <div class="recovery-pending-grid">
                  ${hasBlocks ? `
                  <div>
                    <span>Current block</span>
                    <strong>${Number(item.currentHeight).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Unlock block</span>
                    <strong>${Number(item.unlockBlock).toLocaleString()}</strong>
                  </div>
                  ` : `
                  <div>
                    <span>Failed at</span>
                    <strong>${phase || '—'}</strong>
                  </div>
                  <div>
                    <span>Date</span>
                    <strong>${date || '—'}</strong>
                  </div>
                  `}
                </div>
                ${reason ? `<div class="recovery-failure-reason"><span>Last attempt: ${reason}</span></div>` : ''}
              </article>
            `;
          }

          const blocksRemaining = Math.max(0, Number(item.blocksRemaining || 0));
          const statusText =
            item.status === 'ready'
              ? canTriggerRecovery
                ? 'Wallet recovery data found'
                : 'Tracked failed swap - wallet recovery store empty'
              : `${blocksRemaining.toLocaleString()} blocks remaining`;

          return `
            <article class="recovery-pending-item">
              <div class="recovery-pending-main">
                <span>${escapeHtml(statusText)}</span>
                <strong>${amountHtml}</strong>
                <small title="${escapeHtml(item.txid)}">${escapeHtml(compactTxid(item.txid))}</small>
              </div>
              <div class="recovery-pending-grid">
                <div>
                  <span>Current block</span>
                  <strong>${Number(item.currentHeight || 0).toLocaleString()}</strong>
                </div>
                <div>
                  <span>Unlock block</span>
                  <strong>${Number(item.unlockBlock || 0).toLocaleString()}</strong>
                </div>
              </div>
            </article>
          `;
        })
        .join('')}
    `;
  }

  content.innerHTML = `
    <header class="app-head recovery-head">
      <div>
        <h2>Recovery</h2>
        <div class="app-meta">
          <span>Failed swap protection</span>
          <span>Timelock refunds</span>
        </div>
      </div>
      <div class="app-actions">
        <button id="manual-recovery-btn" class="app-button secondary" type="button" disabled>
          ${icons.recycle(14)}
          <span class="button-label">Trigger Recovery</span>
        </button>
        <span id="recovery-action-note" class="recovery-action-note">Checking recovery data.</span>
      </div>
    </header>

    <div class="recovery-how-strip">
      <span>01 - Detects failed swaps via timelock script</span>
      <span>02 - Waits until the refund timelock expires</span>
      <span>03 - Recovery requires persisted failed-swap data</span>
      <span>04 - Recovered funds land in Contract Balance</span>
    </div>

    <section class="recovery-stats" aria-label="Recovery stats">
      <article class="recovery-stat-card recovered">
        <span class="app-accent"></span>
        <span class="app-card-label">Total Recovered</span>
        <div class="app-card-value"><span id="total-recovered">0 ${SATS_SYMBOL}</span></div>
      </article>
      <article class="recovery-stat-card rate">
        <span class="app-accent"></span>
        <span class="app-card-label">Recovery Status</span>
        <div class="app-card-value"><span id="recovery-rate">Checking</span></div>
      </article>
      <article class="recovery-stat-card pending">
        <span class="app-accent"></span>
        <span class="app-card-label">Pending</span>
        <div class="app-card-value"><span id="pending-count">-</span></div>
      </article>
    </section>

    <section class="app-panel recovery-pending-panel">
      <header class="app-panel-head">
        <div>
          <h3>Pending Recovery</h3>
          <span id="recovery-source-note">Checking wallet debug log</span>
        </div>
      </header>
      <div id="pending-recovery-list" class="app-panel-body recovery-pending-list">
        <div class="recovery-empty-state">
          ${icons.loader(18, 'animate-spin')}
          <div>
            <strong>Checking recovery state</strong>
            <span>Reading latest wallet log entries.</span>
          </div>
        </div>
      </div>
    </section>

  `;

  container.appendChild(content);

  loadRecoveryStatus().then(renderPendingRecoveries);

  content.querySelector('#manual-recovery-btn').addEventListener('click', async () => {
    const btn = content.querySelector('#manual-recovery-btn');
    const label = btn.querySelector('.button-label');
    const recoveryActionNoteEl = content.querySelector('#recovery-action-note');
    if (btn.disabled) return;
    label.textContent = 'Recovering...';
    btn.disabled = true;

    const result = await triggerRecovery();

    if (result.success) {
      label.textContent = 'Done';
      if (recoveryActionNoteEl) {
        recoveryActionNoteEl.textContent = 'Recovery completed.';
      }
      loadRecoveryStatus().then(renderPendingRecoveries);
    } else {
      label.textContent = 'Failed';
      if (recoveryActionNoteEl) {
        recoveryActionNoteEl.textContent = formatRecoveryError(result.error);
      }
    }

    setTimeout(() => {
      loadRecoveryStatus().then(renderPendingRecoveries);
    }, 3000);
  });
}
