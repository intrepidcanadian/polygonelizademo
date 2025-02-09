import type { Plugin } from "@elizaos/core";
import { testAction } from "./actions/testAction";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const bootstrapPlugin2: Plugin = {
    name: "bootstrap",
    description: "Agent bootstrap with basic actions and evaluators",
    actions: [testAction],
    evaluators: [],
    providers: [],
};
export default bootstrapPlugin2;
