import * as vscode from 'vscode';

import { PythonServerManager } from "./PythonServerManager";


class PythonSimulationClient {
    private context: vscode.ExtensionContext;
    private pythonServer: PythonServerManager;
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

    private async getBlockRenderInformation(block: BlockData, pslkPath: string): Promise<BlockRenderInformation | undefined> {
		const cacheKey = this.hashBlockKey(block);
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
}