import { type IAgentRuntime, type Memory, type State, elizaLogger, composeContext, generateObjectDeprecated, ModelClass, type TemplateType } from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";
import { parseUnits, parseAbi } from "viem";
import type { SwapParams, Transaction } from "../types";
import { swapTemplate } from "../templates";
import { QUOTER_V2_ABI as QUOTER_ABI, SWAP_ROUTER_ABI as ROUTER_ABI } from "../abis";
import { isSwapParams } from "../types";

// Export these at the top level
export const TOKENS = {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const,
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as const,
} as const;

export const UNISWAP_ADDRESSES = {
    polygon: {
        FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
    }
} as const;

export class SwapAction {
    constructor(private walletProvider: WalletProvider) {}

    async swap(params: SwapParams): Promise<Transaction> {
        // Validate token pair
        if (!this.isValidTokenPair(params.fromToken, params.toToken)) {
            throw new Error("Only USDC/DAI swaps are supported");
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
            address: UNISWAP_ADDRESSES[params.chain].QUOTER_V2,
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
            args: [walletClient.account.address, UNISWAP_ADDRESSES[params.chain].ROUTER]
        });

        if (allowance < amountIn) {
            const approvalTx = await walletClient.writeContract({
                address: params.fromToken,
                abi: parseAbi(["function approve(address,uint256)"]),
                functionName: "approve",
                args: [UNISWAP_ADDRESSES[params.chain].ROUTER, amountIn],
                chain: this.walletProvider.chains[params.chain],
                account: walletClient.account
            });
            await publicClient.waitForTransactionReceipt({ hash: approvalTx });
        }

        // Execute swap
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min deadline
        const swapTx = await walletClient.writeContract({
            address: UNISWAP_ADDRESSES[params.chain].ROUTER,
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
            to: UNISWAP_ADDRESSES[params.chain].ROUTER,
            value: 0n,
            data: "0x", // Actual transaction data will be handled by viem
        };
    }

    private isValidTokenPair(fromToken: string, toToken: string): boolean {
        const validTokens = [TOKENS.USDC, TOKENS.DAI];
        return validTokens.includes(fromToken as any) && 
               validTokens.includes(toToken as any) && 
               fromToken !== toToken &&  // Make sure tokens are different
               ((fromToken === TOKENS.USDC && toToken === TOKENS.DAI) ||
                (fromToken === TOKENS.DAI && toToken === TOKENS.USDC));
    }
}

export const swapAction = {
    name: "swap",
    description: "Swap tokens on Uniswap v3 on Polygon",
    template: swapTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        const keywords = ["swap", "trade", "exchange", "convert", "token", "tokens", "swap tokens"]
        const text = message.content.text.toLowerCase();
        const hasKeyword = keywords.some(keyword => text.includes(keyword));

        return typeof privateKey === "string" && privateKey.startsWith("0x") && hasKeyword;
    },
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
                    parseInt(options.feeTier) as 100 : 
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
                text: "Swap 100 USDC for USDT on Polygon",
                action: "TOKEN_SWAP"
            }
        }]
    ]
}
