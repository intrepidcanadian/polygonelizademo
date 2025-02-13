import { type IAgentRuntime, type Memory, type State, elizaLogger, composeContext, generateObjectDeprecated, ModelClass, type TemplateType } from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";
import { parseUnits, parseAbi } from "viem";
import type { SwapParams, Transaction } from "../types";
import { swapTemplate } from "../templates";
import { QUOTER_V2_ABI as QUOTER_ABI, SWAP_ROUTER_ABI as ROUTER_ABI } from "../abis";
import { isSwapParams } from "../types";

// Export these at the top level
export const TOKENS = {
    USDC: '0x349298b0e20df67defd6efb8f3170cf4a32722ef' as const,
    USDT: '0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355' as const,
} as const;

export const GINSWAP_ADDRESSES = {
    confluxESpaceTestnet: {
        FACTORY: '0x7e4B6F3A158b1728444d2D5EAec72e081e7d9c48',
        ROUTER: '0x5F3147353c3da9bd0EC2F8F511BD73EcCDf4D9b0',
        QUOTER_V2: '0x7C4a791F8285bD32DDfb33E8c660C3254a9Ba72e'
    }
} as const;

export class SwapAction {
    constructor(private walletProvider: WalletProvider) {}

    async swap(params: SwapParams): Promise<Transaction> {
        // Validate token pair
        if (!this.isValidTokenPair(params.fromToken, params.toToken)) {
            throw new Error("Only USDC/USDT swaps are supported");
        }

        const walletClient = this.walletProvider.getWalletClient(params.chain);
        const publicClient = this.walletProvider.getPublicClient(params.chain);

        // Use params.feeTier instead of hardcoded value
        const FEE_TIER = params.feeTier;

        // Get token decimals
        const decimalsAbi = parseAbi(["function decimals() view returns (uint8)"]);
        const decimals = await publicClient.readContract({
            address: params.fromToken,
            abi: decimalsAbi,
            functionName: "decimals",
        });

        // Convert amount to proper decimals
        const amountIn = parseUnits(params.amount, decimals);

        // Get quote from Quoter
        const quoteResponse = await publicClient.readContract({
            address: GINSWAP_ADDRESSES[params.chain].QUOTER_V2,
            abi: QUOTER_ABI.abi,
            functionName: 'quoteExactInputSingle',
            args: [{
                tokenIn: params.fromToken,
                tokenOut: params.toToken,
                amountIn,
                fee: FEE_TIER,
                sqrtPriceLimitX96: 0n
            }]
        }) as [bigint, bigint, number, bigint];  // Type the response correctly

        // Calculate minimum amount out with slippage
        const basisPoints = 10000n;  // 100%
        const slippageBips = BigInt(Math.floor(params.slippage * 100));  // Convert percentage to BigInt bips
        const minAmountOut = (quoteResponse[0] * (basisPoints - slippageBips)) / basisPoints;

        // Approve Router if needed
        const allowanceAbi = parseAbi(["function allowance(address,address) view returns (uint256)"]);
        const allowance = await publicClient.readContract({
            address: params.fromToken,
            abi: allowanceAbi,
            functionName: "allowance",
            args: [walletClient.account.address, GINSWAP_ADDRESSES[params.chain].ROUTER]
        });

        if (allowance < amountIn) {
            const approvalTx = await walletClient.writeContract({
                address: params.fromToken,
                abi: parseAbi(["function approve(address,uint256)"]),
                functionName: "approve",
                args: [GINSWAP_ADDRESSES[params.chain].ROUTER, amountIn],
                chain: this.walletProvider.chains[params.chain],
                account: walletClient.account
            });
            await publicClient.waitForTransactionReceipt({ hash: approvalTx });
        }

        // Execute swap
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min deadline
        const swapTx = await walletClient.writeContract({
            address: GINSWAP_ADDRESSES[params.chain].ROUTER,
            abi: ROUTER_ABI.abi,
            functionName: 'exactInputSingle',
            args: [{
                tokenIn: params.fromToken,
                tokenOut: params.toToken,
                fee: FEE_TIER,
                recipient: walletClient.account.address,
                deadline,
                amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0n
            }],
            chain: this.walletProvider.chains[params.chain],
            account: walletClient.account
        });

        return {
            hash: swapTx,
            from: walletClient.account.address,
            to: GINSWAP_ADDRESSES[params.chain].ROUTER,
            value: 0n,
            data: "0x", // Actual transaction data will be handled by viem
        };
    }

    private isValidTokenPair(fromToken: string, toToken: string): boolean {
        const validTokens = [TOKENS.USDC, TOKENS.USDT];
        return validTokens.includes(fromToken as any) && 
               validTokens.includes(toToken as any) && 
               fromToken !== toToken &&  // Make sure tokens are different
               ((fromToken === TOKENS.USDC && toToken === TOKENS.USDT) ||
                (fromToken === TOKENS.USDT && toToken === TOKENS.USDC));
    }
}

export const swapAction = {
    name: "swap",
    description: "Swap tokens on Ginseng Swap (Uniswap V3 fork)",
    template: swapTemplate,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: { text: string; content?: any }) => void
    ) => {
        try {
            // Generate swap parameters from template
            const swapContext = composeContext({
                state,
                template: swapTemplate,
            });
            
            const options = await generateObjectDeprecated({
                runtime,
                context: swapContext,
                modelClass: ModelClass.LARGE,
            });

            elizaLogger.debug("Generated options:", options);

            if (!isSwapParams(options)) {
                throw new Error("Invalid swap parameters: " + JSON.stringify(options));
            }

            const walletProvider = await initWalletProvider(runtime);
            const action = new SwapAction(walletProvider);
            const normalizedOptions = {
                ...options,
                slippage: typeof options.slippage === 'string' ? parseFloat(options.slippage) : options.slippage,
                feeTier: typeof options.feeTier === 'string' ? 
                    parseInt(options.feeTier) as 500 | 3000 | 10000 : 
                    options.feeTier
            } as SwapParams;
            const swapResp = await action.swap(normalizedOptions);

            if (callback) {
                callback({
                    text: `Successfully swapped ${options.amount} tokens\nTransaction Hash: ${swapResp.hash}`,
                    content: {
                        success: true,
                        hash: swapResp.hash,
                        chain: options.chain
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in swap handler:", error);
            elizaLogger.error("Error stack:", error.stack);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    similes: ["TOKEN_SWAP", "EXCHANGE_TOKENS", "TRADE_TOKENS"],
    examples: [
        [{
            user: "user",
            content: {
                text: "Swap 100 USDC for USDT on Conflux eSpace testnet",
                action: "TOKEN_SWAP"
            }
        }]
    ],
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    }
}
