import { icons } from '../../js/icons.js';

export function FirstTimeSetupModal(container, onComplete) {
  const defaultWalletName = `taker-wallet-${Math.floor(100000 + Math.random() * 900000)}`;
  const iconClass = 'w-5 h-5 flex-shrink-0';
  const iconWarning = `
    <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86l-7.55 13.09A1 1 0 003.61 18h16.78a1 1 0 00.87-1.5L13.71 3.86a1 1 0 00-1.74 0z"/>
    </svg>
  `;
  const iconInfo = `
    <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  `;
  const iconShield = `
    <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l7 4v5c0 5-3.5 7.74-7 9-3.5-1.26-7-4-7-9V7l7-4z"/>
    </svg>
  `;
  const modal = document.createElement('div');
  modal.id = 'setup-modal';
  modal.className = 'setup-modal-root';

  let currentStep = 1;
  const totalSteps = 2;
  let walletAction = null; // 'create', 'load', or 'restore'
  let walletData = {};
  const connectionPassed = { node: false, tor: false };
  let protocolVersion = 'v2'; // Fixed app-local default until the rest of the flow stops expecting v1/v2.

  modal.innerHTML = `
    <style>
      #setup-modal {
        --setup-bg: #08080a;
        --setup-border: rgba(255,255,255,0.08);
        --setup-border-strong: rgba(255,255,255,0.14);
        --setup-text: #f5f5f7;
        --setup-text-2: #a7a7ad;
        --setup-text-3: #6c6c72;
        --setup-primary: #518def;
        --setup-primary-hover: #6fa2ff;
        --setup-green: #2fbf71;
        --setup-red: #ff4d5a;
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--setup-bg);
        color: var(--setup-text);
        padding: 24px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      #setup-modal * { box-sizing: border-box; }
      #setup-modal .setup-ambient { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
      #setup-modal .setup-glow-1 { position: absolute; left: 50%; top: -30%; transform: translateX(-50%); width: 1100px; height: 900px; border-radius: 50%; background: radial-gradient(closest-side, rgba(81,141,239,0.28), rgba(81,141,239,0.05) 50%, transparent 70%); filter: blur(50px); }
      #setup-modal .setup-glow-2 { position: absolute; left: -10%; bottom: -20%; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(closest-side, rgba(111,162,255,0.12), transparent 70%); filter: blur(60px); }
      #setup-modal .setup-glow-3 { position: absolute; right: -10%; top: 30%; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(closest-side, rgba(81,141,239,0.10), transparent 70%); filter: blur(60px); }
      #setup-modal .setup-grain { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.05; mix-blend-mode: overlay; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
      #setup-modal .setup-shell { position: relative; z-index: 2; width: min(1080px, 100%); max-height: 92vh; overflow-y: auto; border-radius: 32px; background: #101014; border: 1px solid var(--setup-border); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 120px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02); }
      #setup-modal .setup-titlebar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--setup-border); position: relative; }
      #setup-modal .setup-traffic { display: flex; gap: 8px; align-items: center; }
      #setup-modal .setup-traffic span { width: 11px; height: 11px; border-radius: 50%; background: rgba(255,255,255,0.10); display: block; }
      #setup-modal .setup-traffic span:first-child { background: #ff5f57; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }
      #setup-modal .setup-titlebar-name { font-size: 12px; color: var(--setup-text-3); font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase; position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); }
      #setup-modal .setup-titlebar-right { font-size: 11px; color: var(--setup-text-3); font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
      #setup-modal .setup-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--setup-primary); box-shadow: 0 0 10px var(--setup-primary); }
      #setup-modal .setup-content { padding: 48px 52px 44px; position: relative; }
      #setup-modal .setup-header { display: flex; flex-direction: column; align-items: flex-start; text-align: left; margin-bottom: 36px; }
      #setup-modal .setup-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 5px 11px 5px 8px; border: 1px solid var(--setup-border); border-radius: 999px; background: rgba(255,255,255,0.02); font-size: 10.5px; color: var(--setup-text-2); font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 18px; }
      #setup-modal .setup-pip { width: 5px; height: 5px; border-radius: 50%; background: var(--setup-primary); box-shadow: 0 0 0 3px rgba(81,141,239,0.18), 0 0 10px var(--setup-primary); }
      #setup-modal .setup-title { font-size: clamp(32px, 4.4vw, 52px); font-weight: 700; letter-spacing: -0.035em; line-height: 1; margin: 0 0 14px; }
      #setup-modal .setup-title .accent { color: var(--setup-primary); font-style: italic; font-weight: 600; }
      #setup-modal .setup-subtitle { color: var(--setup-text-2); font-size: 15px; line-height: 1.55; max-width: 560px; margin: 0; }
      #setup-modal .setup-stepper { display: flex; align-items: center; justify-content: flex-start; gap: 10px; margin: 28px 0 0; font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: var(--setup-text-3); letter-spacing: 0.1em; text-transform: uppercase; width: 100%; }
      #setup-modal .setup-bar { width: 160px; height: 3px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; position: relative; }
      #setup-modal #progress-fill { display: block; width: 50%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--setup-primary), var(--setup-primary-hover)); transition: width 0.4s cubic-bezier(.2,.8,.2,1); box-shadow: 0 0 12px rgba(81,141,239,0.6); }
      #setup-modal .setup-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 34px; align-items: stretch; }
      #setup-modal .setup-card { position: relative; border-radius: 20px; padding: 22px; background: #16161a; border: 1px solid var(--setup-border); transition: border-color 0.4s, transform 0.4s; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
      #setup-modal .setup-card:hover { transform: translateY(-2px); border-color: var(--setup-border-strong); }
      #setup-modal .setup-card.is-success { border-color: rgba(47,191,113,0.4); }
      #setup-modal .setup-card.is-fail { border-color: rgba(255,77,90,0.45); }
      #setup-modal .setup-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      #setup-modal .setup-num { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0; background: linear-gradient(160deg, rgba(111,162,255,0.9), var(--setup-primary) 60%, #275fb8); box-shadow: 0 6px 16px -4px rgba(81,141,239,0.6), inset 0 1px 0 rgba(255,255,255,0.35); }
      #setup-modal .setup-kicker { font-size: 10px; color: var(--setup-primary); font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; letter-spacing: 0.14em; text-transform: uppercase; display: block; margin-bottom: 2px; }
      #setup-modal .setup-card h3 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.015em; }
      #setup-modal .setup-desc { color: var(--setup-text-2); font-size: 13px; line-height: 1.55; min-height: 62px; margin: 0 0 14px; }
      #setup-modal .setup-spec-area { min-height: 64px; margin-bottom: 18px; display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; }
      #setup-modal .setup-specs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 10.5px; }
      #setup-modal .setup-spec-area .setup-specs { margin-bottom: 0; }
      #setup-modal .setup-specs.nowrap { flex-wrap: nowrap; }
      #setup-modal .setup-spec { display: inline-flex; align-items: center; gap: 4px; min-height: 29px; padding: 5px 9px; border-radius: 7px; background: rgba(255,255,255,0.04); border: 1px solid var(--setup-border); color: var(--setup-text-2); }
      #setup-modal .setup-spec label { color: var(--setup-text-2); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
      #setup-modal .setup-spec label::after { content: ":"; }
      #setup-modal .setup-spec input { width: var(--input-width, 58px); border: 0; outline: 0; background: transparent; color: var(--setup-text); font: 500 10.5px ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; min-width: 0; }
      #setup-modal .setup-spec input[type="password"] { width: var(--input-width, 84px); }
      #setup-modal .setup-spec input[type="number"] { appearance: textfield; -moz-appearance: textfield; }
      #setup-modal .setup-spec input::-webkit-outer-spin-button, #setup-modal .setup-spec input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      #setup-modal .setup-eye { color: var(--setup-text-3); background: transparent; border: 0; padding: 0; cursor: pointer; display: flex; align-items: center; }
      #setup-modal .setup-eye:hover { color: var(--setup-text); }
      #setup-modal .setup-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; height: 46px; border-radius: 12px; border: 0; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 600; color: #fff; background: var(--setup-primary); transition: background 0.2s, transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
      #setup-modal .setup-btn:hover { background: #6fa2ff; transform: translateY(-2px); box-shadow: 0 10px 24px -12px rgba(81,141,239,0.9), 0 0 0 1px rgba(255,255,255,0.08) inset; }
      #setup-modal .setup-btn.is-success { background: var(--setup-green); box-shadow: 0 10px 24px -14px rgba(47,191,113,0.85); }
      #setup-modal .setup-btn.is-success:hover { background: #37ce7d; box-shadow: 0 12px 28px -14px rgba(47,191,113,0.95), 0 0 0 1px rgba(255,255,255,0.08) inset; }
      #setup-modal .setup-btn.secondary { background: rgba(255,255,255,0.05); color: var(--setup-text); border: 1px solid var(--setup-border-strong); }
      #setup-modal .setup-btn.secondary:hover { background: rgba(255,255,255,0.08); }
      #setup-modal .setup-btn[disabled] { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
      #setup-modal .setup-status { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
      #setup-modal .setup-status-row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 9px; background: rgba(255,255,255,0.03); border: 1px solid var(--setup-border); font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 10.5px; }
      #setup-modal .setup-status-row .label { color: var(--setup-text); letter-spacing: 0.05em; min-width: 54px; }
      #setup-modal .setup-status-row .msg { margin-left: auto; color: var(--setup-text-3); text-align: right; overflow-wrap: anywhere; }
      #setup-modal .setup-status-row.ok .indicator { background: rgba(47,191,113,0.15); color: var(--setup-green); }
      #setup-modal .setup-status-row.ok .msg { color: var(--setup-green); }
      #setup-modal .setup-status-row.err .indicator { background: rgba(255,77,90,0.15); color: var(--setup-red); }
      #setup-modal .setup-status-row.err .msg { color: var(--setup-red); }
      #setup-modal .indicator { width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      #setup-modal .setup-info { margin-top: 12px; border-radius: 10px; padding: 12px; font-size: 12px; line-height: 1.45; }
      #setup-modal .setup-info a { color: var(--setup-primary); text-decoration: none; border-bottom: 1px solid rgba(81,141,239,0.4); }
      #setup-modal .setup-footer { margin-top: 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 22px; border-top: 1px solid var(--setup-border); }
      #setup-modal .setup-help { color: var(--setup-text-3); font-size: 12.5px; display: flex; align-items: center; gap: 8px; }
      #setup-modal .setup-help a { color: var(--setup-primary); text-decoration: none; font-weight: 500; border-bottom: 1px solid rgba(81,141,239,0.4); padding-bottom: 1px; }
      #setup-modal .setup-footer-actions { display: flex; gap: 12px; margin-left: auto; }
      #setup-modal .setup-footer-actions .setup-btn { width: auto; min-width: 130px; padding: 0 22px; }
      #setup-modal .setup-footer-actions .setup-btn[disabled]:hover { background: var(--setup-primary); transform: none; }
      #setup-modal .setup-wallet-panel { padding: 0; }
      #setup-modal .hidden { display: none !important; }
      @media (max-width: 760px) {
        #setup-modal { padding: 16px; overflow-y: auto; align-items: flex-start; }
        #setup-modal .setup-content { padding: 32px 24px; }
        #setup-modal .setup-cards { grid-template-columns: 1fr; }
        #setup-modal .setup-titlebar-name { display: none; }
      }
    </style>

    <div class="setup-ambient">
      <div class="setup-glow-1"></div>
      <div class="setup-glow-2"></div>
      <div class="setup-glow-3"></div>
    </div>
    <div class="setup-grain"></div>

    <div class="setup-shell">
      <div class="setup-titlebar">
        <div class="setup-traffic"><span></span><span></span><span></span></div>
        <div class="setup-titlebar-name">Coinswap · Taker</div>
        <div class="setup-titlebar-right"><span class="setup-dot"></span>Onboarding</div>
      </div>

      <!-- Content -->
      <div class="setup-content">
        <div class="setup-header">
          <div class="setup-eyebrow" id="setup-eyebrow"><span class="setup-pip"></span>Welcome · First-time setup</div>
          <h1 class="setup-title" id="setup-title">Let's get you <span class="accent">connected.</span></h1>
          <p class="setup-subtitle" id="setup-subtitle">Two quick checks — your Bitcoin node and a Tor proxy. After this, you're ready to swap privately.</p>

          <div class="setup-stepper">
            <span id="step-indicator">Step 1 of 2</span>
            <div class="setup-bar">
              <span id="progress-fill" style="width: 50%"></span>
            </div>
            <span id="step-pct">50%</span>
          </div>
        </div>

        <!-- Step 1: Bitcoin Endpoints -->
        <div id="step-1" class="setup-step">
          <section class="setup-cards">
            <article class="setup-card" id="card-node">
              <div class="setup-card-head">
                <div class="setup-num">1</div>
                <div>
                  <span class="setup-kicker">Bitcoin</span>
                  <h3>Test your node</h3>
                </div>
              </div>
              <p class="setup-desc">Checks RPC, REST, and ZMQ access to your local Bitcoin Core so your wallet and confirmations stay in sync without a third party.</p>
              <div class="setup-spec-area">
                <div class="setup-specs nowrap">
                  <div class="setup-spec">
                    <label for="setup-rpc-port">RPC</label>
                    <input type="number" id="setup-rpc-port" value="38332" min="1" max="65535" />
                  </div>
                  <div class="setup-spec">
                    <label for="setup-zmq-port">ZMQ</label>
                    <input type="number" id="setup-zmq-port" value="28332" min="1" max="65535" />
                  </div>
                </div>
                <div class="setup-specs nowrap">
                  <div class="setup-spec">
                    <label for="setup-rpc-username">USER</label>
                    <input type="text" id="setup-rpc-username" value="user" style="--input-width: 42px;" />
                  </div>
                  <div class="setup-spec">
                    <label for="setup-rpc-password">PASSWORD</label>
                    <input type="password" id="setup-rpc-password" value="password" style="--input-width: 72px;" />
                  </div>
                </div>
              </div>
              <input type="hidden" id="setup-rpc-host" value="127.0.0.1" />
              <button id="test-rpc-setup" class="setup-btn">
                <span>Test node connection</span>
                <svg class="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
              <div id="rpc-test-result" class="setup-status hidden"></div>
              <div id="node-setup-info" class="setup-info hidden bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                <strong>Info:</strong> Don't have a running Bitcoin Node?
                <a href="https://github.com/citadel-tech/coinswap/blob/master/docs/bitcoind.md" target="_blank" rel="noreferrer">Node setup instructions</a>
              </div>
            </article>

            <article class="setup-card" id="card-tor">
              <div class="setup-card-head">
                <div class="setup-num">2</div>
                <div>
                  <span class="setup-kicker">Network</span>
                  <h3>Test your Tor proxy</h3>
                </div>
              </div>
              <p class="setup-desc">Routes all swap traffic through Tor so your IP and coin history stay private. You can test this before or after the Bitcoin node.</p>
              <div class="setup-spec-area">
                <div class="setup-specs nowrap">
                  <div class="setup-spec">
                    <label for="setup-tor-socks-port">SOCKS</label>
                    <input type="number" id="setup-tor-socks-port" value="9050" min="1024" max="65535" />
                  </div>
                  <div class="setup-spec">
                    <label for="setup-tor-control-port">CTRL</label>
                    <input type="number" id="setup-tor-control-port" value="9051" min="1024" max="65535" />
                  </div>
                  <div class="setup-spec">
                    <label for="setup-tor-auth-password">PASSWORD</label>
                    <input type="password" id="setup-tor-auth-password" style="--input-width: 72px;" />
                  </div>
                </div>
              </div>
              <button id="test-tor-setup" class="setup-btn">
                <span>Test Tor connection</span>
                <svg class="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
              <div id="tor-test-result" class="setup-status hidden"></div>
              <div id="tor-setup-info" class="setup-info hidden bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <strong>Info:</strong> Don't have a running Tor instance?
                <a href="https://github.com/citadel-tech/coinswap/blob/master/docs/tor.md" target="_blank" rel="noreferrer">Tor setup instructions</a>
              </div>
            </article>
          </section>
        </div>

        <!-- Wallet Action Choice -->
        <div id="step-3a" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Choose A Wallet. Or Create a New One.</h3>
          </div>

          <div class="space-y-4">
            <!-- Choice Cards -->
            <div class="grid grid-cols-3 gap-4">
              <!-- Create New Wallet -->
              <div id="choice-create" class="wallet-choice bg-app-bg rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-primary transition-colors text-center">
                <div class="text-gray-400 mb-3 flex justify-center">${icons.plusCircle(40)}</div>
                <h4 class="text-white font-semibold text-lg mb-2">Create New</h4>
                <p class="text-xs text-gray-400">Start fresh with a new wallet</p>
              </div>

              <!-- Load Existing Wallet -->
              <div id="choice-load" class="wallet-choice bg-app-bg rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-primary transition-colors text-center">
                <div class="text-gray-400 mb-3 flex justify-center">${icons.folderOpen(40)}</div>
                <h4 class="text-white font-semibold text-lg mb-2">Load Existing</h4>
                <p class="text-xs text-gray-400">Load a wallet from file</p>
              </div>

              <!-- Restore Wallet -->
              <div id="choice-restore" class="wallet-choice bg-app-bg rounded-lg p-6 border-2 border-gray-700 cursor-pointer hover:border-primary transition-colors text-center">
                <div class="text-gray-400 mb-3 flex justify-center">${icons.recycle(40)}</div>
                <h4 class="text-white font-semibold text-lg mb-2">Restore</h4>
                <p class="text-xs text-gray-400">Restore from backup JSON</p>
              </div>
            </div>

            <div id="choice-message" class="hidden bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p class="text-xs text-blue-400 text-center">
                Please select an option above to continue
              </p>
            </div>
          </div>
        </div>

        <!-- Create New Wallet -->
         
        <div id="step-3b-create" class="setup-step hidden">
          <div class="space-y-4">
            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div class="flex items-start gap-3 text-xs text-yellow-400">
                ${iconWarning}
                <p>
                  <strong>Important:</strong> This password encrypts your wallet. If you forget it, you won't be able to access your funds. Make sure to store it safely!
                </p>
              </div>
            </div>

            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
              <div class="space-y-4">
                <!-- NEW: Wallet Name Input -->
                <div>
                  <label class="block text-sm text-gray-400 mb-2">Wallet Name</label>
                  <input
                    type="text"
                    id="create-wallet-name"
                    value="${defaultWalletName}"
                    placeholder="my-wallet"
                    class="w-full bg-surface border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                  <p class="text-xs text-gray-500 mt-1">Choose a unique name for your wallet</p>
                </div>

                <div>
  <label class="block text-sm text-gray-400 mb-2">Wallet Password <span class="text-red-400">*</span></label>
  <div class="relative">
    <input 
      type="password" 
      id="create-password"
      placeholder="Enter a strong password"
      class="w-full bg-surface border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-primary transition-colors"
    />
    <button
      type="button"
      id="toggle-create-password"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
</div>
<div>
  <label class="block text-sm text-gray-400 mb-2">Confirm Password <span class="text-red-400">*</span></label>
  <div class="relative">
    <input 
      type="password" 
      id="create-password-confirm"
      placeholder="Re-enter your password"
      class="w-full bg-surface border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-primary transition-colors"
    />
    <button
      type="button"
      id="toggle-create-password-confirm"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
</div>

              </div>
            </div>

            <div id="password-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p class="text-xs text-red-400"></p>
            </div>

            <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p class="text-xs text-green-400">
                <strong>✓ Password Tips:</strong>
              </p>
              <ul class="text-xs text-green-400 mt-2 space-y-1">
                <li>• Use at least 12 characters</li>
                <li>• Mix uppercase, lowercase, numbers, and symbols</li>
                <li>• Avoid common words or phrases</li>
                <li>• Store it in a password manager</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Load Existing Wallet -->
        <div id="step-3b-load" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Load Existing Wallet</h3>
            <p class="text-gray-400 text-sm">Browse for your wallet file and enter its password.</p>
          </div>

          <div class="space-y-4">
            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Wallet File</label>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  id="load-wallet-path"
                  placeholder="No file selected"
                  readonly
                  class="flex-1 bg-surface border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none"
                />
                <button 
                  id="browse-wallet-file"
                  class="bg-primary hover:bg-primary-hover text-white font-semibold text-lg py-2 px-6 rounded-lg transition-colors"
                >
                  Browse
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">Default location: ~/.coinswap/taker/wallets/</p>
            </div>

            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
  <label class="block text-sm text-gray-400 mb-2">Wallet Password <span class="text-red-400">*</span></label>
  <div class="relative">
    <input 
      type="password" 
      id="load-password"
      placeholder="Enter wallet password"
      class="w-full bg-surface border border-gray-600 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-primary transition-colors"
    />
    <button
      type="button"
      id="toggle-load-password"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
      aria-label="Toggle password visibility"
    >
      <svg class="eye-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      <svg class="eye-slash-icon w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>
    </button>
  </div>
  <p class="text-xs text-gray-500 mt-2">Required — all wallets must be password-protected</p>
</div>

            <div id="load-error" class="hidden bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p class="text-xs text-red-400"></p>
            </div>
          </div>
        </div>

        <!-- Restore from Backup -->
        <div id="step-3b-restore" class="setup-step hidden">
          <div class="mb-6">
            <h3 class="text-xl font-semibold text-lg text-white mb-2">Restore from Backup</h3>
            <p class="text-gray-400 text-sm">Select your backup JSON file and enter its password.</p>
          </div>

          <div class="space-y-4">
            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Wallet Name (for restored wallet)</label>
              <input 
                type="text" 
                id="restore-wallet-name"
                placeholder="my-restored-wallet"
                class="w-full bg-surface border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <p class="text-xs text-gray-500 mt-1">Choose a name for the restored wallet</p>
            </div>
            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Backup File (JSON)</label>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  id="restore-backup-path"
                  placeholder="No file selected"
                  readonly
                  class="flex-1 bg-surface border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none"
                />
                <button 
                  id="browse-backup-file"
                  class="bg-primary hover:bg-primary-hover text-white font-semibold text-lg py-2 px-6 rounded-lg transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>

            <div class="bg-app-bg rounded-lg p-4 border border-gray-700">
              <label class="block text-sm text-gray-400 mb-2">Wallet Password <span class="text-red-400">*</span></label>
              <input 
                type="password" 
                id="restore-password"
                placeholder="Enter backup password"
                class="w-full bg-surface border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div id="restore-status" class="hidden">
              <!-- Status will be shown here -->
            </div>

            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div class="flex items-start gap-3 text-xs text-purple-400">
                ${iconInfo}
                <p>
                  <strong>Note:</strong> Restoring will re-sync the wallet from wallet-birthday. This can take some time.
                </p>
              </div>
            </div>
          </div>
        </div>

      <!-- Footer -->
      <div class="setup-footer">
        <div class="setup-help">
          <svg class="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          Need help?
          <a href="https://github.com/citadel-tech/coinswap/tree/master/docs" target="_blank" rel="noreferrer">Setup guide</a>
        </div>
        <div class="setup-footer-actions">
        <button id="setup-back-btn" class="setup-btn secondary hidden">
          Back
        </button>
          <button id="setup-next-btn" class="setup-btn">
            Next
          </button>
        </div>
      </div>
    </div>
    </div>
  `;

  container.appendChild(modal);

  // ============================================================================
  // FUNCTIONS
  // ============================================================================

  function updateProgress() {
    const progressFill = modal.querySelector('#progress-fill');
    const stepIndicator = modal.querySelector('#step-indicator');
    const stepPct = modal.querySelector('#step-pct');
    const eyebrow = modal.querySelector('#setup-eyebrow');
    const title = modal.querySelector('#setup-title');
    const subtitle = modal.querySelector('#setup-subtitle');

    const progressPercent = (currentStep / totalSteps) * 100;
    progressFill.style.width = progressPercent + '%';
    stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
    if (stepPct) {
      stepPct.textContent = `${progressPercent}%`;
    }
    if (currentStep === 1) {
      if (eyebrow) eyebrow.innerHTML = '<span class="setup-pip"></span>Welcome · First-time setup';
      if (title) title.innerHTML = "Let's get you <span class=\"accent\">connected.</span>";
      if (subtitle) {
        subtitle.textContent =
          "Two quick checks — your Bitcoin node and a Tor proxy. After this, you're ready to swap privately.";
      }
    } else {
      if (eyebrow) eyebrow.innerHTML = '<span class="setup-pip"></span>Wallet · Final step';
      if (title) title.innerHTML = 'Choose your <span class="accent">wallet.</span>';
      if (subtitle) {
        subtitle.textContent =
          'Create a fresh wallet, load an existing one, or restore from backup to finish setup.';
      }
    }
  }

  function getRpcUrl(host, port) {
    return `http://${host}:${port}`;
  }

  function getRestUrl(host, port) {
    return `${getRpcUrl(host, port)}/rest/chaininfo.json`;
  }

  function getZmqAddress(port) {
    return `tcp://127.0.0.1:${port}`;
  }

  function renderConnectionResults(resultDiv, results) {
    const hasFailure = results.some((result) => !result.ok);
    resultDiv.className = 'setup-status';
    resultDiv.innerHTML = `
      ${results
        .map(
          (result) => `
            <div class="setup-status-row ${result.ok ? 'ok' : 'err'}">
              <div class="indicator">
                ${
                  result.ok
                    ? '<svg viewBox="0 0 24 24" style="width:10px;height:10px" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>'
                    : '<svg viewBox="0 0 24 24" style="width:10px;height:10px" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                }
              </div>
              <div class="label">${result.label}</div>
              <div class="msg">${result.message || ''}</div>
            </div>
          `
        )
        .join('')}
    `;
    resultDiv.classList.remove('hidden');
    const card = resultDiv.closest('.setup-card');
    if (card) {
      card.classList.remove('is-success', 'is-fail');
      card.classList.add(hasFailure ? 'is-fail' : 'is-success');
    }
  }

  function updateConnectionGate() {
    const nextBtn = modal.querySelector('#setup-next-btn');
    if (!nextBtn) return;

    if (currentStep === 1) {
      nextBtn.disabled = !(connectionPassed.node && connectionPassed.tor);
    } else if (currentStep === 2) {
      nextBtn.disabled = !hasWalletStepRequirements();
    } else {
      nextBtn.disabled = false;
    }
  }

  function hasWalletStepRequirements() {
    if (!walletAction) return false;

    if (walletAction === 'create') {
      const walletName = modal.querySelector('#create-wallet-name')?.value?.trim();
      const password = modal.querySelector('#create-password')?.value || '';
      const confirmPassword =
        modal.querySelector('#create-password-confirm')?.value || '';

      return Boolean(walletName && password && confirmPassword);
    }

    if (walletAction === 'load') {
      const walletPath = modal.querySelector('#load-wallet-path')?.value || '';
      const password = modal.querySelector('#load-password')?.value || '';

      return Boolean(walletPath && password);
    }

    if (walletAction === 'restore') {
      const backupPath = modal.querySelector('#restore-backup-path')?.value || '';
      const walletName =
        modal.querySelector('#restore-wallet-name')?.value?.trim() || '';
      const password = modal.querySelector('#restore-password')?.value || '';

      return Boolean(backupPath && walletName && password);
    }

    return false;
  }

  function resetConnectionCheck(which) {
    connectionPassed[which] = false;
    const card = modal.querySelector(`#card-${which}`);
    const btn = modal.querySelector(which === 'node' ? '#test-rpc-setup' : '#test-tor-setup');
    card?.classList.remove('is-success', 'is-fail');
    btn?.classList.remove('is-success');
    updateConnectionGate();
  }

  function syncFormData() {
    walletData.rpc = {
      host: modal.querySelector('#setup-rpc-host')?.value || '127.0.0.1',
      port: modal.querySelector('#setup-rpc-port')?.value || '38332',
      username: modal.querySelector('#setup-rpc-username')?.value || 'user',
      password: modal.querySelector('#setup-rpc-password')?.value || 'password',
      zmqPort: modal.querySelector('#setup-zmq-port')?.value || '28332',
    };

    walletData.create = {
      walletName:
        modal.querySelector('#create-wallet-name')?.value || defaultWalletName,
      password: modal.querySelector('#create-password')?.value || '',
      confirmPassword:
        modal.querySelector('#create-password-confirm')?.value || '',
    };

    walletData.load = {
      walletPath: modal.querySelector('#load-wallet-path')?.value || '',
      password: modal.querySelector('#load-password')?.value || '',
    };

    walletData.restore = {
      walletName: modal.querySelector('#restore-wallet-name')?.value || '',
      backupPath: modal.querySelector('#restore-backup-path')?.value || '',
      password: modal.querySelector('#restore-password')?.value || '',
    };

    walletData.tor = {
      controlPort: modal.querySelector('#setup-tor-control-port')?.value || '9051',
      socksPort: modal.querySelector('#setup-tor-socks-port')?.value || '9050',
      authPassword:
        modal.querySelector('#setup-tor-auth-password')?.value || '',
    };
  }

  function restoreFormData() {
    const rpcData = walletData.rpc || {};
    const createData = walletData.create || {};
    const loadData = walletData.load || {};
    const restoreData = walletData.restore || {};
    const torData = walletData.tor || {};

    const setValue = (selector, value) => {
      const input = modal.querySelector(selector);
      if (input && value !== undefined) {
        input.value = value;
      }
    };

    const setChecked = (selector, checked) => {
      const input = modal.querySelector(selector);
      if (input) {
        input.checked = Boolean(checked);
      }
    };

    setValue('#setup-rpc-host', rpcData.host);
    setValue('#setup-rpc-port', rpcData.port);
    setValue('#setup-rpc-username', rpcData.username);
    setValue('#setup-rpc-password', rpcData.password);
    setValue('#setup-zmq-port', rpcData.zmqPort);

    setValue('#create-wallet-name', createData.walletName || defaultWalletName);
    setValue('#create-password', createData.password);
    setValue('#create-password-confirm', createData.confirmPassword);

    setValue('#load-wallet-path', loadData.walletPath);
    setValue('#load-password', loadData.password);

    setValue('#restore-wallet-name', restoreData.walletName);
    setValue('#restore-backup-path', restoreData.backupPath);
    setValue('#restore-password', restoreData.password);

    setValue('#setup-tor-control-port', torData.controlPort);
    setValue('#setup-tor-socks-port', torData.socksPort);
    setValue('#setup-tor-auth-password', torData.authPassword);
  }

  function showStep(step) {
    syncFormData();

    // Hide all steps
    modal
      .querySelectorAll('.setup-step')
      .forEach((el) => el.classList.add('hidden'));

    if (step === 1) {
      modal.querySelector('#step-1')?.classList.remove('hidden');
    } else if (step === 2) {
      // Determine which wallet screen to show.
      let stepToShow = 'step-3a';
      if (!walletAction) {
        stepToShow = 'step-3a'; // Show choice screen
      } else if (walletAction === 'create') {
        stepToShow = 'step-3b-create';
      } else if (walletAction === 'load') {
        stepToShow = 'step-3b-load';
      } else if (walletAction === 'restore') {
        stepToShow = 'step-3b-restore';
      }

      const stepElement = modal.querySelector(`#${stepToShow}`);
      if (stepElement) {
        stepElement.classList.remove('hidden');
      }
    }

    restoreFormData();

    // Update buttons
    const backBtn = modal.querySelector('#setup-back-btn');
    const nextBtn = modal.querySelector('#setup-next-btn');

    if (step === 1) {
      backBtn.classList.add('hidden');
      nextBtn.textContent = 'Next';
    } else if (step === totalSteps) {
      backBtn.classList.remove('hidden');
      nextBtn.textContent = 'Complete Setup';
    } else {
      backBtn.classList.remove('hidden');
      nextBtn.textContent = 'Next';
    }

    updateProgress();
    updateConnectionGate();
  }

  async function validateWalletStep() {
    syncFormData();

    // If no wallet action selected, show message
    if (!walletAction) {
      showMessage('choice-message');
      return false;
    }

    // Validate the selected wallet action.
    if (walletAction === 'create') {
      const walletName =
        modal.querySelector('#create-wallet-name')?.value || defaultWalletName;
      const password = modal.querySelector('#create-password')?.value || '';
      const confirmPassword =
        modal.querySelector('#create-password-confirm')?.value || '';

      // Validate wallet name
      if (!walletName || walletName.trim() === '') {
        showError('password-error', 'Please enter a wallet name');
        return false;
      }

      if (!password) {
        showError('password-error', 'A password is required — unencrypted wallets are not permitted');
        return false;
      }

      if (password.length < 8) {
        showError('password-error', 'Password must be at least 8 characters');
        return false;
      }

      if (password !== confirmPassword) {
        showError('password-error', 'Passwords do not match');
        return false;
      }

      // Save wallet data (including wallet name)
      walletData.walletName = walletName.trim();
      walletData.password = password;
      walletData.create = {
        walletName: walletName.trim(),
        password,
        confirmPassword,
      };

      return true;
    }

    if (walletAction === 'load') {
      const walletPath = modal.querySelector('#load-wallet-path')?.value || '';
      const password = modal.querySelector('#load-password')?.value || '';

      if (!walletPath) {
        showError('load-error', 'Please select a wallet file');
        return false;
      }

      if (!password) {
        showError('load-error', 'A password is required — unencrypted wallets are not permitted');
        return false;
      }

      // Extract filename from path
      const walletFileName = walletPath.split('/').pop();
      walletData.walletFileName = walletFileName;
      walletData.password = password;
      walletData.load = {
        walletPath,
        password,
      };

      return true;
    }

    if (walletAction === 'restore') {
      const backupPath =
        modal.querySelector('#restore-backup-path')?.value || '';
      const password = modal.querySelector('#restore-password')?.value || '';
      const walletName =
        modal.querySelector('#restore-wallet-name')?.value?.trim() || '';

      if (!backupPath) {
        showError('restore-status', 'Please select a backup file');
        return false;
      }

      if (!walletName) {
        showError(
          'restore-status',
          'Please enter a name for the restored wallet'
        );
        return false;
      }

      if (!password) {
        showError('restore-status', 'A password is required — unencrypted wallets are not permitted');
        return false;
      }

      walletData.backupPath = backupPath;
      walletData.password = password;
      walletData.walletName = walletName;
      walletData.restore = {
        walletName,
        backupPath,
        password,
      };
      return true;
    }

    return false;
  }

  function showError(elementId, message) {
    const errorDiv = modal.querySelector(`#${elementId}`);
    if (errorDiv) {
      // Check if there's a <p> tag, if not create the error content
      const pTag = errorDiv.querySelector('p');
      if (pTag) {
        pTag.textContent = message;
      } else {
        errorDiv.innerHTML = `
          <div class="flex items-center">
            <span class="text-sm text-red-400">${icons.xCircle(14, 'mr-1')} ${message}</span>
          </div>
        `;
      }
      errorDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      errorDiv.classList.remove('hidden');
    }
  }

  function showMessage(elementId) {
    const messageDiv = modal.querySelector(`#${elementId}`);
    if (messageDiv) {
      messageDiv.classList.remove('hidden');
    }
  }

  function buildConfiguration() {
    const zmqPort = modal.querySelector('#setup-zmq-port').value;
    const zmqAddress = getZmqAddress(zmqPort);

    const config = {
      protocol: protocolVersion, // 'v1' (P2WSH) or 'v2' (Taproot)
      rpc: {
        host: modal.querySelector('#setup-rpc-host').value,
        port: parseInt(modal.querySelector('#setup-rpc-port').value),
        username: modal.querySelector('#setup-rpc-username').value,
        password: modal.querySelector('#setup-rpc-password').value,
      },
      zmq: {
        rawblock: zmqAddress,
        rawtx: zmqAddress,
        address: zmqAddress,
      },
      taker: {
        control_port: parseInt(
          modal.querySelector('#setup-tor-control-port').value
        ),
        socks_port: parseInt(
          modal.querySelector('#setup-tor-socks-port').value
        ),
        tor_auth_password:
          modal.querySelector('#setup-tor-auth-password').value || undefined,
      },
      wallet: {
        action: walletAction,
        name: walletData.walletName,
        fileName: walletData.walletFileName,
        password: walletData.password === undefined ? '' : walletData.password,
        backupPath: walletData.backupPath,
      },
    };

    console.log('✅ Configuration built:', config);
    console.log(
      '📋 Protocol version:',
      protocolVersion === 'v1' ? 'P2WSH (V1)' : 'Taproot (V2)'
    );
    return config;
  }

  async function makeRpcCall(method, params = []) {
    const host = modal.querySelector('#setup-rpc-host').value;
    const port = modal.querySelector('#setup-rpc-port').value;
    const username = modal.querySelector('#setup-rpc-username').value;
    const password = modal.querySelector('#setup-rpc-password').value;

    if (!username || !password) {
      throw new Error('RPC username and password are required');
    }

    const response = await fetch(getRpcUrl(host, port), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - check RPC username/password');
      }
      if (response.status === 403) {
        throw new Error('Access forbidden - check rpcallowip in bitcoin.conf');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`);
    }

    return data.result;
  }

  // Real node connection test
  async function testRPCConnection() {
    const btn = modal.querySelector('#test-rpc-setup');
    const resultDiv = modal.querySelector('#rpc-test-result');
    const btnLabel = btn?.querySelector('span');

    if (btnLabel) btnLabel.textContent = 'Pinging node...';
    btn.disabled = true;
    connectionPassed.node = false;
    updateConnectionGate();
    modal.querySelector('#card-node')?.classList.remove('is-success', 'is-fail');
    btn.classList.remove('is-success');

    const host = modal.querySelector('#setup-rpc-host').value;
    const port = modal.querySelector('#setup-rpc-port').value;
    const zmqPort = parseInt(modal.querySelector('#setup-zmq-port').value, 10);

    try {
      const [blockchainInfo, networkInfo, restResponse, zmqResult] =
        await Promise.allSettled([
          makeRpcCall('getblockchaininfo'),
          makeRpcCall('getnetworkinfo'),
          fetch(getRestUrl(host, port)),
          window.api.testTcpPort({ host: '127.0.0.1', port: zmqPort }),
        ]);

      const rpcOk =
        blockchainInfo.status === 'fulfilled' &&
        networkInfo.status === 'fulfilled';
      const chain =
        blockchainInfo.status === 'fulfilled'
          ? blockchainInfo.value?.chain || 'unknown'
          : null;
      const blocks =
        blockchainInfo.status === 'fulfilled'
          ? blockchainInfo.value?.blocks || 0
          : null;
      const version =
        networkInfo.status === 'fulfilled'
          ? networkInfo.value?.subversion || 'Unknown'
          : null;

      const restOk =
        restResponse.status === 'fulfilled' && restResponse.value.ok;

      const results = [
        {
          label: 'RPC',
          ok: rpcOk,
          message: rpcOk
            ? `${version} • ${chain} • ${blocks.toLocaleString()} blocks`
            : blockchainInfo.reason?.message || networkInfo.reason?.message,
        },
        {
          label: 'REST',
          ok: restOk,
          message: restOk
            ? `${getRestUrl(host, port)} reachable`
            : restResponse.status === 'fulfilled'
              ? `HTTP ${restResponse.value.status}: ${restResponse.value.statusText}`
              : restResponse.reason?.message,
        },
        {
          label: 'ZMQ',
          ok:
            zmqResult.status === 'fulfilled' &&
            Boolean(zmqResult.value?.success),
          message:
            zmqResult.status === 'fulfilled' && zmqResult.value?.success
              ? `Port ${zmqPort} reachable`
              : zmqResult.status === 'fulfilled'
                ? zmqResult.value?.error
                : zmqResult.reason?.message,
        },
      ];

      renderConnectionResults(resultDiv, results);
      const nodeFailed = results.some((r) => !r.ok);
      connectionPassed.node = !nodeFailed;
      btn.classList.toggle('is-success', !nodeFailed);
      updateConnectionGate();
      const infoDiv = modal.querySelector('#node-setup-info');
      if (infoDiv) infoDiv.classList.toggle('hidden', !nodeFailed);
    } catch (error) {
      console.error('RPC test failed:', error);

      renderConnectionResults(resultDiv, [
        {
          label: 'Node Test',
          ok: false,
          message:
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')
              ? 'Cannot connect to Bitcoin Core. Is bitcoind running?'
              : error.message,
        },
      ]);
      connectionPassed.node = false;
      btn.classList.remove('is-success');
      updateConnectionGate();
      const infoDiv = modal.querySelector('#node-setup-info');
      if (infoDiv) infoDiv.classList.remove('hidden');
    }

    if (btnLabel) {
      btnLabel.textContent = connectionPassed.node ? 'Re-test node' : 'Test node connection';
    }
    btn.disabled = false;
  }

  // Handle restore wallet
  async function handleRestore() {
    const backupPath = modal.querySelector('#restore-backup-path').value;
    const password = modal.querySelector('#restore-password').value;
    const statusDiv = modal.querySelector('#restore-status');

    if (!backupPath) {
      statusDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      statusDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-red-400">${icons.xCircle(14, 'mr-1')} Please select a backup file</span>
        </div>
      `;
      statusDiv.classList.remove('hidden');
      return false;
    }

    try {
      statusDiv.className =
        'bg-blue-500/10 border border-blue-500/30 rounded-lg p-3';
      statusDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-blue-400">${icons.refreshCw(14, 'mr-1 animate-spin')} Restoring wallet from backup...</span>
        </div>
      `;
      statusDiv.classList.remove('hidden');

      // Call Electron API to restore wallet
      const result = await window.api.restoreWallet({
        backupFilePath: backupPath,
        password,
        walletName: modal.querySelector('#restore-wallet-name').value.trim(),
      });

      if (result.success) {
        statusDiv.className =
          'bg-green-500/10 border border-green-500/30 rounded-lg p-3';
        statusDiv.innerHTML = `
          <div class="flex items-center">
            <span class="text-sm text-green-400">${icons.checkCircle(14, 'mr-1')} Wallet restored successfully!</span>
          </div>
        `;
        return true;
      } else {
        throw new Error(result.error || 'Restore failed');
      }
    } catch (error) {
      console.error('Restore error:', error);
      statusDiv.className =
        'bg-red-500/10 border border-red-500/30 rounded-lg p-3';
      statusDiv.innerHTML = `
        <div class="flex items-center">
          <span class="text-sm text-red-400">${icons.xCircle(14, 'mr-1')} ${error.message}</span>
        </div>
      `;
      statusDiv.classList.remove('hidden');
      return false;
    }
  }

  // Test Tor connection
  async function testTorConnection() {
    const btn = modal.querySelector('#test-tor-setup');
    const resultDiv = modal.querySelector('#tor-test-result');
    const btnLabel = btn?.querySelector('span');

    if (!btn || !resultDiv) return;

    if (btnLabel) btnLabel.textContent = 'Probing circuit...';
    btn.disabled = true;
    connectionPassed.tor = false;
    updateConnectionGate();
    modal.querySelector('#card-tor')?.classList.remove('is-success', 'is-fail');
    btn.classList.remove('is-success');

    const socksPort = parseInt(
      modal.querySelector('#setup-tor-socks-port').value
    );
    const controlPort = parseInt(
      modal.querySelector('#setup-tor-control-port').value
    );

    try {
      const [socksResult, controlResult] = await Promise.all([
        window.api.testTcpPort({ host: '127.0.0.1', port: socksPort }),
        window.api.testTcpPort({ host: '127.0.0.1', port: controlPort }),
      ]);

      const torFailed = !socksResult?.success || !controlResult?.success;
      connectionPassed.tor = !torFailed;
      btn.classList.toggle('is-success', !torFailed);
      updateConnectionGate();
      renderConnectionResults(resultDiv, [
        {
          label: 'SOCKS Port',
          ok: Boolean(socksResult?.success),
          message: socksResult?.success
            ? `Port ${socksPort} reachable`
            : socksResult?.error,
        },
        {
          label: 'Control Port',
          ok: Boolean(controlResult?.success),
          message: controlResult?.success
            ? `Port ${controlPort} reachable`
            : controlResult?.error,
        },
      ]);
      const infoDiv = modal.querySelector('#tor-setup-info');
      if (infoDiv) infoDiv.classList.toggle('hidden', !torFailed);
    } catch (error) {
      console.error('Tor test failed:', error);

      renderConnectionResults(resultDiv, [
        {
          label: 'Tor Connection',
          ok: false,
          message: error.message || String(error),
        },
      ]);
      connectionPassed.tor = false;
      btn.classList.remove('is-success');
      updateConnectionGate();
      const infoDiv = modal.querySelector('#tor-setup-info');
      if (infoDiv) infoDiv.classList.remove('hidden');
    }

    if (btnLabel) {
      btnLabel.textContent = connectionPassed.tor ? 'Re-test Tor' : 'Test Tor connection';
    }
    btn.disabled = false;
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  console.log('🔧 Attaching event listeners...');

  // Wallet action choice
  const choiceCreate = modal.querySelector('#choice-create');
  if (choiceCreate) {
    choiceCreate.addEventListener('click', () => {
      console.log('Create clicked!');
      walletAction = 'create';
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-primary');
        el.classList.add('border-gray-700');
      });
      choiceCreate.classList.remove('border-gray-700');
      choiceCreate.classList.add('border-primary');
      const msg = modal.querySelector('#choice-message');
      if (msg) msg.classList.add('hidden');
      showStep(currentStep);
    });
  }

  const choiceLoad = modal.querySelector('#choice-load');
  if (choiceLoad) {
    choiceLoad.addEventListener('click', () => {
      console.log('Load clicked!');
      walletAction = 'load';
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-primary');
        el.classList.add('border-gray-700');
      });
      choiceLoad.classList.remove('border-gray-700');
      choiceLoad.classList.add('border-primary');
      const msg = modal.querySelector('#choice-message');
      if (msg) msg.classList.add('hidden');
      showStep(currentStep);
    });
  }

  const choiceRestore = modal.querySelector('#choice-restore');
  if (choiceRestore) {
    choiceRestore.addEventListener('click', () => {
      console.log('Restore clicked!');
      walletAction = 'restore';
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-primary');
        el.classList.add('border-gray-700');
      });
      choiceRestore.classList.remove('border-gray-700');
      choiceRestore.classList.add('border-primary');
      const msg = modal.querySelector('#choice-message');
      if (msg) msg.classList.add('hidden');
      showStep(currentStep);
    });
  }

  // Browse wallet file
  const browseWalletBtn = modal.querySelector('#browse-wallet-file');
  if (browseWalletBtn) {
    browseWalletBtn.addEventListener('click', async () => {
      try {
        const result = await window.api.openFile({
          filters: [{ name: 'All Files', extensions: ['*'] }],
        });

        if (result.success && result.filePath) {
          modal.querySelector('#load-wallet-path').value = result.filePath;
          modal.querySelector('#load-error').classList.add('hidden');
          updateConnectionGate();
        }
      } catch (error) {
        console.error('File picker error:', error);
        showError('load-error', 'Failed to open file picker');
      }
    });
  }

  // Browse backup file
  const browseBackupBtn = modal.querySelector('#browse-backup-file');
  if (browseBackupBtn) {
    browseBackupBtn.addEventListener('click', async () => {
      try {
        const result = await window.api.openFile({
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.success && result.filePath) {
          modal.querySelector('#restore-backup-path').value = result.filePath;
          modal.querySelector('#restore-status').classList.add('hidden');
          updateConnectionGate();
        }
      } catch (error) {
        console.error('File picker error:', error);
      }
    });
  }

  // Reusable function to toggle password visibility
  function setupPasswordToggle(toggleButtonId, passwordInputId) {
    const toggleButton = modal.querySelector(toggleButtonId);
    if (!toggleButton) return;

    toggleButton.addEventListener('click', () => {
      const passwordInput = modal.querySelector(passwordInputId);
      const eyeIcon = toggleButton.querySelector('.eye-icon');
      const eyeSlashIcon = toggleButton.querySelector('.eye-slash-icon');

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.add('hidden');
        eyeSlashIcon.classList.remove('hidden');
      } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('hidden');
        eyeSlashIcon.classList.add('hidden');
      }
    });
  }

  // Setup all password toggles
  setupPasswordToggle('#toggle-create-password', '#create-password');
  setupPasswordToggle(
    '#toggle-create-password-confirm',
    '#create-password-confirm'
  );
  setupPasswordToggle('#toggle-rpc-password', '#setup-rpc-password');
  setupPasswordToggle('#toggle-load-password', '#load-password');

  [
    '#setup-rpc-host',
    '#setup-rpc-port',
    '#setup-rpc-username',
    '#setup-rpc-password',
    '#setup-zmq-port',
  ].forEach((selector) => {
    modal
      .querySelector(selector)
      ?.addEventListener('input', () => resetConnectionCheck('node'));
  });

  [
    '#setup-tor-socks-port',
    '#setup-tor-control-port',
    '#setup-tor-auth-password',
  ].forEach((selector) => {
    modal
      .querySelector(selector)
      ?.addEventListener('input', () => resetConnectionCheck('tor'));
  });

  [
    '#create-wallet-name',
    '#create-password',
    '#create-password-confirm',
    '#load-password',
    '#restore-wallet-name',
    '#restore-password',
  ].forEach((selector) => {
    modal.querySelector(selector)?.addEventListener('input', updateConnectionGate);
  });

  // Next button
  const nextBtn = modal.querySelector('#setup-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      console.log(
        'Next clicked! Current step:',
        currentStep,
        'Wallet action:',
        walletAction
      );

      if (currentStep === 1 && !(connectionPassed.node && connectionPassed.tor)) {
        return;
      }

      if (currentStep === 2) {
        const valid = await validateWalletStep();
        if (!valid) {
          console.log('Validation failed');
          return;
        }

        // If restore, perform restore before proceeding
        if (walletAction === 'restore') {
          const restored = await handleRestore();
          if (!restored) {
            return;
          }
        }
      }

      if (currentStep < totalSteps) {
        currentStep++;
        console.log('Moving to step:', currentStep);
        showStep(currentStep);
      } else {
        // Complete setup
        console.log('Completing setup...');
        const config = buildConfiguration();
        modal.remove();
        if (onComplete) onComplete(config);
      }
    });
  }

  // Back button
  modal.querySelector('#setup-back-btn').addEventListener('click', () => {
    if (currentStep === 2 && walletAction) {
      // If in wallet substep, go back to the wallet choice screen.
      walletAction = null;
      showStep(currentStep);
      // Reset choice borders
      modal.querySelectorAll('.wallet-choice').forEach((el) => {
        el.classList.remove('border-primary');
        el.classList.add('border-gray-700');
      });
    } else if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  // Test RPC button
  modal
    .querySelector('#test-rpc-setup')
    .addEventListener('click', testRPCConnection);

  modal
    .querySelector('#test-tor-setup')
    .addEventListener('click', testTorConnection);

  // Initialize
  showStep(currentStep);

  return modal;
}
