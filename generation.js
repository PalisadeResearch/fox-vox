import OpenAI from "openai";
import Hjson from "hjson";

const OPENAI_API_KEY="sk-proj-6AOj927d5Fqfv1h5zj7yT3BlbkFJIxrTT7TOuxcpWRNZGii3"

console.log('Initializing OpenAI...');
const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });
console.log('OpenAI initialized.');

async function generateCompletion(context) {
    return openai.chat.completions.create({
        model: 'gpt-4o',
        messages: context,
        tools: [
            {
                "type": "function",
                "function": {
                    "name": "output",
                    "description": "Output the list of texts, with the newly generated text" +
                        "each associated with one of the original text blocks and in the same order.",
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
    console.log('Starting chain of thought algorithm...');
    const messages = [{ "role": "user", "content": original }];

    const final_completion = await generateCompletion([template.generation, ...messages]);

    return Hjson.parse(final_completion.choices[0].message.tool_calls[0].function.arguments)
}