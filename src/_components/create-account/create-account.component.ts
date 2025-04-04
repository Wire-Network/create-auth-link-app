import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConnectService } from '../connect/connect.service';

@Component({
    selector: 'app-create-account',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
        <div class="my-card">
            <div class="step-container">
                <div class="step-header">
                    <h2 class="title-text">Create Account</h2>
                    <p class="subtitle">Create your WNS account to proceed</p>
                </div>
                <div class="step-body">
                    <p>Your wallet address:</p>
                    <p class="address">{{ connectService.currentAccount?.username }}</p>
                </div>
                <div class="step-footer">
                    <button routerLink="/create-link">Create Account</button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: flex;
            justify-content: center;
            width: 100%;
        }

        .my-card {
            width: 100%;
            max-width: 500px;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-top: 40px;
        }

        .step-container {
            .step-header {
                text-align: center;
                margin-bottom: 20px;

                .title-text {
                    font-size: 24px;
                    font-weight: 500;
                    margin-bottom: 10px;
                }

                .subtitle {
                    color: #666;
                    font-size: 16px;
                }
            }

            .step-body {
                margin: 20px 0;
                text-align: center;

                .address {
                    font-weight: 500;
                    margin-top: 10px;
                }
            }

            .step-footer {
                display: flex;
                justify-content: center;
                
                button {
                    min-width: 140px;
                    max-width: 200px;
                    padding: 8px 16px;
                    min-height: 40px;
                    font-size: 16px;
                    border-radius: 6px;
                    background-color: #9c27b0;
                    color: white;
                    border: none;
                    cursor: pointer;
                    transition: background-color 0.3s ease;

                    &:hover {
                        background-color: #7b1fa2;
                    }
                }
            }
        }
    `]
})
export class CreateAccountComponent {
    constructor(public connectService: ConnectService) {}
} 