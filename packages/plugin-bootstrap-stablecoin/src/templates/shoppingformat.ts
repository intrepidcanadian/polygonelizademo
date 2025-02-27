export const shoppingFormatTemplate = `Given the raw shopping response below:

{{rawShoppingResp}}

Format the response into a structured list of items with their details.

IMPORTANT: Respond with ONLY a JSON object containing these exact fields, no explanation or other text:

{
    "items": [
        {
            "name": "Nike Air Zoom Pegasus 38",
            "brand": "Nike",
            "price": 119.99
        },
        {
            "name": "UnderArmour Steph Curry 2",
            "brand": "UnderArmour",
            "price": 159.99
        }
    ]
}`; 