import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ethers } from 'ethers';
import { ConnectedAccount } from '../../types/interfaces';


export interface Connection {
    chainId?: number;
    account?: ConnectedAccount;
    availableAccounts: ConnectedAccount[];
}

@Injectable({ providedIn: 'root' })
export class ConnectService {
    private provider: any;
    private connectionSubject = new BehaviorSubject<Connection | null>(null);
    public connection$ = this.connectionSubject.asObservable();

    get activeAccount()     { return this.connectionSubject.value?.account }
    get address()           { return this.activeAccount?.address; }



    constructor() {
        // Check if we're in a browser environment and MetaMask is installed
        if (typeof window !== 'undefined') {
            // Wait for the window to load completely
            window.addEventListener('load', () => {
                if ((window as any).ethereum) {
                    this.provider = (window as any).ethereum;
                    this.setupEventListeners();
                }
            });
        }
    }

    get web3Provider() { return new ethers.BrowserProvider(this.provider); }


    /**
     * Connect to MetaMask wallet and get available accounts
     */
    async connectWallet(): Promise<void> {
        if (!this.provider) {
            throw new Error('MetaMask is not installed');
        }

        try {
            // Request account access - this will prompt MetaMask
            const accounts = await this.provider.request({ 
                method: 'eth_requestAccounts' 
            });

            console.log('accounts', accounts);

            // Get the current chain ID
            const chainId = await this.provider.request({ 
                method: 'eth_chainId' 
            });

            // Create account objects for all available accounts
            const availableAccounts = accounts.map((address: string, index: number) => ({
                address,
                username: this.getShortAddress(address),
                // name: `Account ${index + 1}`
            }));

            // Update connection state with all accounts, but no selected account yet
            this.connectionSubject.next({ 
                chainId: Number(chainId),
                availableAccounts
            });

        } catch (error: any) {
            throw new Error(error.message || 'Failed to connect wallet');
        }
    }

    /**
     * Select a specific account
     */
    async selectAccount(address: string): Promise<void> {
        const currentState = this.connectionSubject.value;
        if (!currentState) return;

        const selectedAccount = currentState.availableAccounts.find(acc => acc.address.toLowerCase() === address.toLowerCase());
        if (!selectedAccount) return;

        try {
            // Request MetaMask to switch to this account
            await this.provider.request({
                method: 'eth_requestAccounts',
                params: [{ eth_accounts: [address] }]
            });

            // Update our state with the selected account
            this.connectionSubject.next({
                ...currentState,
                account: selectedAccount
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to switch account');
        }
    }

    /**
     * Clear the selected account to show account selection
     */
    async clearSelectedAccount(): Promise<void> {
        const currentState = this.connectionSubject.value;
        if (!currentState) return;

        // Keep the accounts list but clear the selected account
        this.connectionSubject.next({
            ...currentState,
            account: undefined
        });
    }

    /**
     * Disconnect the wallet
     */
    async disconnectWallet(): Promise<void> {
        this.connectionSubject.next(null);
    }

    /**
     * Get the current connection state
     */
    get connected(): boolean {
        return this.connectionSubject.value !== null;
    }

    /**
     * Get the current account
     */
    get currentAccount(): ConnectedAccount | undefined {
        return this.connectionSubject.value?.account;
    }

    /**
     * Get available accounts
     */
    get availableAccounts(): ConnectedAccount[] {
        return this.connectionSubject.value?.availableAccounts || [];
    }

    /**
     * Get the current chain ID
     */
    get currentChainId(): number | undefined {
        return this.connectionSubject.value?.chainId;
    }

    /**
     * Setup event listeners for account and chain changes
     */
    private setupEventListeners(): void {
        if (!this.provider) return;

        // Handle account changes
        this.provider.on('accountsChanged', async (accounts: string[]) => {
            if (accounts.length === 0) {
                // User disconnected their wallet
                this.disconnectWallet();
            } else {
                // Update available accounts
                const availableAccounts = accounts.map((address: string, index: number) => ({
                    address,
                    username: this.getShortAddress(address),
                }));

                const currentState = this.connectionSubject.value;
                const currentAccount = currentState?.account;

                // Keep the current account if it's still available, otherwise clear it
                const updatedAccount = currentAccount && 
                    availableAccounts.find(acc => acc.address === currentAccount.address);

                this.connectionSubject.next({
                    ...currentState,
                    availableAccounts: availableAccounts.map(acc => ({
                        ...acc,
                        type: 'metamask' as const
                    })),
                    account: updatedAccount ? {
                        ...updatedAccount,
                        type: 'metamask' as const
                    } : undefined
                });
            }
        });

        // Handle chain changes
        this.provider.on('chainChanged', (chainId: string) => {
            const currentState = this.connectionSubject.value;
            if (currentState) {
                this.connectionSubject.next({
                    ...currentState,
                    chainId: Number(chainId)
                });
            }
        });
    }

    /**
     * Get a shortened version of the address
     */
    private getShortAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Sign a message using the connected wallet
     */
    async signMessage(message: string): Promise<string> {
        if (!this.currentAccount) {
            throw new Error('No account selected');
        }

        try {
            const signer = await this.web3Provider.getSigner(this.currentAccount.address);
            return await signer.signMessage(message);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to sign message');
        }
    }


     /**
     * Sign a message using the currently selected account.
     * 
     * @param message The message to sign
     * @returns The signature as a string
     */
     async signWeb3Message(message: any): Promise<string> {
        if (!this.activeAccount) throw new Error('No account connected.');
        try {
            const signer = await this.web3Provider.getSigner();
            const signedMessage = await signer.signMessage(message);
            return signedMessage;
        } catch (err:any) {
            throw new Error(err.message.replace(/Error: /g, ''));
        }
    }
}