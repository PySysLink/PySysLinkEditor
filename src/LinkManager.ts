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