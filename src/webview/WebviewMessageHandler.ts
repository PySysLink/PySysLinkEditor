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
                await this.handleUpdateJson(message.json);
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
            case 'heartbeat':
                console.log(`[Heartbeat] [${message.text}] [${new Date().toISOString()}]`);
                return;
            default:
                console.log(`Type of message not recognized: ${message.type}`);
                return;
        }
    }

    private async handleUpdateJson(json: JsonData): Promise<void> {
        const currentJson = this.options.documentManager.getJson();
        currentJson.version = currentJson.version + 1;
        currentJson.blocks = json.blocks;
        currentJson.links = json.links;

        if (json.simulation_configuration !== undefined) {
            currentJson.simulation_configuration = json.simulation_configuration;
        }

        if (json.initialization_python_script_path !== undefined) {
            currentJson.initialization_python_script_path = json.initialization_python_script_path;
        }

        if (json.toolkit_configuration_path !== undefined) {
            currentJson.toolkit_configuration_path = json.toolkit_configuration_path;
        }

        await this.options.documentManager.writeJson(currentJson);
        this.options.onUpdateWebview();
    }
}
