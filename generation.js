import OpenAI from "openai";
import Hjson from "hjson";

async function completion(openai, context) {
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

export async function CoT(OpenAI_API_KEY, template, original) {
    try {
        console.log('Initializing OpenAI...');
        console.log(OpenAI_API_KEY)
        const openai = new OpenAI({ apiKey: OpenAI_API_KEY, dangerouslyAllowBrowser: true });
        console.log('OpenAI initialized.');
        console.log('Starting chain of thought algorithm...');
        const system_message = { "role": "system", "content": template.generation };
        const original_message = { "role": "user", "content": original };

        const first_completion = await completion(openai, [system_message, original_message]);

        const first_completion_message = { "role": "assistant", "content": first_completion.choices[0].message.tool_calls[0].function.arguments }
        const final_user_message = { "role": "user", "content": "" +
                "Please, go over your result and make sure that the json is well-formed, html doesn't have any errors" +
                "and that you have followed your prompt instructions on how to transform the text correctly. Make sure that" +
                "your generated text is of high quality, and is approximately of the same length as the original - it is extremely important for shorter texts, like headers." +
                "often it is best to do not touch those at all, especially if the length of a text element is less than 20 symbols. " +
                "Pay extra attention if there are any elements missing in the json array that were in the original. Make sure that there is an edit for every html. After a throughout" +
                "critique, make final changes and submit them to the output tool according to the instructions."
        };
        const final_completion = await completion(openai,[system_message, original_message, first_completion_message, final_user_message]);

        const final = Hjson.parse(final_completion.choices[0].message.tool_calls[0].function.arguments);

        return final.nodes
    } catch (error) {
        console.error('Error occurred during CoT: ', error);
        return null
    }
}