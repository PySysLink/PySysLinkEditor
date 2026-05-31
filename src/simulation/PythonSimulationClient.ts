import * as vscode from 'vscode';
import { BlockData, BlockRenderInformation } from '../../shared/JsonTypes';
import { PythonServerManager } from './PythonServerManager';

export class PythonSimulationClient {
    private context: vscode.ExtensionContext;
    private pythonServer: PythonServerManager;
    private webviewPanel?: vscode.WebviewPanel;
    private simulationManager?: {
        notifySimulationCompleted: (msg: any) => void;
        notifySimulationProgress: (msg: any) => void;
    };
    private document?: vscode.TextDocument;
    private renderInfoCache: Map<string, BlockRenderInformation> = new Map();
    private requestId = 0;
    private runningSimulationId = 0;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.pythonServer = new PythonServerManager(context);

        const pythonServer = this.pythonServer;
        (async () => {
            await pythonServer.init();
            await pythonServer.startServer();
        })();

        this.pythonServer.addMessageListener((msg) => this.handlePythonMessage(msg));
    }

    private handlePythonMessage(msg: any) {
        try {
            if (!this.webviewPanel?.webview) {
                return;
            }
        } catch (err: any) {
            if (String(err).includes('Webview is disposed')) {
                return;
            }
            console.error('Unexpected error in Python listener:', err);
        }

        switch (msg.type) {
            case 'print':
                console.log(`[python server]: ${msg.message}`);
                break;
            case 'notification':
                if (msg.event === 'progress') {
                    this.simulationManager?.notifySimulationProgress(msg);
                }
                if (msg.event === 'displayValueUpdate') {
                    vscode.window.showInformationMessage(`${msg.data.displayId}: ${msg.data.value} at ${msg.data.simulationTime}`);
                }
                break;
            case 'response':
                this.simulationManager?.notifySimulationCompleted(msg);
                break;
            case 'error':
                vscode.window.showErrorMessage(`Error on python server: ${msg.error}`);
                break;
            case 'heartbeat':
                console.debug(`[Heartbeat ${msg.subtype}] ${msg.timestamp}`);
                break;
            default:
                console.warn('Unknown message type from Python:', msg);
        }
    }

    private cancelSimulation() {
        if (!this.pythonServer.isRunning()) {
            vscode.window.showErrorMessage('Simulation server is not running. Please run "Start Simulation Server" first.');
            return;
        }

        const id = ++this.requestId;
        const request = {
            type: 'cancel',
            id: this.runningSimulationId
        };

        this.pythonServer.sendRequest(request);
        console.log(`[Extension] Sent cancel for request #${this.runningSimulationId}`, request);
    }

    private async sendSimulationStart(msg: any) {
        if (!this.pythonServer.isRunning()) {
            vscode.window.showErrorMessage('Simulation server is not running. Please run "Start Simulation Server" first.');
            return;
        }

        console.log('[Extension] Sending runSimulation request...');

        const id = ++this.requestId;
        this.runningSimulationId = id;
        const request = {
            type: 'request',
            id,
            method: 'runSimulation',
            params: {
                pslkPath: this.document?.uri.fsPath ?? ''
            }
        };

        this.pythonServer.sendRequest(request);
        console.log(`[Extension] Sent runSimulation request #${id}`, request);
    }

    private async getBlockRenderInformation(block: BlockData, pslkPath: string): Promise<BlockRenderInformation | undefined> {
        const cacheKey = this.hashBlockKey(block);
        const cached = this.renderInfoCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            console.log('Result request block render information');
            const result = await this.pythonServer.sendRequestAsync({
                method: 'getBlockRenderInformation',
                params: {
                    block,
                    pslkPath: this.document?.uri.fsPath ?? ''
                }
            }, 10000);

            const parsed = JSON.parse(result) as BlockRenderInformation;
            this.renderInfoCache.set(cacheKey, parsed);
            return parsed;
        } catch (error) {
            console.error(`Error on python server while getting block render information: ${error}`);
            vscode.window.showErrorMessage(`Error on python server while getting block render information: ${error}`);
        }
    }

    private async loadBlockLibraries() {
        try {
            console.log('Result requested block libraries');
            const result = await this.pythonServer.sendRequestAsync({
                method: 'getLibraries',
                params: {
                    pslkPath: this.document?.uri.fsPath ?? ''
                }
            }, 10000);

            console.log(`Result obtained block libraries: ${result}`);
            if (this.webviewPanel?.webview) {
                this.webviewPanel.webview.postMessage({
                    type: 'setBlockLibraries',
                    model: JSON.parse(result)
                });
            }
        } catch (error) {
            if (this.webviewPanel?.webview) {
                this.webviewPanel.webview.postMessage({
                    type: 'error',
                    error
                });
            }
            console.error(`Error on python server while getting block libraries: ${error}`);
            vscode.window.showErrorMessage(`Error on python server while getting block libraries: ${error}`);
        }
    }

    private hashBlockKey(block: BlockData): string {
        return JSON.stringify(block);
    }
}
