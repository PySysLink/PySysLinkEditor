import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { PythonServerManager } from './PythonServerManager';

let requestId = 0;

export class SimulationManager implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private updateHandlers: ((props: Record<string, any>) => void)[] = [];
    private pythonServer: PythonServerManager;

    constructor(private readonly context: vscode.ExtensionContext) {
      this.pythonServer = new PythonServerManager(context);
      this.pythonServer.init();    

      this.pythonServer.addMessageListener((msg) => this.handlePythonMessage(msg));
    }

    private handlePythonMessage(msg: any) {
      if (!this._view) { return; }

      // Forward progress and result messages to the webview
      if (msg.method === 'progress' && msg.params) {
        this._view.webview.postMessage({
          type: 'progress',
          params: msg.params
        });
      } else if (msg.method === 'completed') {
        this._view.webview.postMessage({
          type: 'completed',
          result: msg.result
        });
      } else if (msg.method === 'error') {
        this._view.webview.postMessage({
          type: 'error',
          error: msg.error
        });
      }
    }

    public registerOnUpdateCallback(handler: ((props: Record<string, any>) => void)): void {
      this.updateHandlers.push(handler);
    }

    public resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {
			this.pythonServer.startServer();           

      this._view = webviewView;
      webviewView.webview.options = { enableScripts: true };
      const scriptUri = webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'simulationManager', 'simulationManager.js')
      );
      const elementsBundled = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js'));

      webviewView.webview.html = /* html */`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <script
              src="${elementsBundled}"
              type="module"
            ></script>
          </head>
          <body>
            <div id="app"></div>
            <script type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `;

      // Listen for messages FROM the webview:
      webviewView.webview.onDidReceiveMessage((msg) => {
        switch (msg.type) {
          case 'runSimulation':
            // frontend wants to save edited props
            this.callUpdatedCallbacks(msg.props);
						this.sendSimulationStart();
            break;

          // you could handle other msg.types here if needed...

          default:
            console.warn(
              `[SimulationManager] unrecognized message type: ${msg.type}`
            );
        }
      });
    }

    public setSelectedModel(model: any): void {
      if (this._view) {
        console.log('setSelectedModel backend', model);
        this._view.webview.postMessage({
          type: 'setSelectedModel',
          model: model
        });
      }
    }

		private async sendSimulationStart() {
			if (!this.pythonServer.isRunning()) {
        vscode.window.showErrorMessage(
          'Simulation server is not running. Please run "Start Simulation Server" first.'
        );
        return;
      }

      console.log('[Extension] Sending runSimulation request...');

      // For demo purposes we ask the user for duration & steps:
      const durationInput = await vscode.window.showInputBox({
        prompt: 'Total simulation duration (seconds)',
        value: '5'
      });
      const stepsInput = await vscode.window.showInputBox({
        prompt: 'Number of progress steps',
        value: '10'
      });
      if (!durationInput || !stepsInput) {
        return; // canceled
      }

      const duration = parseFloat(durationInput);
      const steps = parseInt(stepsInput, 10);
      if (isNaN(duration) || isNaN(steps)) {
        vscode.window.showErrorMessage('Invalid numbers provided.');
        return;
      }

      // Build JSON-RPC request
      const id = ++requestId;
      const request = {
        jsonrpc: '2.0',
        id: id,
        method: 'runSimulation',
        params: { duration, steps }
      };

      // Send it over stdin, newline-terminated
      this.pythonServer.sendRequest(request);
      console.log(`[Extension] Sent runSimulation request #${id}`, request);
		}

    private callUpdatedCallbacks(props: Record<string, any>) {
      for (const handler of this.updateHandlers) {
        try {
          handler(props);
        } catch (err) {
          console.error(
            '[SimulationManager] error in update handler',
            err
          );
        }
      }
    }
  }
  