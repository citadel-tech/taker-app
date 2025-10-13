import { SwapForm } from './SwapForm.js';
import { SwapStatus } from './SwapStatus.js';
import { SwapSummary } from './SwapSummary.js';
import { SwapHistory } from './SwapHistory.js';

export function SwapComponent(container) {
    const content = document.createElement('div');
    content.id = 'swap-content';
    
    content.innerHTML = `
        <h2 class="text-3xl font-bold text-[#FF6B35] mb-2">Coinswap</h2>
        <p class="text-gray-400 mb-8">Perform private Bitcoin swaps through multiple makers</p>

        <div class="grid grid-cols-3 gap-6">
            <div class="col-span-2">
                ${SwapForm()}
                
                <div class="mt-6 hidden" id="swap-status-container">
                    ${SwapStatus()}
                </div>
            </div>

            <div class="col-span-1 space-y-6">
                ${SwapSummary()}
                ${SwapHistory()}
            </div>
        </div>
    `;
    
    container.appendChild(content);
}