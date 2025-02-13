export const swapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token swap on Ginseng Swap (Uniswap V3 fork).
Currently only supports USDC/USDT pair on Conflux eSpace testnet with these addresses:
- USDC: 0x349298b0e20df67defd6efb8f3170cf4a32722ef
- USDT: 0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355

Each of USDC and USDT has 18 decimals on conflux eSpace testnet.
Fee tiers available:
- 0.05% (500)
- 0.3% (3000)
- 1% (10000)

Extract:
- Which token to sell (must be either "USDC" or "USDT")
- Which token to buy (must be either "USDC" or "USDT")
- Amount to swap (number without token symbol, e.g., "100")
- Fee tier to use (default to 0.05% if not specified) which is 500
- Slippage tolerance in percentage (default 0.5% if not specified)

The chain will always be confluxESpaceTestnet.

IMPORTANT: Respond with ONLY a JSON object, no explanation or other text:
{
    "fromToken": "0x349298b0e20df67defd6efb8f3170cf4a32722ef",
    "toToken": "0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355",
    "amount": "100",
    "chain": "confluxESpaceTestnet",
    "slippage": 0.5,
    "feeTier": 500
}
`;

// You can add more templates here for other actions
export const transferTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested transfer:
- Chain to execute on (currently only supports confluxESpaceTestnet)
- Amount to transfer (in ETH, without the coin symbol)
- Recipient address (must be a valid Ethereum address)
- Token address (if not a native token transfer)

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "chain": "confluxESpaceTestnet" | null,
    "amount": string | null,
    "toAddress": string | null,
    "token": string | null
}
\`\`\`
`;

export const quoteTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested price check on Ginseng Swap:
Currently only supports USDC/USDT pair on Conflux eSpace testnet with these addresses:
- USDC: 0x349298b0e20df67defd6efb8f3170cf4a32722ef
- USDT: 0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355

Extract:
- Which token the user is looking to sell (must be either "USDC" or "USDT")
- Which token the user is looking to get quote for (must be either "USDC" or "USDT") which would represent the token the user is looking to buy
- Amount to check (number without token symbol, e.g., "100") where the user is looking to sell
- Fee tier to use (default to 0.3% if not specified)

The chain will always be confluxESpaceTestnet.

IMPORTANT: Respond with ONLY a raw JSON object, no markdown, no code blocks, no explanation:
{
    "fromToken": "0x349298b0e20df67defd6efb8f3170cf4a32722ef",
    "toToken": "0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355",
    "amount": "100",
    "chain": "confluxESpaceTestnet",
    "feeTier": 3000
}`; 