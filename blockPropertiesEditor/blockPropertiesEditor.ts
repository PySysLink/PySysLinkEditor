/* Frontend script for VSCode Webview: dynamically builds the block properties form,
   handles messages from the extension backend, and sends updates back. */

declare const acquireVsCodeApi: any;

interface Block {
	label: string;
	x: number;
	y: number;
	properties?: Record<string, string | number>;
}

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Keep current block state
let currentBlock: Block | null = null;

/**
 * Build the properties form dynamically based on the given block.
 */
function buildForm(block: Block) {
	const container = document.createElement('vscode-form-container');
	container.innerHTML = '';

	// Helper to append a field
	function appendField(key: string, value: string | number, type: string = 'text') {
		const group = document.createElement('vscode-form-group');
		const labelEl = document.createElement('vscode-label');
		labelEl.setAttribute('for', key);
		labelEl.textContent = key.charAt(0).toUpperCase() + key.slice(1);

		const input = document.createElement('vscode-textfield');
		input.id = key;
		console.log('key', key);
		console.log('value', value);
		input.setAttribute('value', value.toString());
		if (type === 'number') input.setAttribute('type', 'number');

		group.appendChild(labelEl);
		group.appendChild(input);
		container.appendChild(group);
	}

	// Standard fields
	appendField('label', block.label);
	appendField('x', block.x, 'number');
	appendField('y', block.y, 'number');

	// Custom properties
	if (block.properties) {
		for (const [key, val] of Object.entries(block.properties)) {
			appendField(key, val);
		}
	}

	// Save button
	const saveBtn = document.createElement('vscode-button');
	saveBtn.id = 'saveBtn';
	saveBtn.setAttribute('appearance', 'cta');
	saveBtn.textContent = 'Save';
	saveBtn.addEventListener('click', onSave);
	container.appendChild(saveBtn);

	// Render
	const root = document.getElementById('app');
	if (root) {
		root.innerHTML = '';
		root.appendChild(container);
	}
}

/**
 * Handle save click: gather form values and post update message.
 */
function onSave() {
	if (!currentBlock) {
		return;
	}
	// Collect inputs
	const inputs = document.querySelectorAll('vscode-textfield');
	const props: any = {};
	inputs.forEach((el: any) => {
		const name = el.id;
		let val: string | number = el.value;
		// convert numbers
		if (el.getAttribute('type') === 'number') {
			val = Number(val);
		}
		props[name] = val;
	});

	vscode.postMessage({
		type: 'update',
		props
	});
}

/**
 * Listen for messages from the extension backend and react accordingly.
 */
window.addEventListener('message', event => {
	const msg = event.data;
	switch (msg.type) {
		case 'updateBlock':
			// New block selected
			currentBlock = msg.block;
			console.log('Msg:', msg);
			console.log('Msg block:', msg.block);
			console.log('Current block:', currentBlock);
			if (currentBlock) {
				buildForm(currentBlock);
			}
			break;
		case 'setHtml':
			// Deprecated: direct HTML replace
			document.getElementById('app')!.innerHTML = msg.html;
			document.getElementById('saveBtn')!.addEventListener('click', onSave);
			break;
		default:
			console.warn('Unknown message type:', msg.type);
	}
});

// On first load, notify extension ready
vscode.postMessage({ type: 'ready' });
