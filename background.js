import {delete_indexDB, fetch_from_object_store, open_indexDB, push_to_object_store} from "./database.js";
import {cluster} from "./cluster.js";
import {CoT} from "./generation.js";

function fetch() {
    const TEXT_BOUNDARY_MIN = 20;

    function get_position(element) {
        let top = 0, left = 0;
        while (element) {
            top += element.offsetTop || 0;
            left += element.offsetLeft || 0;
            element = element.offsetParent;
        }
        return {top, left};
    }

    let nodeWeightCache = new Map();

    function calculate_weight(node) {
        if (nodeWeightCache.has(node)) {
            return nodeWeightCache.get(node);
        }

        let htmlWeight = 0;
        let contentWeight = 0;


        if (node.nodeType === 3) { //Checking if nodeType is TEXT_NODE
            contentWeight = node.textContent.length;
            htmlWeight = 0;
        } else if (node.nodeType === 8) { //Checking if nodeType is COMMENT_NODE
            contentWeight = 0;
            htmlWeight = node.nodeValue.length;
        } else {
            Array.from(node.childNodes).forEach(child => {
                const {htmlWeight: childHtmlWeight, contentWeight: childContentWeight} = calculate_weight(child);
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

    function decompose(parentWeight, childrenWeights) {
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
        const weightedContentWeightLoss = contentWeightLoss * (1 - contentWeightFactor);
        console.log([weightedHtmlWeightReduction, weightedContentWeightLoss]);

        return totalChildContentWeight >= TEXT_BOUNDARY_MIN && weightedHtmlWeightReduction > weightedContentWeightLoss;
    }

    function traverse_dom(node) {
        let bestNodes = [];

        function traverse(node) {
            const {htmlWeight, contentWeight} = calculate_weight(node);
            console.log([node, htmlWeight, contentWeight])

            if (!node.children || node.children.length === 0) {
                if (contentWeight >= TEXT_BOUNDARY_MIN && node.tagName !== 'SCRIPT') {
                    bestNodes.push(node);
                }
                return;
            }

            const childrenWeights = Array.from(node.children).map(child => calculate_weight(child));

            if (decompose({htmlWeight, contentWeight}, childrenWeights)) {
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

    function get_xpath(node) {
        const parts = [];

        for (; node && node.nodeType === 1; node = node.parentNode) { //Checking if nodeType is ELEMENT_NODE
            let index = 0;
            for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType === 10) continue; //Checking if nodeType is DOCUMENT_NODE
                if (sibling.nodeName === node.nodeName) ++index;
            }

            const nodeName = node.nodeName.toLowerCase();
            const part = (index ? nodeName + '[' + (index + 1) + ']' : nodeName);
            parts.unshift(part);
        }

        return parts.length > 0 ? '/' + parts.join('/') : '';
    }

    function validate_node(orig_node, node) {
        console.log([orig_node, node])
        return orig_node.offsetWidth && orig_node.offsetHeight && node.innerHTML && node.plainText && orig_node.tagName !== 'SCRIPT'
    }

    const root = document.body
    let nodes = [];
    console.log(root)

    function push(node) {
        let {top, left} = get_position(node);
        let minimal = {
            xpath: get_xpath(node),
            layout: {
                left: left,
                top: top,
            },
            innerHTML: node.innerHTML,
            plainText: node.textContent,
        }

        if (validate_node(node, minimal)) {
            nodes.push(minimal);
        }
    }

    traverse_dom(root).forEach(node => push(node));

    console.log(nodes)
    return nodes;
}

/*
--###--
Generation (DOESN'T WORK)
--###--
*/

async function* generate(clusters, template, openai) {
    const promises = clusters.map(async cluster => {
        console.log("CoT launched for cluster", cluster, "at", Date.now());
        const original = cluster.map(node => `${node.xpath}\n\n${node.innerHTML}`).join('\n\n--###--\n\n');
        const generation = await CoT(openai, template, original);
        console.log("CoT finished for cluster", cluster, "at", Date.now(), "with result:", generation);
        return generation;
    });

    for (const promise of promises)
    {
        const generation = await promise;
        if (generation)
        {
            yield generation;
        }
    }
}

/*
--###--
SETUP
--###--
*/

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "setup") {
        console.log('Setting up ...')
        open_indexDB(request.url, Object.values(request.templates).map(template => template.name)).then(() => {
            fetch_from_object_store(request.url, 'original')
                .then(async original => {
                    console.log('Fetched original data')
                    if (original?.length > 0) {
                        console.log("original:", original)
                        fetch_from_object_store(request.url, 'clusters')
                            .then(clusters => {
                                console.log('Fetched clusters data')
                                if (clusters?.length > 0) {
                                    console.log("clusters:", clusters)
                                } else {
                                    // cluster the original data
                                    cluster(original).then(clusters => {
                                        console.log("clusters:", clusters)
                                        // save clusters to object store
                                        push_to_object_store(request.url, 'clusters', clusters)
                                            .then(() => {
                                                // successful operation here
                                                console.log('Clusters added successfully.');
                                            })
                                            .catch(console.error);
                                    });
                                }
                            })
                            .catch(console.error);
                    } else {
                        console.log('Retrieving text ...')
                        let result;
                        try {
                            result = await chrome.scripting.executeScript({
                                target: {tabId: request.id},
                                func: fetch
                            });
                        } catch (e) {
                            console.warn(e.message || e);
                            return;
                        }
                        const nodes = result[0].result
                        console.log("original:", original)
                        push_to_object_store(request.url, 'original', nodes)
                            .then(() => {
                                // successful operation here
                                console.log('Original added successfully.');
                                // cluster the data from response
                                cluster(nodes).then(clusters => {
                                    console.log("clusters:", clusters)
                                    // save clusters to object store
                                    push_to_object_store(request.url, 'clusters', clusters)
                                        .then(() => {
                                            // successful operation here
                                            console.log('Clusters added successfully.');
                                        })
                                        .catch(console.error);
                                });
                            })
                            .catch(console.error);
                    }
                })
                .catch(console.error);
        });

        let obj = {};
        obj['template_' + request.url] = Object.values(request.templates)[0];
        chrome.storage.local.set(obj, function () {
            console.log('Template for', request.url, 'saved:', Object.values(request.templates)[0]);
        });
    }

    if (request.action === "set_template") {
        let obj = {};
        obj['template_' + request.url] = request.template;
        chrome.storage.local.set(obj, function () {
            console.log('Template for', request.url, 'saved:', request.template);

            // Always fetch and push 'original' first
            fetch_from_object_store(request.url, 'original').then(original_nodes => {
                console.log("Original Nodes:", original_nodes)
                original_nodes.forEach(async original_node => {
                    const xpath = original_node.xpath;
                    const html = original_node.innerHTML;

                    const func = function (xpath, html) {
                        const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                        if (node) {
                            node.innerHTML = html;
                        } else {
                            console.log(`No element matches the provided XPath: ${xpath}`);
                        }
                    }

                    await chrome.scripting.executeScript({
                        target: {tabId: request.id},
                        function: func,
                        args: [xpath, html]
                    });

                });
            });

            console.log("Original pushed...")

            console.log("Fetching template", request.template.name)
            // Then fetch and push the chosen template
            fetch_from_object_store(request.url, request.template.name).then(nodes => {
                console.log("Template Nodes:", nodes)
                nodes.forEach(async node => {
                    const xpath = node.xpath;
                    const html = node.html;

                    const func = function (xpath, html) {
                        const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                        if (node) {
                            node.innerHTML = html;
                        } else {
                            console.log(`No element matches the provided XPath: ${xpath}`);
                        }
                    }

                    await chrome.scripting.executeScript({
                        target: {tabId: request.id},
                        function: func,
                        args: [xpath, html]
                    });

                });
            });
        });
    }

    if (request.action === "clear-cache") {
        delete_indexDB(request.url)
    }

    if (request.action === "push_openai_to_background") {
        let obj = {};
        obj['openai'] = request.key;
        chrome.storage.local.set(obj, function () {
            console.log('OpenAI key set');
        });

        chrome.runtime.sendMessage({
            action: "push_openai_to_popup",
            openai: request.key
        });
    }

    if (request.action === "setup_finished") {
        chrome.storage.local.get('openai', function (result) {
            chrome.runtime.sendMessage({
                action: "push_openai_to_popup",
                openai: result['openai']
            });
        })
    }

    if (request.action === "generate") {
        fetch_from_object_store(request.url, 'clusters').then(async clusters => {
            chrome.storage.local.get(['template_' + request.url, 'openai'], async function (result) {
                if (result['template_' + request.url] && result['openai']) {
                    let nodes = [];
                    for await (const generation of generate(clusters, result['template_' + request.url], result['openai'])) {
                        for (const node of generation) {
                            nodes.push(node);

                            const xpath = node.xpath;
                            const html = node.html;

                            const func = function (xpath, html) {
                                const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                                if (node) {
                                    node.innerHTML = html;
                                } else {
                                    console.log(`No element matches the provided XPath: ${xpath}`);
                                }
                            }

                            chrome.scripting.executeScript({
                                target: {tabId: request.id},
                                function: func,
                                args: [xpath, html]
                            });
                        }
                    }

                    if (nodes.length > 0) {
                        push_to_object_store(request.url, result['template_' + request.url].name, nodes)
                    }

                    console.log("Page rewritten!...")

                } else {
                    console.log('Cannot find required keys in local storage.');
                }
            });
        }).catch(error => {
            console.log('Error fetching data from object store:', error);
        });
    }
});