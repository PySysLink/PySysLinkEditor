"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PySysLinkBlockEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
const util_1 = require("./util");
/**
 * Provider for cat scratch editors.
 *
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 *
 * This provider demonstrates:
 *
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
class PySysLinkBlockEditorProvider {
    context;
    documentLock = Promise.resolve();
    static register(context) {
        const provider = new PySysLinkBlockEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(PySysLinkBlockEditorProvider.viewType, provider);
        return providerRegistration;
    }
    async withDocumentLock(callback) {
        console.log('Acquiring lock...');
        // Chain the new operation to the existing lock
        const releaseLock = this.documentLock.then(() => callback());
        this.documentLock = releaseLock.then(() => undefined).catch(() => { }); // Prevent lock from breaking on errors
        console.log('Lock released.');
        return releaseLock;
    }
    static viewType = 'pysyslink-editor.modelBlockEditor';
    constructor(context) {
        this.context = context;
    }
    /**
     * Called when our custom editor is opened.
     *
     *
     */
    async resolveCustomTextEditor(document, webviewPanel, _token) {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        }
        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        // 
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(async (e) => {
            switch (e.type) {
                case 'add':
                    this.addBlock(document);
                    return;
                case 'move':
                    this.moveBlock(document, e.id, e.x, e.y);
                    return;
                case 'moveBatch':
                    this.moveBlocks(document, e.updates);
                    return;
                case 'edit':
                    await this.editBlockLabel(document, e.id);
                    return;
                case 'print':
                    console.log(e.text);
                    return;
            }
        });
        updateWebview();
    }
    addBlock(document) {
        const json = this.getDocumentAsJson(document);
        const blocks = Array.isArray(json.blocks) ? json.blocks : [];
        blocks.push({
            id: (0, util_1.getNonce)(),
            label: 'New Block',
            x: 50,
            y: 50
        });
        json.blocks = blocks;
        this.updateTextDocument(document, json);
    }
    moveBlock(document, id, x, y) {
        this.withDocumentLock(async () => {
            const json = this.getDocumentAsJson(document);
            const block = (json.blocks || []).find((b) => b.id === id);
            if (block) {
                block.x = x;
                block.y = y;
                console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
                await this.updateTextDocument(document, json);
            }
        });
    }
    moveBlocks(document, updates) {
        const json = this.getDocumentAsJson(document);
        updates.forEach(update => {
            const block = (json.blocks || []).find((b) => b.id === update.id);
            if (block) {
                block.x = update.x;
                block.y = update.y;
                console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
            }
        });
        this.updateTextDocument(document, json);
    }
    async editBlockLabel(doc, id) {
        const json = this.getDocumentAsJson(doc);
        const block = (json.blocks || []).find((b) => b.id === id);
        if (!block) {
            return;
        }
        const newLabel = await vscode.window.showInputBox({
            prompt: 'New label for block',
            value: block.label
        });
        if (newLabel === undefined) {
            return;
        } // user cancelled
        block.label = newLabel;
        this.updateTextDocument(doc, json);
    }
    /**
     * Get the static html used for the editor webviews.
     */
    getHtmlForWebview(webview) {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'client', 'blockEditor.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'blockEditor.css'));
        // Use a nonce to whitelist which scripts can be run
        const nonce = (0, util_1.getNonce)();
        return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>PySysLink</title>
			</head>
			<body>
			<div class="main">
				<div class="top-controls">
				</div>
				<div class="canvas-container">
					<div class="zoom-container">
						<div class="canvas">
						<svg class="links"></svg>

						</div>
					</div>
				</div>
			</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
    /**
     * Try to get a current document as json text.
     */
    getDocumentAsJson(document) {
        const text = document.getText();
        if (text.trim().length === 0) {
            return {};
        }
        try {
            return JSON.parse(text);
        }
        catch {
            throw new Error('Could not get document as json. Content is not valid json');
        }
    }
    /**
     * Write out the json to a given document.
     */
    updateTextDocument(document, json) {
        const edit = new vscode.WorkspaceEdit();
        // Just replace the entire document every time for this example extension.
        // A more complete extension should compute minimal edits instead.
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(json, null, 2));
        return vscode.workspace.applyEdit(edit);
    }
}
exports.PySysLinkBlockEditorProvider = PySysLinkBlockEditorProvider;
//# sourceMappingURL=PySysLinkBlockEditor.js.map