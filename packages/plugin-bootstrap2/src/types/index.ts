import type { Token } from "@lifi/types";
import type {
    Account,
    Address,
    Chain,
    Hash,
    HttpTransport,
    PublicClient,
    WalletClient,
} from "viem";
import * as viemChains from "viem/chains";

const _SupportedChainList = Object.keys(viemChains) as Array<
    keyof typeof viemChains
>;
export type SupportedChain = "confluxESpaceTestnet" | "polygonAmoy";

// Transaction types
export interface Transaction {
    hash?: `0x${string}`;
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
    chainId?: number;
}

// Token types
export interface TokenWithBalance {
    token: Token;
    balance: bigint;
    formattedBalance: string;
    priceUSD: string;
    valueUSD: string;
}

export interface WalletBalance {
    chain: SupportedChain;
    address: Address;
    totalValueUSD: string;
    tokens: TokenWithBalance[];
}

// Chain configuration
export interface ChainMetadata {
    chainId: number;
    name: string;
    chain: Chain;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrl: string;
}

export interface ChainConfig {
    chain: Chain;
    publicClient: PublicClient<HttpTransport, Chain, Account | undefined>;
    walletClient?: WalletClient;
}

// Action parameters
export interface TransferParams {
    fromChain: SupportedChain;
    toAddress: Address;
    amount: string;
    data?: `0x${string}`;
}

export interface SwapParams extends Record<string, unknown> {
    chain: SupportedChain;
    fromToken: `0x${string}`;
    toToken: `0x${string}`;
    amount: string;
    slippage: number;
    feeTier: 500 | 3000 | 10000;
}

export interface QuoteParams extends Record<string, unknown> {
    chain: SupportedChain;
    fromToken: `0x${string}`;
    toToken: `0x${string}`;
    amount: string;
    feeTier: 500 | 3000 | 10000;
}

export interface BridgeParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    fromToken: Address;
    toToken: Address;
    amount: string;
    toAddress?: Address;
}

// Plugin configuration
export interface EvmPluginConfig {
    rpcUrl?: {
        ethereum?: string;
        abstract?: string;
        base?: string;
        sepolia?: string;
        bsc?: string;
        arbitrum?: string;
        avalanche?: string;
        polygon?: string;
        optimism?: string;
        cronos?: string;
        gnosis?: string;
        fantom?: string;
        fraxtal?: string;
        klaytn?: string;
        celo?: string;
        moonbeam?: string;
        aurora?: string;
        harmonyOne?: string;
        moonriver?: string;
        arbitrumNova?: string;
        mantle?: string;
        linea?: string;
        scroll?: string;
        filecoin?: string;
        taiko?: string;
        zksync?: string;
        canto?: string;
        alienx?: string;
    };
    secrets?: {
        EVM_PRIVATE_KEY: string;
    };
    testMode?: boolean;
    multicall?: {
        batchSize?: number;
        wait?: number;
    };
}

// LiFi types
export type LiFiStatus = {
    status: "PENDING" | "DONE" | "FAILED";
    substatus?: string;
    error?: Error;
};

export type LiFiRoute = {
    transactionHash: Hash;
    transactionData: `0x${string}`;
    toAddress: Address;
    status: LiFiStatus;
};

// Provider types
export interface TokenData extends Token {
    symbol: string;
    decimals: number;
    address: Address;
    name: string;
    logoURI?: string;
    chainId: number;
}

export interface TokenPriceResponse {
    priceUSD: string;
    token: TokenData;
}

export interface TokenListResponse {
    tokens: TokenData[];
}

export interface ProviderError extends Error {
    code?: number;
    data?: unknown;
}

export interface GinswapAddresses {
    FACTORY: `0x${string}`;
    ROUTER: `0x${string}`;
    QUOTER_V2: `0x${string}`;
}

// Add type guards section
export function isSwapParams(options: Record<string, unknown>): options is SwapParams {
    const slippage = typeof options.slippage === 'string' ? parseFloat(options.slippage) : options.slippage;
    const feeTier = typeof options.feeTier === 'string' ? parseInt(options.feeTier) : options.feeTier;

    return typeof options.chain === 'string' &&
           typeof options.fromToken === 'string' &&
           typeof options.toToken === 'string' &&
           typeof options.amount === 'string' &&
           typeof slippage === 'number' && !isNaN(slippage) &&
           [500, 3000, 10000].includes(feeTier as number);
}

export function isQuoteParams(options: Record<string, unknown>): options is QuoteParams {
    const feeTier = typeof options.feeTier === 'string' ? parseInt(options.feeTier) : options.feeTier;

    return typeof options.chain === 'string' &&
           typeof options.fromToken === 'string' &&
           typeof options.toToken === 'string' &&
           typeof options.amount === 'string' &&
           [500, 3000, 10000].includes(feeTier as number);
}