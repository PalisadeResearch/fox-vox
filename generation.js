import OpenAI from "openai";
import Hjson from 'hjson';

const average = array => array.reduce((a, b) => a + b) / array.length;

const OPENAI_API_KEY="sk-proj-6AOj927d5Fqfv1h5zj7yT3BlbkFJIxrTT7TOuxcpWRNZGii3"

console.log('Initializing OpenAI...');
const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });
console.log('OpenAI initialized.');

const DEPTH = 3;
const WIDTH = 3;

import { GENERATION_TOOLS, EVALUATION_TOOLS, CRITIC_TOOLS } from './tools.js';

async function generate_completion(context, tools) {
    context = context || [];

    console.log('Generating completion...');
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: context,
        n: WIDTH,
        tools: tools,
    });
    console.log('Completion generated.');
    return completion;
}

async function evaluate(choices, evaluation) {
    console.log('Evaluating choices...')
    try {
        const ratings = await Promise.all(
            choices.map(async choice => {
                try {
                    console.log('Parsing context...');
                    let context = [evaluation, {role: "user", content: choice.message.tool_calls?.[0].function?.arguments}];

                    console.log('Generating completion for evaluation...');
                    const completion_result = await generate_completion(context, EVALUATION_TOOLS);

                    console.log('Calculating average rating...');
                    return average(
                        completion_result.choices.map(option =>
                            Hjson.parse(option.message.tool_calls?.[0].function?.arguments)["rating"]
                        )
                    );
                } catch (error) {
                    console.error('Error occured:', error);
                    return -1;
                }
            })
        );
        const maxRatingIndex = ratings.indexOf(Math.max(...ratings));
        console.log('Evaluation completed.');
        return choices[maxRatingIndex];
    } catch (error) {
        console.error('Evaluation failed:', error);
        return null;
    }
}

export async function ToT_DFS(template, original) {
    console.log('Starting ToT_DFS...');
    const messages = [ {"role": "user", "content": original} ];
    let chosen_text = [];

    for(let step = 0; step < DEPTH; step++) {
        console.log(`Step ${step}:`);
        const completion = await generate_completion([template.generation, ...messages], GENERATION_TOOLS);
        const choice = await evaluate(completion.choices, template.evaluation);
        if(!choice.message.tool_calls) continue;

        console.log('Parsing choice text...');
        // Parse the choice text as an array of generated texts

        chosen_text = choice.message.tool_calls?.[0].function?.arguments
        messages.push({"role": "assistant", "content": chosen_text});

        console.log('Generating critique...');
        const critique = await generate_completion([template.critic, ...messages], CRITIC_TOOLS);
        const critiqueText = critique?.choices[0]?.message.tool_calls[0]?.function.arguments ?
            Hjson.parse(critique.choices[0].message.tool_calls[0].function.arguments).text : null;

        if(critiqueText) messages.push({"role": "user", "content": critiqueText});
        console.log('Current messages:', messages);
    }
    console.log('ToT_DFS completed.');
    // Return the array of final generated texts
    return chosen_text;
}