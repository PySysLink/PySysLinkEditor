import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { PythonServerManager } from './PythonServerManager';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export class SimulationManager implements vscode.WebviewViewProvider {
    private requestId = 0;
    private runningSimulationId = 0;
    private _view?: vscode.WebviewView;
    private currentSimulationOptionsFileChangedHandler: ((newPath: string) => void)[] = [];
    private pythonServer: PythonServerManager;

    private currentPslkPath: string | undefined = undefined;
    private currentSimulationOptionsPath: string | undefined = undefined;

    constructor(private readonly context: vscode.ExtensionContext, pythonServer: PythonServerManager) {
      this.pythonServer = pythonServer;

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

    public registerCurrentSimulationOptionsFileChangedHandler(handler: ((currentSimulationPath: string) => void)): void {
      this.currentSimulationOptionsFileChangedHandler.push(handler);
    }

    public resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {

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
          case 'openSimulationOptionsFileSelector':
            this.openSimulationOptionsFileSelector();
            break;
          case 'simulationConfigChanged':
            this.saveSimulationConfigToFile(msg.config);
            break;
          default:
            console.warn(
              `[SimulationManager] unrecognized message type: ${msg.type}`
            );
        }
      });
    }

    private saveSimulationConfigToFile(config: any) {
      const filePath = config.simulation_options_file || this.currentSimulationOptionsPath;
      if (!filePath) {
        vscode.window.showErrorMessage('No simulation options file selected.');
        return;
      }

      // Don't save the file path itself in the config
      const configToSave = { ...config };
      delete configToSave.simulation_options_file;

      let existingConfig: any = {};
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          existingConfig = yaml.load(fileContent) || {};
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to read simulation options: ${err.message}`);
          return;
        }
      }

      // Override pertinent fields
      const mergedConfig = { ...existingConfig, ...configToSave };

      try {
        fs.writeFileSync(filePath, yaml.dump(mergedConfig, { indent: 2 }), 'utf8');
        vscode.window.showInformationMessage('Simulation options saved.');
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to save simulation options: ${err.message}`);
      }
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

    public setCurrentPslkPath(pslkPath: string) {
      this.currentPslkPath = pslkPath;
    }

    public setCurrentSimulationOptionsPath(currentSimulationOptionsPath: string) {
      this.currentSimulationOptionsPath = currentSimulationOptionsPath;
    }

    public registerCurrentSimulationOptionsPathChangedCallback(handler: (path: string) => void): void {
      this.currentSimulationOptionsFileChangedHandler.push(handler);
    }

    private async openSimulationOptionsFileSelector() {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        defaultUri: this.currentSimulationOptionsPath ? vscode.Uri.file(this.currentSimulationOptionsPath) : undefined
      };

      vscode.window.showOpenDialog(options).then(fileUri => {
          if (fileUri && fileUri[0]) {
              console.log('Selected file: ' + fileUri[0].fsPath);
              this.currentSimulationOptionsPath = fileUri[0].fsPath;
              // Notify all registered handlers about the change
              this.currentSimulationOptionsFileChangedHandler.forEach(handler => {
                handler(this.currentSimulationOptionsPath!);
              });
              // Post message to webview to update the UI
              this.sendSimulationConfigToWebview();
               
          }
      });
    }

    private sendSimulationConfigToWebview() {
      if (!this._view) {
        return;
      }
      this._view.webview.postMessage({
        type: 'setSimulationConfig',
        config: {
          start_time: 0,
          stop_time: 10,
          run_in_natural_time: false,
          natural_time_speed_multiplier: 1,
          simulation_options_file: this.currentSimulationOptionsPath || ''
        }
      });
    }

		private async sendSimulationStart(msg: any) {
			if (!this.pythonServer.isRunning()) {
        vscode.window.showErrorMessage(
          'Simulation server is not running. Please run "Start Simulation Server" first.'
        );
        return;
      }

      if (!this.currentPslkPath) {
        vscode.window.showErrorMessage('No PSLK file selected. Please open a PSLK file first.');
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
          pslkPath: this.currentPslkPath, 
          configFile: this.currentSimulationOptionsPath || ''
      }
      };

      this.pythonServer.sendRequest(request);
      console.log(`[Extension] Sent runSimulation request #${id}`, request);
		}
  }
  