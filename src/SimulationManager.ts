import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { PythonServerManager } from './PythonServerManager';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export class SimulationManager implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private currentSimulationOptionsFileChangedHandler: ((newPath: string) => void)[] = [];

    private currentPslkPath: string | undefined = undefined;
    private currentSimulationOptionsPath: string | undefined = undefined;

    private pslkCallbacks: Map<string, (msg: any) => void> = new Map();

    constructor(private readonly context: vscode.ExtensionContext) {
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
            if (!this.currentPslkPath) {
              vscode.window.showErrorMessage('No PSLK file selected for simulation.');
              return;
            }

            // Notify the Python server to start the simulation
            const pslkCallback = this.pslkCallbacks.get(this.currentPslkPath);
            if (pslkCallback) {
              pslkCallback({type: 'runSimulation'});
            } else {
              console.warn(`[SimulationManager] No callback registered for PSLK path: ${this.currentPslkPath}`);
            }
            break;
          case 'stopSimulation':
            if (!this.currentPslkPath) {
              vscode.window.showErrorMessage('No PSLK file selected for simulation.');
              return;
            }
            // Notify the Python server to stop the simulation
            const stopCallback = this.pslkCallbacks.get(this.currentPslkPath);
            if (stopCallback) {
              stopCallback({type: 'stopSimulation'});
            } else {
              console.warn(`[SimulationManager] No callback registered for PSLK path: ${this.currentPslkPath}`);
            }
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

    

    public setCurrentPslkPath(pslkPath: string, callback?: (msg: any) => void) {
      this.currentPslkPath = pslkPath;
      this.pslkCallbacks.set(pslkPath, callback || ((msg: any) => {}));    
    }

    public setCurrentSimulationOptionsPath(currentSimulationOptionsPath: string) {
      this.currentSimulationOptionsPath = currentSimulationOptionsPath;
      this.sendSimulationConfigToWebview();
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

      let configFromFile: any = {};
      if (this.currentSimulationOptionsPath && fs.existsSync(this.currentSimulationOptionsPath)) {
        try {
          const fileContent = fs.readFileSync(this.currentSimulationOptionsPath, 'utf8');
          configFromFile = yaml.load(fileContent) || {};
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to read simulation options: ${err.message}`);
        }
      }

      this._view.webview.postMessage({
        type: 'setSimulationConfig',
        config: {
          start_time: configFromFile.start_time ?? 0,
          stop_time: configFromFile.stop_time ?? 10,
          run_in_natural_time: configFromFile.run_in_natural_time ?? false,
          natural_time_speed_multiplier: configFromFile.natural_time_speed_multiplier ?? 1,
          simulation_options_file: this.currentSimulationOptionsPath || ''
        }
      });
    }

    public notifySimulationCompleted(msg: any) {
      this._view?.webview.postMessage({
				type: 'completed',
				result: msg.result
      });
    }

    public notifySimulationProgress(msg: any) {
      this._view?.webview.postMessage({
        type: 'progress',
        params: msg.data
      });
    }
  }
  