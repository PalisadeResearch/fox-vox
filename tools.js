export const GENERATION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "output",
            "description": "Output the list of nodes, with the newly generated text" +
                "in the order associated with the original.",
            "parameters": {
                    "type": "object",
                    "properties": {
                        "nodes": {
                            "type": "array",
                            "description": "The list of all nodes, where each item is the text corresponding to a node",
                            "items": {
                                "type": "string",
                            },
                        },

                    },
                    "required": ["nodes"]
            }
        }
    }
];

export const EVALUATION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "evaluate",
            "description": "Output the rating of the given prompt according to how well it matches the guidelines",
            "parameters": {
                "type": "object",
                "properties": {
                    "rating": {"type": "integer"},
                },
                "required": [
                    "rating"
                ]
            }
        }
    },
];

export const CRITIC_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "critique",
            "description": "Output your final generation in full",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                },
                "required": [
                    "text"
                ]
            }
        }
    },
];