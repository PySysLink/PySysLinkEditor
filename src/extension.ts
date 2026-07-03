// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PySysLinkBlockEditorProvider } from './PySysLinkBlockEditorProvider';
import { SimulationManager } from './SimulationManager';
import { PythonServerManager } from './simulation/PythonServerManager';
import { SimulationTerminalManager } from './SimulationTerminalManager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pysyslink-editor" is now active!');
	let pythonServer = new PythonServerManager(context);

    (async () => {
        await pythonServer.init();
        await pythonServer.startServer();
    })();          
	
    const simulationTerminal = new SimulationTerminalManager();
    
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "pysyslink-editor.runSimulation",
            async () => {

                const session = pySysLinkBlockEditorProvider.activeSession;

                if (!session) {
                    vscode.window.showErrorMessage(
                        "No active PySysLink editor session."
                    );
                    return;
                }

                const pslkPath = session.documentUri.fsPath;

                const command = `python simulate.py "${pslkPath}"`;
                simulationTerminal.runCommand(command);
            }
        )
    );


	let pySysLinkBlockEditorProvider = new PySysLinkBlockEditorProvider(
        context,
        pythonServer
    );
    const disposable = vscode.window.registerCustomEditorProvider(
        'pysyslink-editor.modelBlockEditor', // viewType
        pySysLinkBlockEditorProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            },
            supportsMultipleEditorsPerDocument: true
        }
    );
    context.subscriptions.push(disposable);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (
            editor &&
            editor.document.uri &&
            pySysLinkBlockEditorProvider['sessions']?.has(editor.document.uri.toString())
        ) {
            pySysLinkBlockEditorProvider.setActiveSession(pySysLinkBlockEditorProvider['sessions'].get(editor.document.uri.toString()));
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}




