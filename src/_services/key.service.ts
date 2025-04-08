import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ethers } from 'ethers';
import { ConnectService } from '../_components/connect/connect.service';

const PUB_KEY_MSG = 'Retrieve Public Key';

@Injectable({
    providedIn: 'root'
})
export class KeyService {
    private isBrowser: boolean;
    private _ethPubKey?: string;

    constructor(
        private connectService: ConnectService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    get pubKey(): string | undefined {
        return this._ethPubKey;
    }

    get pubKeys(): Record<string, string> | undefined {
        if (!this.isBrowser) return undefined;
        const keys = localStorage.getItem('pub_keys');
        return keys ? JSON.parse(keys) : undefined;
    }

    async retrievePubKey(): Promise<string | undefined> {
        console.log('Retrieving public key...', this.pubKey);

        if (this.pubKey) return this.pubKey;

        try {
            const sig = await this.connectService.signWeb3Message(PUB_KEY_MSG);
            this._ethPubKey = this.recoverPubKey(PUB_KEY_MSG, sig);

            // Store the public key if we have an address
            if (this.isBrowser && this.connectService.address && this._ethPubKey) {
                const keys = this.pubKeys || {};
                keys[this.connectService.address] = this._ethPubKey;
                localStorage.setItem('pub_keys', JSON.stringify(keys));
            }

            return this._ethPubKey;
        } catch (err: any) {
            console.error('Error retrieving public key:', err);
            throw new Error(err);
        }
    }

    storeLocalPubKey(address: string): void {
        const storedKey = this.getPubKeyByAddress(address);
        if (storedKey) {
            this._ethPubKey = storedKey;
            console.log('Public key loaded from storage for address:', address);
        }
    }

    getPubKeyByAddress(address: string): string | undefined {
        const keys = this.pubKeys;
        return keys ? keys[address] : undefined;
    }

    recoverPubKey(message: string, signature: string): string {
        const msgHash = ethers.hashMessage(message);
        return ethers.SigningKey.recoverPublicKey(msgHash, signature);
    }

    clearStoredKeys(): void {
        if (this.isBrowser) {
            localStorage.removeItem('pub_keys');
            this._ethPubKey = undefined;
        }
    }
} 