export const supplyTokenTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

Extract the parameters needed to supply tokens to AAVE v3 pool on Polygon.

Required parameters:
- chain: Must be "polygon"
- token: Must be a valid token address (USDC: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 or DAI: 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063)
- amount: The amount to supply as a string (e.g. "100")

IMPORTANT: Respond with ONLY a JSON object containing these exact fields, no explanation or other text:

{
    "chain": "polygon",
    "token": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "amount": "100"
}`
    
