import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConnectService } from '../_components/connect/connect.service';
import { addressToWireName, evmSigToWIRE, getCompressedPublicKey } from "@wireio/wns";
import EventEmitter from "events";
import { ethers } from 'ethers';

import { ABI, Action, ActionTypedData, AnyAction, API, APIClient, APIError, Asset, Authority, Checksum256, Checksum256Type, FetchProvider, Name, NameType, PermissionLevel, SignedTransaction, Transaction, UInt256, UInt256Type, UInt64Type } from "@wireio/core";
import { BehaviorSubject, Subscription } from 'rxjs';
import { AuthMsgLink, ConnectedAccount, GetRowsOptions, WireChain, WireChainStats } from '../types/interfaces';

export const DEFAULT_LIMIT = 50
const PUB_KEY_MSG = 'Retrieve Public Key';

@Injectable()
export class SettleService extends EventEmitter {

    info?: API.v1.GetInfoResponse
    get namespace(){ return this.chain.namespace }

    private _ethPubKey?: string;
    get pubKey(): string | undefined {
        return this._ethPubKey;
    }

    noAccount = false;


    account? : API.v1.AccountObject | API.v2.Account
    recentBlocks: API.v1.GetBlockResponse[] = [];
    stats? : WireChainStats;
    chains : WireChain[] = [
        {
            name: 'Local Chain',
            id: "local",
            endpoint: 'http://localhost:8888/v1/chain',
            hyperion: 'http://localhost:8888/v1',
            websocket: 'ws://localhost:8888',
            namespace: 'eosio',
            coreSymbol: 'EOS',
            selected: true
        },
        {
            name: 'Wire Testnet',
            id: "065dcca2dc758af25bcf3b878260a19dd1b81e4597f2af15a262a0c67f1e0106",
            endpoint: 'https://testnet-00.wire.foundation',
            hyperion: 'https://testnet-hyperion.wire.foundation',
            websocket: 'ws://testnet-ship.wire.foundation',
            watchdawg: 'https://dawg.wire.foundation',
            namespace: 'sysio',
            coreSymbol: 'SYS',
            selected: false
        },
        {
            name: 'Wire Classic',
            id: "de9943091e811bfb246ca243144b4d274886b959bbb17dd33d0bc97c745dbbe0",
            endpoint: 'https://wire.siliconswamp.info',
            hyperion: 'https://hyperwire.airwire.io',
            websocket: 'ws://swamprod.airwire.io:8080',
            namespace: 'eosio',
            coreSymbol: 'EOS',
            selected: false
        },
        {
            name: 'Wire Classic Testnet',
            id: "3523eca96f08c0dd978f0bd527f64cd4327ab7ffce00d11daf97d0986a3f02b6",
            endpoint: 'https://val1.wire.foundation',
            hyperion: 'https://hyperion.wire.foundation',
            websocket: 'ws://val1.wire.foundation:8080',
            namespace: 'eosio',
            coreSymbol: 'EOS',
            selected: false
        }
    ];

    connectChange?: Subscription

    link?: AuthMsgLink | null

    private isBrowser: boolean;

    constructor(
        private connect: ConnectService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        super();
        this.isBrowser = isPlatformBrowser(platformId);

        if (this.isBrowser) {
            if (!localStorage.getItem('wire-chains')) {
                localStorage.setItem('wire-chains', JSON.stringify(this.chains));
            }
            this.chains = JSON.parse(localStorage.getItem('wire-chains')!);
        }

        this.connectChange = this.connect.connection$.subscribe((c) => {
            if (c) this.checkAccount(c.account);
        });
    }

    get pubKeys(): Record<string, string> | undefined {
        if (!this.isBrowser) return undefined;
        const keys = localStorage.getItem('pub_keys');
        return keys ? JSON.parse(keys) : undefined;
    }
    

    get chain() {
        return this.chains.find(chain => chain.selected)!;
    }
    get api(){
        return new APIClient({ provider: new FetchProvider(this.chain!.endpoint), hyperionUrl: this.chain!.hyperion })
    }

    private chainSubject = new BehaviorSubject<WireChain | undefined>(undefined);
    public chain$ = this.chainSubject.asObservable();    
    
    get username() : NameType | undefined {
        return this.connect.address ? Name.from(addressToWireName(this.connect.address!)) : undefined
    }



    SETTLE_AUTH_ACTIONS = [
        "initdeposit",
        "setpending",
        "canceldep",
        "utxoxfer",
        "withdraw"
    ];


