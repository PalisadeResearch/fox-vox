let nodeWeightCache = new Map();

const TEXT_BOUNDARY_MIN = 20;
const TEXT_BOUNDARY_MAX = 300;

function getAbsolutePosition(element) {
    let top = 0, left = 0;
    while (element) {
        top += element.offsetTop || 0;
        left += element.offsetLeft || 0;
        element = element.offsetParent;
    }
    return { top, left };
}

function calculateWeight(node) {
    if (nodeWeightCache.has(node)) {
        return nodeWeightCache.get(node);
    }

    let htmlWeight = 0;
    let contentWeight = 0;

    if (node.nodeType === Node.TEXT_NODE) {
        contentWeight = node.textContent.length;
        htmlWeight = 0;
    } else if (node.nodeType === Node.COMMENT_NODE) {
        contentWeight = 0;
        htmlWeight = node.nodeValue.length;
    } else {
        Array.from(node.childNodes).forEach(child => {
            const {htmlWeight: childHtmlWeight, contentWeight: childContentWeight} = calculateWeight(child);
            htmlWeight += childHtmlWeight;
            contentWeight += childContentWeight;
        });
        try {
            if (node.outerHTML && node.innerHTML) {
                htmlWeight += node.outerHTML.length - node.innerHTML.length;
            } else if (node.outerHTML) {
                htmlWeight += node.outerHTML.length;
            }
        } catch (error) {
            console.warn(node, error);
        }
    }

    const result = {htmlWeight, contentWeight};
    nodeWeightCache.set(node, result);
    return result;
}

function sigmoid(x, b = 0.5, a = 1) {
    return 1 / (1 + Math.exp(-a * (x - b)));
}

function shouldMoveToChildren(parentWeight, childrenWeights) {
    const {htmlWeight: parentHtmlWeight, contentWeight: parentContentWeight} = parentWeight;
    const totalChildHtmlWeight = childrenWeights.reduce((sum, weight) => sum + weight.htmlWeight, 0);
    const totalChildContentWeight = childrenWeights.reduce((sum, weight) => sum + weight.contentWeight, 0);

    const htmlWeightReduction = parentHtmlWeight - totalChildHtmlWeight;
    const contentWeightLoss = parentContentWeight - totalChildContentWeight;

    const htmlWeightFactor = sigmoid(parentHtmlWeight / 500, 0.5, 10); // Adjust '10' for steepness
    console.log(htmlWeightFactor);
    const contentWeightFactor = sigmoid(totalChildContentWeight / parentContentWeight, 0.5, 10);
    console.log(contentWeightFactor)

    const weightedHtmlWeightReduction = htmlWeightReduction * htmlWeightFactor;
    const weightedContentWeightLoss = contentWeightLoss * (1-contentWeightFactor);
    console.log([weightedHtmlWeightReduction, weightedContentWeightLoss]);

    return totalChildContentWeight >= TEXT_BOUNDARY_MIN && weightedHtmlWeightReduction > weightedContentWeightLoss;
}

function optimizeTraversal(node) {
    let bestNodes = [];

    function traverse(node) {
        const {htmlWeight, contentWeight} = calculateWeight(node);
        console.log([node, htmlWeight, contentWeight])

        if (!node.children || node.children.length === 0) {
            if (contentWeight >= TEXT_BOUNDARY_MIN && node.tagName !== 'SCRIPT') {
                bestNodes.push(node);
            }
            return;
        }

        const childrenWeights = Array.from(node.children).map(child => calculateWeight(child));

        if (shouldMoveToChildren({htmlWeight, contentWeight}, childrenWeights)) {
            Array.from(node.children).forEach(child => traverse(child));
        } else {
            if (contentWeight >= TEXT_BOUNDARY_MIN && node.tagName !== 'SCRIPT') {
                bestNodes.push(node);
            }
        }
        console.log(node, htmlWeight, contentWeight)
    }

    traverse(node);
    console.log("Best nodes:", bestNodes)
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

function validateNode(orig_node, node) {
    console.log([orig_node, node])
    return orig_node.offsetWidth && orig_node.offsetHeight && node.innerHTML && node.plainText && orig_node.tagName !== 'SCRIPT'
}

function iterate(startNode) {
    let nodes = [];

    function push(orig_node) {
        let {top, left} = getAbsolutePosition(orig_node);
        let node = {
            xpath: getXPathFor(orig_node),
            layout: {
                left: left,
                top: top,
            },
            innerHTML: orig_node.innerHTML,
            plainText: orig_node.textContent,
        }

        if(validateNode(orig_node, node)) {
            nodes.push(node);
        }
    }

    const bestNodes = optimizeTraversal(startNode);
    bestNodes.forEach(node => push(node));

    console.log(nodes)
    return nodes;
}


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.ping) {
        sendResponse({pong: true});
        return;
    }

    if (request.action === "fetchText") {
        let result = iterate(document.body);
        sendResponse({nodes: result})
    }

    if (request.action === "postText") {
        console.log("Posting data!")
        console.log(request)
        try {
            const node = document.evaluate(request.data.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            console.log(node)
            if (node) {
                node.innerHTML = request.data.html;
            } else {
                console.log(`No element matches the provided XPath: ${request.data.xpath}`);
            }
        } catch (e) {
            console.log(e);
        }
        sendResponse()
    }
});

window.addEventListener('unload', async () => {
    await chrome.runtime.sendMessage({action: 'pageRefreshed'});
    await new Promise(resolve => setTimeout(resolve, 1000));
});
