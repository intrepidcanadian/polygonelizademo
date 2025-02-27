import { type IAgentRuntime, type Memory, type State, elizaLogger, composeContext, generateObjectDeprecated, ModelClass } from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";
import { parseUnits, parseAbi } from "viem";
import type { Transaction } from "../types";
import { withdrawTokenTemplate } from "../templates/withdrawToken";
import { AAVEPOOLV3_ABI } from "../abis";

// Reuse token addresses from supply action
export const TOKENS = {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as `0x${string}`,
} as const;

export const AAVE_ADDRESSES = {
    polygon: {
        POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as `0x${string}`
    }
} as const;

export interface WithdrawParams {
    chain: 'polygon';
    token: `0x${string}`;
    amount: string;
}

export function isWithdrawParams(obj: any): obj is WithdrawParams {
    return typeof obj === 'object' &&
           obj.chain === 'polygon' &&
           typeof obj.token === 'string' &&
           obj.token.startsWith('0x') &&
           typeof obj.amount === 'string';
}

export class WithdrawAction {
    constructor(private walletProvider: WalletProvider) {}

    async withdraw(params: WithdrawParams): Promise<Transaction> {
        const walletClient = this.walletProvider.getWalletClient(params.chain);
        const publicClient = this.walletProvider.getPublicClient(params.chain);

        // Get token decimals
        const decimalsAbi = parseAbi(["function decimals() view returns (uint8)"]);
        const decimals = await publicClient.readContract({
            address: params.token,
            abi: decimalsAbi,
            functionName: "decimals",
        });

        // Convert amount to proper decimals
        const amountIn = parseUnits(params.amount, decimals);

        // Execute withdraw
        const withdrawTx = await walletClient.writeContract({
            address: AAVE_ADDRESSES[params.chain].POOL,
            abi: AAVEPOOLV3_ABI.abi,
            functionName: 'withdraw',
            args: [
                params.token,
                amountIn,
                walletClient.account.address
            ],
            chain: this.walletProvider.chains[params.chain],
            account: walletClient.account
        });

        return {
            hash: withdrawTx,
            from: walletClient.account.address,
            to: AAVE_ADDRESSES[params.chain].POOL,
            value: 0n,
            data: "0x",
        };
    }
}

export const withdrawTokenAction = {
    name: "withdrawToken",
    description: "Withdraw tokens from AAVE v3 pool on Polygon",
    template: withdrawTokenTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        const keywords = ["withdraw", "remove", "unstake", "take out"];
        const text = message.content.text.toLowerCase();
        
        return typeof privateKey === "string" && 
               privateKey.startsWith("0x") && 
               keywords.some(keyword => text.includes(keyword));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: { text: string; content?: any }) => void
    ) => {
        try {
            const withdrawContext = composeContext({
                state: {
                    ...state,
                    recentMessages: message.content.text
                },
                template: withdrawTokenTemplate,
            });
            
            const options = await generateObjectDeprecated({
                runtime,
                context: JSON.stringify(withdrawContext),
                modelClass: ModelClass.LARGE,
            });

            elizaLogger.debug("Generated options:", options);

            if (!isWithdrawParams(options)) {
                throw new Error("Invalid withdraw parameters: " + JSON.stringify(options));
            }

            const walletProvider = await initWalletProvider(runtime);
            const action = new WithdrawAction(walletProvider);
            const withdrawResp = await action.withdraw(options);

            if (callback) {
                const tokenName = options.token === TOKENS.USDC ? 'USDC' : 
                                options.token === TOKENS.DAI ? 'DAI' : 
                                'tokens';
                                
                callback({
                    text: `Successfully withdrew ${options.amount} ${tokenName}\nTransaction Hash: ${withdrawResp.hash}`,
                    content: {
                        success: true,
                        hash: withdrawResp.hash,
                        chain: options.chain
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in withdraw handler:", error);
            elizaLogger.error("Error stack:", error.stack);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    similes: ["WITHDRAW_TOKENS", "REMOVE_TOKENS", "UNSTAKE_TOKENS", "WITHDRAW_AAVE_V3"],
    examples: [
        [{
            user: "user",
            content: {
                text: "Withdraw 100 USDC from AAVE on Polygon",
                action: "WITHDRAW_TOKENS"
            }
        }]
    ]
};
