export const launchTokenTemplate = `
Instructions: Parse the user's message to extract token launch parameters.

Current conversation context:
{{recentMessages}}

Required parameters to extract from the most recent message:
- chain: Should be "confluxESpaceTestnet"
- name: Token name (e.g. "Tony")
- symbol: Token symbol (e.g. "TT") 
- initialSupply: Token supply (e.g. 100)
- address: The address the token will be minted to will be default ourselves (e.g. "0x1234567890123456789012345678901234567890")

Current state:
{{tokenName}}: {{name}}
{{tokenSymbol}}: {{symbol}}
{{tokenSupply}}: {{initialSupply}}

Response format example. please respond in JSON.
{
    "chain": "confluxESpaceTestnet",
    "name": "Tony",
    "symbol": "TT", 
    "initialSupply": 100,
    "address": "0x1234567890123456789012345678901234567890"
}
`;