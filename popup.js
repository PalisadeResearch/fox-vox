import {ToT_DFS} from './generation.js';
import {Template} from "./templates.js";
import {cluster} from "./cluster.js";
import templates from './config.json';
import Hjson from 'hjson';



let templateTypes = Object.keys(templates.templates);

let templatesArr = templateTypes.map(templateType => {
    let templateData = templates.templates[templateType];
    return new Template(templateData.name, {"role": "system", "content": templateData.generation}, {"role": "system", "content": templateData.critic}, {"role": "system", "content": templateData.evaluation});
});

// make templatesArr a global variable
window.templatesArr = templatesArr;
window.chosenTemplate = templatesArr[0];

window.clusters = sessionStorage.getItem('clusters') ? JSON.parse(sessionStorage.getItem('clusters')) : null;

let buttonContainer = document.getElementById('buttonContainer');

// Iterate over templates and create a button for each
for (let index in window.templatesArr) {
    // Create a new button element
    const template = window.templatesArr[index]
    let btn = document.createElement('button');

    // Set the button text
    btn.innerText = template.name;

    btn.addEventListener('click', () => {
        window.chosenTemplate = template
        console.log(window.chosenTemplate.generation)
    });

    buttonContainer.appendChild(btn);
}

document.getElementById('generate').addEventListener('click', async () => {
    chrome.tabs.query({active: true, currentWindow: true}, async function (tabs) {
        let promise = new Promise((resolve, reject) => {
            if (window.clusters === null) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "fetchText"}, async function (response) {
                    console.log("Text fetched");
                    console.log(response.nodes);
                    console.log("Clustering...");
                    window.clusters = await cluster(response.nodes);
                    sessionStorage.setItem('clusters', JSON.stringify(window.clusters));
                    resolve();
                });
            } else {
                resolve();
            }

        });

        promise.then(async () => {
            // Iterate over clusters
            const dfsPromises = window.clusters.slice(0, 1).map(async cluster => {
                // Extract only the text properties, then convert to JSON
                const clusterTexts = cluster.map(node => node.text);

                const clusterJsonString = JSON.stringify(clusterTexts);

                // Send to ToT_DFS function with humor template
                const generation = await ToT_DFS(window.chosenTemplate, clusterJsonString);

                console.log(generation)

                const genTexts = Hjson.parse(generation).nodes;

                const paired = genTexts.map((genText, index) => ({
                    xpath: cluster[index].xpath,
                    text: genText
                }));

                console.log(paired)
                // Send paired elements to "postText" action in the content script
                return {tabId: tabs[0].id, data: paired};
            });

            const allPaired = await Promise.all(dfsPromises);

            allPaired.forEach((paired) => {
                if (paired) {
                    console.log("Posted text!")
                    chrome.tabs.sendMessage(paired.tabId, {action: "postText", data: paired.data});
                }
            });
        });
    });
});