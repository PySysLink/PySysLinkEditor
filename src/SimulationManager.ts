import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { PythonServerManager } from './PythonServerManager';


export class SimulationManager implements vscode.WebviewViewProvider {
    private requestId = 0;
    private runningSimulationId = 0;
    private _view?: vscode.WebviewView;
    private updateHandlers: ((props: Record<string, any>) => void)[] = [];
    private pythonServer: PythonServerManager;

    constructor(private readonly context: vscode.ExtensionContext) {
      this.pythonServer = new PythonServerManager(context);
      this.pythonServer.init();    

      this.pythonServer.addMessageListener((msg) => this.handlePythonMessage(msg));
    }

    private handlePythonMessage(msg: any) {
      if (!this._view) {
        return;
      }

      switch (msg.type) {
        case 'print':
          console.log(`[python server]: ${msg.message}`);
          break;
        case 'notification':
          // In our protocol, notifications carry an `event` + `data`
          if (msg.event === 'progress') {
            this._view.webview.postMessage({
              type: 'progress',
              params: msg.data
            });
          }
          break;

        case 'response':
          // A successful RPC response
          this._view.webview.postMessage({
            type: 'completed',
            result: msg.result
          });
          break;

        case 'error':
          // If you choose to surface errors as their own type
          this._view.webview.postMessage({
            type: 'error',
            error: msg.error
          });
          vscode.window.showErrorMessage(
            `Error on python server: ${msg.error}`
          );
          break;

        case 'heartbeat':
          // Optional: handle ping/pong if you want to display connectivity
          console.debug(`[Heartbeat ${msg.subtype}] ${msg.timestamp}`);
          break;

        default:
          console.warn('Unknown message type from Python:', msg);
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

      webviewView.webview.onDidReceiveMessage((msg) => {
        console.log(`SimulationManager: [${msg}]`);
        switch (msg.type) {
          case 'runSimulation':
						this.sendSimulationStart(msg);
            break;
          case 'stopSimulation':
            this.cancelSimulation();
            break;
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

      const duration = msg.params.duration;
      const steps = msg.params.steps;
      console.log(`duration: ${msg.params.duration}`);
      console.log(`steps: ${msg.params.steps}`);
      console.log(`msg: ${msg}`);
      if (isNaN(duration) || isNaN(steps)) {
        vscode.window.showErrorMessage('Invalid numbers provided.');
        return;
      }

      // Build JSON-RPC request
      const id = ++this.requestId;
      this.runningSimulationId = id;

      const request = {
        type: 'request',
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
  