import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConnectService } from '../_components/connect/connect.service';
import { addressToWireName, evmSigToWIRE, getCompressedPublicKey } from "@wireio/wns";
import EventEmitter from "events";
import { ethers } from 'ethers';

import { ABI, Action, ActionTypedData, AnyAction, API, APIClient, APIError, Asset, Authority, Checksum256, Checksum256Type, FetchProvider, Name, NameType, PermissionLevel, SignedTransaction, Transaction, UInt256, UInt256Type, UInt64Type } from "@wireio/core";
import { BehaviorSubject, Subscription } from 'rxjs';
import { AuthMsgLink, ConnectedAccount, GetRowsOptions, WireChain, WireChainStats } from '../types/interfaces';

export const DEFAULT_LIMIT = 50;
const PUB_KEY_MSG = 'Retrieve Public Key';

@Injectable()
export class SettleService extends EventEmitter {
    // #region Properties
    private _ethPubKey?: string;
    private isBrowser: boolean;
    private chainSubject = new BehaviorSubject<WireChain | undefined>(undefined);

    public chain$ = this.chainSubject.asObservable();
    public info?: API.v1.GetInfoResponse;
    public noAccount = false;
    public account?: API.v1.AccountObject | API.v2.Account;
    public recentBlocks: API.v1.GetBlockResponse[] = [];
    public stats?: WireChainStats;
    public connectChange?: Subscription;
    public link?: AuthMsgLink | null;

    // Constants
    public readonly SETTLE_AUTH_ACTIONS = [
        "initdeposit",
        "setpending",
        "canceldep",
        "utxoxfer",
        "withdraw"
    ];

    // Chain Configuration
    public chains: WireChain[] = [
        {
            name: 'Wire Testnet',
            id: "065dcca2dc758af25bcf3b878260a19dd1b81e4597f2af15a262a0c67f1e0106",
            endpoint: 'https://testnet-00.wire.foundation',
            // hyperion: 'https://testnet-hyperion.wire.foundation',
            websocket: 'ws://testnet-ship.wire.foundation',
            watchdawg: 'https://dawg.wire.foundation',
            namespace: 'sysio',
            coreSymbol: 'SYS',
            selected: false
        }
    ];
    // #endregion

    // #region Getters
    get namespace() { 
        return this.chain.namespace;
    }

    get pubKey(): string | undefined {
        return this._ethPubKey;
    }

    get chain() {
        return this.chains.find(chain => chain.selected)!;
    }

    get api() {
        return new APIClient({ 
            provider: new FetchProvider(this.chain!.endpoint), 
            // hyperionUrl: this.chain!.hyperion 
        });
    }

    get username(): NameType | undefined {
        return this.connect.address ? 
            Name.from(addressToWireName(this.connect.address!)) : 
            undefined;
    }

    get pubKeys(): Record<string, string> | undefined {
        if (!this.isBrowser) return undefined;
        const keys = localStorage.getItem('pub_keys');
        return keys ? JSON.parse(keys) : undefined;
    }
    // #endregion

    constructor(
        private connect: ConnectService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        super();
        this.isBrowser = isPlatformBrowser(platformId);
        this.initializeChains();
        this.setupConnectionSubscription();
    }

    // #region Initialization Methods
    private initializeChains(): void {
        if (this.isBrowser) {
            if (!localStorage.getItem('wire-chains')) {
                localStorage.setItem('wire-chains', JSON.stringify(this.chains));
            }
            this.chains = JSON.parse(localStorage.getItem('wire-chains')!);
        }
    }

    private setupConnectionSubscription(): void {
        this.connectChange = this.connect.connection$.subscribe((c) => {
            if (c?.account) {
                const wireUsername = this.username;
                if (wireUsername) {
                    this.checkAccount({ 
                        username: wireUsername.toString(), 
                        address: c.account.address, 
                        type: 'metamask' 
                    });
                    // Check link status immediately after account check
                    this.checkLinkByUsername(wireUsername).catch(err => {
                        console.error('Failed to check link status:', err);
                    });
                }
            } else {
                this.clearState();
            }
        });
    }

    private clearState(): void {
        this.account = undefined;
        this.link = null;
        this.emit('account', undefined);
        this.emit('link', undefined);
    }
    // #endregion

