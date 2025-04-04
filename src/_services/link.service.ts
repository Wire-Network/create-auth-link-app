import { Injectable } from '@angular/core';
import { BehaviorSubject, filter } from 'rxjs';
import { AuthMsgLink } from '../types/interfaces';
import { ChainService } from './chain.service';
import { AccountService } from './account.service';
import { KeyService } from './key.service';

@Injectable({
    providedIn: 'root'
})
export class LinkService {
    private linkSubject = new BehaviorSubject<AuthMsgLink | undefined>(undefined);
    private linkExistsSubject = new BehaviorSubject<boolean>(false);

    public link$ = this.linkSubject.asObservable();
    public linkExists$ = this.linkExistsSubject.asObservable();

    constructor(
        private chainService: ChainService,
        private accountService: AccountService,
        private keyService: KeyService
    ) {
        // Subscribe to account changes, but only when we have a valid account
        this.accountService.account$.pipe(
            filter(account => !!account)
        ).subscribe(async () => {
            await this.checkLinkStatus();
        });
    }

    private clearLink(): void {
        console.log('Clearing link state');
        this.linkSubject.next(undefined);
        this.linkExistsSubject.next(false);
    }

    // Public method to clear link state from outside the service
    public resetLinkState(): void {
        this.clearLink();
    }

    async checkLinkStatus(): Promise<void> {
        const username = this.accountService.username;
        console.log('Checking link status, current username:', username);
        
        if (!username) {
            console.warn('No username available to check link status');
            this.clearLink();
            return;
        }

        // Skip if it looks like an Ethereum address
        if (username.startsWith('0x')) {
            console.warn('Username appears to be an Ethereum address, skipping link check');
            this.clearLink();
            return;
        }

        try {
            console.log('Checking link status for Wire username:', username);
            const response = await this.chainService.getRows<AuthMsgLink>({
                contract: 'auth.msg',
                json: true,
                scope: 'auth.msg',
                table: 'links',
                index_position: 'secondary',
                limit: 50,
                lower_bound: username,
                upper_bound: username,
                key_type: 'name'
            });

            const hasLink = response.rows.length > 0;
            console.log('Link status check result:', { username, hasLink, rows: response.rows });
            this.linkExistsSubject.next(hasLink);
            if (hasLink) {
                const link = response.rows[0] as AuthMsgLink;
                this.linkSubject.next(link);
            } else {
                this.linkSubject.next(undefined);
            }
        } catch (error) {
            console.error('Error checking link status:', error);
            this.clearLink();
        }
    }

    // async createLink(): Promise<string | undefined> {
    //     const username = this.accountService.username;
    //     const address = this.accountService.address;
        
    //     console.log('Creating link for:', { username, address });
        
    //     if (!username || !address) {
    //         console.error('Missing username or address for link creation');
    //         return undefined;
    //     }

    //     try {
    //         // First check if a link already exists
    //         await this.checkLinkStatus();
    //         if (this.linkExists) {
    //             console.warn('Link already exists for username:', username);
    //             return this.currentLink?.pub_key;
    //         }

    //         console.log('Retrieving public key from wallet...');
    //         // Get the public key
    //         const pubKey = await this.keyService.retrievePubKey();
    //         console.log('Retrieved public key:', pubKey);
            
    //         if (!pubKey) {
    //             console.error('Failed to retrieve public key');
    //             return undefined;
    //         }

    //         // Make sure the public key doesn't have the 0x prefix if it's there
    //         const formattedPubKey = pubKey.startsWith('0x') ? pubKey.substring(2) : pubKey;
    //         console.log('Formatted public key for link creation:', formattedPubKey);
            
    //         // Return the public key for the transaction
    //         return formattedPubKey;
    //     } catch (error) {
    //         console.error('Error creating link:', error);
    //         return undefined;
    //     }
    // }

    get currentLink(): AuthMsgLink | undefined {
        return this.linkSubject.value;
    }

    get linkExists(): boolean {
        return this.linkExistsSubject.value;
    }
} 