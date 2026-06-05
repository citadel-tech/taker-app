import { icons } from '../../js/icons.js';

export function RecoveryComponent(container) {
  const content = document.createElement('div');
  content.id = 'recovery-content';
  content.className = 'app-page recovery-page';

  async function triggerRecovery() {
    try {
      const result = await window.api.taker.recover();
      return result;
    } catch (error) {
      console.error('Recovery failed:', error);
      return { success: false, error: error.message };
    }
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
        <button id="manual-recovery-btn" class="app-button primary" type="button">
          ${icons.recycle(16)}
          <span>Trigger Recovery</span>
        </button>
      </div>
    </header>

    <section class="recovery-stats" aria-label="Recovery stats">
      <article class="recovery-stat-card recovered">
        <span class="app-accent"></span>
        <span class="app-card-label">Total Recovered</span>
        <div class="app-card-value"><span id="total-recovered">0 丰</span></div>
      </article>
      <article class="recovery-stat-card rate">
        <span class="app-accent"></span>
        <span class="app-card-label">Recovery Rate</span>
        <div class="app-card-value"><span id="recovery-rate">100%</span></div>
      </article>
      <article class="recovery-stat-card pending">
        <span class="app-accent"></span>
        <span class="app-card-label">Pending</span>
        <div class="app-card-value"><span id="pending-count">0</span></div>
      </article>
    </section>

    <section class="recovery-layout">
      <article class="app-panel recovery-flow-panel">
        <header class="app-panel-head">
          <div>
            <h3>Recovery Flow</h3>
            <span>Automatic refund path</span>
          </div>
        </header>
        <div class="app-panel-body recovery-flow">
          <div class="recovery-step">
            <span>01</span>
            <p>The app automatically detects failed swaps and attempts to recover via the timelock script.</p>
          </div>
          <div class="recovery-step">
            <span>02</span>
            <p>It waits for the HTLC timelock to expire, then create and broadcast the recovery transaction.</p>
          </div>
          <div class="recovery-step">
            <span>03</span>
            <p>All recoverable funds appear in the wallet's Contract Balance.</p>
          </div>
          <div class="recovery-step">
            <span>04</span>
            <p>It automatically resumes recovery at every restart if the previous recovery didn't complete.</p>
          </div>
        </div>
      </article>

      <aside class="app-panel recovery-action-panel">
        <header class="app-panel-head">
          <div>
            <h3>Manual Recovery</h3>
            <span>Fallback control</span>
          </div>
        </header>
        <div class="app-panel-body">
          <div class="recovery-manual-copy">
            ${icons.shieldCheck(28)}
            <p>Use this only when automatic recovery doesn't work for some reason. This will force the recovery process to begin again.</p>
          </div>
          <div id="recovery-status" class="recovery-status hidden"></div>
        </div>
      </aside>
    </section>
  `;

  container.appendChild(content);

  content.querySelector('#manual-recovery-btn').addEventListener('click', async () => {
    const btn = content.querySelector('#manual-recovery-btn');
    const statusDiv = content.querySelector('#recovery-status');
    const label = btn.querySelector('span');

    label.textContent = 'Recovering...';
    btn.disabled = true;
    btn.classList.add('loading');

    statusDiv.className = 'recovery-status info';
    statusDiv.innerHTML = `${icons.loader(16, 'animate-spin')} <span>Recovery has started. Once completed the wallet will reflect recovered balance.</span>`;

    const result = await triggerRecovery();

    if (result.success) {
      statusDiv.className = 'recovery-status success';
      statusDiv.innerHTML = `${icons.checkCircle(16)} <span>Recovery completed successfully</span>`;
      label.textContent = 'Recovery Complete';
    } else {
      statusDiv.className = 'recovery-status error';
      statusDiv.innerHTML = `${icons.xCircle(16)} <span>${result.error || 'Recovery failed'}</span>`;
      label.textContent = 'Recovery Failed';
    }

    setTimeout(() => {
      label.textContent = 'Trigger Recovery';
      btn.disabled = false;
      btn.classList.remove('loading');
    }, 3000);
  });
}
