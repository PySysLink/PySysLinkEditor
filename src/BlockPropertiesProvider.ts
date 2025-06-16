import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { BlockData } from '../shared/JsonTypes';


export class BlockPropertiesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private updateHandlers: ((blockData: BlockData) => void)[] = [];
    public selectedBlockId: string | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {}
  
    public registerOnUpdateCallback(handler: ((blockData: BlockData) => void)): void {
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
            this.callUpdatedCallbacks(msg.block);
            break;

          // you could handle other msg.types here if needed...

          default:
            console.warn(
              `[BlockPropertiesProvider] unrecognized message type: ${msg.type}`
            );
        }
      });
    }

    public setSelectedBlock(block: BlockData | undefined): void {
      if (!block) {
        this.selectedBlockId = null;
        if (this._view) {
          this._view.webview.postMessage({
            type: 'clearSelection'
          });
        }
        return;
      }
      if (this._view) {
        this._view.webview.postMessage({
          type: 'updateBlock',
          block: block
        });
        this.selectedBlockId = block.id;
      }
    }


    private callUpdatedCallbacks(newBlock: BlockData) {
      for (const handler of this.updateHandlers) {
        try {
          handler(newBlock);
        } catch (err) {
          console.error(
            '[BlockPropertiesProvider] error in update handler',
            err
          );
        }
      }
    }
  }
  