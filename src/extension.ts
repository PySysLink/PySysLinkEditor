// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PySysLinkBlockEditorProvider } from './PySysLinkBlockEditor';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';
import { SimulationManager } from './SimulationManager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pysyslink-editor" is now active!');
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

	const { disposable, provider: pySysLinkBlockEditorProvider } = PySysLinkBlockEditorProvider.register(context, blockPropertiesProvider);
    context.subscriptions.push(disposable);
	blockPropertiesProvider.registerOnUpdateCallback(pySysLinkBlockEditorProvider.updateBlockParameters);
	console.log('Congratulations, activation completed!');


}

// This method is called when your extension is deactivated
export function deactivate() {}




