"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockPropertiesProvider = void 0;
class BlockPropertiesProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtmlForView();
        webviewView.webview.onDidReceiveMessage(msg => {
            // handle { type: 'update', id, props }
            // apply edits to TextDocument here...
        });
    }
    getHtmlForView() {
        return /* html */ `
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
exports.BlockPropertiesProvider = BlockPropertiesProvider;
//# sourceMappingURL=BlockPropertiesProvider.js.map