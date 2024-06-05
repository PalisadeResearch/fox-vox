import {Template} from "./templates.js";

function getActiveTab(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        callback(tabs[0]);
    });
}

export function setup(tab, url) {
    return new Promise((resolve, reject) => {
        fetch(chrome.runtime.getURL('/config.json'))
            .then(response => response.json())
            .then(data => {
                const templates = data.templates

                chrome.runtime.sendMessage({
                    action: "setup",
                    id: tab.id,
                    url: url.hostname + url.pathname,
                    templates: templates
                });

                let radio_container = document.getElementById('radio-container');

                Object.values(templates).forEach(template => {

                    let label = document.createElement('label');
                    let input = document.createElement('input');
                    let span = document.createElement('span');

                    input.type = 'radio';
                    input.name = 'view';
                    input.value = template.name;
                    input.id = `view-${template.name}`;

                    span.innerText = template.name;

                    label.htmlFor = `view-${template.name}`;

                    label.appendChild(input);
                    label.appendChild(span);

                    input.addEventListener('change', async () => {
                        console.log("Sending template" + template.name)
                        chrome.runtime.sendMessage({
                            action: "set_template",
                            id: tab.id,
                            url: url.hostname + url.pathname,
                            template: template,
                        });
                    });

                    radio_container.appendChild(label);
                });
            })
            .catch((error) => {
                console.log('Error:', error)
                reject(error);
            });

        document.getElementById('generate-button').addEventListener('click', async () => {
            chrome.runtime.sendMessage({action: "generate", id: tab.id, url: url.hostname + url.pathname})
        });

        document.getElementById('clear-cache').addEventListener('click', async () => {
            chrome.runtime.sendMessage({action: "clear-cache", id: tab.id, url: url.hostname + url.pathname})
        });

        document.getElementById('openAIKey').addEventListener('input', function () {
            console.log("Setting new openAI key..." + document.getElementById('openAIKey').value)
            chrome.runtime.sendMessage({
                action: "push_openai_to_background",
                key: document.getElementById('openAIKey').value,
                url: url.hostname + url.pathname
            })
        });

        resolve();
    })
}

document.addEventListener('DOMContentLoaded', async function () {
    getActiveTab(function (tab) {
        const url = new URL(tab.url);
        setup(tab, url).then(async () => {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === "generation_init") {
                    console.log("Generated!")
                }

                if (message.action === "generation_completed") {
                    console.log("Set!")
                }

                if (message.action === "push_openai_to_popup") {
                    console.log("OpenAI set!" + message.openai)
                    document.getElementById('openAIKey').value = message.openai
                }
            });

            chrome.runtime.sendMessage({
                action: "setup_finished",
                id: tab.id,
                url: url.hostname + url.pathname
            })
        });
    })
});


/*
--###--
Event listeners
--###--
*/
