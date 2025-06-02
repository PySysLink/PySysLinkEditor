import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { PythonServerManager } from './PythonServerManager';


export class BlockPalette implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private pythonServer: PythonServerManager;

    constructor(private readonly context: vscode.ExtensionContext, pythonServer: PythonServerManager) {
          this.pythonServer = pythonServer;
    }

    public resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {

      this._view = webviewView;
      webviewView.webview.options = { enableScripts: true };
      const scriptUri = webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'blockPalette', 'blockPalette.js')
      );
      const elementsBundled = webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js')
      );

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

      (async () => {
        try {
          await this.pythonServer.waitForServer(20000);
          await this.loadBlockLibraries();
        } catch (err) {
          console.error('[BlockPalette] Could not load block libraries:', err);
          vscode.window.showErrorMessage('Could not connect to simulation server in time.');
        }
      })();


      // Listen for messages FROM the webview:
      webviewView.webview.onDidReceiveMessage((msg) => {
        switch (msg.type) {
          case 'updatePalette':
            this.loadBlockLibraries(); // trigger refresh
            break;

          default:
            console.warn(`[BlockPalette] Unrecognized message type: ${msg.type}`);
        }
      });
    }

    private async loadBlockLibraries() {
        try {
          const result = await this.pythonServer.sendRequestAsync({
            method: "getLibraries"
          }, 10000);

          if (this._view) {
            this._view.webview.postMessage({
              type: 'setBlockLibraries',
              model: result
            });
          }
        } catch (error) {
          if (this._view) {
            this._view.webview.postMessage({
              type: 'error',
              error: error
            });
          }
          vscode.window.showErrorMessage(
            `Error on python server while getting block libraries: ${error}`
          );
        }      
    }
  }
  