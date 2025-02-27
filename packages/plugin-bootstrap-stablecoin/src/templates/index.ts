import { yieldTemplate } from "./yield.ts";

export { yieldTemplate };

export const swapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token swap on Uniswap v3 on Polygon.
Currently only supports USDC/DAI pair on Polygon with these addresses:

- DAI on Polygon Mainnet = 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063
- USDC on Polygon Mainnet = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359

Each of USDC and DAI has 6 decimals on polygon mainnet.
Fee tiers available is 0.01% only

Extract:
- Which token to sell (must be either "USDC" or "DAI")
- Which token to buy (must be either "DAI" or "USDC")
- Amount to swap (number without token symbol, e.g., "100")
- Fee tier to use is 0.01%  
- Slippage tolerance in percentage (default 0.05% if not specified)

The chain will always be polygon.

IMPORTANT: Respond with ONLY a JSON object, no explanation or other text:
{
    "fromToken": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "toToken": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    "amount": "100",
    "chain": "polygon",
    "slippage": 0.5,
    "feeTier": 100
}
`;

export const quoteTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested price check on Uniswap v3 on Polygon:
Currently only supports USDC/DAI pair on Polygon with these addresses:
- DAI on Polygon Mainnet = 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063
- USDC on Polygon Mainnet = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359

Extract:
- Which token the user is looking to sell (must be either "DAI" or "USDC")
- Which token the user is looking to get quote for (must be either "DAI" or "USDC") which would represent the token the user is looking to buy
- Amount to check (number without token symbol, e.g., "100") where the user is looking to sell
- Fee tier to use is 0.01% 

The chain will always be polygon.

IMPORTANT: Respond with ONLY a raw JSON object, no markdown, no code blocks, no explanation:
{
    "fromToken": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    "toToken": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "amount": "100",
    "chain": "polygon",
    "feeTier": 100
}`; 