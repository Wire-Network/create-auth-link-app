import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Action, API, Name, PermissionLevel, Transaction, SignedTransaction, ABI, AnyAction, APIError, NameType } from '@wireio/core';
import { ChainService } from './chain.service';
import { AccountService } from './account.service';
import { ConnectService } from '../_components/connect/connect.service';
import { ethers } from 'ethers';
import { evmSigToWIRE, getCompressedPublicKey } from '@wireio/wns';
import { KeyService } from './key.service';

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
        private accountService: AccountService,
        private connectService: ConnectService,
        private keyService: KeyService
    ) {}

    async pushTransaction(action: AnyAction | AnyAction[]): Promise<API.v1.PushTransactionResponse> {
        try {
            const actions = await this.anyToAction(action);
            const info = await this.chainService.api.v1.chain.get_info();
            const header = info.getTransactionHeader();
            const transaction = Transaction.from({ ...header, actions });
            const digest = transaction.signingDigest(info.chain_id);
            const messageBytes = ethers.getBytes('0x' + digest.hexString);
            const eth_sig = await this.connectService.signWeb3Message(messageBytes).catch(err => { throw new Error(err); });
            const signature = evmSigToWIRE(eth_sig, 'EM');
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

    // async sendTransaction(actions: Action[]): Promise<TransactionResult> {
    //     const username = this.accountService.username;
    //     if (!username) {
    //         throw new Error('No username available for transaction');
    //     }

    //     try {
    //         // Add transaction to pending list
    //         const pendingTxs = this.pendingTransactionsSubject.value;
    //         this.pendingTransactionsSubject.next([...pendingTxs, 'pending']);

    //         // Get the latest blockchain info
    //         const info = await this.chainService.api.v1.chain.get_info();
    //         const header = info.getTransactionHeader();
            
    //         console.log('Transaction header:', header);
            
    //         // Create transaction
    //         const transaction = Transaction.from({ ...header, actions });
            
    //         // Sign the transaction with wallet
    //         const digest = transaction.signingDigest(info.chain_id);
    //         const messageBytes = ethers.getBytes('0x' + digest.hexString);
    //         console.log('Signing digest:', digest.hexString);
            
    //         const ethSignature = await this.connectService.signWeb3Message(messageBytes);
    //         const wireSignature = evmSigToWIRE(ethSignature, 'EM');
            
    //         console.log('Signature:', { ethSignature, wireSignature });
            
    //         // Create signed transaction
    //         const signedTransaction = SignedTransaction.from({ 
    //             ...transaction, 
    //             signatures: [wireSignature] 
    //         });
            
    //         // Push the transaction
    //         const result = await this.chainService.api.v1.chain.push_transaction(signedTransaction);
            
    //         console.log('Transaction result:', result);

    //         // Update pending transactions
    //         this.removePendingTransaction('pending');

    //         return {
    //             transactionId: result.transaction_id,
    //             blockNum: result.processed.block_num,
    //             status: 'executed'
    //         };
    //     } catch (error: any) {
    //         // Remove from pending list
    //         this.removePendingTransaction('pending');
    //         console.error('Transaction failed:', error);

    //         return {
    //             transactionId: '',
    //             blockNum: 0,
    //             status: 'failed',
    //             error: error.message || 'Transaction failed'
    //         };
    //     }
    // }

    private removePendingTransaction(txId: string): void {
        const pendingTxs = this.pendingTransactionsSubject.value;
        this.pendingTransactionsSubject.next(
            pendingTxs.filter(id => id !== txId)
        );
    }

    private getExpirationTime(): string {
        const date = new Date();
        date.setMinutes(date.getMinutes() + 30); // 30 minutes from now
        return date.toISOString().split('.')[0];
    }

    get hasPendingTransactions(): boolean {
        return this.pendingTransactionsSubject.value.length > 0;
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
                // Fallback if no ABI is available
                actions.push(Action.from(act));
            }
        }
        
        return actions;
    }

    async createLinkTransaction(username: string, pubKey: string): Promise<any> {
        const compressed = getCompressedPublicKey(pubKey);
        const nonce = new Date().getTime();
        const msg_hash = ethers.keccak256(new Uint8Array(Buffer.from(compressed + nonce + username)));
        const messageBytes = ethers.getBytes(msg_hash);
        const eth_sig = await this.connectService.signWeb3Message(messageBytes).catch(err => { throw new Error(err); });
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

    // async linkAuthTransaction(username: string): Promise<TransactionResult> {
    //     const action: AnyAction = {
    //         account: Name.from(this.chainService.namespace),
    //         name: Name.from('linkauth'),
    //         authorization: [
    //             {
    //                 actor: Name.from(username),
    //                 permission: Name.from('active')
    //             }
    //         ],
    //         data: {
    //             account: username,
    //             code: 'auth.msg',
    //             type: 'createlink',
    //             requirement: 'active'
    //         }
    //     };
        
    //     // First fetch the ABI to properly serialize the action
    //     const actions = await this.anyToAction(action);
    //     // return this.sendTransaction(actions);

    //     return [] as any
    // }
} 