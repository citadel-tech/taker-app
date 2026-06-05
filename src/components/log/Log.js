import { icons } from '../../js/icons.js';

export function LogComponent(container) {
  const content = document.createElement('div');
  content.id = 'log-content';

  let currentFilter = 'all';
  let autoScroll = true;
  let showTimestamps = true;
  let logs = [];
  let pollInterval = null;
  const MAX_LOGS = 30;

  function parseLogLine(line) {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2}T[\d:.]+)[^\s]*\s+(INFO|WARN|ERROR|DEBUG|TRACE)\s+(.+)$/
    );
    if (match) {
      return {
        timestamp: new Date(match[1]).getTime(),
        type: match[2].toLowerCase(),
        message: match[3],
      };
    }
    return { timestamp: Date.now(), type: 'info', message: line };
  }

  async function fetchLogs() {
    try {
      const data = await window.api.logs.get(50);
      if (data.success) {
        logs = data.logs.map(parseLogLine);
        renderLogs();
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }

  async function openLogFile() {
    try {
      const walletInfo = await window.api.taker.getWalletInfo();
      if (walletInfo.success && walletInfo.dataDir) {
        const logPath = `${walletInfo.dataDir}/debug.log`;
        await window.api.shell.showItemInFolder(logPath);
      } else {
        alert('Could not locate log file directory');
      }
    } catch (err) {
      console.error('Failed to open log file:', err);
      alert('Failed to open log file location: ' + err.message);
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });
  }

  function getTypeColor(type) {
    switch (type) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warn';
      case 'debug':
        return 'debug';
      case 'trace':
        return 'trace';
      default:
        return 'info';
    }
  }

  function getTypeLabel(type) {
    return type.toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderLogs() {
    const logOutput = content.querySelector('#log-output');
    if (!logOutput) return;

    let filtered =
      currentFilter === 'all'
        ? logs
        : logs.filter((l) => l.type === currentFilter);
    filtered = filtered.slice(-MAX_LOGS);

    if (filtered.length === 0) {
      logOutput.innerHTML =
        '<div class="app-empty">No logs available for this filter.</div>';
    } else {
      logOutput.innerHTML = filtered
        .map((log) => {
          const timeStr = showTimestamps
            ? `<span class="log-time">${formatTime(log.timestamp)}</span>`
            : '';
          return `
            <div class="log-entry ${getTypeColor(log.type)}">
              ${timeStr}
              <span class="log-level">${getTypeLabel(log.type)}</span>
              <span class="log-message">${escapeHtml(log.message)}</span>
            </div>
          `;
        })
        .join('');
    }

    if (autoScroll) logOutput.scrollTop = logOutput.scrollHeight;
    updateStats();
  }

  function updateStats() {
    const stats = {
      info: logs.filter((l) => l.type === 'info').length,
      warn: logs.filter((l) => l.type === 'warn').length,
      error: logs.filter((l) => l.type === 'error').length,
      debug: logs.filter((l) => l.type === 'debug').length,
    };
    const total = Object.values(stats).reduce((a, b) => a + b, 0) || 1;

    const el = (id) => content.querySelector(id);
    if (el('#info-count')) el('#info-count').textContent = stats.info;
    if (el('#warn-count')) el('#warn-count').textContent = stats.warn;
    if (el('#error-count')) el('#error-count').textContent = stats.error;
    if (el('#debug-count')) el('#debug-count').textContent = stats.debug;
    if (el('#info-bar'))
      el('#info-bar').style.width = `${(stats.info / total) * 100}%`;
    if (el('#warn-bar'))
      el('#warn-bar').style.width = `${(stats.warn / total) * 100}%`;
    if (el('#error-bar'))
      el('#error-bar').style.width = `${(stats.error / total) * 100}%`;
    if (el('#debug-bar'))
      el('#debug-bar').style.width = `${(stats.debug / total) * 100}%`;
  }

  function setFilter(filter) {
    currentFilter = filter;
    content.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderLogs();
  }

  content.innerHTML = `
    <div class="app-page log-page">
      <header class="app-head log-head">
        <div>
          <h2>System Logs</h2>
          <div class="app-meta">
            <span>Last ${MAX_LOGS} lines</span>
            <span>Protocol monitor</span>
          </div>
        </div>
        <div class="app-actions">
          <button id="refresh-logs" class="app-button ghost" type="button">
            ${icons.refreshCw(16)} Refresh
          </button>
          <button id="open-log-file" class="app-button primary" type="button">
            ${icons.folderOpen(16)} Open Log File
          </button>
        </div>
      </header>

      <section class="log-notice">
        ${icons.lightbulb(18)}
        <p>Showing a compact live view for performance. Open the full debug.log file for complete history.</p>
      </section>

      <section class="log-layout">
        <article class="app-panel log-main-panel">
          <header class="app-panel-head compact">
            <div>
              <h3>Live Output</h3>
              <span>Auto refresh every 2s</span>
            </div>
            <div class="app-panel-controls">
              <div class="app-tabs log-filters">
                <button id="filter-all" data-filter="all" class="filter-btn active" type="button">All</button>
                <button id="filter-info" data-filter="info" class="filter-btn" type="button">Info</button>
                <button id="filter-warn" data-filter="warn" class="filter-btn" type="button">Warning</button>
                <button id="filter-error" data-filter="error" class="filter-btn" type="button">Error</button>
                <button id="filter-debug" data-filter="debug" class="filter-btn" type="button">Debug</button>
              </div>
            </div>
          </header>
          <div class="app-panel-body">
            <div id="log-output" class="log-output"></div>
          </div>
        </article>
      
        <aside class="log-side">
          <article class="app-panel log-stats-panel">
            <header class="app-panel-head">
              <div>
                <h3>Log Stats</h3>
                <span>Current sample</span>
              </div>
            </header>
            <div class="app-panel-body log-stats">
              <div class="log-stat info">
                <div><span>Info</span><strong id="info-count">0</strong></div>
                <span class="log-stat-track"><span id="info-bar"></span></span>
              </div>
              <div class="log-stat warn">
                <div><span>Warning</span><strong id="warn-count">0</strong></div>
                <span class="log-stat-track"><span id="warn-bar"></span></span>
              </div>
              <div class="log-stat error">
                <div><span>Error</span><strong id="error-count">0</strong></div>
                <span class="log-stat-track"><span id="error-bar"></span></span>
              </div>
              <div class="log-stat debug">
                <div><span>Debug</span><strong id="debug-count">0</strong></div>
                <span class="log-stat-track"><span id="debug-bar"></span></span>
              </div>
            </div>
          </article>

          <article class="app-panel log-settings-panel">
            <header class="app-panel-head">
              <div>
                <h3>Display</h3>
                <span>Preferences</span>
              </div>
            </header>
            <div class="app-panel-body log-settings">
              <label>
                <input type="checkbox" id="auto-scroll" checked />
                <span>Auto-scroll</span>
              </label>
              <label>
                <input type="checkbox" id="show-timestamps" checked />
                <span>Show timestamps</span>
              </label>
              <label>
                <input type="checkbox" id="auto-refresh" checked />
                <span>Auto-refresh</span>
              </label>
            </div>
          </article>
        </aside>
      </section>
    </div>
  `;

  container.appendChild(content);

  // Event listeners
  content
    .querySelector('#filter-all')
    .addEventListener('click', () => setFilter('all'));
  content
    .querySelector('#filter-info')
    .addEventListener('click', () => setFilter('info'));
  content
    .querySelector('#filter-warn')
    .addEventListener('click', () => setFilter('warn'));
  content
    .querySelector('#filter-error')
    .addEventListener('click', () => setFilter('error'));
  content
    .querySelector('#filter-debug')
    .addEventListener('click', () => setFilter('debug'));
  content.querySelector('#refresh-logs').addEventListener('click', fetchLogs);
  content
    .querySelector('#open-log-file')
    .addEventListener('click', openLogFile);

  content.querySelector('#auto-scroll').addEventListener('change', (e) => {
    autoScroll = e.target.checked;
  });

  content.querySelector('#show-timestamps').addEventListener('change', (e) => {
    showTimestamps = e.target.checked;
    renderLogs();
  });

  content.querySelector('#auto-refresh').addEventListener('change', (e) => {
    if (e.target.checked) {
      pollInterval = setInterval(fetchLogs, 2000);
    } else {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  });

  // Initial fetch and start polling
  fetchLogs();
  pollInterval = setInterval(fetchLogs, 2000);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
}
