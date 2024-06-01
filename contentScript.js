let nodeWeightCache = new Map();

const TEXT_BOUNDARY_MIN = 30;
const TEXT_BOUNDARY_MAX = 300;

function calculateWeight(node) {
    if (nodeWeightCache.has(node)) {
        return nodeWeightCache.get(node);
    }

    let htmlWeight = 0;
    let contentWeight = 0;

    if (node.nodeType === Node.TEXT_NODE) {
        contentWeight = node.textContent.length;
        htmlWeight = 0;
    } else {
        Array.from(node.childNodes).forEach(child => {
            const { htmlWeight: childHtmlWeight, contentWeight: childContentWeight } = calculateWeight(child);
            htmlWeight += childHtmlWeight;
            contentWeight += childContentWeight;
        });
        try {
            if(node.outerHTML && node.innerHTML) {
                htmlWeight += node.outerHTML.length - node.innerHTML.length;
            }
        } catch (error) {
            console.warn(node, error);
        }}

    const result = { htmlWeight, contentWeight };
    nodeWeightCache.set(node, result);
    return result;
}

function sigmoid(x, a = 1) {
    return 1 / (1 + Math.exp(-a * (x - 0.5)));
}

function shouldMoveToChildren(parentWeight, childrenWeights) {
    const { htmlWeight: parentHtmlWeight, contentWeight: parentContentWeight } = parentWeight;
    const totalChildHtmlWeight = childrenWeights.reduce((sum, weight) => sum + weight.htmlWeight, 0);
    const totalChildContentWeight = childrenWeights.reduce((sum, weight) => sum + weight.contentWeight, 0);

    const htmlWeightReduction = parentHtmlWeight - totalChildHtmlWeight;
    const contentWeightLoss = parentContentWeight - totalChildContentWeight;

    // Adjust the sigmoid curve to prioritize differently based on the HTML weight
    const htmlWeightFactor = sigmoid(parentHtmlWeight / 500, 10); // Adjust '10' for steepness
    const contentWeightFactor = sigmoid(1 - (totalChildContentWeight / parentContentWeight), 10);

    const weightedHtmlWeightReduction = htmlWeightReduction * htmlWeightFactor;
    const weightedContentWeightLoss = contentWeightLoss * contentWeightFactor;

    return totalChildContentWeight >= TEXT_BOUNDARY_MIN && weightedHtmlWeightReduction > weightedContentWeightLoss;
}

function optimizeTraversal(node) {
    let bestNodes = [];

    function traverse(node) {
        const { htmlWeight, contentWeight } = calculateWeight(node);

        if (!node.children || node.children.length === 0) {
            if (contentWeight >= TEXT_BOUNDARY_MIN) {
                bestNodes.push(node);
            }
            return;
        }

        const childrenWeights = Array.from(node.children).map(child => calculateWeight(child));

        if (shouldMoveToChildren({ htmlWeight, contentWeight }, childrenWeights)) {
            Array.from(node.children).forEach(child => traverse(child));
        } else {
            if (contentWeight >= TEXT_BOUNDARY_MIN) {
                bestNodes.push(node);
            }
        }
    }

    traverse(node);
    return bestNodes;
}

function getXPathFor(node) {
    var parts = [];

    for (; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentNode) {
        var index = 0;
        for (var sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
            if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
            if (sibling.nodeName === node.nodeName) ++index;
        }

        var nodeName = node.nodeName.toLowerCase();
        var part = (index ? nodeName + '[' + (index + 1) + ']' : nodeName);
        parts.unshift(part);
    }

    return parts.length > 0 ? '/' + parts.join('/') : '';
}

function iterate(startNode) {
    let nodes = [];

    function push(node) {
        let rect = node.getBoundingClientRect();
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

    const bestNodes = optimizeTraversal(startNode);
    bestNodes.forEach(node => push(node));

    console.log(nodes)
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
