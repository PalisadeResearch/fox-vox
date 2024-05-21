import {ToT_DFS} from './generation.js';
import {humorous} from "./templates.js";
import {cluster} from "./cluster.js";

document.getElementById('button').addEventListener('click', async () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: "fetchText"}, async function (response) {
            console.log("Text fetched");
            console.log(response.nodes);
            console.log("Clustering...");

            const clusters = await cluster(response.nodes);
            console.log(clusters);

            // Iterate over clusters
            const dfsPromises = clusters.slice(0,3).map(async cluster => {
                // Extract only the text properties, then convert to JSON
                const clusterTexts = cluster.map(node => node.text);
                const clusterJsonString = JSON.stringify(clusterTexts);

                // Send to ToT_DFS function with humor template
                const generation = await ToT_DFS(humorous, clusterJsonString);

                console.log(generation)

                const genTexts = JSON.parse(generation).nodes;

                const paired = genTexts.map((genText, index) => ({
                    xpath: cluster[index].xpath,
                    text: genText
                }));

                console.log(paired)
                // Send paired elements to "postText" action in the content script
                return { tabId: tabs[0].id, data: paired };
            });

            const allPaired = await Promise.all(dfsPromises);

            allPaired.forEach((paired) => {
                if(paired){
                    chrome.tabs.sendMessage(paired.tabId, {action: "postText", data: paired.data});
                }
            });
        });
    });
});