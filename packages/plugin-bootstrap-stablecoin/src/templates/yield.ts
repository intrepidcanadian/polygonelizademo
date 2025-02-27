export const yieldTemplate = `Given the recent messages

{{recentMessages}}

Extract the parameters needed to fetch yield rates for stablecoins:
- The user wants to supply stablecoins to get yield
- The user wants to supply stablecoins on AAVE and the rates are on https://app.aave.com/markets/
- The user wants to supply stablecoins on Polygon
- The user wants to know the supply rates of DAI and USD Coin stablecoins.
- Provide supply rates for all USDC variants (i.e. USDC, USDC.e, etc.)

IMPORTANT: Respond with ONLY a JSON object, no explanation or other text:

{
    "task": "Please go to https://app.aave.com/markets/, and switch to the Polygon Market, and find the supply rate of USD Coin and supply rate of DAI stablecoin",
}`;