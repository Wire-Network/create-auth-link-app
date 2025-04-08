import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { API, NameType, Name } from "@wireio/core";
import { ChainService } from './chain.service';
import { addressToWireName } from "@wireio/wns";

@Injectable({
    providedIn: 'root'
})
export class AccountService {
    private accountSubject = new BehaviorSubject<API.v1.AccountObject | undefined>(undefined);
    public noAccountSubject = new BehaviorSubject<boolean>(true);
    private wireUsernameSubject = new BehaviorSubject<string | undefined>(undefined);

    public account$ = this.accountSubject.asObservable();
    public noAccount$ = this.noAccountSubject.asObservable();
    public wireUsername$ = this.wireUsernameSubject.asObservable();

    constructor(private chainService: ChainService) {}

    async getAccount(name: NameType, tryOnce?: boolean): Promise<API.v2.GetAccountResponse | API.v1.AccountObject> {
        // Get the API client from the chain service
        const api = this.chainService.api;
        
        console.log('Attempting to get account for:', name.toString());
        
        try {
            // Try v1 API first
            const res = await api.v1.chain.get_account(name);
            console.log('V1 API response:', JSON.stringify(res));
            return res as API.v1.AccountObject;
        } catch (err) {
            console.log('V1 API failed, trying V2 API:', err);
            if (!tryOnce) {
                try {
                    // Try v2 API as fallback
                    const res: any = await api.v2.state.get_account(name.toString());
                    console.log('V2 API response:', JSON.stringify(res));
                    if (res.statusCode && res.statusCode == 500) throw new Error('Account not found');
                    return res as API.v2.GetAccountResponse;
                } catch (err) {
                    console.error('V2 API also failed:', err);
                    throw new Error('Account not found');
                }
            }
            throw new Error('Account not found');
        }
    }

    // Convert an Ethereum address to a Wire username
    convertAddressToWireName(address: string): NameType {
        if (!address) {
            console.error('Received empty address for conversion');
            return '';
        }

        console.log('Converting address:', address);
        
        // If it's already a Wire username (not starting with 0x), return it as is
        if (!address.startsWith('0x')) {
            console.log('Address appears to be a Wire username already, using as-is');
            return address;
        }
        
        try {
            // Convert Ethereum address to Wire username using Name.from like SettleService does
            const wireName = Name.from(addressToWireName(address));
            console.log('Converted to Wire name:', wireName.toString());
            return wireName;
        } catch (error) {
            console.error('Error converting address to Wire name:', error);
            // Return a sensible fallback or the original address
            return address;
        }
    }

    async updateAccount(nameOrAddress: string): Promise<boolean> {
        try {
            // Convert Ethereum address to Wire username if needed
            const wireName = this.convertAddressToWireName(nameOrAddress);
            console.log(`Converting ${nameOrAddress} to Wire name: ${wireName}`);
            
            const accountData = await this.getAccount(wireName);
            
            // Update accountSubject and noAccountSubject
            if (accountData) {
                this.noAccountSubject.next(false);
                
                // Handle different response structures between v1 and v2 API
                if ('account' in accountData) {
                    // This is a v2 API response
                    this.accountSubject.next(accountData.account as any);
                    
                    // Update username if we have account_name in the account object
                    if (accountData.account && 'account_name' in accountData.account) {
                        this.wireUsernameSubject.next(accountData.account.account_name.toString());
                    }
                } else {
                    // This is a v1 API response
                    this.accountSubject.next(accountData as API.v1.AccountObject);
                    
                    // Update username from account_name
                    if ('account_name' in accountData) {
                        this.wireUsernameSubject.next(accountData.account_name.toString());
                    }
                }
                
                console.log('Account updated:', this.accountSubject.value);
                return true;
            } else {
                this.clearAccount();
                return false;
            }
        } catch (error) {
            console.error('Error updating account:', error);
            this.clearAccount();
            return false;
        }
    }

    async connectAccount(nameOrAddress: string): Promise<boolean> {
        // Update account information and emit changes to subscribers
        return await this.updateAccount(nameOrAddress);
    }

    async createAccount(username: string): Promise<boolean> {
        try {
            // Check if account already exists
            const existingAccount = await this.getAccount(username);
            if (existingAccount) {
                console.warn('Account already exists:', username);
                return false;
            }

            // TODO: Implement account creation transaction
            // This will depend on your specific chain's account creation process
            console.log('Creating account:', username);
            return true;
        } catch (error) {
            console.error('Error creating account:', error);
            return false;
        }
    }

    clearAccount(): void {
        this.accountSubject.next(undefined);
        this.noAccountSubject.next(true);
        this.wireUsernameSubject.next(undefined);
    }

    get currentAccount(): API.v1.AccountObject | undefined {
        return this.accountSubject.value;
    }

    get username(): string | undefined {
        return this.wireUsernameSubject.value || this.currentAccount?.account_name?.toString();
    }

    get address(): string | undefined {
        return this.currentAccount?.account_name?.toString();
    }
} 