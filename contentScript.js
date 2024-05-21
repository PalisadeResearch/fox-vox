// contentScript.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getTags") {
        var tags = [...document.querySelectorAll('p')].map((tag, index)=> { tag.dataset.tagIndex = index; return { textContent: tag.textContent, id: index }; });

        sendResponse({tags: tags}); }
    else
        if (request.action === "updateTag")
        { var tagElement = document.querySelector(`[data-tag-index="${request.data.id}"]`);
            if(tagElement!= null){ tagElement.textContent = request.data.text; }
        }
});