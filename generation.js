import OpenAI from "openai";
import Hjson from "hjson";


let openai;

async function generateCompletion(context) {
    return openai.chat.completions.create({
        model: 'gpt-4o',
        messages: context,
        tools: [
            {
                "type": "function",
                "function": {
                    "name": "output",
                    "description": "Output the list of nodes, with the newly generated html, including text and 'a' and 'b' blocks," +
                        "each associated with one of the original html blocks and in the same order.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "nodes": {
                                "type": "array",
                                "description": "The list of all text blocks, where each item is the text corresponding to a text block",
                                "items": {
                                    "type": "string",
                                },
                            },

                        },
                        "required": ["nodes"]
                    }
                }
            }
        ],
        tool_choice: "required"
    });
}

export async function CoT(template, original) {
    try {
        console.log('Initializing OpenAI...');
        openai = new OpenAI({ apiKey: window.OpenAI_API_KEY, dangerouslyAllowBrowser: true });
        console.log('OpenAI initialized.');
        console.log('Starting chain of thought algorithm...');
        const messages = [{ "role": "user", "content": original }];

        const final_completion = await generateCompletion([template.generation, ...messages]);

        return Hjson.parse(final_completion.choices[0].message.tool_calls[0].function.arguments);
    } catch (error) {
        console.error('Error occurred during CoT: ', error);
        return { nodes: [] };
    }
}