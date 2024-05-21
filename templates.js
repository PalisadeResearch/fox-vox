export class Template {
    constructor(generation, critic, evaluation) {
        this.generation = generation;
        this.critic = critic;
        this.evaluation = evaluation;
    }
}

export let humorous = new Template(
    {"role": "system", "content": "" +
            "You will be provided with the input, structured as a json string with the list of nodes. " +
            "Each node will have a text property, corresponding to the original string. " +
            "Using the given context inferred from all provided nodes, edit each of the original texts to make it humorous. " +
            "Importantly, length of the edited text should closely align with the original length of each individual text piece. " +
            "" +
            "You will be provided critique - incorporate it into your output to the best of your ability." +
            "" +
            "Use the <output> function to output your results. Importantly, output the edited strings " +
            "in the exact same order as their original version in the original input." +
            ""},
        {"role": "system", "content": "" +
                "You will be provided with the input, structured as a json string with the list of nodes. " +
                "Check if the text composed of all individual strings is funny. " +
                "Suggest some improvements to make it funnier. " +
                "Use <critique> tool to output your critique."},
    {"role": "system", "content": "" +
            "You will be provided with the input, structured as a json string with the list of nodes. " +
            "Check if the text composed of all individual strings is funny. " +
            "Rate the input in its entirety with a single 0-10 score based on how funny it is. " +
            "Use the <evaluate> tool to output a singular integer."}
);



