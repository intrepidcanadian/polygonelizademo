import { 
    type IAgentRuntime, 
    type Memory, 
    type State, 
    elizaLogger, 
    composeContext, 
    generateObjectDeprecated,
    ModelClass 
} from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";
import type { LaunchTokenParams, Transaction } from "../types";
import { launchTokenTemplate } from "../templates/launchtoken.ts";
import { ERC20_FACTORY_ABI } from "../abis";
import { MemoryManager } from "@elizaos/core";

// Factory contract that deploys new ERC20 tokens
export const FACTORY_ADDRESSES = {
    confluxESpaceTestnet: {
        TOKEN_FACTORY: '0xe389E971D1E66Fa2ba704f0FB8d1d1E631B42bFB' as const, // Your factory contract address
    }
} as const;

export class LaunchTokenAction {
    constructor(private walletProvider: WalletProvider) {}

    async launch(params: LaunchTokenParams): Promise<Transaction> {
        const walletClient = this.walletProvider.getWalletClient(params.chain);
        const publicClient = this.walletProvider.getPublicClient(params.chain);

        // Validate token parameters
        if (params.initialSupply <= 0) {
            throw new Error("Initial supply must be greater than 0");
        }

        // Deploy new token through factory
        const deployTx = await walletClient.writeContract({
            address: FACTORY_ADDRESSES[params.chain].TOKEN_FACTORY,
            abi: ERC20_FACTORY_ABI.abi,
            functionName: 'createToken',
            args: [
                params.name,
                params.symbol,
                BigInt(params.initialSupply)
            ],
            chain: this.walletProvider.chains[params.chain],
            account: walletClient.account
        });

        return {
            hash: deployTx,
            from: walletClient.account.address,
            to: FACTORY_ADDRESSES[params.chain].TOKEN_FACTORY,
            value: 0n,
            data: "0x",
        };
    }
}

export const launchTokenAction = {
    name: "launchtoken",
    description: "Launch a new ERC20 token on the specified chain",
    template: launchTokenTemplate,
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: Record<string, unknown>, callback?: (response: { text: string; content?: any }) => void) => {
        try {
            elizaLogger.debug("Handler called with message:", message.content?.text);

            if (message.content?.text) {
                const params = await generateObjectDeprecated({
                    runtime,
                    context: composeContext({ 
                        state: { ...state, recentMessages: message.content.text },
                        template: launchTokenTemplate
                    }),
                    modelClass: ModelClass.LARGE,
                }) as LaunchTokenParams;

                elizaLogger.debug("Generated params:", params);

                // Launch token directly
                const walletProvider = await initWalletProvider(runtime);
                const action = new LaunchTokenAction(walletProvider);
                const launchResp = await action.launch(params);

                if (callback) {
                    callback({
                        text: `🚀 Successfully launched token ${params.name}!\nTransaction Hash: ${launchResp.hash}`,
                        content: { success: true, hash: launchResp.hash }
                    });
                }
                return true;
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in token launch handler:", error);
            if (callback) {
                callback({ text: `❌ Error launching token: ${error.message}` });
            }
            return false;
        }
    },
    similes: ["CREATE_TOKEN", "DEPLOY_TOKEN", "NEW_TOKEN"],
    examples: [
        [{
            user: "user",
            content: {
                text: "Launch a new token called 'My Token' with symbol 'MTK' and supply of 1000000",
                action: "CREATE_TOKEN"
            }
        }]
    ],
    validate: async (runtime: IAgentRuntime) => {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        return typeof privateKey === "string" && privateKey.startsWith("0x");
    }
}; 