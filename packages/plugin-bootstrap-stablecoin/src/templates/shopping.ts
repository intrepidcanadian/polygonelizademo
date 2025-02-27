export const shoppingTemplate = `Given the recent messages

{{recentMessages}}

Extract what the user wants to search for on Amazon.
- All items listed must have a price, name and brand.
- Create a list of each item with its name, brand, and price.
- Scroll down to if items are avaialbl but prices are not found or visible
- Search for the item on Amazon

IMPORTANT: Respond with ONLY a JSON object containing these exact fields, no explanation or other text. Make sure each item we listhas a visible name, visible brand, and visible price:

{
    "task": "Search amazon website for <item> and return a list of each item wit its name, brand, and price"
}`; 