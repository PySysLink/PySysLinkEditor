import * as vscode from 'vscode';
import { SimulationManager } from './SimulationManager';
import { PySysLinkBlockEditorSession } from './PySysLinkBlockEditorSession';
import { PythonServerManager } from './simulation/PythonServerManager';

export class PySysLinkBlockEditorProvider implements vscode.CustomTextEditorProvider {
    private sessions = new Map<string, PySysLinkBlockEditorSession>();
    private _activeSession: PySysLinkBlockEditorSession | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly pythonServer: PythonServerManager
    ) {}

    public get activeSession() {
        return this._activeSession;
    }

    public setActiveSession(session: PySysLinkBlockEditorSession | undefined): void {
        this._activeSession = session;
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const session = new PySysLinkBlockEditorSession(
            this.context,
            document,
            webviewPanel,
            this.pythonServer
        );
        this.sessions.set(document.uri.toString(), session);
        this.setActiveSession(session);

        // Listen for when this editor becomes active
        webviewPanel.onDidChangeViewState(e => {
            if (webviewPanel.active) {
                this.setActiveSession(session);
            }
        });

        // Clean up when closed
        webviewPanel.onDidDispose(() => {
            this.sessions.delete(document.uri.toString());
            if (this._activeSession === session) {
                this.setActiveSession(undefined);
            }
        });

        
    }
}