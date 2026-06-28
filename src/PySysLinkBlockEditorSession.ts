import * as vscode from 'vscode';
import { BlockData, IdType, JsonData } from '../shared/JsonTypes';
import { getBlockData } from '../shared/JsonManager';
import { PythonServerManager } from './simulation/PythonServerManager';
import { SimulationManager } from './SimulationManager';
import { HtmlBuilder } from './webview/HtmlBuilder';
import { WebviewMessageHandler } from './webview/WebviewMessageHandler';
import { DocumentManager } from './document/DocumentManager';

export class PySysLinkBlockEditorSession {
    private webviewPanel: vscode.WebviewPanel;
    private selectedBlockId: IdType | undefined;
    private simulationManager: SimulationManager;
    private documentManager: DocumentManager;
    private htmlBuilder: HtmlBuilder;
    private messageHandler: WebviewMessageHandler;
    private pythonServer: PythonServerManager;
    private lastJson: JsonData | undefined;
    private context: vscode.ExtensionContext;

    public get documentUri(): vscode.Uri {
        return this.documentManager.documentUri;
    }

    constructor(
        context: vscode.ExtensionContext,
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        simulationManager: SimulationManager,
        pythonServer: PythonServerManager
    ) {
        this.context = context;
        this.webviewPanel = webviewPanel;
        this.simulationManager = simulationManager;
        this.pythonServer = pythonServer;

        this.documentManager = new DocumentManager(document, simulationManager, pythonServer);
        this.htmlBuilder = new HtmlBuilder(context);
        this.messageHandler = new WebviewMessageHandler({
            documentManager: this.documentManager,
            pythonServer: this.pythonServer,
            onBlockSelected: this.handleBlockSelected,
            onUpdateWebview: this.updateWebview,
            onLoadBlockLibraries: this.loadBlockLibraries,
            onRequestBlockHtml: this.displayBlockHTML
        });

        this.simulationManager.registerCurrentSimulationOptionsFileChangedHandler(async (newPath) => {
            await this.documentManager.changeSimulationsOptionsFile(newPath);
        });
        this.simulationManager.registerCurrentInitializationScriptFileChangedHandler(async (newPath) => {
            await this.documentManager.changeInitializationScriptFile(newPath);
        });
        this.simulationManager.registerCurrentToolkitConfigurationFileChangedHandler(async (newPath) => {
            await this.documentManager.changeToolkitConfigurationFile(newPath);
        });

        this.context.subscriptions.push(
            vscode.window.onDidChangeActiveColorTheme(this.onThemeChange, this)
        );

        this.renderWebview();
    }

