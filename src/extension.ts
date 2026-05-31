// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PySysLinkBlockEditorProvider } from './PySysLinkBlockEditorProvider';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { SimulationManager } from './SimulationManager';
import { PythonServerManager } from './simulation/PythonServerManager';

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
    const simulationManager = new SimulationManager(context);

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

    vscode.commands.executeCommand(
        "setContext",
        "pysyslink.simulationRunning",
        false
    );

    const simulationStatus =
        vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

    simulationStatus.show();

    function updateSimulationStatus(running: boolean) {

        if (running) {
            simulationStatus.text =
                "$(debug-stop) Simulation Running";

            simulationStatus.tooltip =
                "Click to stop simulation";

            simulationStatus.command =
                "pysyslink-editor.stopSimulation";
        }
        else {
            simulationStatus.text =
                "$(play) Simulation Stopped";

            simulationStatus.tooltip =
                "Click to run simulation";

            simulationStatus.command =
                "pysyslink-editor.runSimulation";
        }
    }

    updateSimulationStatus(false);

    context.subscriptions.push(simulationStatus);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "pysyslink-editor.runSimulation",
            async () => {

                // Start simulation here
                console.log("Running simulation");

                await vscode.commands.executeCommand(
                    "setContext",
                    "pysyslink.simulationRunning",
                    true
                );

                updateSimulationStatus(true);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "pysyslink-editor.stopSimulation",
            async () => {

                // Stop simulation here
                console.log("Stopping simulation");

                await vscode.commands.executeCommand(
                    "setContext",
                    "pysyslink.simulationRunning",
                    false
                );

                updateSimulationStatus(false);
            }
        )
    );

    

	


	let pySysLinkBlockEditorProvider = new PySysLinkBlockEditorProvider(
        context,
        blockPropertiesProvider,
        simulationManager
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
            pySysLinkBlockEditorProvider['_activeSession'] =
                pySysLinkBlockEditorProvider['sessions'].get(editor.document.uri.toString());
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}




