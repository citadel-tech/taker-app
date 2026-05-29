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

function compactEndpoint(value, left = 11, right = 7) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= left + right + 3) return text;
  return `${text.slice(0, left)}...${text.slice(-right)}`;
}

function normalizeTone(color) {
  if (color === 'green' || color === 'success') return 'settled';
  if (color === 'orange' || color === 'yellow' || color === 'amber') return 'locked';
  if (color === 'red' || color === 'failed' || color === 'error') return 'failed';
  if (color === 'blue') return 'active';
  return 'awaiting';
}

function toneForStatus(statusText, color) {
  const status = String(statusText || '').toLowerCase();
  if (/fail|error/.test(status)) return 'failed';
  if (/contracts? received|contract ready/.test(status)) return 'settled';
  if (/complete|settled|received$|swap complete/.test(status)) return 'settled';
  if (/connected|handshake ok/.test(status)) return 'active';
  if (/confirm|contract|key|lock|sweep|mempool|final|exchange/.test(status)) {
    return 'locked';
  }
  return normalizeTone(color);
}

function toneRank(tone) {
  if (tone === 'failed') return 5;
  if (tone === 'settled') return 4;
  if (tone === 'locked') return 3;
  if (tone === 'active') return 2;
  return 1;
}

function phaseForStatus(statusText, tone) {
  const status = String(statusText || '').toLowerCase();
  if (tone === 'failed') return { step: 3, title: 'Swap Failed', phase: 'failed' };
  if (/contracts? received|contract ready|contract/.test(status)) {
    return { step: 2, title: 'Contract Establishment', phase: 'contract' };
  }
  if (tone === 'settled' || /complete|settled|received|swept/.test(status)) {
    return { step: 3, title: 'Settlement', phase: 'settlement' };
  }
  if (tone === 'locked' || /lock|contract|confirm|sweep|final|exchange|mempool|key|ready/.test(status)) {
    return { step: 2, title: 'Contract Establishment', phase: 'contract' };
  }
  if (tone === 'active' || /connect|handshake|negotiat|offer|initial|fetch/.test(status)) {
    return { step: 1, title: 'Handshake', phase: 'handshake' };
  }
  return null;
}

function phaseRank(phase) {
  if (phase === 'failed') return 4;
  if (phase === 'settlement') return 3;
  if (phase === 'contract') return 2;
  if (phase === 'handshake') return 1;
  return 0;
}

function nodeXY(angle, cx, cy, radius) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}

