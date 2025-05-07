import * as vscode from 'vscode';

export function moveMovables(
    document: vscode.TextDocument,
    updates: { type: string; id: string; x: number; y: number }[],
    getDocumentAsJson: (document: vscode.TextDocument) => any,
    updateTextDocument: (document: vscode.TextDocument, json: any) => void
): void {
    const json = getDocumentAsJson(document);

    // Iterate over the updates and apply them
    updates.forEach(update => {
        switch (update.type) {
            case 'moveBlock': {
                const block = json.blocks.find((block: any) => block.id === update.id);
                if (block) {
                    block.x = update.x;
                    block.y = update.y;
                }
                break;
            }
            case 'moveLinkNode': {
                const linkNode = json.links.find((link: any) =>
                    link.intermediateNodes.some((node: any) => node.id === update.id)
                );
                if (linkNode) {
                    const node = linkNode.intermediateNodes.find((node: any) => node.id === update.id);
                    if (node) {
                        node.x = update.x;
                        node.y = update.y;
                    }
                }
                break;
            }
            default:
                console.warn(`Unknown update type: ${update.type}`);
        }
    });

    // Save the updated JSON back to the document
    updateTextDocument(document, json);
}