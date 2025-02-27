import { elizaLogger, IAgentRuntime, Memory, State, MemoryManager } from "@elizaos/core";
import { yieldTemplate } from "../templates/index.ts";
import { composeContext, ModelClass } from "@elizaos/core";
import { yieldFormatTemplate } from "../templates/yieldformat.ts";
import { generateObjectDeprecated } from "@elizaos/core";
import { randomUUID } from "crypto";

async function getYields(options: any) {
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
        elizaLogger.error('Error fetching yields:', error);
        throw error;
    }
}

export const yieldAction = {
    name: "GET_SUPPLY_RATES",
    description: "Find the supply yield rates for DAI and USDC on AAVE on Polygon",
    template: yieldTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        const requiredTerms = ['find', 'what', 'show'];
        const optionalTerms = ['stablecoin', 'aave', 'dai', 'usdc', 'supply', 'rates'];
        
        // Check if some required terms are present
        const hasRequiredTerms = requiredTerms.some(term => text.includes(term));
        // Check if at least one optional term is present
        const hasOptionalTerm = optionalTerms.some(term => text.includes(term));
        
        return hasRequiredTerms && hasOptionalTerm;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: any, callback: any) => {
        try {
            // Build context from user message using template
            const yieldContext = composeContext({
                state: {
                    ...state,
                    recentMessages: message.content.text
                },
                template: yieldTemplate
            });

            // Generate options based on the context
            const options = await generateObjectDeprecated({
                runtime,
                context: JSON.stringify(yieldContext),
                modelClass: ModelClass.LARGE,
            });
        
            // Get and log raw response first
            const rawYieldResp = await getYields(options);
            
            elizaLogger.debug('RAW YIELD RESPONSE:', {
                raw: rawYieldResp,
                type: typeof rawYieldResp
            });

            // Extract the text content from the AgentHistoryList response
            let rateText = "";
            if (rawYieldResp?.result) {
                // Find the last completed action (is_done=True)
                const doneActionMatch = rawYieldResp.result.match(/ActionResult\(is_done=True,\s*extracted_content='([^']+)'/);
                if (doneActionMatch) {
                    rateText = doneActionMatch[1];
                    elizaLogger.debug('Found completed action text:', { rateText });
                } else {
                    // Fallback: try to find any rate information in the response
                    const anyRateMatch = rawYieldResp.result.match(/(\d+\.?\d*)%.*?(\d+\.?\d*)%/);
                    if (anyRateMatch) {
                        rateText = rawYieldResp.result;
                        elizaLogger.debug('Found rate information in response:', { rateText });
                    }
                }
            }

            console.log("this is the rateText", rateText);

            // elizaLogger.debug('Extracted rate text:', { rateText });

//             // Then proceed with context composition
//             const yieldFormatContext = composeContext({
//                 state: {
//                     ...state,
//                     rawYieldResp: rateText || JSON.stringify(rawYieldResp)
//                 },
//                 template: yieldFormatTemplate
//             });

//             const yieldResp = await generateObjectDeprecated({
//                 runtime,
//                 context: yieldFormatContext,
//                 modelClass: ModelClass.LARGE,
//             });

//             elizaLogger.debug('YIELD RESPONSE:', {
//                 raw: yieldResp,
//                 type: typeof yieldResp,
//                 keys: Object.keys(yieldResp || {})
//             });

//             // Parse and validate rates with error handling
//             let daiRate = 0;
//             let usdcRate = 0;

//             // First try to get rates from the formatted response
//             if (typeof yieldResp === 'object' && yieldResp !== null) {
//                 daiRate = Number(yieldResp["DAI supply rate"] || yieldResp.DAI_supply_rate || 0);
//                 usdcRate = Number(yieldResp["USDC supply rate"] || yieldResp.USDC_supply_rate || 0);
//             }

//             // If rates are still 0, try to parse them directly from the raw text
//             if (daiRate === 0 || usdcRate === 0) {
//                 // Try multiple regex patterns to match different formats
//                 const patterns = [
//                     // Format: "USDC is 2.97% and DAI is 4.19%"
//                     /USDC.*?is\s*(\d+\.?\d*)%.*?DAI.*?is\s*(\d+\.?\d*)%/,
//                     // Format: "USD Coin (USDC) is 2.97% and for DAI stablecoin is 4.19%"
//                     /USD Coin.*?is\s*(\d+\.?\d*)%.*?DAI.*?is\s*(\d+\.?\d*)%/,
//                     // Format: "DAI is 4.19% and USDC is 2.97%" (reverse order)
//                     /DAI.*?is\s*(\d+\.?\d*)%.*?USDC.*?is\s*(\d+\.?\d*)%/,
//                     // Format: "USDC**: 2.97%... DAI**: 4.19%"
//                     /USDC.*?(\d+\.?\d*)%.*?DAI.*?(\d+\.?\d*)%/
//                 ];

//                 for (const pattern of patterns) {
//                     const matches = rateText.match(pattern);
//                     if (matches) {
//                         // Check which pattern matched to determine rate order
//                         if (pattern.source.startsWith('DAI')) {
//                             // DAI rate is first in this pattern
//                             daiRate = Number(matches[1]);
//                             usdcRate = Number(matches[2]);
//                         } else {
//                             // USDC rate is first in this pattern
//                             usdcRate = Number(matches[1]);
//                             daiRate = Number(matches[2]);
//                         }
//                         elizaLogger.debug('Successfully parsed rates from pattern:', {
//                             pattern: pattern.source,
//                             daiRate,
//                             usdcRate
//                         });
//                         break;
//                     }
//                 }
//             }

//             elizaLogger.debug('Final parsed rates:', {
//                 daiRate,
//                 usdcRate,
//                 rateText,
//                 formattedResponse: yieldResp
//             });

//             if (daiRate === 0 && usdcRate === 0) {
//                 elizaLogger.error('Failed to parse rates from response:', {
//                     rawResponse: rawYieldResp,
//                     rateText,
//                     formattedResponse: yieldResp
//                 });
//             }

//             // Store yield data in memory using the memories table
//             const yieldManager = new MemoryManager({
//                 runtime,
//                 tableName: "memories"
//             });

//             // Create a structured yield memory object
//             const yieldMemory = {
//                 id: randomUUID(),
//                 type: 'SUPPLY_RATE',
//                 userId: state.agentId!,
//                 agentId: state.agentId,
//                 content: {
//                     text: `DAI supply rate: ${daiRate}% APY, USDC supply rate: ${usdcRate}% APY on AAVE V3 Polygon`,
//                     action: "GET_SUPPLY_RATES",
//                     source: "AAVE_V3_POLYGON",
//                     metadata: {
//                         timestamp: Date.now(),
//                         rates: {
//                             DAI: daiRate,
//                             USDC: usdcRate
//                         },
//                         protocol: 'AAVE_V3',
//                         chain: 'POLYGON',
//                         source: "AAVE_V3_POLYGON"
//                     }
//                 },
//                 roomId: message.roomId,
//                 createdAt: Date.now(),
//                 embedding: null
//             };

//             try {
//                 await yieldManager.createMemory(yieldMemory, true);
//                 elizaLogger.debug("Successfully stored yield data in memories", {
//                     rates: yieldMemory.content.metadata.rates,
//                     protocol: yieldMemory.content.metadata.protocol,
//                     chain: yieldMemory.content.metadata.chain,
//                     timestamp: yieldMemory.content.metadata.timestamp
//                 });
//             } catch (error) {
//                 elizaLogger.error("Failed to store yield data:", error);
//                 // Continue execution even if storage fails
//             }

//             // Format display text
//             const yieldText = `Current supply rates on AAVE V3 Polygon:\nDAI: ${daiRate}% APY\nUSDC: ${usdcRate}% APY`;
            
//             const responseText = `${yieldText}

// ${daiRate > usdcRate ? "DAI" : "USDC"} currently offers the highest yield among these stablecoins.

// Would you like me to help analyze any trading opportunities with these rates?`;

            callback({ text: `${rateText}` });

        } catch (error) {
            console.error(error);
            callback({ text: "Error finding current yield rates" });
        }
    },
    similes: ["YIELD_OPTIMIZATION ON STABLECOINS", "MAXIMIZE_RETURNS", "GET_SUPPLY_RATES"],
    examples: [
        [{
            user: "user",
            content: {
                text: "Find the best yield between USDC and DAI on Polygon on AAVE",
                action: "GET_SUPPLY_RATES"
            }
        }],
        [{
            user: "user",
            content: {
                text: "What are the current supply rates for stablecoins?",
                action: "GET_SUPPLY_RATES"
            }
        }]
    ]
};