import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ChainService } from '../../_services/chain.service';

@Component({
    selector: 'app-chain-selector',
    standalone: true,
    imports: [CommonModule, IonicModule, FormsModule],
    template: `
        <div class="selector-container">
            <select [(ngModel)]="selectedChainId" (ngModelChange)="onChainChange($event)">
                <option *ngFor="let chain of chainService.availableChains" [value]="chain.id.toString()">
                    {{ chain.name }}
                </option>
            </select>
            <div class="select-arrow">▼</div>
        </div>
    `,
    styles: [`
        .selector-container {
            position: relative;
            display: inline-block;
            min-width: 200px;
        }
        
        .select-arrow {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            color: var(--ion-color-light);
            font-size: 14px;
            z-index: 2;
        }
        
        select {
            background: var(--ion-color-dark);
            border: 1px solid var(--ion-color-medium);
            border-radius: 8px;
            color: var(--ion-color-light);
            font-size: 15px;
            font-weight: 500;
            padding: 12px 36px 12px 16px;
            margin: 0;
            cursor: pointer;
            outline: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            width: 100%;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
        }

        select:hover {
            border-color: var(--ion-color-primary);
            background: var(--ion-color-dark-shade);
        }

        select:focus {
            border-color: var(--ion-color-primary);
            box-shadow: 0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.2);
        }

        select::-ms-expand {
            display: none;
        }

        select option {
            background: var(--ion-color-dark);
            color: var(--ion-color-light);
            padding: 12px;
            font-size: 15px;
        }

        select option:checked {
            background: var(--ion-color-primary);
            color: var(--ion-color-light);
        }

        select option:hover {
            background: var(--ion-color-primary-shade);
        }

        select {
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
        }
    `]
})
export class ChainSelectorComponent {
    selectedChainId: string = '';

    constructor(
        public chainService: ChainService
    ) {
        const selectedChain = this.chainService.selectedChain;
        if (selectedChain) {
            this.selectedChainId = selectedChain.id.toString();
        }
    }

    onChainChange(chainId: string) {
        if (chainId) {
            this.chainService.selectChain(chainId);
        }
    }
} 