import * as vscode from 'vscode';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { BlockData, BlockRenderInformation, IdType, JsonData } from '../shared/JsonTypes';
import { getBlockData, updateBlockParameters } from '../shared/JsonManager';
import { PythonServerManager } from './PythonServerManager';
import { SimulationManager } from './SimulationManager';
import { getNonce } from '../shared/util';
import * as crypto from 'crypto';

export function hashBlockKey(block: BlockData): string {
	const relevant = {
		blockLibrary: block.blockLibrary,
		blockType: block.blockType,
		label: block.label,
		inputPorts: block.inputPorts,
		outputPorts: block.outputPorts,
		properties: block.properties
	};

	const json = JSON.stringify(relevant);
	return crypto.createHash('sha256').update(json).digest('hex');
}

export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {
	private sessions = new Map<string, PySysLinkBlockEditorSession>();
    private _activeSession: PySysLinkBlockEditorSession | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly blockPropertiesProvider: BlockPropertiesProvider,
        private readonly simulationManager: SimulationManager
    ) {}

	public get activeSession() {
        return this._activeSession;
    }

	public setActiveSession(session: PySysLinkBlockEditorSession | undefined): void {
		this._activeSession = session;
		this.blockPropertiesProvider.setSelectedBlock(undefined);

		if (session) {
			this.simulationManager.setCurrentPslkPath(session.documentUri.fsPath, session.simulationManagerCallback);
			let simPath = session.getSimulationOptionsPath();
			if (simPath) {
				this.simulationManager.setCurrentSimulationOptionsPath(simPath);
			}
			let initPath = session.getInitializationScriptPath();
			if (initPath) {
				this.simulationManager.setCurrentInitializationScriptPath(initPath);
			}
			let toolkitPath = session.getToolkitConfigurationPath();
			if (toolkitPath) {
				this.simulationManager.setCurrentToolkitConfigurationFilePath(toolkitPath);
			}
		}
	}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const session = new PySysLinkBlockEditorSession(
            this.context,
            document,
            webviewPanel,
            this.blockPropertiesProvider,
            this.simulationManager
        );
		this.sessions.set(document.uri.toString(), session);
        this.setActiveSession(session);

        // Listen for when this editor becomes active
        webviewPanel.onDidChangeViewState(e => {
            if (webviewPanel.active) {
                this.setActiveSession(session);
            }
        });

        // Clean up when closed
        webviewPanel.onDidDispose(() => {
            this.sessions.delete(document.uri.toString());
            if (this._activeSession === session) {
                this.setActiveSession(undefined);
            }
        });

		
    }
}

export class PySysLinkBlockEditorSession {
	private documentLock: Promise<void> = Promise.resolve();
	private document: vscode.TextDocument;
	public get documentUri(): vscode.Uri {
		return this.document.uri;
	}
	private webviewPanel: vscode.WebviewPanel;
	private selectedBlockId: IdType | undefined;
	private blockPropertiesProvider: BlockPropertiesProvider;
	private simulationManager: SimulationManager;

	private lastVersion: number = 0;

	private pythonServer: PythonServerManager;
	private context: vscode.ExtensionContext;

	private static readonly viewType = 'pysyslink-editor.modelBlockEditor';

	private requestId = 0;
	private runningSimulationId = 0;

	private renderInfoCache: Map<string, BlockRenderInformation> = new Map();


