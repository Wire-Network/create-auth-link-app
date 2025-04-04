import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConnectService } from './connect.service';
import { LinkService } from '../../_services/link.service';
import { AccountService } from '../../_services/account.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'wallet-connect',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './connect.component.html',
    styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit, OnDestroy {
    private connectionSub?: Subscription;
    private linkSub?: Subscription;

    constructor(
        public connectService: ConnectService,
        public linkService: LinkService,
        public accountService: AccountService
    ) {}

    ngOnInit() {
        // Subscribe to connection changes
        this.connectionSub = this.connectService.connection$.subscribe(connection => {
            console.log('Connection state changed:', connection);
            
            // If we have a selected account, update the account service
            if (connection?.account) {
                console.log('Account object from connection:', JSON.stringify(connection.account));
                this.loadWireAccount(connection.account);
            } else if (!connection) {
                // Disconnected - clear account
                this.accountService.clearAccount();
            }
        });

        // Subscribe to link status changes
        this.linkSub = this.linkService.linkExists$.subscribe(exists => {
            console.log('Link status changed:', exists);
        });
    }

    // Helper methods for template to convert TimePoint to Date
    getCreatedDate(timePoint: any): Date | null {
        if (!timePoint) return null;
        return new Date(timePoint.toString());
    }
    
    getLastUpdateDate(timePoint: any): Date | null {
        if (!timePoint) return null;
        return new Date(timePoint.toString());
    }
    
    // Helper methods to format CPU and NET values
    formatCpuAvailable(value: any): number {
        if (!value) return 0;
        return Number(value.toString());
    }
    
    formatNetAvailable(value: any): number {
        if (!value) return 0;
        return Number(value.toString());
    }

    async loadWireAccount(account: string | { address: string, username?: string, type?: string }) {
        try {
            // Use the Ethereum address to load the WIRE account
            // The account service will convert it to a Wire username
            if (typeof account === 'string') {
                // If we were passed a string, use it directly
                console.log('Loading Wire account from string:', account);
                console.log('Calling connectAccount with string address/name');
                const success = await this.accountService.connectAccount(account);
                console.log('Account connection result:', success);
                
                // Check account state after connection
                console.log('Account state after connection:',
                    'username:', this.accountService.username,
                    'account:', this.accountService.currentAccount);
            } else if (account && account.address) {
                // If we were passed an account object, use its address
                console.log('Loading Wire account from address object:', account);
                console.log('Account object properties:',
                    'address:', account.address,
                    'username:', account.username,
                    'type:', account.type);
                
                console.log('Calling connectAccount with address:', account.address);
                const success = await this.accountService.connectAccount(account.address);
                console.log('Account connection result:', success);
                
                // Check account state after connection
                console.log('Account state after connection:',
                    'username:', this.accountService.username,
                    'account:', this.accountService.currentAccount);
            } else {
                console.error('Invalid account information for Wire account loading');
            }
        } catch (error) {
            console.error('Failed to load Wire account:', error);
        }
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
        this.accountService.clearAccount();
        this.linkService.resetLinkState();
    }

    async selectAccount(address: string) {
        try {
            await this.connectService.selectAccount(address);
            
            // If the selected account is available, load the WIRE account
            const account = this.connectService.currentAccount;
            if (account) {
                await this.loadWireAccount(account);
            }
        } catch (error: any) {
            console.error('Failed to select account:', error.message);
            alert(error.message);
        }
    }

    async changeAccount() {
        try {
            // First clear the account in the account service
            this.accountService.clearAccount();
            // Make sure to clear link status
            this.linkService.resetLinkState();
            // Then clear the selected account in the connect service
            await this.connectService.clearSelectedAccount();
        } catch (error: any) {
            console.error('Failed to change account:', error.message);
            alert(error.message);
        }
    }

    ngOnDestroy() {
        this.connectionSub?.unsubscribe();
        this.linkSub?.unsubscribe();
    }
}