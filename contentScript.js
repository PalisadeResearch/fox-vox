let skippedNodes = [];

/**
 * Generates an XPath for any node in the document.
 * @param {Node} node - The node to generate an XPath for.
 * @return {string} An absolute XPath to the node.
 */

const TEXT_BOUNDARY = 200
const CONTEXT_BOUNDARY = 40

function getXPathFor(node) {
    var parts = [];

    for (; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentNode) {
        var index = 0;
        for (var sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
            // Ignore document type declaration.
            if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE)
                continue;
            if (sibling.nodeName === node.nodeName)
                ++index;
        }

        var nodeName = node.nodeName.toLowerCase();
        var part = (index ? nodeName + '[' + (index + 1) + ']' : nodeName);
        parts.unshift(part);
    }

    return parts.length > 0 ? '/' + parts.join('/') : '';
}

let nodeSizeCache = new Map();

function calculateSize(node) {
    if (nodeSizeCache.has(node)) {
        return nodeSizeCache.get(node);
    }

    let result;

    if (node.nodeType === Node.TEXT_NODE) {
        result = node.textContent.length;
    } else {
        result = Array.from(node.childNodes)
            .reduce((sum, child) => sum + calculateSize(child), 0);
    }

    nodeSizeCache.set(node, result);
    return result;
}

function iterate(startNode) {
    let queue = [startNode];
    let nodes = [];

    function push(node) {
        let rect = node.getBoundingClientRect();
        if (!node.textContent || node.textContent.length < CONTEXT_BOUNDARY) { return }
        nodes.push({
            xpath: getXPathFor(node),
            layout: {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            },
            innerHTML: node.innerHTML,
            plainText: node.textContent,
        });
    }

    while (queue.length > 0) {
        let node = queue.shift();
        let size = calculateSize(node);

        if (size > TEXT_BOUNDARY && node.children) {
            let isSpecialTag = Array.from(node.children).every(child =>
                child.nodeType === Node.TEXT_NODE ||
                ['a', 'b', 'strong'].includes(child.tagName.toLowerCase())
            );

            if (isSpecialTag) {
                push(node);
            } else {
                let nonScriptChildren = Array.from(node.children)
                    .filter(child => child.tagName.toLowerCase() !== 'script' && child.offsetWidth !== 0 && child.offsetHeight !== 0);
                queue.push(...nonScriptChildren);
            }
        } else {
            push(node);
        }
    }

    console.log(nodeSizeCache)
    return nodes;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.ping) {
        sendResponse({pong: true});
        return;
    }

    if (request.action === "fetchText") {
        let result = iterate(document.body);
        sendResponse({nodes: result})
    }

    if (request.action === "postText") {
        request.data.forEach(({xpath, text}) => {
            const iterator = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
            try {
                let thisNode = iterator.iterateNext();
                while (thisNode) {
                    thisNode.innerHTML = text;
                    thisNode = iterator.iterateNext();
                }
            } catch (e) {
                console.log('Error: Document tree modified during iteration ' + e);
            }
        });
    }
});

window.addEventListener('unload', async () => {
    await chrome.runtime.sendMessage({action: 'pageRefreshed'});
    await new Promise(resolve => setTimeout(resolve, 1000));
});
