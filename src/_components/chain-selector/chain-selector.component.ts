import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SettleService } from '../../_services/settle.service';
import { WireChain } from '../../types/interfaces';

@Component({
    selector: 'chain-selector',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="chain-selector">
            <select (change)="selectChain($event)" [value]="settleService.chain.name">
                <option *ngFor="let chain of settleService.chains" [value]="chain.name">
                    {{ chain.name }}
                </option>
            </select>
        </div>
    `,
    styles: [`
        .chain-selector {
            margin: 10px 0;
        }
        select {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ccc;
            background-color: white;
            width: 200px;
        }
    `]
})
export class ChainSelectorComponent {
    private isBrowser: boolean;

    constructor(
        public settleService: SettleService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    selectChain(event: Event) {
        const select = event.target as HTMLSelectElement;
        const selectedChain = this.settleService.chains.find(chain => chain.name === select.value);
        if (selectedChain) {
            // Update selected status for all chains
            this.settleService.chains.forEach(chain => chain.selected = chain.name === selectedChain.name);
            // Store updated chains in localStorage only in browser environment
            if (this.isBrowser) {
                localStorage.setItem('wire-chains', JSON.stringify(this.settleService.chains));
            }
        }
    }
} 