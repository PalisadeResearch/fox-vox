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
                    "description": "Output HTML where the inner text content, like text inside 'p' tags, " +
                        "was regenerated according to the prompt, but the html structure remains the same",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "nodes": {
                                "type": "array",
                                "description": "Each item of the array is the full HTML as in the original," +
                                    "but with inner text content regenerated according to your prompt," +
                                    "outputted in the same order as they were in the original input, where they were split by" +
                                    "separator --###--, accompanied by the associated xpath that was listed right after the separator",
                                "items": {
                                    "type": "object",
                                    "description": "Item is an object with two parameters. " +
                                        "'html' holds the final edited HTML " +
                                        "'xpath' holds the xpath that was attached to the original at the top of the block below the separator, like a header.",
                                    "properties": {
                                        "html": {
                                            "type": "string"
                                        },
                                        "xpath": {
                                            "type": "string"
                                        }
                                    }
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

        const final = Hjson.parse(final_completion.choices[0].message.tool_calls[0].function.arguments);
        console.log([original, final])
        return final
    } catch (error) {
        console.error('Error occurred during CoT: ', error);
        return { nodes: [[]] };
    }
}