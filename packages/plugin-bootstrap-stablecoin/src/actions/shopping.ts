import { elizaLogger, IAgentRuntime, Memory, State, MemoryManager } from "@elizaos/core";
import { shoppingTemplate } from "../templates/shopping";
import { composeContext, ModelClass } from "@elizaos/core";
import { shoppingFormatTemplate } from "../templates/shoppingformat";
import { generateObjectDeprecated } from "@elizaos/core";
import { randomUUID } from "crypto";

async function getShopping(options: any) {
    try {
        const response = await fetch('http://localhost:8888/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options)
        });

        const data = await response.json();
        return data;
    } catch (error) {
        elizaLogger.error('Error fetching shopping data:', error);
        throw error;
    }
}

export const shoppingAction = {
    name: "GET_SHOPPING_LIST",
    description: "Find and compare prices for items across different stores",
    template: shoppingTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        const requiredTerms = ['find', 'what', 'show', 'compare', 'shopping', 'list'];
        
        const hasRequiredTerms = requiredTerms.some(term => text.includes(term));
        
        return hasRequiredTerms;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: any, callback: any) => {
        try {
            const shoppingContext = composeContext({
                state: {
                    ...state,
                    recentMessages: message.content.text
                },
                template: shoppingTemplate
            });

            const options = await generateObjectDeprecated({
                runtime,
                context: JSON.stringify(shoppingContext),
                modelClass: ModelClass.LARGE,
            });
        
            const rawShoppingResp = await getShopping(options);
            
            elizaLogger.debug('RAW SHOPPING RESPONSE:', {
                raw: rawShoppingResp,
                type: typeof rawShoppingResp
            });

            // Extract the text content from the AgentHistoryList response
            let itemText = "";
            if (rawShoppingResp) {
                // First try to find the 'done' action with the final list
                const doneMatch = rawShoppingResp.result.match(/ActionResult\(is_done=True,\s*extracted_content="([^"]+)"/);
                if (doneMatch) {
                    itemText = doneMatch[1].replace(/\*\*/g, '').replace(/\\n/g, '\n');
                    elizaLogger.debug('Found completed action text:', { itemText });
                } else {
                    // Fallback: look for the done object in all_model_outputs
                    const doneOutputMatch = rawShoppingResp.result.match(/'done':\s*{'text':\s*"([^"]+)"}/);
                    if (doneOutputMatch) {
                        itemText = doneOutputMatch[1].replace(/\*\*/g, '').replace(/\\n/g, '\n');
                        elizaLogger.debug('Found done output text:', { itemText });
                    }
                }
            }

            console.log("this is the itemText", itemText);

            // // Then proceed with context composition
            // const shoppingFormatContext = composeContext({
            //     state: {
            //         ...state,
            //         rawShoppingResp: itemText
            //     },
            //     template: shoppingFormatTemplate
            // });

            // const shoppingResp = await generateObjectDeprecated({
            //     runtime,
            //     context: shoppingFormatContext,
            //     modelClass: ModelClass.LARGE,
            // });

            // elizaLogger.debug('SHOPPING RESPONSE:', {
            //     raw: shoppingResp,
            //     type: typeof shoppingResp,
            //     keys: Object.keys(shoppingResp || {})
            // });

            // // Use shoppingResp directly since it's already an object
            // const items = shoppingResp?.items || [];

            // console.log("this is the items", items);

            // elizaLogger.debug('Items:', {
            //     itemCount: items.length,
            //     items
            // });

            // // Store shopping data in memory
            // const shoppingManager = new MemoryManager({
            //     runtime,
            //     tableName: "memories"
            // });

            // // Format items for storage
            // const formattedItems = items.map(item => ({
            //     name: item.name || 'Unknown Item',
            //     brand: item.brand || 'Unknown Brand',
            //     price: item.price ? `$${item.price}` : 'Price not available'
            // }));

            // const shoppingMemory = {
            //     id: randomUUID(),
            //     type: 'SHOPPING_LIST',
            //     userId: state.agentId!,
            //     agentId: state.agentId,
            //     content: {
            //         text: JSON.stringify(formattedItems, null, 2),  // Pretty print the formatted items
            //         action: "GET_SHOPPING_LIST",
            //         source: "AMAZON_SEARCH",
            //     },
            //     roomId: message.roomId,
            //     createdAt: Date.now(),
            //     embedding: null
            // };

            // try {
            //     await shoppingManager.createMemory(shoppingMemory, true);
            //     elizaLogger.debug("Successfully stored shopping data in memories");
            // } catch (error) {
            //     elizaLogger.error("Failed to store shopping data:", error);
            // }

            // Format display text for user using the existing helper function
            // const responseText = formatShoppingResults(items);
            callback({ text: itemText });

        } catch (error) {
            console.error(error);
            callback({ text: "Error finding shopping information" });
        }
    },
    similes: ["SHOPPING_SEARCH", "FIND_PRODUCTS", "COMPARE_PRICES"],
    examples: [
        [{
            user: "user",
            content: {
                text: "Find running shoes from Amazon",
                action: "GET_SHOPPING_LIST"
            }
        }],
        [{
            user: "user",
            content: {
                text: "Search for gaming laptops",
                action: "GET_SHOPPING_LIST"
            }
        }]
    ]
};

function formatShoppingResults(items: any[]): string {
    if (!items?.length) {
        return "No items found matching your search criteria.";
    }

    let resultText = `Found ${items.length} items:\n\n`;

    items.forEach((item: any, index: number) => {
        resultText += `${index + 1}. ${item.name || 'Unknown Item'}\n`;
        if (item.brand) resultText += `   Brand: ${item.brand}\n`;
        if (item.price) resultText += `   Price: $${item.price}\n`;
        resultText += '\n';
    });

    return resultText;
} 