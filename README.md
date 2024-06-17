---
layout: default
---

# Welcome to FoxVox Landing!

FoxVox is a Chrome extension powered by GPT-4, created by Palisade Research, to interactively demonstrate the capabilities of AI for **automated disinformation at scale**. Our goal is to show how AI can be used by malicious actors—such as large corporations, news websites, social media platforms, or hackers—to subtly alter the content you consume online without your awareness.

With current capabilities of AI-models, you are one click away from making NYT sound like a journal on conspiracy theories ...

# Image Comparison Slider

![NYT](/docs/assets/tg_image_1684397744.jpeg)

Or from making stack overflow a collection of bad jokes ...

![SO](/docs/assets/tg_image_453700902.jpeg)

And so much more!

### Why is this dangerous?

- **Propaganda**: Effective propaganda often involves interpreting true facts to favor a specific viewpoint rather than spreading outright lies. AI models can generate high-quality news titles and articles en masse, making it easier for actors to flood the internet with politically charged content and sway public opinion more effectively than ever before.

- **Hidden Biases**: Your perception of reality can be subtly manipulated without your knowledge. As more companies integrate AI models to generate, analyze, structure, or search for content, there is a lack of procedures or certifications to ensure these tools are used ethically. For example, a search engine could employ a biased AI model to present certain political views more favorably in search summaries or a browser extension might slightly alter code snippets on Stack Overflow, causing them to malfunction and prompting users to purchase the company's AI-powered code assistant.

- **Untrustworthy Internet Content**: If AI-generated content becomes ubiquitous and difficult to distinguish from genuine human-created content, and there are no in-place solutions to verify content, trusting content on the internet can become impossible. 

- **Targeted Attacks**: Advanced AI can tailor disinformation campaigns to specific demographics, increasing their effectiveness. For instance, personalized fake news stories could be created to target individuals based on their online behavior, making the disinformation more convincing. Alternatively, AI system could target a specific person, collecting information about them throughout the web, and then making convincing and strategic phishing emails and calls.

### How fast and pricey one generation is? Can we make it even more convincing?

Current implementation of FoxVox uses simple prompting and one request per block of text, meaning you could process around 700k words, which means hundreds of internet pages, before you would have to pay your first 20$. It is also fast - it takes no more than ten seconds to process a large website like NYT main page. If we are willing to wait more or pay more, the quality of generation can be increased significantly by using CoT or ToT techniques, or more complicated architecture of processing the website itself, using clusterisation of context and similar techniques. 

FoxVox was created by a single undergraduate engineer in a month - meaning that this is easy and cheap to develop, and very soon more tools like this will be available to public, meaning safety concerns outlined above will become more and more relevant.

### What is the narrative? What do we propose to do?

FoxVox aims to highlight the potential dangers of AI-driven disinformation. By demonstrating how AI can be used to manipulate the content you see online, we hope to raise awareness about the need for ethical guidelines and safeguards in AI development and deployment.  

Potential of AI for disinformation is vast, and we don't have basic defences against it. We imply that development of AI technologies demands us to adopt new standards of content verification, including web content. These standards can include:

- Page hash verifications that happen outside of browser context, allowing us to check if content of the page has been tempered with.

- Certificates for news aggregators and social media platforms that verify their integirty. 

### How do I check it out myself?

1. Visit our google web store page: _google web store link HERE_ 
2. Download the chrome extension
3. Go to your favourite news outlet
4. Open the extension, choose a template, and click generate
5. Enjoy!


