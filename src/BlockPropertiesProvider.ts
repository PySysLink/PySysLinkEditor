import * as vscode from 'vscode';

export class BlockPropertiesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {}
  
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
      webviewView.webview.html = /* html */`
        <!DOCTYPE html>
        <html lang="en">
          <head></head>
          <body>
            <div id="app"></div>
            <script type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `;
    }

    public setSelectedBlock(block: any): void {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'updateBlock',
          block: block
        });
      }
    }
  }
  