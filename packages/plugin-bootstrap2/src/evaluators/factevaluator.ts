import { Evaluator, formatActionNames, Memory } from "@elizaos/core";


export const formatFacts = (facts: Memory[]) => {
    const messageStrings = facts
        .reverse()
        .map((fact: Memory) => fact.content.text);
    const finalMessageStrings = messageStrings.join("\n");
    return finalMessageStrings;
};

const factsTemplate = 

`TASK: Extract claims from the conversation as an array of claims in JSON format

# START OF EXAMPLES
These are the examples of the expected output of this task:
{{evaluationExamples}}

# END OF EXAMPLES

# INSTRUCTIONS


Extract any claims from the conversation that are not already present in the list of known facts above:
- Try not to include already-known facts. If you think a fact is already known, but you're not sure, respond with already_known: true.
- If the fact is already in the user's description, set in_bio to true
- If we've already extracted this fact, set already_known to true
- Set the claim type to 'status', 'fact' or 'opinion'
- For true facts about the world or the character that do not change, set the claim type to 'fact'
- For facts that are true but change over time, set the claim type to 'status'
- For non-facts, set the type to 'opinion'
- 'opinion' includes non-factual opinions and also includes the character's thoughts, feelings, judgments or recommendations
- Include any factual detail, including where the user lives, works, or goes to school, what they do for a living, their hobbies, and any other relevant information

Recent Messages:
{{recentMessages}}

Response should be a JSON object array inside a JSON markdown block. Correct response format:
\`\`\`json
[
  {"claim": string, "type": enum<fact|opinion|status>, in_bio: boolean, already_known: boolean },
  {"claim": string, "type": enum<fact|opinion|status>, in_bio: boolean, already_known: boolean },
  ...
]
\`\`\``;
`

async function 