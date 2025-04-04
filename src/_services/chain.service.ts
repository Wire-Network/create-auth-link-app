import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { API, APIClient, FetchProvider, NameType } from "@wireio/core";
import { WireChain, WireChainStats, GetRowsOptions } from '../types/interfaces';

export const DEFAULT_LIMIT = 50;

@Injectable({
    providedIn: 'root'
})
export class ChainService {
    private isBrowser: boolean;
    private chainSubject = new BehaviorSubject<WireChain | undefined>(undefined);
    
    public chain$ = this.chainSubject.asObservable();
    public info?: API.v1.GetInfoResponse;
    public stats?: WireChainStats;
    public recentBlocks: API.v1.GetBlockResponse[] = [];

    // Chain Configuration
    private chains: WireChain[] = [
        {
            name: 'Local Chain',
            id: "local",
            endpoint: 'https://det-dev.gitgo.app',
            // hyperion: 'https://dev-hyperion.gitgo.app/v1/',
            // websocket: 'ws://det-dev.gitgo.app:8888',
            namespace: 'sysio',
            coreSymbol: 'SYS',
            selected: true
        },
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

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);
        this.initializeChains();
    }

    get selectedChain(): WireChain {
        return this.chains.find(chain => chain.selected)!;
    }

    get namespace(): string {
        return this.selectedChain.namespace;
    }

    get api(): APIClient {
        return new APIClient({ 
            provider: new FetchProvider(this.selectedChain.endpoint), 
            // hyperionUrl: this.selectedChain.hyperion 
        });
    }

    get availableChains(): WireChain[] {
        return this.chains;
    }

    private initializeChains(): void {
        if (this.isBrowser) {
            const storedChains = localStorage.getItem('wire-chains');
            if (!storedChains) {
                localStorage.setItem('wire-chains', JSON.stringify(this.chains));
            } else {
                this.chains = JSON.parse(storedChains);
            }
            this.chainSubject.next(this.selectedChain);
        }
    }

    selectChain(chainId: string): void {
        const previousChain = this.selectedChain;
        
        // Update chain selection
        this.chains = this.chains.map(chain => ({
            ...chain,
            selected: chain.id === chainId
        }));

        // Save to localStorage
        if (this.isBrowser) {
            localStorage.setItem('wire-chains', JSON.stringify(this.chains));
        }

        const newChain = this.selectedChain;
        if (previousChain.id !== newChain.id) {
            this.chainSubject.next(newChain);
        }
    }

    async getChainInfo(): Promise<API.v1.GetInfoResponse> {
        this.info = await this.api.v1.chain.get_info();
        return this.info;
    }

    async getRows<T = any>(options: GetRowsOptions): Promise<API.v1.GetTableRowsResponse<any, T>> {
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

    // Chain Stats
    async updateChainStats(): Promise<void> {
        try {
            const info = await this.getChainInfo();
            // Initialize with default values, these should be updated with actual data
            this.stats = {
                maxRam: 0,
                ramUsed: 0,
                ramFree: 0,
                ramFreePercentage: 0,
                ramStaked: 0,
                totalSupply: 0,
                stakedSupply: 0,
                circulatingSupply: 0,
                stakedToCirculatingRatio: 0,
                cpuLimitPerBlock: 0,
                netLimitPerBlock: 0,
                transactionsPerSecond: 0,
                maxTransactionsPerSecond: 0,
                blockCpuLimitPercentage: 0,
                blockNetLimitPercentage: 0,
                info: info
            };
        } catch (error) {
            console.error('Failed to update chain stats:', error);
        }
    }
} 