import * as vscode from 'vscode';
import { addBlock, deleteBlock, moveBlock, editBlockLabel } from './BlockManager';
import { getNonce } from './util';
import { addLink, moveLinkBatch, deleteLink } from './LinkManager';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';

export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {
	private documentLock: Promise<void> = Promise.resolve();
	private blockPropertiesProvider: BlockPropertiesProvider;

	public static register(context: vscode.ExtensionContext, blockPropertiesProvider: BlockPropertiesProvider): vscode.Disposable {
		const provider = new PySysLinkBlockEditorProvider(context, blockPropertiesProvider);
		const providerRegistration = vscode.window.registerCustomEditorProvider(PySysLinkBlockEditorProvider.viewType, provider);

		console.log('Register start');

		return providerRegistration;
	}

	private static readonly viewType = 'pysyslink-editor.modelBlockEditor';


	constructor(
		private readonly context: vscode.ExtensionContext,
		blockPropertiesProvider: BlockPropertiesProvider
	) { 		
		this.blockPropertiesProvider = blockPropertiesProvider;
	}
	
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		console.log('before get html');
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
		console.log('after get html');


		const updateWebview = () => {
			const json  = this.getDocumentAsJson(document);	
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

		

		webviewPanel.webview.onDidReceiveMessage(async e => {
			switch (e.type) {
				case 'edit':
					editBlockLabel(document, e.id, this.getDocumentAsJson, this.updateTextDocument);
					return;
				case 'updateStates':
					this.withDocumentLock(async () => {
						let json = this.getDocumentAsJson(document);
						e.updates.forEach((update: any) => {
							json = this.handleMessage(json, update);
						});
						await this.updateTextDocument(document, json);
					});
					return;
				case 'print':
					console.log(e.text);
					return;
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

	private handleMessage(json: any, e: any) : any {
		switch (e.type) {
			case 'addBlock':
				return addBlock(json);
			case 'move':
				return moveBlock(e.id, e.x, e.y, json);
			case 'addLink':
				addLink(e.id, e.sourceId, e.sourcePort, e.targetId, e.targetPort, e.sourceX, e.sourceY, e.targetX, e.targetY, e.intermediateNodes, json);
				return;
			case 'moveLinkBatch':
				return moveLinkBatch(e.updates, json);
			case 'moveLinkNode':
				return moveLinkBatch([e], json);
			case 'deleteLink':
				return deleteLink(json, e.id);
			case 'deleteBlock':
				return deleteBlock(json, e.id);
			default:
				console.log(`Type of message not recognized: ${e.type}`);
				return json;
		}
	}
    

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'out', 'client', 'blockEditor.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'blockEditor.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
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

	private async withDocumentLock<T>(callback: () => Promise<T>): Promise<T> {
		console.log('Acquiring lock...');

		// Chain the new operation to the existing lock
		const releaseLock = this.documentLock.then(() => callback());
		this.documentLock = releaseLock.then(() => undefined).catch(() => {}); // Prevent lock from breaking on errors
		console.log('Lock released.');

		return releaseLock;
	}

	private getDocumentAsJson = (document: vscode.TextDocument): any => {
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
		} catch (error) {
			console.error('Error parsing document JSON:', error);
			throw new Error('Could not get document as json. Content is not valid json');
		}
	};

	private updateTextDocument = (document: vscode.TextDocument, json: any) => {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2)
		);

		return vscode.workspace.applyEdit(edit);
	};

}