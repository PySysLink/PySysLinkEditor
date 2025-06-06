import * as vscode from 'vscode';
import { getNonce } from './util';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { BlockData, IdType, JsonData } from '../shared/JsonTypes';
import { getBlockData, updateBlockParameters, updateLinksNodesPosition } from '../shared/JsonManager';
import { PythonServerManager } from './PythonServerManager';

export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {
	private documentLock: Promise<void> = Promise.resolve();
	private document: vscode.TextDocument | undefined;
	private webviewPanel: vscode.WebviewPanel | undefined;
	private selectedBlockId: IdType | undefined;
	private blockPropertiesProvider: BlockPropertiesProvider;

	private lastVersion: number = 0;

	private pythonServer: PythonServerManager;

	public static register(
		context: vscode.ExtensionContext,
		blockPropertiesProvider: BlockPropertiesProvider,
		pythonServer: PythonServerManager,
	): { disposable: vscode.Disposable; provider: PySysLinkBlockEditorProvider } {
		const provider = new PySysLinkBlockEditorProvider(context, blockPropertiesProvider, pythonServer);
		const disposable = vscode.window.registerCustomEditorProvider(PySysLinkBlockEditorProvider.viewType, provider);
	
		console.log('Register start');
	
		return { disposable, provider };
	}

	private static readonly viewType = 'pysyslink-editor.modelBlockEditor';


	constructor(
		private readonly context: vscode.ExtensionContext,
		blockPropertiesProvider: BlockPropertiesProvider,
		pythonServer: PythonServerManager
	) { 		
		this.blockPropertiesProvider = blockPropertiesProvider;
		this.pythonServer = pythonServer;

		this.context.subscriptions.push(
			vscode.window.onDidChangeActiveColorTheme(this.onThemeChange, this)
		);
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
		this.webviewPanel = webviewPanel;


		


		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				this.notifySelectedBlock();
				this.updateWebview();
			}
		});

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		

		webviewPanel.webview.onDidReceiveMessage(async e => {
			switch (e.type) {
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
					this.selectedBlockId = e.blockId;
					this.notifySelectedBlock();
					return;
				case 'updateBlockPalette':
					this.loadBlockLibraries();
					return;
				default:
					console.log(`Type of message not recognized: ${e.type}`);
					return;
			}
		});

		console.log('Resolved, update webview');
		this.updateWebview();
		this.postColorTheme(vscode.window.activeColorTheme.kind);
	}


	private onThemeChange(e: vscode.ColorTheme) {
		this.postColorTheme(e.kind);
	}

	private postColorTheme(theme: vscode.ColorThemeKind) {
		let themeKind = "unknown";
		if (theme === vscode.ColorThemeKind.Light) {
			themeKind = "light";
		} else if (theme === vscode.ColorThemeKind.Dark) {
			themeKind = "dark";
		} else {
			themeKind = "highContrast";
		}
		if (this.webviewPanel) {
			this.webviewPanel.webview.postMessage({
				type: 'colorThemeKindChanged',
				kind: themeKind,
			});
		}
	}


	private async notifySelectedBlock() {
		if (this.document && this.selectedBlockId) {
        	const json = this.getDocumentAsJson(this.document);
        	const blockData = getBlockData(json, this.selectedBlockId);
			if (blockData) {
				this.blockPropertiesProvider.setSelectedBlock(blockData);
			}
		}
	}

	private updateWebview = () => {
		if (this.document && this.webviewPanel) {
			const json  = this.getDocumentAsJson(this.document);	
			this.webviewPanel.webview.postMessage({
				type: 'update',
				json: json,
			});
		}	
	};

    

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		(async () => {
			try {
			await this.pythonServer.waitForServer(20000);
			await this.loadBlockLibraries();
			} catch (err) {
			console.error('[BlockPalette] Could not load block libraries:', err);
			vscode.window.showErrorMessage('Could not connect to simulation server in time.');
			}
		})();

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
	  	
		const elementsBundled = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 
								'node_modules', 
								'@vscode-elements', 
								'elements', 
								'dist', 
								'bundled.js'));

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

				<script
					nonce="${nonce}"
					src="${elementsBundled}"
					type="module"
				></script>
			</head>
			<body>
			<div class="main">
				<div class="top-controls"></div>
				<div class="editor-layout">
					<div class="canvas-container">
						<div class="zoom-container">
							<div class="canvas"></div>
						</div>
					</div>
					<div class="block-palette-sidebar" id="block-palette-sidebar">
						<div id="block-palette-content"></div>
					</div>
				</div>
			</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	public updateBlockParameters = async (block: BlockData): Promise<void> => {
		let block_render_info = await this.getBlockRenderInformation(block);
		block.inputPorts = block_render_info.input_ports;
		block.outputPorts = block_render_info.output_ports;
		this.withDocumentLock(async () => {
			if (this.document) {
				let json = this.getDocumentAsJson(this.document);
				json = updateBlockParameters(json, block);
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

	private updateTextDocument = async (document: vscode.TextDocument, json: any) => {
		// Get the current JSON from the document
		const currentJson = this.getDocumentAsJson(document);

		// Find new blocks (by id)
		const currentBlockIds = new Set((currentJson.blocks ?? []).map(b => b.id));
		const newBlocks: BlockData[] = (json.blocks ?? []).filter((b: BlockData) => !currentBlockIds.has(b.id));

		// For each new block, get and set port amounts
		for (const block of newBlocks) {
			try {
				const blockRenderInfo = await this.getBlockRenderInformation(block);
				if (blockRenderInfo) {
					block.inputPorts = blockRenderInfo.input_ports;
					block.outputPorts = blockRenderInfo.output_ports;
				}
			} catch (err) {
				console.error(`Failed to get render info for block ${block.id}:`, err);
			}
		}

		// Update links node positions as before
		json = updateLinksNodesPosition(json);

		// Replace the entire document
		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2)
		);

		return vscode.workspace.applyEdit(edit);
	};

	private async getBlockRenderInformation(block: BlockData): Promise<any> {
		try {
		console.log("Result requested block libraries");
          const result = await this.pythonServer.sendRequestAsync({
            method: "getBlockRenderInformation",
			params: { block }
          }, 10000);

		  return JSON.parse(result);
        } catch (error) {
          console.error(`Error on python server while getting block render information: ${error}`);
          vscode.window.showErrorMessage(
            `Error on python server while getting block render information: ${error}`
          );
        } 
	}

	private async loadBlockLibraries() {
        try {
		console.log("Result requested block libraries");
          const result = await this.pythonServer.sendRequestAsync({
            method: "getLibraries"
          }, 10000);

		  console.log(`Result obtained block libraries: ${result}`);
          
          console.log(`Available libraries: ${JSON.parse(result)}`);
          if (this.webviewPanel?.webview) {
            this.webviewPanel?.webview.postMessage({
              type: 'setBlockLibraries',
              model: JSON.parse(result)
            });
          }
        } catch (error) {
          if (this.webviewPanel?.webview) {
            this.webviewPanel?.webview.postMessage({
              type: 'error',
              error: error
            });
          }
          console.error(`Error on python server while getting block libraries: ${error}`);
          vscode.window.showErrorMessage(
            `Error on python server while getting block libraries: ${error}`
          );
        }      
    }

}