function routeArcPath(startAngle, endAngle, cx, cy, radius) {
  const start = nodeXY(startAngle, cx, cy, radius);
  const end = nodeXY(endAngle, cx, cy, radius);
  const delta = ((endAngle - startAngle) % 360 + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function positionStyle(point, width, height) {
  return `--node-x:${(point.x / width) * 100}%; --node-y:${(point.y / height) * 100}%;`;
}

function buildMakerNode(index, angle, cx, cy, radius, address, width, height) {
  const { x, y } = nodeXY(angle, cx, cy, radius);
  const displayAddress = address ? compactEndpoint(address) : 'Pending connection';
  const pendingClass = address ? '' : ' is-pending';

  return `
    <article
      id="maker-${index}"
      class="route-node maker awaiting"
      data-angle="${angle}"
      style="${positionStyle({ x, y }, width, height)}"
    >
      <div class="route-icon">${icons.globe(22)}</div>
      <span>Maker</span>
      <h3>Maker ${String(index + 1).padStart(2, '0')}</h3>
      <p class="route-address${pendingClass}" title="${escapeHtml(address || '')}">${escapeHtml(displayAddress)}</p>
      <b class="route-status">Awaiting</b>
    </article>
  `;
}

export function createSwapProgressAnimation(stage, options = {}) {
  const makerCount = Math.max(1, Number(options.makers || 1));
  const amount = Number(options.amount || 0);
  const hops = Number(options.hops || makerCount + 1);
  const fee = Number(options.fee || 0);
  const receiveAmount = Number(options.receiveAmount || Math.max(0, amount - fee));
  const makerAddresses = Array.isArray(options.makerAddresses)
    ? options.makerAddresses
    : [];

  const width = 960;
  const height = 560;
  const cx = width / 2;
  const cy = 278;
  const radius = makerCount <= 3 ? 190 : 206;
  const wallet = nodeXY(0, cx, cy, radius);
  const makerAngles = Array.from(
    { length: makerCount },
    (_, i) => ((i + 1) * 360) / (makerCount + 1)
  );
  const totalNodes = makerCount + 1;
  const nodeGapDegrees = (Math.asin(58 / radius) * 180) / Math.PI;
  const routeAngles = [0, ...makerAngles, 360];
  const routeSegments = Array.from({ length: totalNodes }, (_, index) => {
    const startAngle = routeAngles[index] + nodeGapDegrees;
    const endAngle = routeAngles[index + 1] - nodeGapDegrees;
    return routeArcPath(startAngle, endAngle, cx, cy, radius);
  });
  const routeSegmentsMarkup = routeSegments
    .map(
      (path, index) => `
        <path class="route-segment base" d="${path}" />
        <path id="route-line-${index}" class="route-segment active" d="${path}" pathLength="1" />
      `
    )
    .join('');

  const makersMarkup = makerAngles
    .map((angle, index) =>
      buildMakerNode(index, angle, cx, cy, radius, makerAddresses[index], width, height)
    )
    .join('');

  stage.innerHTML = `
    <div class="swap-animation">
      <svg class="swap-animation-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <defs>
          <radialGradient id="swapPacketGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.9" />
            <stop offset="48%" stop-color="currentColor" stop-opacity="0.45" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle class="swap-route-ring outer" cx="${cx}" cy="${cy}" r="${radius + 26}" />
        ${routeSegmentsMarkup}
        <circle class="swap-packet-glow" cx="${wallet.x}" cy="${wallet.y}" r="38" />
        <circle class="swap-packet" cx="${wallet.x}" cy="${wallet.y}" r="10" />
      </svg>

      <article id="you-send" class="route-node taker awaiting" style="${positionStyle(wallet, width, height)}">
        <div class="route-icon">${icons.save(22)}</div>
        <span>Taker</span>
        <h3>Your wallet</h3>
        <p>Origin · Receiver</p>
        <b class="route-status">Awaiting</b>
      </article>

      ${makersMarkup}
      <div class="swap-center-copy">
        <strong id="swap-animation-phase">Handshake</strong>
        <span id="swap-animation-caption">Establishing Tor connections with makers</span>
      </div>

      <div class="swap-animation-complete" hidden>
        <i>${icons.check(28)}</i>
        <span>Received ${formatSats(receiveAmount || 0)}</span>
      </div>
    </div>
  `;

  const activeSegments = Array.from(stage.querySelectorAll('.route-segment.active'));
  const packet = stage.querySelector('.swap-packet');
  const packetGlow = stage.querySelector('.swap-packet-glow');
  const phaseEl = stage.querySelector('#swap-animation-phase');
  const captionEl = stage.querySelector('#swap-animation-caption');
  const completeEl = stage.querySelector('.swap-animation-complete');
  const state = {
    phase: 'handshake',
    phaseRank: 1,
    progress: 0,
    failed: false,
    nodeRanks: new Map(),
  };

  function setNodeState(node, label, tone, key = node?.id) {
    if (!node) return;
    const nextRank = toneRank(tone);
    const currentRank = state.nodeRanks.get(key) || 0;
    if (nextRank < currentRank) return;
    state.nodeRanks.set(key, nextRank);

    node.classList.remove('awaiting', 'active', 'connecting', 'locked', 'connected', 'failed');
    if (tone === 'settled') node.classList.add('connected');
    else if (tone === 'locked') node.classList.add('locked', 'connecting');
    else if (tone === 'active') node.classList.add('active', 'connecting');
    else if (tone === 'failed') node.classList.add('failed');
    else node.classList.add('awaiting');

    const badge = node.querySelector('.route-status');
    if (badge) badge.textContent = label || 'Awaiting';
  }

  function updatePhase(next) {
    if (!next || state.failed) return;
    const nextRank = phaseRank(next.phase);
    if (nextRank < state.phaseRank) return;
    state.phaseRank = nextRank;
    state.phase = next.phase;
    stage.querySelector('.swap-animation')?.setAttribute('data-phase', next.phase);
    if (phaseEl) phaseEl.textContent = next.title;
    if (captionEl) {
      captionEl.textContent =
        next.phase === 'settlement'
          ? 'Routing the settlement packet back to your wallet'
          : next.phase === 'contract'
            ? 'Locking contracts and exchanging swap data'
            : 'Establishing Tor connections with makers';
    }
  }

  function updateProgress(progress) {
    state.progress = Math.max(state.progress, Math.min(1, Math.max(0, progress)));
    const segmentProgress = state.progress * totalNodes;
    activeSegments.forEach((segment, index) => {
      const visible = Math.min(1, Math.max(0, segmentProgress - index));
      segment.style.strokeDasharray = `${visible} 1`;
    });

    const travelIndex = Math.min(makerCount, Math.round(state.progress * makerCount));
    const angle = travelIndex >= makerCount ? 360 : makerAngles[travelIndex] || 0;
    const point = nodeXY(angle, cx, cy, radius);
    if (packet) {
      packet.setAttribute('cx', point.x);
      packet.setAttribute('cy', point.y);
    }
    if (packetGlow) {
      packetGlow.setAttribute('cx', point.x);
      packetGlow.setAttribute('cy', point.y);
    }
  }

  function setRouteLine(index, active) {
    const line = stage.querySelector(`#route-line-${index}`);
    if (line) line.classList.toggle('is-active', Boolean(active));
  }

  return {
    setMakerAddress(index, address) {
      const node = stage.querySelector(`#maker-${index}`);
      const addressEl = node?.querySelector('.route-address');
      if (!addressEl || !address) return;
      addressEl.textContent = compactEndpoint(address);
      addressEl.title = address;
      addressEl.classList.remove('is-pending');
    },

    setMakerVisible(index, visible) {
      const node = stage.querySelector(`#maker-${index}`);
      if (node) node.classList.toggle('is-muted', !visible);
    },

    setMakerStatus(index, statusText, color) {
      const tone = toneForStatus(statusText, color);
      const node = stage.querySelector(`#maker-${index}`);
      setNodeState(node, statusText, tone, `maker-${index}`);
      updatePhase(phaseForStatus(statusText, tone));

      if (tone !== 'awaiting') {
        for (let i = 0; i <= index; i += 1) setRouteLine(i, true);
        updateProgress((index + 1) / Math.max(1, makerCount));
      }
    },

    setWalletActive(active) {
      const tone = active ? 'active' : 'awaiting';
      setNodeState(stage.querySelector('#you-send'), active ? 'Connected' : 'Awaiting', tone, 'wallet');
      updateProgress(active ? 0.05 : 0);
    },

    setReceiverActive(active) {
      const tone = active ? 'settled' : 'awaiting';
      setNodeState(stage.querySelector('#you-send'), active ? 'Received' : 'Awaiting', tone, 'wallet');
      if (active) {
        updatePhase({ title: 'Settlement', phase: 'settlement' });
        updateProgress(1);
      }
    },

    setStats({ amount: nextAmount, fee: nextFee, receiveAmount: nextReceiveAmount } = {}) {
      const completeText = completeEl?.querySelector('span');
      if (!completeText) return;
      const value =
        Number.isFinite(Number(nextReceiveAmount))
          ? Number(nextReceiveAmount)
          : Math.max(0, Number(nextAmount ?? amount) - Number(nextFee ?? fee));
      completeText.textContent = `Received ${formatSats(value)}`;
    },

    setComplete() {
      state.failed = false;
      updatePhase({ title: 'Settlement', phase: 'settlement' });
      stage.querySelectorAll('.route-node.maker').forEach((node, index) => {
        setNodeState(node, 'Complete', 'settled', `maker-${index}`);
      });
      setNodeState(stage.querySelector('#you-send'), 'Received', 'settled', 'wallet');
      for (let i = 0; i < makerCount; i += 1) setRouteLine(i, true);
      updateProgress(1);
      if (completeEl) completeEl.hidden = false;
    },

    setFailed() {
      state.failed = true;
      state.phaseRank = phaseRank('failed');
      stage.querySelector('.swap-animation')?.setAttribute('data-phase', 'failed');
      if (phaseEl) phaseEl.textContent = 'Swap Failed';
      if (captionEl) captionEl.textContent = 'Recovery has started automatically';
      stage.querySelectorAll('.route-node.maker').forEach((node, index) => {
        setNodeState(node, 'Failed', 'failed', `maker-${index}`);
      });
    },

    destroy() {
      stage.innerHTML = '';
    },
  };
}
