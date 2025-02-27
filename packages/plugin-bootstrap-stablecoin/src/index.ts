import type { Plugin } from "@elizaos/core";

export * as actions from "./actions/index.ts";
export * as evaluators from "./evaluators/index.ts";
export * as providers from "./providers/index.ts";

import { walletProvider } from "./providers/wallet.ts";
import { uniswapSwapProvider } from "./providers/uniswap.ts";
import { swapAction } from "./actions/swap.ts";
import { yieldAction } from "./actions/yield.ts";
import { timeProvider } from "./providers/time.ts";
import { supplyTokenAction } from "./actions/supply.ts";
import { withdrawTokenAction } from "./actions/withdraw.ts";
import { shoppingAction } from "./actions/shopping.ts";

export const bootstrapPlugin2: Plugin = {
    name: "Stablecoin Management Plugin",
    description: "Plugin where you can manage stablecoins by swapping them on Uniswap V3 or supply them on AAVE. You can also create shopping lists from Amazon",
    actions: [swapAction, yieldAction, supplyTokenAction, withdrawTokenAction, shoppingAction],
    evaluators: [],
    providers: [walletProvider, uniswapSwapProvider, timeProvider],
};
export default bootstrapPlugin2;
