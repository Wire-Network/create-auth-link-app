import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ChainService } from '../../_services/chain.service';

@Component({
    selector: 'app-chain-selector',
    standalone: true,
    imports: [CommonModule, IonicModule],
    template: `
        <div class="selector-container">
            <select (change)="selectChain($event)" [value]="chainService.selectedChain.name">
                <option *ngFor="let chain of chainService.availableChains" [value]="chain.name">
                    {{ chain.name }}
                </option>
            </select>
        </div>
    `,
    styles: [`
        .selector-container {
            position: relative;
            display: inline-block;
        }
        
        .selector-container::after {
            content: '';
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid var(--ion-color-light);
            pointer-events: none;
        }
        
        select {
            background: var(--ion-color-dark);
            border: 1px solid var(--ion-color-medium);
            border-radius: 4px;
            color: var(--ion-color-light);
            font-size: 15px;
            font-weight: 500;
            padding: 10px 36px 10px 16px;
            margin: 0;
            cursor: pointer;
            outline: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            min-width: 180px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        select:hover {
            border-color: var(--ion-color-primary);
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
            padding: 10px;
            font-size: 15px;
        }
    `]
})
export class ChainSelectorComponent {
    constructor(
        public chainService: ChainService
    ) {}

    selectChain(event: Event) {
        const select = event.target as HTMLSelectElement;
        const selectedChain = this.chainService.availableChains.find(chain => chain.name === select.value);
        
        if (selectedChain) {
            this.chainService.selectChain(selectedChain.id.toString());
        }
    }
} 