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
    private currentInitializationScriptFileChangedHandler: ((newPath: string) => void)[] = [];

    private currentPslkPath: string | undefined = undefined;
    private currentSimulationOptionsPath: string | undefined = undefined;
    private currentInitializationScriptPath: string | undefined = undefined;

    private pslkCallbacks: Map<string, (msg: any) => void> = new Map();

    constructor(private readonly context: vscode.ExtensionContext) {
    }

    public registerCurrentSimulationOptionsFileChangedHandler(handler: ((currentSimulationPath: string) => void)): void {
      this.currentSimulationOptionsFileChangedHandler.push(handler);
    }
    
    public registerCurrentInitializationScriptFileChangedHandler(handler: ((currentInitializationScriptPath: string) => void)): void {
      this.currentInitializationScriptFileChangedHandler.push(handler);
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
      const styleMainUri = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'simulationManager', 'simulationManager.css'));

      webviewView.webview.html = /* html */`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <script
              src="${elementsBundled}"
              type="module"
            ></script>
            <link href="${styleMainUri}" rel="stylesheet" />
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
          case 'openInitializationScriptFileSelector':
            this.openInitializationScriptFileSelector();
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
      this.sendSimulationConfigToWebview();
    }

    public setCurrentSimulationOptionsPath(currentSimulationOptionsPath: string) {
      this.currentSimulationOptionsPath = currentSimulationOptionsPath;
      this.sendSimulationConfigToWebview();
    }

    public setCurrentInitializationScriptPath(currentInitializationScriptPath: string) {
      this.currentInitializationScriptPath = currentInitializationScriptPath;
      this.sendSimulationConfigToWebview();
    }


    private async openSimulationOptionsFileSelector() {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        defaultUri: this.currentSimulationOptionsPath && this.currentPslkPath ? vscode.Uri.file(path.resolve(path.dirname(this.currentPslkPath), this.currentSimulationOptionsPath)) : undefined
      };

      vscode.window.showOpenDialog(options).then(fileUri => {
          if (fileUri && fileUri[0]) {
              console.log('Selected file: ' + fileUri[0].fsPath);
              let selectedPath = fileUri[0].fsPath;
              if (this.currentPslkPath) {
                const baseDir = path.dirname(this.currentPslkPath);
                selectedPath = path.relative(baseDir, selectedPath);
              }
              this.currentSimulationOptionsPath = selectedPath;
              // Notify all registered handlers about the change
              this.currentSimulationOptionsFileChangedHandler.forEach(handler => {
                handler(this.currentSimulationOptionsPath!);
              });
              // Post message to webview to update the UI
              this.sendSimulationConfigToWebview();
               
          }
      });
    }
    
    
    private async openInitializationScriptFileSelector() {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        defaultUri: this.currentInitializationScriptPath && this.currentPslkPath ? vscode.Uri.file(path.resolve(path.dirname(this.currentPslkPath), this.currentInitializationScriptPath)) : undefined
      };

      vscode.window.showOpenDialog(options).then(fileUri => {
          if (fileUri && fileUri[0]) {
              console.log('Selected file: ' + fileUri[0].fsPath);
              let selectedPath = fileUri[0].fsPath;
              if (this.currentPslkPath) {
                const baseDir = path.dirname(this.currentPslkPath);
                selectedPath = path.relative(baseDir, selectedPath);
              }
              this.currentInitializationScriptPath = selectedPath;
              // Notify all registered handlers about the change
              this.currentInitializationScriptFileChangedHandler.forEach(handler => {
                handler(this.currentInitializationScriptPath!);
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

      const currentPslkFilename = this.currentPslkPath ? path.basename(this.currentPslkPath) : '';

      this._view.webview.postMessage({
        type: 'setSimulationConfig',
        config: {
          start_time: configFromFile.start_time ?? 0,
          stop_time: configFromFile.stop_time ?? 10,
          run_in_natural_time: configFromFile.run_in_natural_time ?? false,
          natural_time_speed_multiplier: configFromFile.natural_time_speed_multiplier ?? 1,
          simulation_options_file: this.currentSimulationOptionsPath || '',
          initialization_script_file: this.currentInitializationScriptPath || '',
          current_pslk: currentPslkFilename
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
  