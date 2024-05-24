

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.ping) { sendResponse({pong: true}); return; }

    if (request.action === "fetchText") {
        var xpath = function(node) {
            var index, path = [], sibling, siblings;
            while (node && node.nodeType === Node.ELEMENT_NODE) {
                index = 0;
                siblings = node.parentNode.childNodes;
                for (var i = 0; i < siblings.length; i++) {
                    sibling = siblings[i];
                    if (sibling.nodeType !== Node.ELEMENT_NODE) {
                        continue;
                    }
                    if (sibling === node) {
                        path.unshift(node.tagName.toLowerCase() + '[' + (index + 1) + ']');
                        break;
                    }
                    if (sibling.nodeType === node.nodeType && sibling.tagName === node.tagName) {
                        index++;
                    }
                }
                node = node.parentNode;
            }
            return path.length ? '/' + path.join('/') : null;
        };

        const iterator = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, function(node) {
            return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        });

        const nodes = [];
        let currentNode;
        while (currentNode = iterator.nextNode()) {
            const nodeText = currentNode.nodeValue.trim();
            const isScriptTag = currentNode.parentNode.tagName === "SCRIPT";
            const specialCharacterCount = (nodeText.match(/[{}\/@#]/g) || []).length;

            if (!isScriptTag && nodeText.length >= 30 && specialCharacterCount < 3) {
                const rect = currentNode.parentNode.getBoundingClientRect();
                if (rect.top || rect.left || rect.width || rect.height || rect.right || rect.bottom) {
                    nodes.push({
                        text: nodeText,
                        xpath: xpath(currentNode.parentNode),
                        layout: {
                            left: rect.left,
                            top: rect.top,
                            right: rect.right,
                            bottom: rect.bottom,
                            width: rect.width,
                            height: rect.height
                        }
                    });
                }
            }
        }
        console.log("Sending response...")
        sendResponse({nodes: nodes });
    } else if (request.action === "postText") {
        request.data.forEach(({xpath, text}) => {
            const iterator = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
            try {
                let thisNode = iterator.iterateNext();
                while (thisNode) {
                    thisNode.textContent = text;
                    thisNode = iterator.iterateNext();
                }
            }
            catch (e) {
                console.log( 'Error: Document tree modified during iteration ' + e );
            }
        });
    }
});