export class Template {
    constructor(generation, critic, evaluation) {
        this.generation = generation;
        this.critic = critic;
        this.evaluation = evaluation;
    }
}

export let humorous = new Template(
    {"role": "system", "content": "Rewrite the given input with humor. Use the <output> function for the final version of the sentence."},
        {"role": "system", "content": "Check if the sentence is funny. Suggest some improvements to make it funnier. Use <critique> tool to output your critique."},
    {"role": "system", "content": "Rate the sentence 0-10 based on how funny it is. Use the <evaluate> tool to output a singular integer."}
);



