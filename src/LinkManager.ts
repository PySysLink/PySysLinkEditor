import * as vscode from 'vscode';
import { getNonce } from './util';

export function addLink(document: vscode.TextDocument, sourceId: string, targetId: string, getDocumentAsJson: (doc: vscode.TextDocument) => any, updateTextDocument: (doc: vscode.TextDocument, json: any) => void): void {
    const json = getDocumentAsJson(document);
    const links = Array.isArray(json.links) ? json.links : [];
    
    // Check if the link already exists
    const existingLink = links.find((link: any) => link.sourceId === sourceId && link.targetId === targetId);
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