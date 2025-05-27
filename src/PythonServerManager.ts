import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { PythonExtension } from '@vscode/python-extension';

type PythonMessage = any;
type PythonMessageListener = (msg: PythonMessage) => void;

export class PythonServerManager {
  private pythonApi?: PythonExtension;
  private pythonProc?: ChildProcess;
  private listeners: PythonMessageListener[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  public addMessageListener(listener: PythonMessageListener) {
    this.listeners.push(listener);
  }

  public removeMessageListener(listener: PythonMessageListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(msg: PythonMessage) {
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch (e) {
        console.error('[PythonServerManager] Listener error:', e);
      }
    }
  }

  public async init() {
    this.pythonApi = await PythonExtension.api();

    // Subscribe to environment changes
    const environments = this.pythonApi.environments;
    this.context.subscriptions.push(
      environments.onDidChangeActiveEnvironmentPath(() => {
        vscode.window.showInformationMessage('Python environment variables changed. Restarting simulation server...');
        this.restartServer();
      })
    );
  }

  public async startServer() {
    const scriptPath = this.context.asAbsolutePath(
      path.join('src', 'pysyslink_server/pysyslink_server.py')
    );

    if (this.pythonApi) {
      const environmentPath = this.pythonApi.environments.getActiveEnvironmentPath();
      const environment = await this.pythonApi.environments.resolveEnvironment(environmentPath);
      if (environment) {
        console.log(`Path to env: ${environment.path}`);
      } else {
        vscode.window.showErrorMessage(
            'No environment selected, please run [Python: select interpreter] first.'
        );
        return;
      }
    

        this.pythonProc = spawn(environment.path, [scriptPath], {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        stdio: ['pipe', 'pipe', 'pipe']
        });

        this.pythonProc.on('error', (err) => {
        vscode.window.showErrorMessage(`Failed to start Python process: ${err.message}`);
        });

        this.pythonProc.stderr?.on('data', (chunk: Buffer) => {
        console.error('[Python stderr]', chunk.toString());
        });

        if (this.pythonProc.stdout) {
        const rl = readline.createInterface({
            input: this.pythonProc.stdout,
            terminal: false
        });

        rl.on('line', (line: string) => {
            try {
            const msg = JSON.parse(line);
            console.log('[Python JSON-RPC]', msg);
            this.notifyListeners(msg); 
            } catch (e) {
            console.error('[Protocol error] Invalid JSON:', line);
            }
        });
        }

        vscode.window.showInformationMessage('Simulation server started.');
    }
  }

  public async restartServer() {
    await this.stopServer();
    await this.startServer();
  }

  public async stopServer() {
    if (this.pythonProc) {
      this.pythonProc.kill();
      this.pythonProc = undefined;
      vscode.window.showInformationMessage('Simulation server stopped.');
    }
  }

  public sendRequest(request: any) {
    if (this.pythonProc?.stdin) {
      this.pythonProc.stdin.write(JSON.stringify(request) + '\n');
    }
  }

  public isRunning() {
    return !!this.pythonProc;
  }
}