    async checkAccount(account?: ConnectedAccount){
        if (!account) account = { username: this.username as string, address: this.connect.address as any, type: 'metamask' };
        this.storeLocalPubKey(account.address)
        this.getAccount(account.username).then(account => {
            this.noAccount = false
            if (account.hasOwnProperty('query_time_ms')) {
                this.account = (account as API.v2.GetAccountResponse).account
            }
            else {
                this.account = account as API.v1.AccountObject;
            }
            
        }, err => {
            this.account = undefined
            this.noAccount = true
        });
    }

    storeLocalPubKey(address: string) {
        const storedKey = this.getPubKeyByAddress(address);
        if (storedKey) {
            this._ethPubKey = storedKey;
            // console.log(`Public key for address ${address} loaded from local storage.`);
        } else {
            // console.log(`No public key found in local storage for address ${address}.`);
        }
    }

    getPubKeyByAddress(address: string): string | undefined {
        const keys = this.pubKeys;
        return keys ? keys[address] : undefined;
    }


    async getAccount(name: NameType, tryOnce?: boolean): Promise < API.v2.GetAccountResponse | API.v1.AccountObject> {
        if (!this.api.v2Provider) return this.api.v1.chain.get_account(name);
        else try {
            const res : any = await this.api.v2.state.get_account(name.toString());
            if (res.statusCode && res.statusCode == 500) throw new Error('Account not found');
            else return res as API.v2.GetAccountResponse;
        } catch (err) {
            if (!tryOnce) return this.api.v1.chain.get_account(name);
            else throw new Error('Account not found');
        }
    }

     /**
     * Fetches rows based on the provided options.
     * @param options The options for fetching rows.
     * @returns A Promise that resolves to the fetched rows.
     */
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
            const eth_sig = await this.connect.signWeb3Message(messageBytes).catch(err => { throw new Error(err) });
            const signature = evmSigToWIRE(eth_sig, 'EM');
            const signedTrx = SignedTransaction.from({ ...transaction, signatures: [signature] });
            return this.api.v1.chain.push_transaction(signedTrx)

        } catch (e: any) {
            if (e instanceof APIError) {
                let msg = e.details[0]?.message?.replace(/Error:/g, '');
                // console.log('PushTransaction API error:', msg);
                throw new Error(msg)
            }
            else {
                // console.log('PushTransaction unknown error:', e);
                let msg = e.message?.replace(/Error:/g, '') || e
                console.log(">>>", msg);
                
                // if (msg.contains('user rejected transaction')) msg = 'User rejected transaction';
                throw new Error(msg)
            }
        }
    }

    

     /**
     * Checks the 'auth.msg' contract's 'links' table by username to see if the provided EOS account is linked to an Ethereum address.
     * Will use the connected wallet's username if no username is provided.
     *
     `* @param username Username to check the link status of, if not provided will use the connected wallet's username.
     * @returns The link status of the provided EOS account as seen in the 'auth.msg' contract's 'links' table.
     */
     checkLinkByUsername(username?: NameType): Promise<AuthMsgLink> {
        return new Promise((resolve, reject) => {
            if (!username && !this.username) {
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
                    // console.log('Link stored for', this.username, this.link);
                    this.emit('link', this.link);
                    resolve(this.link);
                } else {
                    this.link = null;
                    this.emit('link', undefined);
                    reject('No link found for username: ' + username);
                }
            })
            .catch((err: any) => {
                this.link = undefined;
                reject('Error checking if account is linked: ' + err);
            });
        });
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


        /**
     * Recovers the public key from an Ethereum signed message.
     *
     * @param message The message that was signed.
     * @param signature The signature of the signed message.
     * @returns The public key that signed the message.
     */
        recoverPubKey(message: string, signature: string): string {
            const msgHash = ethers.hashMessage(message);
            return ethers.SigningKey.recoverPublicKey(msgHash, signature);
        }
    

    

     /**
     * Creates a link between the Ethereum account used to sign these transactions and the EOS account provided.
     * Once linked, the Ethereum account can sign transactions on behalf of the EOS account and will be granted the special 'auth.ext' permission.
     *
     * @param account_name EOS account name to link with Ethereum account.
     * @param pub_key Optional public key to use for linking. If not provided, will attempt to retrieve from Ethereum wallet.
     * @returns Returns the transaction receipts for the 'createlink' and 'linkauth' actions.
     */
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

        const link_auth_receipt = this.pushTransaction(linkAuthActions);

        return link_auth_receipt;
    }
} 