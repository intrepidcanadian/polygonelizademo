export const yieldFormatTemplate = `Given the yield data:

{{yieldData}}

Extract the DAI stablecoin supply rate and USD Coin stablecoin supply rate from the response.
- Both of the supply rates are in % and should be on Polygon from AAVE
- If there are two rates for USDC, do not use the one that is USDC.e 
- Take the USDC supply rate over the USDC.e supply rate

IMPORTANT: Respond with ONLY a JSON object, no explanation or other text:
{
    "USDC supply rate": 1.23,
    "DAI supply rate": 3.25,
    "chain": "polygon",
    "protocol": "aave"
}`;