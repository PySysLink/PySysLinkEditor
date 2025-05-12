import * as vscode from 'vscode';

export class BlockPropertiesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {}
  
    public resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = this.getHtmlForView();
      webviewView.webview.onDidReceiveMessage(msg => {
        // handle { type: 'update', id, props }
        // apply edits to TextDocument here...
      });
    }
  
    private getHtmlForView(): string {
      return /* html */`
        <!DOCTYPE html><body>
          <form id="propsForm">
            <label>Label: <input name="label"/></label><br/>
            <label>X: <input name="x" type="number"/></label><br/>
            <label>Y: <input name="y" type="number"/></label><br/>
            <button type="submit">Save</button>
          </form>
          <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('propsForm').addEventListener('submit', e => {
              e.preventDefault();
              const f = e.target;
              vscode.postMessage({
                type: 'update',
                id: /* selected block ID */,
                props: {
                  label: f.label.value,
                  x: Number(f.x.value),
                  y: Number(f.y.value)
                }
              });
            });
          </script>
        </body>`;
    }
  }
  