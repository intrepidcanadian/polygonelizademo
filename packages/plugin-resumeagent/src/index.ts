import type { Plugin } from "@elizaos/core";
import * as actions from "./actions";
import * as providers from "./providers";

import { resumeParserProvider } from "./providers/resumeParser";
import { parseResumeAction } from "./actions";
import { uploadResumeAction } from "./actions";

// Export the plugin as both named and default export
export const resumeagentPlugin: Plugin = {
    name: "resumeAgent",
    description: "AI Agent for Resume Parsing",
    actions: [
        parseResumeAction,
        uploadResumeAction
    ],
    evaluators: [],
    providers: [
        resumeParserProvider
    ],
    services: [],
};

export default resumeagentPlugin; 
