export function NavComponent(container) {
    const nav = document.createElement('div');
    nav.className = 'w-64 bg-[#1a2332] flex flex-col';
    
    nav.innerHTML = `
        <div class="p-4 border-b border-gray-700">
            <h1 class="text-2xl font-bold text-[#FF6B35]">Coinswap</h1>
            <p class="text-xs text-gray-400 mt-1">Taker Wallet</p>
        </div>
        
        <nav class="flex-1 p-3 space-y-2 overflow-y-auto">
            <a href="#wallet" data-nav="wallet" class="nav-item active flex flex-col items-center justify-center p-4 rounded-lg bg-[#FF6B35] text-white hover:bg-[#ff7d4d] transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                </svg>
                <span class="text-sm font-semibold">Wallet</span>
            </a>

            <a href="#market" data-nav="market" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span class="text-sm font-semibold">Market</span>
            </a>

            <a href="#send" data-nav="send" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                <span class="text-sm font-semibold">Send</span>
            </a>

            <a href="#receive" data-nav="receive" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8l-8 8-8-8"></path>
                </svg>
                <span class="text-sm font-semibold">Receive</span>
            </a>

            <a href="#swap" data-nav="swap" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
                <span class="text-sm font-semibold">Swap</span>
            </a>

            <a href="#recovery" data-nav="recovery" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <span class="text-sm font-semibold">Recovery</span>
            </a>

            <a href="#log" data-nav="log" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span class="text-sm font-semibold">Log</span>
            </a>

            <a href="#settings" data-nav="settings" class="nav-item flex flex-col items-center justify-center p-4 rounded-lg bg-[#242d3d] text-gray-400 hover:bg-[#2d3748] hover:text-white transition-colors">
                <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span class="text-sm font-semibold">Settings</span>
            </a>
        </nav>
    `;
    
    container.appendChild(nav);
}