    // #region Account Management
    async checkAccount(account?: ConnectedAccount) {
        if (!account) {
            if (!this.username || !this.connect.address) {
                this.account = undefined;
                this.noAccount = true;
                this.emit('account', undefined);
                return;
            }
            account = { 
                username: this.username.toString(), 
                address: this.connect.address, 
                type: 'metamask' 
            };
        }

        this.storeLocalPubKey(account.address);
        
        try {
            const accountData = await this.getAccount(account.username);
            this.noAccount = false;
            if (accountData.hasOwnProperty('query_time_ms')) {
                this.account = (accountData as API.v2.GetAccountResponse).account;
            } else {
                this.account = accountData as API.v1.AccountObject;
            }
            this.emit('account', this.account);
            
            // Check link status after successful account fetch
            await this.checkLinkByUsername(account.username);
        } catch (err) {
            this.account = undefined;
            this.noAccount = true;
            this.emit('account', undefined);
            console.error('Failed to check account:', err);
        }
    }

    async getAccount(name: NameType, tryOnce?: boolean): Promise<API.v2.GetAccountResponse | API.v1.AccountObject> {
        if (!this.api.v2Provider) return this.api.v1.chain.get_account(name);
        try {
            const res: any = await this.api.v2.state.get_account(name.toString());
            if (res.statusCode && res.statusCode == 500) throw new Error('Account not found');
            return res as API.v2.GetAccountResponse;
        } catch (err) {
            if (!tryOnce) return this.api.v1.chain.get_account(name);
            throw new Error('Account not found');
        }
    }
    // #endregion

    // #region Public Key Management
    storeLocalPubKey(address: string) {
        const storedKey = this.getPubKeyByAddress(address);
        if (storedKey) {
            this._ethPubKey = storedKey;
        }
    }

    getPubKeyByAddress(address: string): string | undefined {
        const keys = this.pubKeys;
        return keys ? keys[address] : undefined;
    }

    async retrievePubKey(): Promise<string | undefined> {
        console.log('Retrieving public key...', this.pubKey);

        if (this.pubKey) return this.pubKey;

        try {
            const sig = await this.connect.signWeb3Message(PUB_KEY_MSG);
            this._ethPubKey = this.recoverPubKey(PUB_KEY_MSG, sig);
            return this._ethPubKey;
        } catch (err:any) {
            console.error('Error retrieving public key:', err);
            throw new Error(err);
        }
    }

    recoverPubKey(message: string, signature: string): string {
        const msgHash = ethers.hashMessage(message);
        return ethers.SigningKey.recoverPublicKey(msgHash, signature);
    }
    // #endregion

    // #region Link Management
    checkLinkByUsername(username?: NameType): Promise<AuthMsgLink> {
        return new Promise((resolve, reject) => {
            if (!username && !this.username) {
                this.link = null;
                this.emit('link', undefined);
                reject('No username provided or found.');
                return;
            }

            if (!username) username = this.username;
            
            this.getRows({
                contract: 'auth.msg',
                table: 'links',
                key_type: 'name',
                index_position: 'secondary',
                lower_bound: username,
                upper_bound: username,
            })
            .then((res: any) => {
                if (res.rows.length) {
                    this.link = res.rows[0] as AuthMsgLink;
                    console.log('Link found for', username?.toString(), this.link);
                    this.emit('link', this.link);
                    resolve(this.link);
                } else {
                    this.link = null;
                    console.log('No link found for', username?.toString());
                    this.emit('link', undefined);
                    reject('No link found for username: ' + username);
                }
            })
            .catch((err: any) => {
                this.link = undefined;
                this.emit('link', undefined);
                console.error('Error checking link:', err);
                reject('Error checking if account is linked: ' + err);
            });
        });
    }

