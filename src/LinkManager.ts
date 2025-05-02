import * as vscode from 'vscode';
import { getNonce } from './util';

export function addLink(
    document: vscode.TextDocument,
    sourceId: string,
    sourcePort: number,
    targetId: string,
    targetPort: number,
    intermediateNodes: { x: number; y: number }[] = [],
    getDocumentAsJson: (doc: vscode.TextDocument) => any,
    updateTextDocument: (doc: vscode.TextDocument, json: any) => void
): void {
    const json = getDocumentAsJson(document);
    const links = Array.isArray(json.links) ? json.links : [];

    // Check if the link already exists
    const existingLink = links.find(
        (link: any) =>
            link.sourceId === sourceId &&
            link.sourcePort === sourcePort &&
            link.targetId === targetId &&
            link.targetPort === targetPort
    );
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

export function moveLinkBatch(document: vscode.TextDocument, updates: { 
    sourceId: string; 
    sourcePort: number; 
    targetId: string; 
    targetPort: number; 
    nodeIndex: number; 
    x: number; 
    y: number; }[],
    getDocumentAsJson: (doc: vscode.TextDocument) => any,
    updateTextDocument: (doc: vscode.TextDocument, json: any) => void): void {
    const json = getDocumentAsJson(document);

    // Iterate over each update and apply the changes
    updates.forEach(update => {
        const link = json.links.find((link: any) =>
            link.sourceId === update.sourceId &&
            link.sourcePort === update.sourcePort &&
            link.targetId === update.targetId &&
            link.targetPort === update.targetPort
        );

        if (link && Array.isArray(link.intermediateNodes) && link.intermediateNodes[update.nodeIndex]) {
            // Update the position of the intermediate node
            link.intermediateNodes[update.nodeIndex].x = update.x;
            link.intermediateNodes[update.nodeIndex].y = update.y;
        } else {
            console.warn(`Link or intermediate node not found for update:`, update);
        }
    });

    // Save the updated JSON back to the document
    updateTextDocument(document, json);
}