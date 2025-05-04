"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLink = addLink;
exports.moveLinkBatch = moveLinkBatch;
const util_1 = require("./util");
function addLink(document, sourceId, sourcePort, targetId, targetPort, intermediateNodes = [], getDocumentAsJson, updateTextDocument) {
    const json = getDocumentAsJson(document);
    const links = Array.isArray(json.links) ? json.links : [];
    const newLink = {
        id: (0, util_1.getNonce)(),
        sourceId: sourceId,
        sourcePort: sourcePort,
        targetId: targetId,
        targetPort: targetPort,
        intermediateNodes: intermediateNodes
    };
    links.push(newLink);
    json.links = links;
    console.log(`Added link between ${sourceId}:${sourcePort} and ${targetId}:${targetPort}`);
    updateTextDocument(document, json);
}
function moveLinkBatch(document, updates, getDocumentAsJson, updateTextDocument) {
    const json = getDocumentAsJson(document);
    // Iterate over each update and apply the changes
    updates.forEach(update => {
        const link = json.links.find((link) => link.id === update.id);
        console.log("Link and intermediate nodes:");
        console.log(link);
        console.log(link?.intermediateNodes);
        console.log(json.links);
        console.log(update.id);
        if (link && Array.isArray(link.intermediateNodes) && link.intermediateNodes[update.nodeIndex]) {
            // Update the position of the intermediate node
            link.intermediateNodes[update.nodeIndex].x = update.x;
            link.intermediateNodes[update.nodeIndex].y = update.y;
        }
        else {
            console.warn(`Link or intermediate node not found for update:`, update);
        }
    });
    // Save the updated JSON back to the document
    updateTextDocument(document, json);
}
//# sourceMappingURL=LinkManager.js.map