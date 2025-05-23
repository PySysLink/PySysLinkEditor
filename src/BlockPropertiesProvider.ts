import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';


export class BlockPropertiesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private updateHandlers: ((props: Record<string, any>) => void)[] = [];
    public selectedBlockId: string | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {}
  
    public registerOnUpdateCallback(handler: ((props: Record<string, any>) => void)): void {
      this.updateHandlers.push(handler);
    }

    public resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {

      this._view = webviewView;
      webviewView.webview.options = { enableScripts: true };
      const scriptUri = webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'blockPropertiesEditor', 'blockPropertiesEditor.js')
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
          case 'update':
            // frontend wants to save edited props
            this.callUpdatedCallbacks(msg.props);
            break;

          // you could handle other msg.types here if needed...

          default:
            console.warn(
              `[BlockPropertiesProvider] unrecognized message type: ${msg.type}`
            );
        }
      });
    }

    public setSelectedBlock(block: any): void {
      if (this._view) {
        console.log('setSelectedBlock backend', block);
        this._view.webview.postMessage({
          type: 'updateBlock',
          block: block
        });
        this.selectedBlockId = block.id;
      }
    }


    private callUpdatedCallbacks(props: Record<string, any>) {
      for (const handler of this.updateHandlers) {
        try {
          handler(props);
        } catch (err) {
          console.error(
            '[BlockPropertiesProvider] error in update handler',
            err
          );
        }
      }
    }
  }
  