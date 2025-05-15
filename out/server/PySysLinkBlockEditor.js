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
const BlockManager_1 = require("./BlockManager");
const util_1 = require("./util");
const LinkManager_1 = require("./LinkManager");
class PySysLinkBlockEditorProvider {
    context;
    documentLock = Promise.resolve();
    blockPropertiesProvider;
    static register(context, blockPropertiesProvider) {
        const provider = new PySysLinkBlockEditorProvider(context, blockPropertiesProvider);
        const providerRegistration = vscode.window.registerCustomEditorProvider(PySysLinkBlockEditorProvider.viewType, provider);
        console.log('Register start');
        return providerRegistration;
    }
    static viewType = 'pysyslink-editor.modelBlockEditor';
    constructor(context, blockPropertiesProvider) {
        this.context = context;
        this.blockPropertiesProvider = blockPropertiesProvider;
    }
    async resolveCustomTextEditor(document, webviewPanel, _token) {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        console.log('before get html');
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        console.log('after get html');
        const updateWebview = () => {
            const json = this.getDocumentAsJson(document);
            webviewPanel.webview.postMessage({
                type: 'update',
                text: JSON.stringify({
                    blocks: json.blocks || [],
                    links: json.links || []
                }),
            });
        };
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
        webviewPanel.webview.onDidReceiveMessage(async (e) => {
            switch (e.type) {
                case 'edit':
                    (0, BlockManager_1.editBlockLabel)(document, e.id, this.getDocumentAsJson, this.updateTextDocument);
                    return;
                case 'updateStates':
                    this.withDocumentLock(async () => {
                        let json = this.getDocumentAsJson(document);
                        e.updates.forEach((update) => {
                            json = this.handleMessage(json, update);
                        });
                        await this.updateTextDocument(document, json);
                    });
                    return;
                case 'print':
                    console.log(e.text);
                    return;
                case 'blockSelected':
                    this.blockPropertiesProvider.setSelectedBlock(e.block);
                default:
                    this.withDocumentLock(async () => {
                        let json2 = this.getDocumentAsJson(document);
                        this.handleMessage(json2, e);
                        await this.updateTextDocument(document, json2);
                    });
                    return;
            }
        });
        updateWebview();
    }
    handleMessage(json, e) {
        switch (e.type) {
            case 'addBlock':
                return (0, BlockManager_1.addBlock)(json);
            case 'move':
                return (0, BlockManager_1.moveBlock)(e.id, e.x, e.y, json);
            case 'addLink':
                (0, LinkManager_1.addLink)(e.id, e.sourceId, e.sourcePort, e.targetId, e.targetPort, e.sourceX, e.sourceY, e.targetX, e.targetY, e.intermediateNodes, json);
                return;
            case 'moveLinkBatch':
                return (0, LinkManager_1.moveLinkBatch)(e.updates, json);
            case 'moveLinkNode':
                return (0, LinkManager_1.moveLinkBatch)([e], json);
            case 'deleteLink':
                return (0, LinkManager_1.deleteLink)(json, e.id);
            case 'deleteBlock':
                return (0, BlockManager_1.deleteBlock)(json, e.id);
            default:
                console.log(`Type of message not recognized: ${e.type}`);
                return json;
        }
    }
    /**
     * Get the static html used for the editor webviews.
     */
    getHtmlForWebview(webview) {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'blockEditor', 'blockEditor.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'blockEditor', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'blockEditor', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'blockEditor', 'blockEditor.css'));
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
						<div class="canvas"></div>
					</div>
				</div>
			</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
    async withDocumentLock(callback) {
        console.log('Acquiring lock...');
        // Chain the new operation to the existing lock
        const releaseLock = this.documentLock.then(() => callback());
        this.documentLock = releaseLock.then(() => undefined).catch(() => { }); // Prevent lock from breaking on errors
        console.log('Lock released.');
        return releaseLock;
    }
    getDocumentAsJson = (document) => {
        console.log("Get document json");
        const text = document.getText();
        console.log("Text obtained");
        if (text.trim().length === 0) {
            return { blocks: [], links: [] };
        }
        try {
            const json = JSON.parse(text);
            json.blocks = Array.isArray(json.blocks) ? json.blocks : [];
            json.links = Array.isArray(json.links) ? json.links : [];
            return json;
        }
        catch (error) {
            console.error('Error parsing document JSON:', error);
            throw new Error('Could not get document as json. Content is not valid json');
        }
    };
    updateTextDocument = (document, json) => {
        const edit = new vscode.WorkspaceEdit();
        // Just replace the entire document every time for this example extension.
        // A more complete extension should compute minimal edits instead.
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(json, null, 2));
        return vscode.workspace.applyEdit(edit);
    };
}
exports.PySysLinkBlockEditorProvider = PySysLinkBlockEditorProvider;
//# sourceMappingURL=PySysLinkBlockEditor.js.map