    public renderWebview(): void {
        this.webviewPanel.webview.options = {
            enableScripts: true,
        };

        this.webviewPanel.webview.html = this.htmlBuilder.getHtmlForWebview(this.webviewPanel.webview);

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === this.documentManager.documentUri.toString()) {
                console.log(`Document changed, updating webview for ${this.documentManager.documentUri.toString()}`);
                this.updateWebview();
            }
        });

        this.webviewPanel.onDidDispose(() => {
            console.warn('Disposing webview panel and its subscriptions');
            changeDocumentSubscription.dispose();
        });

        this.messageHandler.attach(this.webviewPanel.webview);

        this.updateWebview();
        this.postColorTheme(vscode.window.activeColorTheme.kind);
        this.simulationManager.setCurrentPslkPath(this.documentManager.documentUri.fsPath, this.simulationManagerCallback);

        const simPath = this.getSimulationOptionsPath();
        if (simPath) {
            this.simulationManager.setCurrentSimulationOptionsPath(simPath);
        }

        const initPath = this.getInitializationScriptPath();
        if (initPath) {
            this.simulationManager.setCurrentInitializationScriptPath(initPath);
        }

        const toolkitPath = this.getToolkitConfigurationPath();
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
        let themeKind = 'unknown';
        if (theme === vscode.ColorThemeKind.Light) {
            themeKind = 'light';
        } else if (theme === vscode.ColorThemeKind.Dark) {
            themeKind = 'dark';
        } else {
            themeKind = 'highContrast';
        }

        this.webviewPanel.webview.postMessage({
            type: 'colorThemeKindChanged',
            kind: themeKind,
        });
    }

    private handleBlockSelected = (blockId: IdType): void => {
        this.selectedBlockId = blockId;
    };

    private updateBlockParameters = async (block: BlockData): Promise<void> => {
        await this.documentManager.updateBlockParameters(block);
        this.updateWebview();
    };

    private loadBlockLibraries = async (): Promise<void> => {        
        if (!this.pythonServer.isRunning()) {
            console.warn('Python server is not running, skipping block library load.');
            return;
        }

        if (!this.webviewPanel?.webview) {
            console.warn('Webview not available, skipping block library load.');
            return;
        }

        try {
            const result = await this.pythonServer.sendRequestAsync({
                method: 'getLibraries',
                params: {
                    pslkPath: this.documentManager.documentUri.fsPath
                }
            }, 10000);

            const libraries = typeof result === 'string' ? JSON.parse(result) : result;
            this.webviewPanel.webview.postMessage({
                type: 'setBlockLibraries',
                model: libraries
            });
        } catch (error: any) {
            console.error('Error loading block libraries:', error);
            vscode.window.showErrorMessage(`Could not load block libraries: ${error}`);
        }
    };

    public displayBlockHTML = async (blockId: IdType): Promise<void> => {
        const json = this.documentManager.getJson();
        const block = getBlockData(json, blockId);
        if (!block) {
            vscode.window.showErrorMessage(`Block with id: ${blockId} not found on document json`);
            return;
        }

        try {
            const result = await this.pythonServer.sendRequestAsync({
                method: 'getBlockHTML',
                params: {
                    block,
                    pslkPath: this.documentManager.documentUri.fsPath
                }
            }, 10000);

            const panel = vscode.window.createWebviewPanel(
                'pysyslink-plot',
                `Plot for block ${block.label}`,
                vscode.ViewColumn.Active,
                { enableScripts: true }
            );

            await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
            await vscode.commands.executeCommand('workbench.action.toggleCompactAuxiliaryWindow');

            const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'blockPropertiesEditor', 'blockPropertiesEditor.js'));
            const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'blockPropertiesEditor', 'blockPropertiesEditor.css'));

            panel.webview.html = `<!DOCTYPE html>
<html>
<head>
<link rel="stylesheet" href="${cssUri}">
<style>
    html, body {
        background-color: var(--vscode-editor-background) !important;
        color: black;
        margin: 0;
        padding: 0;
    }
    div[id^=\"fig_el\"] {
        background-color: white !important;
    }
    .pysyslink-container {
        display: flex;
        flex-direction: column;
    }
    .plot-area {
        flex: 0 0 auto;
        overflow: auto;
        padding: 8px;
        background-color: white;
    }
    .props-area {
        border-top: 1px solid #ddd;
        padding: 8px;
        background: var(--vscode-editor-background);
    }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/5.16.0/d3.min.js"></script>
<script src="https://mpld3.github.io/js/mpld3.v0.5.12.js"></script>
</head>
<body>
<div class="pysyslink-container">
  <div class="plot-area">
    ${result.html}
  </div>
  <div class="props-area">
    <div id="app">Loading block editor...</div>
  </div>
</div>
<script src="${scriptUri}"></script>
</body>
</html>`;

            // Wire messages from the webview
            const disposables: vscode.Disposable[] = [];
            const msgHandler = panel.webview.onDidReceiveMessage(async (msg: any) => {
                switch (msg.type) {
                    case 'ready':
                        // Webview ready - send selected block data
                        panel.webview.postMessage({ type: 'updateBlock', block });
                        break;
                    case 'update':
                        try {
                            await this.documentManager.updateBlockParameters(msg.block);
                            this.updateWebview();
                            if (msg.action === 'applyAndClose') {
                                panel.dispose();
                            }
                        } catch (e: any) {
                            console.error('Error applying block update from popup:', e);
                            vscode.window.showErrorMessage(`Could not apply block changes: ${e}`);
                        }
                        break;
                    case 'cancel':
                        panel.dispose();
                        break;
                    default:
                        console.warn('Unknown message from popup webview:', msg);
                }
            });

            disposables.push(msgHandler);

            panel.onDidDispose(() => {
                disposables.forEach(d => d.dispose());
            });
        } catch (error: any) {
            console.error(`Error on python server while getting block HTML: ${error}`);
            vscode.window.showErrorMessage(`Error on python server while getting block HTML: ${error}`);
        }
    };

    private updateWebview = (): void => {
        const json = this.documentManager.getJson();
        if (this.lastJson && JSON.stringify(this.lastJson) === JSON.stringify(json)) {
            console.log('No changes detected, skipping webview update.');
            return;
        }

        if (this.lastJson) {
            console.log('Changes detected, updating webview.');
        }

        this.lastJson = json;
        this.webviewPanel.webview.postMessage({
            type: 'update',
            json: json,
        });
    };

    public getSimulationOptionsPath(): string | undefined {
        return this.documentManager.getSimulationOptionsPath();
    }

    public getInitializationScriptPath(): string | undefined {
        return this.documentManager.getInitializationScriptPath();
    }

    public getToolkitConfigurationPath(): string | undefined {
        return this.documentManager.getToolkitConfigurationPath();
    }

    private async sendSimulationStart(msg: any): Promise<void> {
        if (!this.pythonServer.isRunning()) {
            vscode.window.showErrorMessage('Simulation server is not running. Please start the Python server first.');
            return;
        }

        const request = {
            type: 'request',
            method: 'runSimulation',
            params: {
                pslkPath: this.documentManager.documentUri.fsPath
            }
        };

        await this.pythonServer.sendRequestAsync(request, 10000);
    }

    private async cancelSimulation(): Promise<void> {
        if (!this.pythonServer.isRunning()) {
            vscode.window.showErrorMessage('Simulation server is not running.');
            return;
        }

        await this.pythonServer.sendRequestAsync({ type: 'request', method: 'cancelSimulation', params: {} }, 10000);
    }
}