    async createLink(username: NameType) {
        if (!this.connect.connected)
            throw new Error("No wallet connected, connect first.");

        // Step 1: Need users public key.
        if (!this.pubKey)
            await this.retrievePubKey().catch(err => { throw new Error(err); });
        if (!this.pubKey)
            throw new Error('Failed to get public key from Ethereum wallet.');

        // Convert actions to digests and sign with Ethereum wallet, push singed transaction to wire
        const compressed = getCompressedPublicKey(this.pubKey);
        const nonce = new Date().getTime();
        const msg_hash = ethers.keccak256(new Uint8Array(Buffer.from(compressed + nonce + username)));
        const messageBytes = ethers.getBytes(msg_hash);
        const eth_sig = await this.connect.signWeb3Message(messageBytes).catch(err => { throw new Error(err); });
        const wire_sig = evmSigToWIRE(eth_sig);
        const create_link_receipt = await this.pushTransaction({
            account: 'auth.msg',
            name: 'createlink',
            authorization: [{ actor: username, permission: 'active' }],
            data: {
                sig: wire_sig,
                msg_hash: msg_hash.slice(2),
                nonce: nonce,
                account_name: username,
            },
        }).catch((err: any) => {
            console.log(err);
            throw new Error(err);
        });

        return create_link_receipt;
    }

    async linkAuthExt(username: NameType) {
        if (!this.connect.connected)
            throw new Error("No Ethereum wallet found, 'WNS.connect' first.");

        // Linking 'auth.ext' permission with WNS contract actions.
        const linkAuthActions: AnyAction[] = [];
        this.SETTLE_AUTH_ACTIONS.forEach(action =>
            linkAuthActions.push({
                account: this.namespace,
                name: 'linkauth',
                authorization: [{ actor: username, permission: 'active' }],
                data: {
                    account: username,
                    code: 'settle.wns',
                    type: action,
                    requirement: 'auth.ext',
                },
            })
        );

        return this.pushTransaction(linkAuthActions);
    }
    // #endregion

    // #region Transaction Management
    async anyToAction(action: AnyAction | AnyAction[]): Promise<Action[]> {
        if (!Array.isArray(action)) action = [action];
        const actions: Action[] = [];
        const knownAbis = new Map<NameType, ABI>();
        for (const act of action) {
            if (!knownAbis.has(act.account)) {
                const abi_res = await this.api.v1.chain.get_abi(act.account);
                knownAbis.set(act.account, ABI.from(abi_res.abi!));
            }
            actions.push(Action.from(act, knownAbis.get(act.account)!));
        }
        return actions;
    }

    async pushTransaction(action: AnyAction | AnyAction[]): Promise<API.v1.PushTransactionResponse> {
        try {
            const actions = await this.anyToAction(action);
            const info = await this.api.v1.chain.get_info();
            const header = info.getTransactionHeader();
            const transaction = Transaction.from({ ...header, actions });
            const digest = transaction.signingDigest(info.chain_id);
            const messageBytes = ethers.getBytes('0x' + digest.hexString);
            const eth_sig = await this.connect.signWeb3Message(messageBytes).catch(err => { throw new Error(err); });
            const signature = evmSigToWIRE(eth_sig, 'EM');
            const signedTrx = SignedTransaction.from({ ...transaction, signatures: [signature] });
            return this.api.v1.chain.push_transaction(signedTrx);
        } catch (e: any) {
            if (e instanceof APIError) {
                throw new Error(e.details[0]?.message?.replace(/Error:/g, ''));
            } else {
                const msg = e.message?.replace(/Error:/g, '') || e;
                console.log(">>>", msg);
                throw new Error(msg);
            }
        }
    }

    public async getRows<T = any>(options: GetRowsOptions): Promise<API.v1.GetTableRowsResponse<any, T>> {
        try {
            // Trim string fields
            for (const key in options) {
                if (typeof options[key] === 'string') {
                    options[key] = (options[key] as string).trim();
                }
            }
            if (!options.key_type) options.key_type = 'i64'; // default to int keytype
        
            const result = await this.api.v1.chain.get_table_rows({
                json: true,
                code: options.contract,
                scope: options.scope !== undefined ? options.scope : options.contract,
                table: options.table,
                index_position: options.index_position,
                limit: options.limit ?? DEFAULT_LIMIT,
                lower_bound: options.lower_bound as any,
                upper_bound: options.upper_bound as any,
                key_type: options.key_type,
                reverse: options.reverse,
            });

            return result as API.v1.GetTableRowsResponse<any, T>;
        } catch (e: any) {
            console.error('getRows error:', e.error?.details?.[0]?.message);
            throw e;
        }
    }
    // #endregion
} 