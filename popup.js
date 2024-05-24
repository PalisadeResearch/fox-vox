import {CoT} from './generation.js';
import {Template} from "./templates.js";
import {cluster} from "./cluster.js";
import templates from './config.json';
import {addData, getAllData, openDatabase} from './indexedDB.js';

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

if (!window.name) {
    window.name = generateUUID();
}

const DB_PREFIX = 'templateDatabase_';
const CLUSTER_DB_NAME = 'clustersDatabase';
const CLUSTER_STORE_NAME = 'clusters';
const PAIRED_STORE_NAME = 'paired';

let templateTypes = Object.keys(templates.templates);

let templatesArr = templateTypes.map(templateType => {
    let templateData = templates.templates[templateType];
    return new Template(templateData.name, {"role": "system", "content": templateData.generation}, {
        "role": "system",
        "content": templateData.critic
    });
});

function deleteDatabase(dbName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event);
    });
}

window.templatesArr = templatesArr;
window.chosenTemplate = templatesArr[0];

document.addEventListener('DOMContentLoaded', async function() {
    let radio_container = document.getElementById('radio-container');
    let generateButton = document.getElementById('generate');

    const emoji = ['🦊', '🦊 🦊', '🦊 🦊 🦊'];
    let emojiIndex = 0;
    let emojiInterval;

    async function checkAndSetCachedStatus(templateName, span) {
        const dbName = `${DB_PREFIX}${templateName}`;
        const db = await openDatabase(dbName, PAIRED_STORE_NAME);
        const paired = await getAllData(db, PAIRED_STORE_NAME);
        if (paired.length > 0) {
            span.innerText += ' ✅';
        }
    }

    for (let index in window.templatesArr) {
        const template = window.templatesArr[index];

        // Create label and input elements
        let label = document.createElement('label');
        let input = document.createElement('input');
        let span = document.createElement('span');

        input.type = 'radio';
        input.name = 'view';
        input.value = template.name;
        input.id = `view-${index}`;

        span.innerText = template.name;

        label.htmlFor = `view-${index}`;

        // Check and set cached status
        await checkAndSetCachedStatus(template.name, span);

        // Append input and span to the label
        label.appendChild(input);
        label.appendChild(span);

        // Add event listener to input
        input.addEventListener('change', async () => {
            window.chosenTemplate = template;
            console.log(window.chosenTemplate.generation);

            const dbName = `${DB_PREFIX}${template.name}`;
            const db = await openDatabase(dbName, PAIRED_STORE_NAME);
            const paired = await getAllData(db, PAIRED_STORE_NAME);

            if (paired.length > 0) {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {action: "postText", data: paired});
                });
            }
        });

        // Append the label to the container
        radio_container.appendChild(label);
    }

    function startEmojiAnimation() {
        emojiInterval = setInterval(() => {
            generateButton.innerText = `In progress ... ${emoji[emojiIndex]}`;
            emojiIndex = (emojiIndex + 1) % emoji.length;
        }, 500);
    }

    function stopEmojiAnimation() {
        clearInterval(emojiInterval);
        generateButton.innerText = 'Let us rewrite it for you!';
    }

    generateButton.addEventListener('click', async () => {
        // Start the emoji animation
        startEmojiAnimation();

        const dbName = `${DB_PREFIX}${window.chosenTemplate.name}`;
        await deleteDatabase(dbName); // Delete existing paired data if any

        const newDb = await openDatabase(dbName, PAIRED_STORE_NAME);

        chrome.tabs.query({active: true, currentWindow: true}, async function (tabs) {
            const activeTab = tabs[0].id;

            let injectionPromise = new Promise(async (resolve) => {
                chrome.tabs.sendMessage(activeTab, {ping: true}, async function (response) {
                    if (response && response.pong) {
                        resolve();
                    } else {
                        await chrome.scripting.executeScript({
                            target: {tabId: activeTab},
                            files: ["./contentScript.js"]
                        });
                        resolve();
                    }
                });
            });

            injectionPromise.then(async () => {
                let promise = new Promise(async (resolve) => {
                    const clusterDb = await openDatabase(CLUSTER_DB_NAME, CLUSTER_STORE_NAME);
                    let clusters = await getAllData(clusterDb, CLUSTER_STORE_NAME);

                    if (!clusters.length) {
                        chrome.tabs.sendMessage(tabs[0].id, {action: "fetchText"}, async function (response) {
                            clusters = await cluster(response.nodes);
                            console.log(clusters);
                            clusters.forEach(cluster => {
                                addData(clusterDb, CLUSTER_STORE_NAME, cluster);
                            });
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });

                promise.then(async () => {
                    const clusterDb = await openDatabase(CLUSTER_DB_NAME, CLUSTER_STORE_NAME);
                    let clusters = await getAllData(clusterDb, CLUSTER_STORE_NAME);

                    console.log(clusters);
                    let promises = clusters.map(async cluster => {
                        const generation = await CoT(window.chosenTemplate, cluster.map(node => node.text).join('\n\n'));
                        console.log(generation);

                        const paired = generation.nodes
                            .filter((_, index) => cluster[index])
                            .map((text, index) => ({
                                xpath: cluster[index].xpath,
                                text: text
                            }));

                        console.log(paired);

                        // Post as soon as the new paired is created
                        if (paired) {
                            chrome.tabs.sendMessage(tabs[0].id, {action: "postText", data: paired});
                        }

                        // Save paired data to IndexedDB
                        paired.forEach(p => addData(newDb, PAIRED_STORE_NAME, p));

                        return paired;
                    });

                    // Await all promises
                    const nodes = await Promise.all(promises);

                    console.log("Posted text!");

                    // Update the label with the cached emoji
                    const templateIndex = templatesArr.findIndex(t => t.name === window.chosenTemplate.name);
                    const label = document.querySelector(`label[for='view-${templateIndex}'] span`);
                    if (label) {
                        label.innerText = `${window.chosenTemplate.name} ✅`;
                    }

                    // Stop the emoji animation once the generation is complete
                    stopEmojiAnimation();
                });
            });
        });
    });
});

window.addEventListener('beforeunload', () => {
    deleteDatabase(`${DB_PREFIX}${window.chosenTemplate.name}`).then(() => {
        console.log(`Database ${DB_PREFIX}${window.chosenTemplate.name} deleted.`);
    }).catch((error) => {
        console.error(`Failed to delete database ${DB_PREFIX}${window.chosenTemplate.name}:`, error);
    });
});
