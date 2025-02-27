import { type WalletProvider } from "./wallet";
import { UNISWAP_ADDRESSES, TOKENS } from "../actions/swap";
import { type SupportedChain } from "../types";
import { parseUnits, formatUnits } from "viem";
import { QUOTER_V2_ABI as QUOTER_ABI } from "../abis";
import { type IAgentRuntime, type Memory, type State, type Provider, ModelClass } from "@elizaos/core";
import { initWalletProvider } from "./wallet";
import { generateObjectDeprecated, composeContext } from "@elizaos/core";
import { quoteTemplate } from "../templates";
import { isQuoteParams } from "../types";

export interface IUniswapSwapProvider {
    getPools(): Record<string, Record<number, string>>;
    getQuote(params: QuoteParams): Promise<QuoteResult>;
}

interface QuoteParams {
    chain: SupportedChain;
    fromToken: `0x${string}`;
    toToken: `0x${string}`;
    amount: string;
    feeTier: number;
}

interface QuoteResult {
    amountOut: string;
    priceImpact: string;
    ticksCrossed: number;
    estimatedGas: string;
}

export const uniswapSwapProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string | null> {
        try {
            const walletProvider = await initWalletProvider(runtime);
            const uniswap = new UniswapSwapProvider(walletProvider);
            const pools = uniswap.getPools();

            let quoteInfo = '';
            if (message?.content?.action === "GET_QUOTE") {
                const options = await generateObjectDeprecated({
                    runtime,
                    context: composeContext({ state, template: quoteTemplate }),
                    modelClass: ModelClass.LARGE,
                });

                if (!isQuoteParams(options)) {
                    throw new Error("Invalid quote parameters");
                }

                const quote = await uniswap.getQuote(options);
                quoteInfo = `The current quote for exchanging ${options.amount} ${options.fromToken === TOKENS.USDC ? 'USDC' : 'USDT'} is ${Number(quote.amountOut).toFixed(6)} ${options.toToken === TOKENS.USDC ? 'USDC' : 'USDT'}`;
            }

            return `The pools on Uniswap are ${JSON.stringify(pools)}${quoteInfo ? '. ' + quoteInfo : ''}`;
        } catch (error) {
            console.error("Error in Uniswap provider:", error);
            return null;
        }
    }
};

export class UniswapSwapProvider implements IUniswapSwapProvider {
    constructor(private walletProvider: WalletProvider) {}

    getPools() {
        return {
            'USDC-DAI': {
                100: '0xf369277650aD6654f25412ea8BFBD5942733BaBC',
            }
        };
    }

    async getQuote(params: QuoteParams) {
        const publicClient = this.walletProvider.getPublicClient(params.chain);
        
        // Get token decimals
        const decimalsAbi = ["function decimals() view returns (uint8)"];
        const decimals = await publicClient.readContract({
            address: params.fromToken,
            abi: decimalsAbi,
            functionName: "decimals",
        }) as number;

        // Get quote
        const result = await publicClient.readContract({
            address: UNISWAP_ADDRESSES[params.chain].QUOTER_V2,
            abi: QUOTER_ABI.abi,
            functionName: 'quoteExactInputSingle',
            args: [{
                tokenIn: params.fromToken,
                tokenOut: params.toToken,
                amount: parseUnits(params.amount, decimals),
                fee: params.feeTier,
                sqrtPriceLimitX96: 0n
            }]
        }) as [bigint, bigint, number, bigint];

        const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

        return {
            amountOut: formatUnits(amountOut, decimals),
            priceImpact: sqrtPriceX96After.toString(),
            ticksCrossed: initializedTicksCrossed,
            estimatedGas: gasEstimate.toString()
        };
    }
} 