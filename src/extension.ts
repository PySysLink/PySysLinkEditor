// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PySysLinkBlockEditorProvider } from './PySysLinkBlockEditor';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { SimulationManager } from './SimulationManager';
import { PythonServerManager } from './PythonServerManager';

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

    const blockPropertiesProvider = new BlockPropertiesProvider(context);
    const simulationManager = new SimulationManager(context, pythonServer);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'pysyslink-editor.blockPropertiesView',
			blockPropertiesProvider
		)
	);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'pysyslink-editor.simulationManager',
			simulationManager
		)
	);

	


	const pySysLinkBlockEditorProvider = new PySysLinkBlockEditorProvider(
        context,
        blockPropertiesProvider,
        simulationManager,
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

	// vscode.window.onDidChangeActiveTextEditor(editor => {
    //     if (editor && editor.document && editor.document.uri.fsPath.endsWith('.pslk')) {
    //         simulationManager.setCurrentPslkPath(editor.document.uri.fsPath);
	// 		let simPath = pySysLinkBlockEditorProvider.getSimulationOptionsPath();
	// 		if (simPath) {
	// 			simulationManager.setCurrentSimulationOptionsPath(simPath);
	// 		}
    //     }
    // });
}

// This method is called when your extension is deactivated
export function deactivate() {}




