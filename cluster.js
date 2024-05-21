import OpenAI from 'openai';

const OPENAI_API_KEY="sk-proj-6AOj927d5Fqfv1h5zj7yT3BlbkFJIxrTT7TOuxcpWRNZGii3"

const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });

async function generate_embeddings(nodes) {
    const promises = nodes.map((node, i) => {
        console.log(`Preparing to generate embedding for node ${i+1} out of ${nodes.length}.`);
        return openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: node.text.trim(), // Use node.text here
            encoding_format: 'float',
        }).then(response => {
            console.log(`Embedding generated for node ${i+1}.`);
            node.embedding = response.data[0].embedding; // Add embedding to the node
            return node; // Return the node not just the embedding
        });
    });
    return await Promise.all(promises);
}

function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((acc, _, idx) => acc + a[idx] * b[idx], 0);
    const magnitudeA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

function calculateDistance(node1, node2) {
    const dx = node1.layout.left - node2.layout.left;
    const dy = node1.layout.top - node2.layout.top;
    return Math.sqrt(dx * dx + dy * dy);
}

// Function to normalize the distance - can be adjusted as needed
function normalizeDistance(distance, maxDistance) {
    return distance / maxDistance;
}

function adjustRadius(baseRadius, spatialDistance, adjustmentFactor = 1) {
    /*
    console.log("------")
    console.log(baseRadius)
    console.log(spatialDistance)
    console.log(baseRadius / (1 + adjustmentFactor * spatialDistance))
    console.log("------")
     */

    return baseRadius / (1 + adjustmentFactor * spatialDistance);
}

export async function cluster(nodes, semanticRadius = 1, spatialRadius = 300) {
    console.log('Starting the clustering process...');
    let clusters = [];

    console.log('Generating embeddings for nodes...');
    let remainingNodes = await generate_embeddings(nodes);
    console.log('Embeddings successfully generated.');

    let clusterCount = 0;
    while (remainingNodes.length > 0) {
        console.log(`Creating the cluster ${++clusterCount}...`);
        const currentCluster = [remainingNodes[0]];
        const currentVector = remainingNodes[0].embedding;
        remainingNodes = remainingNodes.slice(1);

        remainingNodes = remainingNodes.filter((node, idx) => {
            const semanticDistance = cosineSimilarity(currentVector, node.embedding);
            const spatialDistance = normalizeDistance(calculateDistance(currentCluster[0], node), spatialRadius);

            const adjustedSemanticRadius = adjustRadius(semanticRadius, spatialDistance);

            const isClose = (semanticDistance > 1 - adjustedSemanticRadius);

            if (isClose) {
                console.log(`Adding node ${idx+2} to cluster ${clusterCount}.`);
                currentCluster.push(node);
            }
            return !isClose;
        });

        console.log(`Successfully formed the cluster ${clusterCount} with ${currentCluster.length} nodes.`);
        clusters.push(currentCluster);
    }

    console.log('Finished the clustering process.');
    return clusters;
}