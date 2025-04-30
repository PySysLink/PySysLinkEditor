import * as vscode from 'vscode';
import { getNonce } from './util';

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
export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {

	private documentLock: Promise<void> = Promise.resolve();

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new PySysLinkBlockEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(PySysLinkBlockEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private async withDocumentLock<T>(callback: () => Promise<T>): Promise<T> {
		console.log('Acquiring lock...');

		// Chain the new operation to the existing lock
		const releaseLock = this.documentLock.then(() => callback());
		this.documentLock = releaseLock.then(() => undefined).catch(() => {}); // Prevent lock from breaking on errors
		console.log('Lock released.');

		return releaseLock;
	}

	private static readonly viewType = 'pysyslink-editor.modelBlockEditor';


	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		function updateWebview() {
			const json = this.getDocumentAsJson(document);
			webviewPanel.webview.postMessage({
				type: 'update',
				text: JSON.stringify({
					blocks: json.blocks || [],
					links: json.links || []
				}),
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
		webviewPanel.webview.onDidReceiveMessage(async e => {
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
				case 'addLink':
					this.addLink(document, e.sourceId, e.targetId);
					return;
				case 'print':
					console.log(e.text);
					return;
			}
		});

		updateWebview();
	}

    private addBlock(document: vscode.TextDocument) {
        const json = this.getDocumentAsJson(document);
        const blocks = Array.isArray(json.blocks) ? json.blocks : [];
        blocks.push({
            id: getNonce(),
            label: 'New Block',
            x: 50,
            y: 50
        });
        json.blocks = blocks;
        this.updateTextDocument(document, json);
    }

	private addLink(document: vscode.TextDocument, sourceId: string, targetId: string): void {
		this.withDocumentLock(async () => {
			const json = this.getDocumentAsJson(document);
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
			await this.updateTextDocument(document, json);
		});
	}
    
    private moveBlock(document: vscode.TextDocument, id: string, x: number, y: number) {
		this.withDocumentLock(async () => {
			const json = this.getDocumentAsJson(document);
			const block = (json.blocks || []).find((b: any) => b.id === id);
			if (block) {
				block.x = x;
				block.y = y;
				console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);

				await this.updateTextDocument(document, json);
			}
		});
    }

	private moveBlocks(document: vscode.TextDocument, updates: { id: string; x: number; y: number }[]) {
		const json = this.getDocumentAsJson(document);
	
		updates.forEach(update => {
			const block = (json.blocks || []).find((b: any) => b.id === update.id);
			if (block) {
				block.x = update.x;
				block.y = update.y;
				console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
			}
		});
	
		this.updateTextDocument(document, json);
	}

    private async editBlockLabel(doc: vscode.TextDocument, id: string) {
        const json = this.getDocumentAsJson(doc);
        const block = (json.blocks || []).find((b: any) => b.id === id);
        if (!block) { return; }
      
        const newLabel = await vscode.window.showInputBox({
          prompt: 'New label for block',
          value: block.label
        });
      
        if (newLabel === undefined) { return; }  // user cancelled
      
        block.label = newLabel;
        this.updateTextDocument(doc, json);
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


	/**
	 * Try to get a current document as json text.
	 */
	private getDocumentAsJson(document: vscode.TextDocument): any {
		const text = document.getText();
		if (text.trim().length === 0) {
			return { blocks: [], links: [] };
		}
	
		try {
			const json = JSON.parse(text);
			json.blocks = Array.isArray(json.blocks) ? json.blocks : [];
			json.links = Array.isArray(json.links) ? json.links : [];
			return json;
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}

	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2)
		);

		return vscode.workspace.applyEdit(edit);
	}
}