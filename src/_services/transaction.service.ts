import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Action, API, Transaction, SignedTransaction, ABI, AnyAction, APIError, NameType } from '@wireio/core';
import { ChainService } from './chain.service';
import { ConnectService } from '../_components/connect/connect.service';
import { ethers } from 'ethers';
import { evmSigToWIRE, getCompressedPublicKey } from '@wireio/wns';

export interface TransactionResult {
    transactionId: string;
    blockNum: number;
    status: 'executed' | 'failed' | 'pending';
    error?: string;
}

@Injectable({
    providedIn: 'root'
})
export class TransactionService {
    private pendingTransactionsSubject = new BehaviorSubject<string[]>([]);
    public pendingTransactions$ = this.pendingTransactionsSubject.asObservable();

    public SETTLE_AUTH_ACTIONS = [
        "initdeposit",
        "setpending",
        "canceldep",
        "utxoxfer",
        "withdraw"
    ];
    

    constructor(
        private chainService: ChainService,
        private connectService: ConnectService,
    ) {}

    async pushTransaction(action: AnyAction | AnyAction[]): Promise<API.v1.PushTransactionResponse> {
        try {
            const actions = await this.anyToAction(action);
            const info = await this.chainService.api.v1.chain.get_info();
            const header = info.getTransactionHeader();
            const transaction = Transaction.from({ ...header, actions });
            const digest = transaction.signingDigest(info.chain_id);
            const messageBytes = ethers.getBytes('0x' + digest.hexString);
            const ethSig = await this.connectService.signWeb3Message(messageBytes).catch(err => { throw new Error(err); });
            const signature = evmSigToWIRE(ethSig, 'EM');
            const signedTrx = SignedTransaction.from({ ...transaction, signatures: [signature] });
            return this.chainService.api.v1.chain.push_transaction(signedTrx);
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
    // Helper method to fetch ABIs and create actions
    async anyToAction(action: AnyAction | AnyAction[]): Promise<Action[]> {
        if (!Array.isArray(action)) action = [action];
        const actions: Action[] = [];
        const knownAbis = new Map<string, ABI>();
        
        for (const act of action) {
            const accountName = act.account.toString();
            if (!knownAbis.has(accountName)) {
                const abiResponse = await this.chainService.api.v1.chain.get_abi(accountName);
                if (abiResponse.abi) {
                    knownAbis.set(accountName, ABI.from(abiResponse.abi));
                }
            }
            
            if (knownAbis.has(accountName)) {
                actions.push(Action.from(act, knownAbis.get(accountName)!));
            } else {
                actions.push(Action.from(act));
            }
        }
        
        return actions;
    }

    async createLinkTransaction(username: string, pubKey: string): Promise<any> {
        const compressed = getCompressedPublicKey(pubKey);
        const nonce = new Date().getTime();
        const msgHash = ethers.keccak256(new Uint8Array(Buffer.from(compressed + nonce + username)));
        const messageBytes = ethers.getBytes(msgHash);
        const ethSig = await this.connectService.signWeb3Message(messageBytes).catch(err => { throw new Error(err); });
        const wireSig = evmSigToWIRE(ethSig);
        const createLinkReceipt = await this.pushTransaction({
            account: 'auth.msg',
            name: 'createlink',
            authorization: [{ actor: username, permission: 'active' }],
            data: {
                sig: wireSig,
                msg_hash: msgHash.slice(2),
                nonce: nonce,
                account_name: username,
            },
        }).catch((err: any) => {
            console.log(err);
            throw new Error(err);
        });

        return createLinkReceipt;
    }

    async linkAuthTransaction(username: string):Promise<any> {
      
        const linkAuthActions: AnyAction[] = [];
        this.SETTLE_AUTH_ACTIONS.forEach(action =>
            linkAuthActions.push({
                account: this.chainService.namespace,
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
} 