import * as vscode from 'vscode';
import { getNonce } from './util';
import { initializeBlockMetadata } from './BlockMetadata';

export function addBlock(
    json: any
): any {
    const blocks = Array.isArray(json.blocks) ? json.blocks : [];

    // Define the new block
    const newBlock = {
        id: getNonce(),
        label: 'New Block',
        x: 50,
        y: 50,
        blockType: 'defaultType', 
        blockClass: 'defaultClass',
        inputPorts: 0,
        outputPorts: 0, 
        properties: {} 
    };

    // Initialize ports and properties based on blockType and blockClass
    initializeBlockMetadata(newBlock);

    blocks.push(newBlock);
    json.blocks = blocks;
    return json;
}

export function moveBlock(id: string, x: number, y: number, json: any): any {
    const block = (json.blocks || []).find((b: any) => b.id === id);
    if (block) {
        block.x = x;
        block.y = y;
        console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
    }
    return json;
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
