"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockPropertiesProvider = void 0;
const vscode = __importStar(require("vscode"));
class BlockPropertiesProvider {
    context;
    _view;
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtmlForView(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(msg => {
            // handle { type: 'update', id, props }
            // apply edits to TextDocument here...
        });
    }
    getReact() {
    }
    getHtmlForView(webview) {
        const elementsBundled = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js'));
        return /* html */ `
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
}
exports.BlockPropertiesProvider = BlockPropertiesProvider;
//# sourceMappingURL=BlockPropertiesProvider.js.map