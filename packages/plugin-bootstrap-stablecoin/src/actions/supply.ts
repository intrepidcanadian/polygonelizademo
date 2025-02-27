import { type IAgentRuntime, type Memory, type State, elizaLogger, composeContext, generateObjectDeprecated, ModelClass } from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";
import { parseUnits, parseAbi } from "viem";
import type { Transaction } from "../types";
import { supplyTokenTemplate } from "../templates/supplyToken";
import { AAVEPOOLV3_ABI } from "../abis";

// Export these at the top level
export const TOKENS = {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' as `0x${string}`,
} as const;

export const AAVE_ADDRESSES = {
    polygon: {
        POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as `0x${string}`
    }
} as const;

export interface SupplyParams {
    chain: 'polygon';
    token: `0x${string}`;
    amount: string;
}

export function isSupplyParams(obj: any): obj is SupplyParams {
    return typeof obj === 'object' &&
           obj.chain === 'polygon' &&
           typeof obj.token === 'string' &&
           obj.token.startsWith('0x') &&
           typeof obj.amount === 'string';
}

export class SupplyAction {
    constructor(private walletProvider: WalletProvider) {}

    async supply(params: SupplyParams): Promise<Transaction> {
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

        // Approve AAVE Pool if needed
        const allowanceAbi = parseAbi(["function allowance(address,address) view returns (uint256)"]);
        const allowance = await publicClient.readContract({
            address: params.token,
            abi: allowanceAbi,
            functionName: "allowance",
            args: [walletClient.account.address, AAVE_ADDRESSES[params.chain].POOL]
        });

        if (allowance < amountIn) {
            const approvalTx = await walletClient.writeContract({
                address: params.token,
                abi: parseAbi(["function approve(address,uint256)"]),
                functionName: "approve",
                args: [AAVE_ADDRESSES[params.chain].POOL, amountIn],
                chain: this.walletProvider.chains[params.chain],
                account: walletClient.account
            });
            await publicClient.waitForTransactionReceipt({ hash: approvalTx });
        }

        // Execute supply
        const supplyTx = await walletClient.writeContract({
            address: AAVE_ADDRESSES[params.chain].POOL,
            abi: AAVEPOOLV3_ABI.abi,
            functionName: 'supply',
            args: [
                params.token,
                amountIn,
                walletClient.account.address,
                0 // referralCode
            ],
            chain: this.walletProvider.chains[params.chain],
            account: walletClient.account
        });

        return {
            hash: supplyTx,
            from: walletClient.account.address,
            to: AAVE_ADDRESSES[params.chain].POOL,
            value: 0n,
            data: "0x",
        };
    }
}

export const supplyTokenAction = {
    name: "supplyToken",
    description: "Supply tokens to AAVE v3 pool on Polygon",
    template: supplyTokenTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        const keywords = ["supply", "deposit", "stake", "lock", "lock tokens"];
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
            const supplyContext = composeContext({
                state: {
                    ...state,
                    recentMessages: message.content.text
                },
                template: supplyTokenTemplate,
            });
            
            const options = await generateObjectDeprecated({
                runtime,
                context: JSON.stringify(supplyContext),
                modelClass: ModelClass.LARGE,
            });

            elizaLogger.debug("Generated options:", options);

            if (!isSupplyParams(options)) {
                throw new Error("Invalid supply parameters: " + JSON.stringify(options));
            }

            const walletProvider = await initWalletProvider(runtime);
            const action = new SupplyAction(walletProvider);
            const supplyResp = await action.supply(options);

            if (callback) {
                const tokenName = options.token === TOKENS.USDC ? 'USDC' : 
                                options.token === TOKENS.DAI ? 'DAI' : 
                                'tokens';
                                
                callback({
                    text: `Successfully supplied ${options.amount} ${tokenName}\nTransaction Hash: ${supplyResp.hash}`,
                    content: {
                        success: true,
                        hash: supplyResp.hash,
                        chain: options.chain
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in supply handler:", error);
            elizaLogger.error("Error stack:", error.stack);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    similes: ["SUPPLY_TOKENS", "DEPOSIT_TOKENS", "STAKE_TOKENS", "SUPPLY_AAVE_V3"],
    examples: [
        [{
            user: "user",
            content: {
                text: "Supply 100 USDC to AAVE on Polygon",
                action: "SUPPLY_TOKENS"
            }
        }]
    ]
};
   