	constructor(
		context: vscode.ExtensionContext,
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        blockPropertiesProvider: BlockPropertiesProvider,
        simulationManager: SimulationManager
	) { 		
		this.context = context;
		this.document = document;
		this.webviewPanel = webviewPanel;
		this.blockPropertiesProvider = blockPropertiesProvider;
		this.simulationManager = simulationManager;

		this.pythonServer = new PythonServerManager(context);
		const pythonServer = this.pythonServer;
		(async () => {
			await pythonServer.init();
			await pythonServer.startServer();
		})();      


		
		this.pythonServer.addMessageListener((msg) => this.handlePythonMessage(msg));
		this.blockPropertiesProvider.registerOnUpdateCallback(this.updateBlockParameters);
		this.simulationManager.registerCurrentSimulationOptionsFileChangedHandler(this.changeSimulationsOptionsFile);
		this.simulationManager.registerCurrentInitializationScriptFileChangedHandler(this.changeInitializationScriptFile);
		this.simulationManager.registerCurrentToolkitConfigurationFileChangedHandler(this.changeToolkitConfigurationFile);


		this.context.subscriptions.push(
			vscode.window.onDidChangeActiveColorTheme(this.onThemeChange, this)
		);

		this.renderWebview();
	}

	private handlePythonMessage(msg: any) {
		try {
        	if (!this.webviewPanel?.webview) {return;}
		} catch (err: any) {
			if (String(err).includes("Webview is disposed")) {
				return;
			}
			console.error("Unexpected error in Python listener:", err);
		}


		switch (msg.type) {
			case 'print':
				console.log(`[python server]: ${msg.message}`);
				break;
			case 'notification':
				// In our protocol, notifications carry an `event` + `data`
				if (msg.event === 'progress') {
					this.simulationManager.notifySimulationProgress(msg);
				}
				break;
	
			case 'response':
				// A successful RPC response
				this.simulationManager.notifySimulationCompleted(msg);
				break;
	
			case 'error':
				// If you choose to surface errors as their own type
				vscode.window.showErrorMessage(
				`Error on python server: ${msg.error}`
				);
				break;
	
			case 'heartbeat':
				// Optional: handle ping/pong if you want to display connectivity
				console.debug(`[Heartbeat ${msg.subtype}] ${msg.timestamp}`);
				break;
			
			case 'notification':
				// In our protocol, notifications carry an `event` + `data`
				if (msg.event === 'displayValueUpdate') {
					vscode.window.showInformationMessage(`${msg.data.displayId}: ${msg.data.value} at ${msg.data.simulationTime}`);
				}
				break;
	
			default:
				console.warn('Unknown message type from Python:', msg);
		}
	}

	private cancelSimulation() {
		if (!this.pythonServer.isRunning()) {
			vscode.window.showErrorMessage(
				'Simulation server is not running. Please run "Start Simulation Server" first.'
			);
			return;
		}

		const id = ++this.requestId;
		const request = {
			type: 'cancel',
			id: this.runningSimulationId
		};

		// Send it over stdin, newline-terminated
		this.pythonServer.sendRequest(request);
		console.log(`[Extension] Sent cancel for request #${this.runningSimulationId}`, request);
	}

	private async sendSimulationStart(msg: any) {
		if (!this.pythonServer.isRunning()) {
			vscode.window.showErrorMessage(
				'Simulation server is not running. Please run "Start Simulation Server" first.'
			);
			return;
		}

		console.log('[Extension] Sending runSimulation request...');

		const id = ++this.requestId;
		this.runningSimulationId = id;

		const request = {
			type: 'request',
			id: id,
			method: 'runSimulation',
			params: { 
			pslkPath: this.document.uri.fsPath
		}
		};

		this.pythonServer.sendRequest(request);
		console.log(`[Extension] Sent runSimulation request #${id}`, request);
	}
	
	private printJsonDiff(obj1: any, obj2: any, path: string = ''): void {
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
            if (obj1 !== obj2) {
                console.log(`Value mismatch server at ${path}: ${obj1} !== ${obj2}`);
            }
            return;
        }

        const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

