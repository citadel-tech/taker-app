export function LogComponent(container) {
    const content = document.createElement('div');
    content.id = 'log-content';
    
    content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">System Logs</h2>
        <p class="text-gray-400 mb-8">Real-time application logs and events</p>

        <div class="grid grid-cols-4 gap-6">
            <!-- Left: Log Display -->
            <div class="col-span-3">
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <!-- Log Controls -->
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex gap-2">
                            <button class="bg-[#FF6B35] text-white px-4 py-2 rounded text-sm font-semibold">
                                All
                            </button>
                            <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold transition-colors">
                                Info
                            </button>
                            <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold transition-colors">
                                Warning
                            </button>
                            <button class="bg-[#0f1419] hover:bg-[#242d3d] border border-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold transition-colors">
                                Error
                            </button>
                        </div>
                        <div class="flex gap-2">
                            <button class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-4 py-2 rounded text-sm transition-colors">
                                Clear Logs
                            </button>
                            <button class="bg-[#242d3d] hover:bg-[#2d3748] text-white px-4 py-2 rounded text-sm transition-colors">
                                Export
                            </button>
                        </div>
                    </div>

                    <!-- Log Output -->
                    <div class="bg-[#0f1419] rounded-lg p-4 font-mono text-sm h-[600px] overflow-y-auto">
                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:45:23]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Wallet synced successfully</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:45:25]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Connected to Bitcoin Core RPC</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:46:10]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Syncing offerbook from directory server</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:46:15]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Found 3 suitable makers for swap</span>
                        </div>

                        <!-- Warning Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:47:30]</span>
                            <span class="text-yellow-400">[WARN]</span>
                            <span class="text-gray-300"> Maker connection timeout, retrying...</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:47:35]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Successfully connected to maker ewaexd2es2uzr34wp26c</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:48:01]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Initiating first hop with maker</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:48:15]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Received multisig pubkeys from maker</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:48:30]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Broadcasting funding transaction a1b2c3d4e5f6...</span>
                        </div>

                        <!-- Error Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:49:05]</span>
                            <span class="text-red-400">[ERROR]</span>
                            <span class="text-gray-300"> Failed to connect to maker h2cxriyylj7ue: connection refused</span>
                        </div>

                        <!-- Warning Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:49:10]</span>
                            <span class="text-yellow-400">[WARN]</span>
                            <span class="text-gray-300"> Marking maker as bad, selecting alternative</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:49:20]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Selected new maker abc123xyz789d</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:50:05]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> All signatures collected, swap complete</span>
                        </div>

                        <!-- Info Log -->
                        <div class="mb-2 hover:bg-[#1a2332] px-2 py-1 rounded">
                            <span class="text-gray-500">[12:50:10]</span>
                            <span class="text-blue-400">[INFO]</span>
                            <span class="text-gray-300"> Wallet synced, balance updated</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Log Info -->
            <div class="col-span-1 space-y-6">
                <!-- Log Stats -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Log Stats</h3>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-sm text-gray-400">Info</span>
                                <span class="text-blue-400 font-semibold">142</span>
                            </div>
                            <div class="w-full bg-[#0f1419] rounded-full h-2">
                                <div class="bg-blue-400 h-2 rounded-full" style="width: 85%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-sm text-gray-400">Warning</span>
                                <span class="text-yellow-400 font-semibold">23</span>
                            </div>
                            <div class="w-full bg-[#0f1419] rounded-full h-2">
                                <div class="bg-yellow-400 h-2 rounded-full" style="width: 40%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-sm text-gray-400">Error</span>
                                <span class="text-red-400 font-semibold">5</span>
                            </div>
                            <div class="w-full bg-[#0f1419] rounded-full h-2">
                                <div class="bg-red-400 h-2 rounded-full" style="width: 15%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Auto-scroll -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Settings</h3>
                    <div class="space-y-3">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked class="w-4 h-4 accent-[#FF6B35]" />
                            <span class="text-sm text-gray-300">Auto-scroll</span>
                        </label>
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked class="w-4 h-4 accent-[#FF6B35]" />
                            <span class="text-sm text-gray-300">Show timestamps</span>
                        </label>
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" class="w-4 h-4 accent-[#FF6B35]" />
                            <span class="text-sm text-gray-300">Verbose mode</span>
                        </label>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="bg-[#1a2332] rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-300 mb-4">Quick Actions</h3>
                    <div class="space-y-2">
                        <button class="w-full bg-[#0f1419] hover:bg-[#242d3d] text-white py-2 rounded text-sm transition-colors text-left px-3">
                            📋 Copy all logs
                        </button>
                        <button class="w-full bg-[#0f1419] hover:bg-[#242d3d] text-white py-2 rounded text-sm transition-colors text-left px-3">
                            💾 Save to file
                        </button>
                        <button class="w-full bg-[#0f1419] hover:bg-[#242d3d] text-white py-2 rounded text-sm transition-colors text-left px-3">
                            🔍 Search logs
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(content);
}