import { icons } from '../../js/icons.js';
import { formatSats } from '../../js/price.js';

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
    if (!list) return;

    const pending = Array.isArray(recovery?.pending) ? recovery.pending : [];
    const totalPendingAmount = Number(recovery?.totalPendingAmount || 0);
    const recoveredCount = Number(recovery?.recoveredCount || 0);

    pendingCountEl.textContent = String(pending.length);
    totalRecoveredEl.textContent = recoveredCount > 0 ? String(recoveredCount) + ' swaps' : formatSats(0);
    recoveryRateEl.textContent = pending.length > 0 ? 'Pending' : 'Clear';
    recoverySourceEl.textContent =
      recovery?.source === 'debug-log'
        ? 'Status inferred from wallet debug log.'
        : '';

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
          const amount =
            Number.isFinite(item.amount) && item.amount > 0
              ? formatSats(item.amount)
              : 'Amount unavailable';

          if (fromTracker) {
            const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
            const phase = item.failedAtPhase ? escapeHtml(item.failedAtPhase) : '';
            const reason = item.failureReason ? escapeHtml(item.failureReason) : '';
            const hasBlocks = item.blocksRemaining != null;
            const statusText = item.status === 'ready'
              ? 'Ready to recover'
              : hasBlocks
                ? `${Number(item.blocksRemaining).toLocaleString()} blocks remaining`
                : 'Awaiting timelock recovery';
            return `
              <article class="recovery-pending-item">
                <div class="recovery-pending-main">
                  <span>${escapeHtml(statusText)}</span>
                  <strong>${escapeHtml(amount)}</strong>
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
                ${reason ? `<div class="recovery-failure-reason"><span>${reason}</span></div>` : ''}
              </article>
            `;
          }

          const blocksRemaining = Math.max(0, Number(item.blocksRemaining || 0));
          const statusText =
            item.status === 'ready'
              ? 'Ready to recover'
              : `${blocksRemaining.toLocaleString()} blocks remaining`;

          return `
            <article class="recovery-pending-item">
              <div class="recovery-pending-main">
                <span>${escapeHtml(statusText)}</span>
                <strong>${escapeHtml(amount)}</strong>
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
        <button id="manual-recovery-btn" class="app-button secondary" type="button">
          ${icons.recycle(14)}
          <span>Trigger Recovery</span>
        </button>
      </div>
    </header>

    <div class="recovery-how-strip">
      <span>01 — Detects failed swaps via timelock script</span>
      <span>02 — Waits for HTLC expiry, broadcasts recovery tx</span>
      <span>03 — Recovered funds land in Contract Balance</span>
      <span>04 — Resumes on every restart until complete</span>
    </div>

    <section class="recovery-stats" aria-label="Recovery stats">
      <article class="recovery-stat-card recovered">
        <span class="app-accent"></span>
        <span class="app-card-label">Total Recovered</span>
        <div class="app-card-value"><span id="total-recovered">0 丰</span></div>
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
    const label = btn.querySelector('span');
    label.textContent = 'Recovering...';
    btn.disabled = true;

    const result = await triggerRecovery();

    if (result.success) {
      label.textContent = 'Done';
      loadRecoveryStatus().then(renderPendingRecoveries);
    } else {
      label.textContent = 'Failed';
    }

    setTimeout(() => {
      label.textContent = 'Trigger Recovery';
      btn.disabled = false;
    }, 3000);
  });
}
