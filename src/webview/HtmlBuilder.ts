import * as vscode from 'vscode';
import { getNonce } from '../../shared/util';

export class HtmlBuilder {
    constructor(private readonly context: vscode.ExtensionContext) {}

    public getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri,
            'out',
            'blockEditor',
            'blockEditor.js'
        ));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri,
            'blockEditor',
            'reset.css'
        ));

        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri,
            'blockEditor',
            'vscode.css'
        ));

        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri,
            'blockEditor',
            'blockEditor.css'
        ));

        const nonce = getNonce();

        return /* html */ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet" />
                <link href="${styleVSCodeUri}" rel="stylesheet" />
                <link href="${styleMainUri}" rel="stylesheet" />
                <title>PySysLink</title>
            </head>
            <body>
                <div class="main">
                    <div class="top-controls"></div>
                    <div class="editor-layout">
                        <div class="canvas-container">
                            <div class="zoom-container">
                                <div class="canvas"></div>
                            </div>
                        </div>
                        <div class="block-palette-sidebar" id="block-palette-sidebar">
                            <div id="block-palette-content"></div>
                        </div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
