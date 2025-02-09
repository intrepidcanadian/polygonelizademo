import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";

export class TestAction {
    constructor() {}

    async sayHi(): Promise<string> {
        return "hi tony";
    }
}

export const testAction = {
    name: "test",
    description: "A test action that logs 'hi tony'",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: any,
        callback?: any
    ) => {
        elizaLogger.log("Test action handler called");
        const action = new TestAction();

        try {
            const response = await action.sayHi();
            if (callback) {
                callback({
                    text: response,
                    content: {
                        success: true,
                        message: response
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in test handler:", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    validate: async (_runtime: IAgentRuntime) => {
        return true; // No validation needed for this simple test
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Run test action",
                    action: "TEST_ACTION",
                },
            },
        ],
    ],
    similes: ["TEST_ACTION", "TEST", "HELLO"],
};
