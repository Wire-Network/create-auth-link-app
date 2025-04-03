import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConnectService } from './connect.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'wallet-connect',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './connect.component.html',
    styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit, OnDestroy {
    private subscription?: Subscription;

    constructor(public connectService: ConnectService) {}

    ngOnInit() {
        // Subscribe to connection changes
        this.subscription = this.connectService.connection$.subscribe(connection => {
            console.log('Connection state changed:', connection);
        });
    }

    async connect() {
        try {
            await this.connectService.connectWallet();
        } catch (error: any) {
            console.error('Failed to connect:', error.message);
            alert(error.message);
        }
    }

    async disconnect() {
        await this.connectService.disconnectWallet();
    }

    async selectAccount(address: string) {
        try {
            await this.connectService.selectAccount(address);
        } catch (error: any) {
            console.error('Failed to select account:', error.message);
            alert(error.message);
        }
    }

    async changeAccount() {
        try {
            await this.connectService.clearSelectedAccount();
        } catch (error: any) {
            console.error('Failed to change account:', error.message);
            alert(error.message);
        }
    }

    ngOnDestroy() {
        this.subscription?.unsubscribe();
    }
}