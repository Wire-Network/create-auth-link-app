import { API, Checksum256Type, NameType } from "@wireio/core";

export interface AuthMsgLink {
    key: number;
    account_name: string;
    pub_key: string;
    eth_address: number[] | Uint8Array;
    address?: string;
    comp_key: string;
}


export interface GetRowsOptions {
    contract: NameType;
    scope?: NameType;
    table: NameType;
    index_position?: "primary" | "secondary" | "tertiary" | "fourth" | "fifth" | "sixth" | "seventh" | "eighth" | "ninth" | "tenth" | undefined;
    limit?: number;
    lower_bound?: API.v1.TableIndexType | string;
    upper_bound?: API.v1.TableIndexType | string;
    key_type?: keyof API.v1.TableIndexTypes;

    reverse?: boolean;
    [key: string]: any; // Add this line
}


export interface WireChainStats {
    maxRam: number;
    ramUsed: number;
    ramFree: number;
    ramFreePercentage: number;
    ramStaked: number;
    totalSupply: number;
    stakedSupply: number;
    circulatingSupply: number;
    stakedToCirculatingRatio: number;
    cpuLimitPerBlock: number;
    netLimitPerBlock: number;
    transactionsPerSecond: number;
    maxTransactionsPerSecond: number;
    blockCpuLimitPercentage: number;
    blockNetLimitPercentage: number;
    info: API.v1.GetInfoResponse;
}


export interface WireChain {
    id: Checksum256Type;
    name: string;
    endpoint: string;
    hyperion?: string;
    websocket?: string;
    watchdawg?: string;
    namespace: string;
    coreSymbol: string;
    selected?: boolean;
}


export interface ConnectedAccount {
    selected?: boolean;
    address: string;
    type: AccountType;
    username: string;
}

export type AccountType = 'metamask' | 'walletconnect' | 'coinbasewallet';
