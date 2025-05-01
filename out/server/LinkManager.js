"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLink = addLink;
function addLink(document, sourceId, sourcePort, targetId, targetPort, intermediateNodes = [], getDocumentAsJson, updateTextDocument) {
    const json = getDocumentAsJson(document);
    const links = Array.isArray(json.links) ? json.links : [];
    // Check if the link already exists
    const existingLink = links.find((link) => link.sourceId === sourceId &&
        link.sourcePort === sourcePort &&
        link.targetId === targetId &&
        link.targetPort === targetPort);
    if (existingLink) {
        console.log(`Link between ${sourceId}:${sourcePort} and ${targetId}:${targetPort} already exists.`);
        return;
    }
    // Add the new link
    links.push({
        sourceId,
        sourcePort,
        targetId,
        targetPort,
        intermediateNodes
    });
    json.links = links;
    console.log(`Added link between ${sourceId}:${sourcePort} and ${targetId}:${targetPort}`);
    updateTextDocument(document, json);
}
//# sourceMappingURL=LinkManager.js.map