        for (const key of keys) {
            const newPath = path ? `${path}.${key}` : key;
            this.printJsonDiff(obj1?.[key], obj2?.[key], newPath);
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
				console.log(`Document changed, updating webview for ${this.document.uri.toString()}`);
				this.updateWebview();
			}
		});

		this.webviewPanel.onDidDispose(() => {
			console.warn('Disposing webview panel and its subscriptions');
			console.warn(">>> Webview DISPOSED at", new Date().toISOString());
    		console.trace();
			changeDocumentSubscription.dispose();
		});

		

		this.webviewPanel.webview.onDidReceiveMessage(async e => {
			switch (e.type) {
				case 'updateJson':
					console.log(`update json called`);
					this.documentLock = this.withDocumentLock(async () => {
						if (this.document) {
							let json = this.getDocumentAsJson(this.document);
							json.version = json.version + 1;
							json.blocks = e.json.blocks;
							json.links = e.json.links;
							json = await this.updateBlockRenderInformation(json);
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
				case 'doubleClickOnBlock':
					if (this.pythonServer.isRunning()) {
						this.displayBlockHTML(e.blockId);
					}
					return;
				case 'heartbeat':
					console.log(`[Heartbeat] [${e.text}] [${new Date().toISOString()}]`);
					return;
				default:
					console.log(`Type of message not recognized: ${e.type}`);
					return;
			}
		});

		console.log('Resolved, update webview');
		this.updateWebview();
		this.postColorTheme(vscode.window.activeColorTheme.kind);
		this.simulationManager.setCurrentPslkPath(this.document.uri.fsPath, this.simulationManagerCallback);
		let simPath = this.getSimulationOptionsPath();
		if (simPath) {
			this.simulationManager.setCurrentSimulationOptionsPath(simPath);
		}
		let initPath = this.getInitializationScriptPath();
		if (initPath) {
			this.simulationManager.setCurrentInitializationScriptPath(initPath);
		}
		let toolkitPath = this.getToolkitConfigurationPath();
		if (toolkitPath) {
			this.simulationManager.setCurrentToolkitConfigurationFilePath(toolkitPath);
		}
	}

	public simulationManagerCallback = (msg: any) => {
		switch (msg.type) {
			case 'runSimulation':
				this.sendSimulationStart(msg);
				break;
			case 'stopSimulation':
				this.cancelSimulation();
				break;
			default:
				console.warn(`Unknown simulation manager message type: ${msg.type}`);
		}
	};


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

	private lastJson: JsonData | undefined;

	private updateWebview = () => {
		if (this.document && this.webviewPanel) {
			const json  = this.getDocumentAsJson(this.document);	
			if (this.lastJson && JSON.stringify(this.lastJson) === JSON.stringify(json)) {
				console.log('No changes detected, skipping webview update.');
				return;
			} else if (this.lastJson) {
				console.log('Changes detected, updating webview.');
				this.printJsonDiff(this.lastJson, json);
			}
			this.lastJson = json; // Store the last JSON for comparison
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
		if (!this.isBlockInDocument(block.id)) {
			console.warn(`Block with id ${block.id} is not in the current document.`);
			return;
		}
		await this.withDocumentLock(async () => {
			if (this.document) {
				let json = this.getDocumentAsJson(this.document);
				json = updateBlockParameters(json, block);
				json = await this.updateBlockRenderInformation(json);
				await this.updateTextDocument(this.document, json);
			}
		});
		this.updateWebview();
	};

	public isBlockInDocument = (blockId: IdType): boolean => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			let result = json.blocks?.some(block => block.id === blockId);
			if (result === undefined) {
				result = false;
			}
			return result;
		}
		return false;
	};

	public async displayBlockHTML(blockId: IdType) {
		let block = this.getDocumentAsJson(this.document).blocks?.find(block => block.id === blockId);
		if (block === undefined) {
			vscode.window.showErrorMessage(`Block with id: ${blockId} not found on document json`);
			return;
		}
		try {
			console.log("Result request block HTML");
			const result = await this.pythonServer.sendRequestAsync({
				method: "getBlockHTML",
				params: { 
					block: block,
					pslkPath: this.document.uri.fsPath 
				}
			}, 10000);

			const panel = vscode.window.createWebviewPanel(
				'pysyslink-plot',
				`Plot for block ${block.label}`,
				vscode.ViewColumn.Active,
				{ enableScripts: true }
			);

			await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
			console.log(result);
			panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    html, body {
      background-color: white !important;
      color: black;
      margin: 0;
      padding: 0;
    }
    /* Ensure plot area (the div with your figure) is white */
    div[id^="fig_el"] {
      background-color: white !important;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/5.16.0/d3.min.js"></script>
  <script src="https://mpld3.github.io/js/mpld3.v0.5.12.js"></script>
</head>
<body>
  ${result.html}
<body>
<html>`;
        } catch (error) {
          console.error(`Error on python server while getting block HTML: ${error}`);
          vscode.window.showErrorMessage(
            `Error on python server while getting block HTML: ${error}`
          );
        }
	}

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
			return { version: this.lastVersion, blocks: [], links: [], simulation_configuration: "", initialization_python_script_path: "", toolkit_configuration_path: "" };
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

	private updateBlockRenderInformation = async (json: JsonData): Promise<JsonData> => {
		if (!this.document) {
			console.log('Document is not available for updating block render information.');
			return json;
		}
		if (this.pythonServer.isRunning()) {
			const blockPromises = (json.blocks ?? []).map(async block => {
				try {
					const renderInfo = await this.getBlockRenderInformation(block, this.document.uri.fsPath);
					if (renderInfo) {
						block.blockRenderInformation = renderInfo;
						block.inputPorts = renderInfo.input_ports;
						block.outputPorts = renderInfo.output_ports;
					}
				} catch (err) {
					console.error(`Error getting block render information for block ${block.id}:`, err);
				}
			});

			// Wait for all block render info to be fetched in parallel
			await Promise.all(blockPromises);
		} else {
			console.warn('Python server is not running, skipping block render information update.');
		}
		return json;
	};

	private updateTextDocument = async (document: vscode.TextDocument, json: JsonData) => {
		console.log('Updating text document with new JSON data...');

		// Replace the entire document
		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2)
		);

		return vscode.workspace.applyEdit(edit);
	};

	private async getBlockRenderInformation(block: BlockData, pslkPath: string): Promise<BlockRenderInformation | undefined> {
		const cacheKey = hashBlockKey(block);
		const cached = this.renderInfoCache.get(cacheKey);
		if (cached) {return cached;}
		
		try {
			console.log("Result request block render information");
			const result = await this.pythonServer.sendRequestAsync({
				method: "getBlockRenderInformation",
				params: { 
					block: block,
					pslkPath: this.document.uri.fsPath 
				}
			}, 10000);

		  	const parsed = JSON.parse(result) as BlockRenderInformation;
			this.renderInfoCache.set(cacheKey, parsed);
			return parsed;

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
            method: "getLibraries",
			params: { 
				pslkPath: this.document.uri.fsPath 
			}
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
	
	public getInitializationScriptPath = (): string | undefined => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			return json.initialization_python_script_path;
		}
		return undefined;
	};
	
	public getToolkitConfigurationPath = (): string | undefined => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			return json.toolkit_configuration_path;
		}
		return undefined;
	};

	public changeSimulationsOptionsFile = (newPath: string): void => {
		if (this.document) {
			
			this.withDocumentLock(async () => {
				const json = this.getDocumentAsJson(this.document);
				json.simulation_configuration = newPath;	
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentSimulationOptionsPath(newPath);
		}
	};
	
	public changeInitializationScriptFile = (newPath: string): void => {
		if (this.document) {
			
			this.withDocumentLock(async () => {
				let json = this.getDocumentAsJson(this.document);
				json.initialization_python_script_path = newPath;
				json = await this.updateBlockRenderInformation(json);	
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentInitializationScriptPath(newPath);
		}
	};
	
	public changeToolkitConfigurationFile = (newPath: string): void => {
		if (this.document) {
			
			this.withDocumentLock(async () => {
				let json = this.getDocumentAsJson(this.document);
				json.toolkit_configuration_path = newPath;	
				json = await this.updateBlockRenderInformation(json);
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentToolkitConfigurationFilePath(newPath);
		}
	};
}