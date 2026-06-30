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

function endpointSuffix(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const host = text
    .replace(/^https?:\/\//i, '')
    .replace(/^tcp:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/\.onion$/i, '');
  if (host.length <= 14) return host;
  return `${host.slice(0, 8)}…${host.slice(-8)}`;
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
  if (/contracts? received|contract ready|contract|broadcast|mempool|confirm/.test(status)) {
    return { step: 2, title: 'Contracting', phase: 'contracting' };
  }
  if (tone === 'settled' || /complete|settled|received|swept/.test(status)) {
    return { step: 3, title: 'Settling', phase: 'settling' };
  }
  if (/key|final|exchange|sweep|receiving/.test(status)) {
    return { step: 3, title: 'Settling', phase: 'settling' };
  }
  if (tone === 'locked' || /lock|contract|confirm|mempool|ready/.test(status)) {
    return { step: 2, title: 'Contracting', phase: 'contracting' };
  }
  if (tone === 'active' || /connect|handshake|negotiat|offer|initial|fetch/.test(status)) {
    return { step: 1, title: 'Handshaking', phase: 'handshaking' };
  }
  return null;
}

function phaseRank(phase) {
  if (phase === 'failed') return 5;
  if (phase === 'complete') return 4;
  if (phase === 'settlement' || phase === 'settling') return 3;
  if (phase === 'contract' || phase === 'contracting') return 2;
  if (phase === 'handshake' || phase === 'handshaking') return 1;
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
  const displayAddress = address ? endpointSuffix(address) : 'Pending';
  const pendingClass = address ? '' : ' is-pending';

  return `
    <article
      id="maker-${index}"
      class="route-node maker awaiting"
      data-angle="${angle}"
      style="${positionStyle({ x, y }, width, height)}"
    >
      <div class="route-icon">${icons.globe(22)}</div>
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
  const nodeGapDegrees = (Math.asin(44 / radius) * 180) / Math.PI;
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
        <b class="route-status">Awaiting</b>
      </article>

      ${makersMarkup}
      <div class="swap-center-copy">
        <strong id="swap-animation-phase">Handshaking</strong>
      </div>

    </div>
  `;

  const activeSegments = Array.from(stage.querySelectorAll('.route-segment.active'));
  const packet = stage.querySelector('.swap-packet');
  const packetGlow = stage.querySelector('.swap-packet-glow');
  const phaseEl = stage.querySelector('#swap-animation-phase');
  const state = {
    phase: 'handshaking',
    phaseRank: 1,
    progress: 0,
    failed: false,
    nodeRanks: new Map(),
    verifiedMakers: new Set(),
    confirmedFundingHops: new Set(),
    completedHandovers: new Set(),
  };

  stage.querySelector('.swap-animation')?.setAttribute('data-phase', 'handshaking');
  stage.querySelector('.swap-animation')?.classList.add('is-blinking');

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
    if (next.phase !== 'handshaking') {
      stage.querySelector('.swap-animation')?.classList.remove('is-blinking');
    }
    if (phaseEl) phaseEl.textContent = next.title;
  }

  function updateProgress(progress) {
    state.progress = Math.max(state.progress, Math.min(1, Math.max(0, progress)));
    const segmentProgress = state.progress * totalNodes;
    activeSegments.forEach((segment, index) => {
      const visible = Math.min(1, Math.max(0, segmentProgress - index));
      segment.style.strokeDasharray = `${visible} 1`;
    });

    const travelIndex = Math.min(totalNodes, Math.round(segmentProgress));
    const angle = routeAngles[travelIndex] ?? 360;
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

  function setRouteSegmentClass(index, className, active = true) {
    const line = stage.querySelector(`#route-line-${index}`);
    if (!line) return;
    line.classList.toggle(className, Boolean(active));
    if (active) line.style.strokeDasharray = '1 0';
  }

  function setCenterCompleteButton() {
    const center = stage.querySelector('.swap-center-copy');
    if (!center) return;
    center.innerHTML = `
      <button id="swap-complete-report-btn" type="button">
        Swap Complete
      </button>
    `;
    center
      .querySelector('#swap-complete-report-btn')
      ?.addEventListener('click', () => {
        if (typeof options.onOpenReport === 'function') options.onOpenReport();
      });
  }

  return {
    setMakerAddress(index, address) {
      const node = stage.querySelector(`#maker-${index}`);
      const addressEl = node?.querySelector('.route-address');
      if (!addressEl || !address) return;
      addressEl.textContent = endpointSuffix(address);
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

      const normalizedStatus = String(statusText || '').toLowerCase();
      if (/offer|handshake|connected|negotiat|initial|fetch/.test(normalizedStatus)) {
        this.setMakerVerified(index);
      }
      if (/contract|broadcast|mempool|confirm|lock/.test(normalizedStatus)) {
        this.startContracting();
        if (/confirm|ready|received/.test(normalizedStatus)) {
          this.setFundingHopConfirmed(index);
        } else {
          this.setFundingHopPending(index);
        }
      }
      if (/key|exchange|final|receiv|sweep|complete/.test(normalizedStatus)) {
        this.startSettling();
        this.setMakerHandoverPending(index);
        if (/received|forwarded|complete/.test(normalizedStatus)) {
          this.setMakerHandoverComplete(index);
        }
      }

      if (tone !== 'awaiting') {
        const activeThrough = index === makerCount - 1 ? totalNodes - 1 : index;
        for (let i = 0; i <= activeThrough; i += 1) setRouteLine(i, true);
        updateProgress(index === makerCount - 1 ? 1 : (index + 1) / totalNodes);
      }
    },

    setWalletActive(active) {
      const tone = active ? 'active' : 'awaiting';
      setNodeState(stage.querySelector('#you-send'), active ? 'Connected' : 'Awaiting', tone, 'wallet');
      if (active && state.phase === 'handshaking') this.setHandshakeBlinking(true);
      updateProgress(active ? 0.05 : 0);
    },

    setReceiverActive(active) {
      const tone = active ? 'settled' : 'awaiting';
      setNodeState(stage.querySelector('#you-send'), active ? 'Received' : 'Awaiting', tone, 'wallet');
      if (active) {
        updatePhase({ title: 'Settling', phase: 'settling' });
        updateProgress(1);
      }
    },

    setHandshakeBlinking(active) {
      updatePhase({ title: 'Handshaking', phase: 'handshaking' });
      stage.querySelector('.swap-animation')?.classList.toggle('is-blinking', Boolean(active));
    },

    setMakerVerified(index) {
      state.verifiedMakers.add(index);
      const node = stage.querySelector(`#maker-${index}`);
      if (!node) return;
      node.classList.add('verified');
      node.classList.remove('is-muted');
      const badge = node.querySelector('.route-status');
      if (badge) badge.textContent = 'Verified';
    },

    setOffersDownloaded() {
      this.setHandshakeBlinking(false);
    },

    startContracting() {
      updatePhase({ title: 'Contracting', phase: 'contracting' });
    },

    setFundingHopPending(index) {
      this.startContracting();
      setRouteSegmentClass(index, 'funding-pending', true);
    },

    setFundingHopConfirmed(index) {
      this.startContracting();
      state.confirmedFundingHops.add(index);
      setRouteSegmentClass(index, 'funding-pending', false);
      setRouteSegmentClass(index, 'funding-confirmed', true);
      setRouteLine(index, true);
    },

    startSettling() {
      updatePhase({ title: 'Settling', phase: 'settling' });
    },

    setMakerHandoverPending(index) {
      this.startSettling();
      setRouteSegmentClass(index, 'funding-pending', false);
      setRouteSegmentClass(index, 'funding-confirmed', false);
      setRouteSegmentClass(index, 'handover-pending', true);
      const node = stage.querySelector(`#maker-${index}`);
      if (!node || state.completedHandovers.has(index)) return;
      node.classList.remove('locked', 'active');
      node.classList.add('handover-pending');
    },

    setMakerHandoverComplete(index) {
      this.startSettling();
      state.completedHandovers.add(index);
      setRouteSegmentClass(index, 'funding-pending', false);
      setRouteSegmentClass(index, 'funding-confirmed', false);
      setRouteSegmentClass(index, 'handover-pending', false);
      setRouteSegmentClass(index, 'handover-confirmed', true);
      const node = stage.querySelector(`#maker-${index}`);
      if (!node) return;
      node.classList.remove('locked', 'active', 'handover-pending');
      node.classList.add('handover-complete');
    },

    setAllHandoversComplete() {
      this.startSettling();
      stage.querySelector('.swap-animation')?.classList.add('is-handover-complete');
    },

    setSweepConfirmed() {
      stage.querySelector('.swap-animation')?.classList.remove('is-handover-complete');
      stage.querySelector('.swap-animation')?.classList.add('is-sweep-confirmed');
      updatePhase({ title: 'Swap Complete', phase: 'complete' });
      activeSegments.forEach((segment) => {
        segment.classList.remove('funding-pending', 'funding-confirmed', 'handover-pending');
        segment.classList.add('handover-confirmed');
        segment.style.strokeDasharray = '1 0';
      });
    },

    setStats({ amount: nextAmount, fee: nextFee, receiveAmount: nextReceiveAmount } = {}) {
      const value =
        Number.isFinite(Number(nextReceiveAmount))
          ? Number(nextReceiveAmount)
          : Math.max(0, Number(nextAmount ?? amount) - Number(nextFee ?? fee));
      return formatSats(value);
    },

    setComplete() {
      state.failed = false;
      updatePhase({ title: 'Settling', phase: 'settling' });
      updatePhase({ title: 'Swap Complete', phase: 'complete' });
      stage.querySelectorAll('.route-node.maker').forEach((node, index) => {
        setNodeState(node, 'Complete', 'settled', `maker-${index}`);
        node.classList.remove('handover-pending');
        node.classList.add('handover-complete');
      });
      setNodeState(stage.querySelector('#you-send'), 'Received', 'settled', 'wallet');
      this.setSweepConfirmed();
      for (let i = 0; i < totalNodes; i += 1) setRouteLine(i, true);
      updateProgress(1);
      setCenterCompleteButton();
    },

    setFailed() {
      state.failed = true;
      state.phaseRank = phaseRank('failed');
      const animation = stage.querySelector('.swap-animation');
      animation?.setAttribute('data-phase', 'failed');
      animation?.classList.remove('is-blinking', 'is-handover-complete', 'is-sweep-confirmed');
      if (phaseEl) phaseEl.textContent = 'Swap Failed';
      stage.querySelectorAll('.route-node.maker').forEach((node, index) => {
        setNodeState(node, 'Failed', 'failed', `maker-${index}`);
      });
    },

    destroy() {
      stage.innerHTML = '';
    },
  };
}
