import * as vscode from 'vscode';
import { DocumentManager } from '../document/DocumentManager';
import { PythonServerManager } from '../simulation/PythonServerManager';
import { IdType, JsonData } from '../../shared/JsonTypes';

export interface WebviewMessageHandlerOptions {
    documentManager: DocumentManager;
    pythonServer: PythonServerManager;
    onBlockSelected: (blockId: IdType) => void;
    onUpdateWebview: () => void;
    onLoadBlockLibraries: () => Promise<void> | void;
    onRequestBlockHtml: (blockId: IdType) => Promise<void>;
    onDoubleClickOnSubsystem: (subsystemId: IdType) => Promise<void>;
    goToSubsystem: (subsystemId: IdType) => Promise<void>;
    openSimulationOptionsFileSelector: () => Promise<void>;
    openInitializationScriptFileSelector: () => Promise<void>;
    openToolkitConfigurationFileSelector: () => Promise<void>;
    goToRootSubsystem: () => Promise<void>;
}

export class WebviewMessageHandler {
    constructor(private readonly options: WebviewMessageHandlerOptions) {}

    public attach(webview: vscode.Webview): void {
        webview.onDidReceiveMessage((message) => {
            void this.handleMessage(message);
        });
    }

    public async handleMessage(message: any): Promise<void> {
        if (!message || typeof message.type !== 'string') {
            console.warn('[WebviewMessageHandler] Received invalid message', message);
            return;
        }

        switch (message.type) {
            case 'updateJson':
                console.log('update json called');
                await this.handleUpdateJson(message.json, message.subsystemIds);
                return;
            case 'print':
                console.log(message.text);
                return;
            case 'blockSelected':
                console.log(`Block selected: ${message.blockId}`);
                this.options.onBlockSelected(message.blockId);
                return;
            case 'updateBlockPalette':
                await this.options.onLoadBlockLibraries();
                return;
            case 'doubleClickOnBlock':
                if (this.options.pythonServer.isRunning()) {
                    await this.options.onRequestBlockHtml(message.blockId);
                } else {
                    vscode.window.showWarningMessage('Python server is not running. Cannot display block preview.');
                }
                return;
            case 'doubleClickOnSubsystem':
                await this.options.onDoubleClickOnSubsystem(message.subsystemId);
                return;
            case 'goToSubsystem':
                await this.options.goToSubsystem(message.subsystemId);
                return;
            case 'goToRootSubsystem':
                await this.options.goToRootSubsystem();
                return;
            case 'openSimulationOptionsFileSelector': {
                this.options.openSimulationOptionsFileSelector();
                return;
            }

            case 'openInitializationScriptFileSelector': {
                this.options.openInitializationScriptFileSelector();
                return;
            }

            case 'openToolkitConfigurationFileSelector': {
                this.options.openToolkitConfigurationFileSelector();
                return;
            }
            case 'heartbeat':
                console.log(`[Heartbeat] [${message.text}] [${new Date().toISOString()}]`);
                return;
            default:
                console.log(`Type of message not recognized: ${message.type}`);
                return;
        }
    }

    private async handleUpdateJson(json: JsonData, subsystemIds: IdType[]): Promise<void> {
        const currentJson = this.options.documentManager.getJson(subsystemIds);
        currentJson.blocks = json.blocks;
        currentJson.links = json.links;
        currentJson.subsystems = json.subsystems;

        await this.options.documentManager.writeJson(currentJson, subsystemIds);
        this.options.onUpdateWebview();
    }
}
