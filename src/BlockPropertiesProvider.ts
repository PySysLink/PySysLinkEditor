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
      webviewView.webview.html = this.getHtmlForView(webviewView.webview);
      webviewView.webview.onDidReceiveMessage(msg => {
        // handle { type: 'update', id, props }
        // apply edits to TextDocument here...
      });
    }

    public setSelectedBlock(block: any): void {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'updateBlock',
          block: block
        });
      }
    }
  
    private getHtmlForView(webview: vscode.Webview): string {
      const elementsBundled = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js'));
      return /* html */`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <script
              src="${elementsBundled}"
              type="module"
            ></script>
          </head>
          <body>
            <vscode-form-container>
              <vscode-form-group>
                <vscode-label for="blockName">Name</vscode-label>
                <vscode-textfield id="blockName" name="label"></vscode-textfield>
              </vscode-form-group>
              <vscode-form-group>
                <vscode-label for="posX">X</vscode-label>
                <vscode-textfield id="posX" name="x" type="number"></vscode-textfield>
              </vscode-form-group>
              <vscode-form-group>
                <vscode-label for="posY">Y</vscode-label>
                <vscode-textfield id="posY" name="y" type="number"></vscode-textfield>
              </vscode-form-group>
              <vscode-button id="saveBtn" appearance="cta">Save</vscode-button>
            </vscode-form-container>
            <script>
              const vscode = acquireVsCodeApi();
              document.getElementById("saveBtn").addEventListener("click", () => {
                const form = document.querySelector("vscode-form-container");
                // gather values, then:
                vscode.postMessage({
                  type: "update",
                  props: {
                    label: form.querySelector("[name='label']").value,
                    x: Number(form.querySelector("[name='x']").value),
                    y: Number(form.querySelector("[name='y']").value),
                  }
                });
              });
            </script>
          </body>
        </html>
      `;
    }


    private updateHtmlForBlock(block: any): void {
      const propertiesHtml = Object.entries(block.properties || {}).map(([key, value]) => `
        <vscode-form-group>
          <vscode-label for="${key}">${key}</vscode-label>
          <vscode-textfield id="${key}" name="${key}" value="${value}"></vscode-textfield>
        </vscode-form-group>
      `).join('');
  
      this._view?.webview.postMessage({
        type: 'setHtml',
        html: `
          <vscode-form-container>
            <vscode-form-group>
              <vscode-label for="blockName">Name</vscode-label>
              <vscode-textfield id="blockName" name="label" value="${block.label}"></vscode-textfield>
            </vscode-form-group>
            <vscode-form-group>
              <vscode-label for="posX">X</vscode-label>
              <vscode-textfield id="posX" name="x" type="number" value="${block.x}"></vscode-textfield>
            </vscode-form-group>
            <vscode-form-group>
              <vscode-label for="posY">Y</vscode-label>
              <vscode-textfield id="posY" name="y" type="number" value="${block.y}"></vscode-textfield>
            </vscode-form-group>
            ${propertiesHtml}
            <vscode-button id="saveBtn" appearance="cta">Save</vscode-button>
          </vscode-form-container>
        `
      });
    }
  }
  