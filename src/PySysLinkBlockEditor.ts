import * as vscode from 'vscode';
import { getNonce } from './util';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { BlockData, IdType, JsonData } from '../shared/JsonTypes';
import { getBlockData, updateBlockParameters, updateLinksNodesPosition } from '../shared/JsonManager';
import { PythonServerManager } from './PythonServerManager';
import { SimulationManager } from './SimulationManager';

export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly blockPropertiesProvider: BlockPropertiesProvider,
        private readonly simulationManager: SimulationManager,
        private readonly pythonServer: PythonServerManager
    ) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        new PySysLinkBlockEditorSession(
            this.context,
            document,
            webviewPanel,
            this.blockPropertiesProvider,
            this.simulationManager,
            this.pythonServer
        );
    }
}

export class PySysLinkBlockEditorSession {
	private documentLock: Promise<void> = Promise.resolve();
	private document: vscode.TextDocument;
	private webviewPanel: vscode.WebviewPanel;
	private selectedBlockId: IdType | undefined;
	private blockPropertiesProvider: BlockPropertiesProvider;
	private simulationManager: SimulationManager;

	private lastVersion: number = 0;

	private pythonServer: PythonServerManager;
	private context: vscode.ExtensionContext;

	private static readonly viewType = 'pysyslink-editor.modelBlockEditor';


	constructor(
		context: vscode.ExtensionContext,
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        blockPropertiesProvider: BlockPropertiesProvider,
        simulationManager: SimulationManager,
        pythonServer: PythonServerManager
	) { 		
		this.context = context;
		this.document = document;
		this.webviewPanel = webviewPanel;
		this.blockPropertiesProvider = blockPropertiesProvider;
		this.simulationManager = simulationManager;
		this.pythonServer = pythonServer;

		
		this.pythonServer.addMessageListener((msg) => this.handlePythonMessage(msg));
		this.blockPropertiesProvider.registerOnUpdateCallback(this.updateBlockParameters);
		this.simulationManager.registerCurrentSimulationOptionsFileChangedHandler(this.changeSimulationsOptionsFile);


		this.context.subscriptions.push(
			vscode.window.onDidChangeActiveColorTheme(this.onThemeChange, this)
		);

		this.renderWebview();
	}

	private handlePythonMessage(msg: any) {
		if (!this.webviewPanel?.webview) {
			return;
		}

		switch (msg.type) {
		case 'notification':
			// In our protocol, notifications carry an `event` + `data`
			if (msg.event === 'displayValueUpdate') {
				vscode.window.showInformationMessage(`${msg.data.displayId}: ${msg.data.value} at ${msg.data.simulationTime}`);
			}
			break;
		default:
			break;		
		}
	}
	
	public renderWebview(
	): void {
		// Setup initial content for the webview
		this.webviewPanel.webview.options = {
			enableScripts: true,
		};
		console.log('before get html');
		this.webviewPanel.webview.html = this.getHtmlForWebview(this.webviewPanel.webview);
		console.log('after get html');


		


		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === this.document.uri.toString()) {
				this.notifySelectedBlock();
				this.updateWebview();
			}
		});

		this.webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		

		this.webviewPanel.webview.onDidReceiveMessage(async e => {
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
		this.simulationManager.setCurrentPslkPath(this.document.uri.fsPath);
		let simPath = this.getSimulationOptionsPath();
		if (simPath) {
			this.simulationManager.setCurrentSimulationOptionsPath(simPath);
		}
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
			return { version: this.lastVersion, blocks: [], links: [], simulation_configuration: "" };
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

	public getSimulationOptionsPath = (): string | undefined => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			return json.simulation_configuration;
		}
		return undefined;
	};

	public changeSimulationsOptionsFile = (newPath: string): void => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			json.simulation_configuration = newPath;
			this.withDocumentLock(async () => {
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentSimulationOptionsPath(newPath);
		}
	};
}