import * as vscode from 'vscode';


class HtmlBuilder {

    /**
     * Get the static html used for the editor webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        (async () => {
            try {
            await this.pythonServer.waitForServer(20000);
            await this.loadBlockLibraries();
            } catch (err) {
            console.error('[BlockPalette] Could not load block libraries:', err);
            vscode.window.showErrorMessage('Could not connect to simulation server in time.');
            }
        })();

        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'out', 'blockEditor', 'blockEditor.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'blockEditor', 'reset.css'));

        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'blockEditor', 'vscode.css'));

        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'blockEditor', 'blockEditor.css'));

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return /* html */`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
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


    public async displayBlockHTML(blockId: IdType) {
        let block = this.getDocumentAsJson(this.document).blocks?.find(block => block.id === blockId);
        if (block === undefined) {
            vscode.window.showErrorMessage(`Block with id: ${blockId} not found on document json`);
            return;
        }
        try {
            console.log("Result request block HTML");
            const result = await this.pythonServer.sendRequestAsync({
                method: "getBlockHTML",
                params: { 
                    block: block,
                    pslkPath: this.document.uri.fsPath 
                }
            }, 10000);

            const panel = vscode.window.createWebviewPanel(
                'pysyslink-plot',
                `Plot for block ${block.label}`,
                vscode.ViewColumn.Active,
                { enableScripts: true }
            );

            await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
            console.log(result);
            panel.webview.html = `<!DOCTYPE html>
<html>
<head>
<style>
    html, body {
    background-color: white !important;
    color: black;
    margin: 0;
    padding: 0;
    }
    /* Ensure plot area (the div with your figure) is white */
    div[id^="fig_el"] {
    background-color: white !important;
    }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/5.16.0/d3.min.js"></script>
<script src="https://mpld3.github.io/js/mpld3.v0.5.12.js"></script>
</head>
<body>
${result.html}
<body>
<html>`;
        } catch (error) {
        console.error(`Error on python server while getting block HTML: ${error}`);
        vscode.window.showErrorMessage(
            `Error on python server while getting block HTML: ${error}`
        );
        }
    }
}