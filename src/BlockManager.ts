import * as vscode from 'vscode';
import { getNonce } from './util';

export function addBlock(document: vscode.TextDocument, getDocumentAsJson: (doc: vscode.TextDocument) => any, updateTextDocument: (doc: vscode.TextDocument, json: any) => void): void {
    const json = getDocumentAsJson(document);
    const blocks = Array.isArray(json.blocks) ? json.blocks : [];
    blocks.push({
        id: getNonce(),
        label: 'New Block',
        x: 50,
        y: 50
    });
    json.blocks = blocks;
    updateTextDocument(document, json);
}

export function moveBlock(document: vscode.TextDocument, id: string, x: number, y: number, getDocumentAsJson: (doc: vscode.TextDocument) => any, updateTextDocument: (doc: vscode.TextDocument, json: any) => void): void {
    const json = getDocumentAsJson(document);
    const block = (json.blocks || []).find((b: any) => b.id === id);
    if (block) {
        block.x = x;
        block.y = y;
        console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
        updateTextDocument(document, json);
    }
}

export function moveBlocks(document: vscode.TextDocument, updates: { id: string; x: number; y: number }[], getDocumentAsJson: (doc: vscode.TextDocument) => any, updateTextDocument: (doc: vscode.TextDocument, json: any) => void): void {
    const json = getDocumentAsJson(document);

    updates.forEach(update => {
        const block = (json.blocks || []).find((b: any) => b.id === update.id);
        if (block) {
            block.x = update.x;
            block.y = update.y;
            console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
        }
    });

    updateTextDocument(document, json);
}

export async function editBlockLabel(document: vscode.TextDocument, id: string, getDocumentAsJson: (doc: vscode.TextDocument) => any, updateTextDocument: (doc: vscode.TextDocument, json: any) => void): Promise<void> {
    const json = getDocumentAsJson(document);
    const block = (json.blocks || []).find((b: any) => b.id === id);
    if (!block) { return; }

    const newLabel = await vscode.window.showInputBox({
        prompt: 'New label for block',
        value: block.label
    });

    if (newLabel === undefined) { return; }  // user cancelled

    block.label = newLabel;
    updateTextDocument(document, json);
}
