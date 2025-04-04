import { Component } from '@angular/core';
import { ConnectComponent } from '../connect/connect.component';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [ConnectComponent],
    template: `
        <div class="home-container">
            <wallet-connect></wallet-connect>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
            max-width: 500px;
            margin-top: 40px;
        }

        :host ::ng-deep wallet-connect {
            width: 100%;
            
            button {
                width: 100%;
                padding: 8px 16px;
                margin: 8px 0;
                font-size: 16px;
                min-height: 40px;
            }

            .account-info {
                text-align: center;
                margin: 20px 0;
            }

            .actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: center;
            }
        }
    `]
})
export class HomeComponent {} 