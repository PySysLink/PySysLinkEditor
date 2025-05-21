import * as vscode from 'vscode';
import { addBlock, deleteBlock, moveBlock, editBlockLabel, getBlockData, updateBlockProperties } from './BlockManager';
import { getNonce } from './util';
import { addLink, moveLinkBatch, deleteLink } from './LinkManager';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { JsonData } from '../shared/JsonTypes';

export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {
	private documentLock: Promise<void> = Promise.resolve();
	private document: vscode.TextDocument | undefined;
	private blockPropertiesProvider: BlockPropertiesProvider;

	private lastVersion: number = 0;

	public static register(
		context: vscode.ExtensionContext,
		blockPropertiesProvider: BlockPropertiesProvider
	): { disposable: vscode.Disposable; provider: PySysLinkBlockEditorProvider } {
		const provider = new PySysLinkBlockEditorProvider(context, blockPropertiesProvider);
		const disposable = vscode.window.registerCustomEditorProvider(PySysLinkBlockEditorProvider.viewType, provider);
	
		console.log('Register start');
	
		return { disposable, provider };
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
		this.document = document;


		const updateWebview = () => {
			const json  = this.getDocumentAsJson(document);	
			webviewPanel.webview.postMessage({
				type: 'update',
				json: json,
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
				case 'updateJson':
					this.documentLock = this.withDocumentLock(async () => {
						if (this.document) {
							const json = this.getDocumentAsJson(this.document);
							json.version = json.version + 1;
							json.blocks = e.json.blocks;
							json.links = e.json.links;
							await this.updateTextDocument(this.document, json);
						}
					});
					return;
				case 'print':
					console.log(e.text);
					return;
				case 'blockSelected':
					console.log(`Block selected: ${e.blockId}`);
					this.blockPropertiesProvider.setSelectedBlock(await getBlockData(document, e.blockId, this.getDocumentAsJson));
					return;
				default:
					console.log(`Type of message not recognized: ${e.type}`);
					return;
			}
		});

		console.log('Resolved, update webview');
		updateWebview();
	}

    

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'out', 'blockEditor', 'blockEditor.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'blockEditor', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'blockEditor', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'blockEditor', 'blockEditor.css'));

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

	public updateBlockParameters = (props: Record<string, any>): void => {
		const blockId = this.blockPropertiesProvider.selectedBlockId;
		this.withDocumentLock(async () => {
			if (this.document && blockId) {
				let json = this.getDocumentAsJson(this.document);
				json = await updateBlockProperties(json, blockId, props);
				await this.updateTextDocument(this.document, json);
			}
		});
	};

	private async withDocumentLock<T>(callback: () => Promise<T>): Promise<T> {
		console.log('Acquiring lock...');

		// Chain the new operation to the existing lock
		const releaseLock = this.documentLock.then(() => callback());
		this.documentLock = releaseLock.then(() => undefined).catch(() => {}); // Prevent lock from breaking on errors
		console.log('Lock released.');

		return releaseLock;
	}

	private getDocumentAsJson = (document: vscode.TextDocument): JsonData => {
		const text = document.getText();
		if (text.trim().length === 0) {
			this.lastVersion += 1;
			return { version: this.lastVersion, blocks: [], links: [] };
		}
	
		try {
			const json = JSON.parse(text);
			this.lastVersion += 1;
			json.version = this.lastVersion;
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