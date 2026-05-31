import * as vscode from 'vscode';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { BlockData, BlockRenderInformation, IdType, JsonData } from '../shared/JsonTypes';
import { getBlockData, updateBlockParameters } from '../shared/JsonManager';
import { PythonServerManager } from './simulation/PythonServerManager';
import { SimulationManager } from './SimulationManager';
import { getNonce } from '../shared/util';
import * as crypto from 'crypto';


export class PySysLinkBlockEditorSession {
	
	private webviewPanel: vscode.WebviewPanel;
	private selectedBlockId: IdType | undefined;
	private blockPropertiesProvider: BlockPropertiesProvider;
	private simulationManager: SimulationManager;


	private context: vscode.ExtensionContext;

	private static readonly viewType = 'pysyslink-editor.modelBlockEditor';


	private renderInfoCache: Map<string, BlockRenderInformation> = new Map();


	constructor(
		context: vscode.ExtensionContext,
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        blockPropertiesProvider: BlockPropertiesProvider,
        simulationManager: SimulationManager
	) { 		
		this.context = context;
		this.webviewPanel = webviewPanel;
		this.blockPropertiesProvider = blockPropertiesProvider;
		this.simulationManager = simulationManager;

		
		this.blockPropertiesProvider.registerOnUpdateCallback(this.updateBlockParameters);
		this.simulationManager.registerCurrentSimulationOptionsFileChangedHandler(this.changeSimulationsOptionsFile);
		this.simulationManager.registerCurrentInitializationScriptFileChangedHandler(this.changeInitializationScriptFile);
		this.simulationManager.registerCurrentToolkitConfigurationFileChangedHandler(this.changeToolkitConfigurationFile);


		this.context.subscriptions.push(
			vscode.window.onDidChangeActiveColorTheme(this.onThemeChange, this)
		);

		this.renderWebview();
	}

	
	
	

	public renderWebview(): void {
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

		

		this.webviewPanel.webview.onDidReceiveMessage(); // Webview Message Handler

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
						block.inputPortTypes = renderInfo.input_port_types;
						block.outputPortTypes = renderInfo.output_port_types;
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

	

    private hashBlockKey(block: BlockData): string {
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
}