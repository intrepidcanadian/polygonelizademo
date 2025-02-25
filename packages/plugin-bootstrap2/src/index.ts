import type { Plugin } from "@elizaos/core";

export * as actions from "./actions/index.ts";
export * as evaluators from "./evaluators/index.ts";
export * as providers from "./providers/index.ts";

import { walletProvider } from "./providers/wallet";
import { ginsengSwapProvider } from "./providers/ginswap";
import { swapAction } from "./actions/swap";
import { timeProvider } from "./providers/time";
import { launchTokenAction } from "./actions/launchtoken.ts";

export const bootstrapPlugin2: Plugin = {
    name: "Ginseng Swap Plugin",
    description: "Plugin for swapping USDC/USDT tokens on Ginseng Swap (Uniswap V3 fork) on Conflux eSpace testnet and to launch tokens",
    actions: [swapAction, launchTokenAction],
    evaluators: [],
    providers: [walletProvider, ginsengSwapProvider, timeProvider],
};
export default bootstrapPlugin2;
