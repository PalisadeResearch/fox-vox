import {ToT_DFS} from './generation.js';
import {humorous} from "./templates.js";

document.getElementById('button').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: "getTags"}, async function (response) {
            console.log("Tags collected...");
            console.log(response.tags);
            const tasks = response.tags.map(async tag => {
                console.log("Starting ToT_DFS for tag: " + tag.id);
                tag.textContent = "HELLO WORLD";

                // Sending updateTag message
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateTag",
                    data: {
                        id: tag.id,
                        text: tag.textContent
                    }
                });
            });

            await Promise.all(tasks);
        });
    });
});
