import { elizaLogger, IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

const timeProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {

        const currentDate = new Date();

        const humanReadable = new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "long",
        }).format(currentDate);

        const timestring = `The current date and time is ${humanReadable}. Please use this as your reference for any time-based operations or responses.`;

        elizaLogger.info("THIS IS THE TIME PROVIDER");
        elizaLogger.info(message);
        elizaLogger.info(state);
        elizaLogger.info(runtime);

        return timestring;
    },
};

export { timeProvider };
