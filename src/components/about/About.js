export async function AboutComponent(container) {
  container.innerHTML = `
    <div class="flex-1 p-8 overflow-auto">

      <!-- Header -->
      <div class="flex items-start justify-between mb-8">
        <div>
          <h2 class="text-3xl font-bold text-[#FF6B35]">Coinswap</h2>
          <p class="text-gray-400 text-sm mt-1">Taker Wallet — Bitcoin Privacy Tool</p>
        </div>
        <div class="flex items-center gap-3 mt-1">
          <span class="text-gray-500 text-sm">Version</span>
          <span id="app-version" class="text-white font-mono text-sm bg-[#1a2332] px-3 py-1 rounded">Loading...</span>
        </div>
      </div>

      <!-- What is Coinswap -->
      <div class="bg-[#1a2332] rounded-lg p-8 max-w-3xl space-y-4">
        <h3 class="text-xl font-semibold text-white">About Coinswap</h3>
        <p class="text-gray-300 text-sm leading-relaxed">
          Coinswap is a trustless, self-custodial atomic swap protocol built on Bitcoin. Unlike existing solutions
          that rely on centralized servers, Coinswap's marketplace is seeded in the Bitcoin blockchain itself —
          no central host required. Sybil resistance is achieved through
          <span class="text-white font-medium">Fidelity Bonds</span>: time-locked UTXOs that make Sybil attacks
          economically costly while bootstrapping the marketplace on-chain.
        </p>
        <p class="text-gray-300 text-sm leading-relaxed">
          There are two roles. <span class="text-white font-medium">Makers</span> are swap service providers who
          earn fees for supplying liquidity and run in an install-fund-forget mode — no active management needed.
          <span class="text-white font-medium">Takers</span> (this app) initiate swaps, pay all fees, and select
          makers based on bond validity, available liquidity, and fee rates.
        </p>
        <p class="text-gray-300 text-sm leading-relaxed">
          Swaps are routed through multiple makers — no single maker sees the full route. The taker relays all
          messages between makers over Tor, keeping each maker's view partial. This app is a production-grade
          implementation of Chris Belcher's teleport-transactions proof-of-concept.
        </p>
      </div>

    </div>
  `;

  try {
    const result = await window.api.app.getVersionInfo();
    const version = result.success ? `v${result.appVersion}` : 'unavailable';
    container.querySelector('#app-version').textContent = version;
  } catch (_) {
    container.querySelector('#app-version').textContent = 'unavailable';
  }
}
