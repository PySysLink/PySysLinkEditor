"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLink = addLink;
function addLink(document, sourceId, targetId, getDocumentAsJson, updateTextDocument) {
    const json = getDocumentAsJson(document);
    const links = Array.isArray(json.links) ? json.links : [];
    // Check if the link already exists
    const existingLink = links.find((link) => link.sourceId === sourceId && link.targetId === targetId);
    if (existingLink) {
        console.log(`Link between ${sourceId} and ${targetId} already exists.`);
        return;
    }
    // Add the new link
    links.push({ sourceId, targetId });
    json.links = links;
    console.log(`Added link between ${sourceId} and ${targetId}`);
    updateTextDocument(document, json);
}
//# sourceMappingURL=LinkManager.js.map