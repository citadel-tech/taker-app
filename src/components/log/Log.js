export function LogComponent(container) {
  const content = document.createElement('div');
  content.id = 'log-content';

  let currentFilter = 'all';
  let autoScroll = true;
  let showTimestamps = true;
  let logs = [];
  let pollInterval = null;
  const MAX_LOGS = 30; // Limit to last 30 lines for performance

  function parseLogLine(line) {
    // Parse: 2025-11-21T20:48:08.479897668+05:30 INFO coinswap::utill - Message
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+)[^\s]*\s+(INFO|WARN|ERROR|DEBUG|TRACE)\s+(.+)$/);
    if (match) {
      return {
        timestamp: new Date(match[1]).getTime(),
        type: match[2].toLowerCase() === 'warn' ? 'warn' : match[2].toLowerCase() === 'error' ? 'error' : 'info',
        message: match[3]
      };
    }
    return { timestamp: Date.now(), type: 'info', message: line };
  }

  async function fetchLogs() {
    try {
      // IPC call to get only last 50 logs (we'll filter to 20 per type)
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
      // Get wallet info to find data dir
      const walletInfo = await window.api.taker.getWalletInfo();
      if (walletInfo.success && walletInfo.dataDir) {
        const logPath = `${walletInfo.dataDir}/debug.log`;
        
        // Use Electron's shell to open the containing folder
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
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-blue-400';
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

    // Filter logs and limit to MAX_LOGS (last 20)
    let filtered = currentFilter === 'all' ? logs : logs.filter(l => l.type === currentFilter);
    filtered = filtered.slice(-MAX_LOGS); // Only keep last 20

    if (filtered.length === 0) {
      logOutput.innerHTML = '<div class="text-gray-500 text-center py-8">No logs available</div>';
    } else {
      logOutput.innerHTML = filtered.map(log => {
        const timeStr = showTimestamps ? `<span class="text-gray-500">[${formatTime(log.timestamp)}]</span>` : '';
        return `<div class="mb-1 hover:bg-[#1a2332] px-2 py-1 rounded">${timeStr} <span class="${getTypeColor(log.type)}">[${getTypeLabel(log.type)}]</span> <span class="text-gray-300">${escapeHtml(log.message)}</span></div>`;
      }).join('');
    }

    if (autoScroll) logOutput.scrollTop = logOutput.scrollHeight;
    updateStats();
  }

  function updateStats() {
    const stats = {
      info: logs.filter(l => l.type === 'info').length,
      warn: logs.filter(l => l.type === 'warn').length,
      error: logs.filter(l => l.type === 'error').length
    };
    const total = stats.info + stats.warn + stats.error || 1;

    const el = (id) => content.querySelector(id);
    if (el('#info-count')) el('#info-count').textContent = stats.info;
    if (el('#warn-count')) el('#warn-count').textContent = stats.warn;
    if (el('#error-count')) el('#error-count').textContent = stats.error;
    if (el('#info-bar')) el('#info-bar').style.width = `${(stats.info / total) * 100}%`;
    if (el('#warn-bar')) el('#warn-bar').style.width = `${(stats.warn / total) * 100}%`;
    if (el('#error-bar')) el('#error-bar').style.width = `${(stats.error / total) * 100}%`;
  }

  function setFilter(filter) {
    currentFilter = filter;
    content.querySelectorAll('.filter-btn').forEach(btn => {
      btn.className = 'filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold text-lg transition-colors';
    });
    content.querySelector(`#filter-${filter}`).className = 'filter-btn bg-[#FF6B35] text-white px-4 py-2 rounded text-sm font-semibold text-lg';
    renderLogs();
  }

  content.innerHTML = `
    <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">System Logs</h2>
    <p class="text-gray-400 mb-4">Real-time coinswap protocol logs (last 20 lines)</p>
    
    <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
      <div class="flex items-start gap-3">
        <span class="text-2xl">💡</span>
        <div class="flex-1">
          <p class="text-blue-400 text-sm">
            <strong>Limited view:</strong> Only the last 20 log lines are shown here for performance. 
            For complete logs and debugging, use the "Open Log File" button to view the full debug.log file.
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-6">
      <div class="col-span-3">
        <div class="bg-[#1a2332] rounded-lg p-6">
          <div class="flex justify-between items-center mb-6">
            <div class="flex gap-2">
              <button id="filter-all" class="filter-btn bg-[#FF6B35] text-white px-4 py-2 rounded text-sm font-semibold text-lg">All</button>
              <button id="filter-info" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold text-lg transition-colors">Info</button>
              <button id="filter-warn" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold text-lg transition-colors">Warning</button>
              <button id="filter-error" class="filter-btn bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold text-lg transition-colors">Error</button>
            </div>
            <div class="flex gap-2">
              <button id="refresh-logs" class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-4 py-2 rounded text-sm transition-colors">
                🔄 Refresh
              </button>
              <button id="open-log-file" class="bg-[#FF6B35] hover:bg-[#ff7d4d] text-white px-4 py-2 rounded text-sm font-semibold text-lg transition-colors">
                📁 Open Log File
              </button>
            </div>
          </div>
          <div id="log-output" class="bg-[#0f1419] rounded-lg p-4 font-mono text-xs h-[500px] overflow-y-auto"></div>
        </div>
      </div>
      
      <div class="col-span-1 space-y-6">
        <div class="bg-[#1a2332] rounded-lg p-6">
          <h3 class="text-lg font-semibold text-lg text-gray-300 mb-4">Log Stats</h3>
          <div class="space-y-4">
            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm text-gray-400">Info</span>
                <span id="info-count" class="text-blue-400 font-semibold text-lg">0</span>
              </div>
              <div class="w-full bg-[#0f1419] rounded-full h-2">
                <div id="info-bar" class="bg-blue-400 h-2 rounded-full" style="width:0%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm text-gray-400">Warning</span>
                <span id="warn-count" class="text-yellow-400 font-semibold text-lg">0</span>
              </div>
              <div class="w-full bg-[#0f1419] rounded-full h-2">
                <div id="warn-bar" class="bg-yellow-400 h-2 rounded-full" style="width:0%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm text-gray-400">Error</span>
                <span id="error-count" class="text-red-400 font-semibold text-lg">0</span>
              </div>
              <div class="w-full bg-[#0f1419] rounded-full h-2">
                <div id="error-bar" class="bg-red-400 h-2 rounded-full" style="width:0%"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-[#1a2332] rounded-lg p-6">
          <h3 class="text-lg font-semibold text-lg text-gray-300 mb-4">Settings</h3>
          <div class="space-y-3">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="auto-scroll" checked class="w-4 h-4 accent-[#FF6B35]" />
              <span class="text-sm text-gray-300">Auto-scroll</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="show-timestamps" checked class="w-4 h-4 accent-[#FF6B35]" />
              <span class="text-sm text-gray-300">Show timestamps</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="auto-refresh" checked class="w-4 h-4 accent-[#FF6B35]" />
              <span class="text-sm text-gray-300">Auto-refresh (2s)</span>
            </label>
          </div>
        </div>
        
        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p class="text-xs text-yellow-400">
            <strong>⚠️ Performance:</strong> Viewing logs continuously may slow down the app. 
            Disable auto-refresh if experiencing lag.
          </p>
        </div>
      </div>
    </div>
  `;

  container.appendChild(content);

  // Event listeners
  content.querySelector('#filter-all').addEventListener('click', () => setFilter('all'));
  content.querySelector('#filter-info').addEventListener('click', () => setFilter('info'));
  content.querySelector('#filter-warn').addEventListener('click', () => setFilter('warn'));
  content.querySelector('#filter-error').addEventListener('click', () => setFilter('error'));
  content.querySelector('#refresh-logs').addEventListener('click', fetchLogs);
  
  content.querySelector('#open-log-file').addEventListener('click', openLogFile);
  
  content.querySelector('#auto-scroll').addEventListener('change', (e) => { 
    autoScroll = e.target.checked; 
  });
  
  content.querySelector('#show-timestamps').addEventListener('change', (e) => { 
    showTimestamps = e.target.checked; 
    renderLogs(); 
  });
  
  content.querySelector('#auto-refresh').addEventListener('change', (e) => {
    if (e.target.checked) {
      pollInterval = setInterval(fetchLogs, 2000); // Changed to 2 seconds (from 500ms)
    } else {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  });

  // Initial fetch and start polling (2 seconds instead of 500ms)
  fetchLogs();
  pollInterval = setInterval(fetchLogs, 2000);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
}