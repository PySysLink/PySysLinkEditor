// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PySysLinkBlockEditorProvider } from './PySysLinkBlockEditor';
import { BlockPropertiesProvider } from './BlockPropertiesProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pysyslink-editor" is now active!');
    const blockPropertiesProvider = new BlockPropertiesProvider(context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'pysyslink-editor.blockPropertiesView',
			blockPropertiesProvider
		)
	);

	context.subscriptions.push(PySysLinkBlockEditorProvider.register(context, blockPropertiesProvider));

	console.log('Congratulations, activation completed!');


}

// This method is called when your extension is deactivated
export function deactivate() {}




