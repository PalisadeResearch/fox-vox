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

const DB_NAME = `templateDatabase_${window.name}`;
const CLUSTER_STORE_NAME = 'clusters';

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

let radio_container = document.getElementById('radio-container');

for (let index in window.templatesArr) {

    const template = window.templatesArr[index]
    let btn = document.createElement('button');

    btn.innerText = template.name;

    btn.addEventListener('click', () => {
        window.chosenTemplate = template
        console.log(window.chosenTemplate.generation)
    });

    radio_container.appendChild(btn);
}

document.getElementById('generate').addEventListener('click', async () => {
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
                    resolve()
                }
            });
        });

        injectionPromise.then(async () => {
            let promise = new Promise(async (resolve) => {
                const db = await openDatabase(DB_NAME, CLUSTER_STORE_NAME);
                let clusters = await getAllData(db, CLUSTER_STORE_NAME);

                if (!clusters.length) {
                    chrome.tabs.sendMessage(tabs[0].id, {action: "fetchText"}, async function (response) {
                        clusters = await cluster(response.nodes);
                        console.log(clusters)
                        clusters.forEach(cluster => {
                            addData(db, CLUSTER_STORE_NAME, cluster);
                        });
                        resolve()
                    });
                } else {
                    resolve();
                }

            });

            promise.then(async () => {
                const db = await openDatabase(DB_NAME, CLUSTER_STORE_NAME);
                let clusters = await getAllData(db, CLUSTER_STORE_NAME);

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

                    return paired;
                });

                // Await all promises
                const nodes = await Promise.all(promises);

                console.log("Posted text!");
                // Now that all promises have been resolved, there's no need to post them again.
            });
        });
    });
});

window.addEventListener('beforeunload', () => {
    deleteDatabase(DB_NAME).then(() => {
        console.log(`Database ${DB_NAME} deleted.`);
    }).catch((error) => {
        console.error(`Failed to delete database ${DB_NAME}:`, error);
    });
});