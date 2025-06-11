/* Frontend script for VSCode Webview: dynamically builds the block properties form,
   handles messages from the extension backend, and sends updates back. */

import { BlockData } from "../shared/JsonTypes";

declare const acquireVsCodeApi: any;


// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Keep current block state
let currentBlock: BlockData | null = null;

/**
 * Build the properties form dynamically based on the given block.
 */
function buildForm(block: BlockData) {
	const container = document.createElement('vscode-form-container');
	container.innerHTML = '';

	const infoFields = [
        { label: 'Block Library', value: block.blockLibrary },
        { label: 'Block Type', value: block.blockType },
        { label: 'Block ID', value: block.id }
    ];
    infoFields.forEach(({ label, value }) => {
        const group = document.createElement('vscode-form-group');
        const labelEl = document.createElement('vscode-label');
        labelEl.textContent = label;
        const info = document.createElement('span');
        info.textContent = value;
        info.style.marginLeft = '8px';
        group.appendChild(labelEl);
        group.appendChild(info);
        container.appendChild(group);
    });

	// Standard fields
	appendField(container, 'label', block.label);
	appendField(container, 'x', block.x, 'number');
	appendField(container, 'y', block.y, 'number');

	// Custom properties
	if (block.properties) {
		for (const [key, val] of Object.entries(block.properties)) {
			appendPropertyField(container, key, val);
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

function appendField(container: HTMLElement, key: string, value: string | number, type: string = 'text') {
        const group = document.createElement('vscode-form-group');
        const labelEl = document.createElement('vscode-label');
        labelEl.setAttribute('for', key);
        labelEl.textContent = key.charAt(0).toUpperCase() + key.slice(1);

        const input = document.createElement('vscode-textfield');
        input.id = key;
        input.setAttribute('value', value.toString());
        if (type === 'number') {input.setAttribute('type', 'number');}
        group.appendChild(labelEl);
        group.appendChild(input);
        container.appendChild(group);
    }

    function appendPropertyField(container: HTMLElement, key: string, property: {type: string, value: any }) {
        const group = document.createElement('vscode-form-group');
        const labelEl = document.createElement('vscode-label');
        labelEl.setAttribute('for', key);
        labelEl.textContent = key.charAt(0).toUpperCase() + key.slice(1);

        let input: HTMLElement;

        if (property.type === 'bool') {
            input = document.createElement('input');
            input.id = key;
            input.setAttribute('type', 'checkbox');
            (input as HTMLInputElement).checked = property.value;
        } else if (property.type === 'float' || property.type === 'int') {
            input = document.createElement('vscode-textfield');
            input.id = key;
            input.setAttribute('type', 'number');
            input.setAttribute('value', property.value.toString());
        } else if (property.type === 'string') {
            input = document.createElement('vscode-textfield');
            input.id = key;
            input.setAttribute('type', 'text');
            input.setAttribute('value', property.value);
        } else if (property.type.endsWith('[]') && Array.isArray(property.value)) {
            input = document.createElement('div');
            input.id = key;
            property.value.forEach((item: any, idx: number) => {
                const itemInput = document.createElement('vscode-textfield');
                itemInput.id = `${key}__${idx}`;
                itemInput.setAttribute('value', item.toString());
                itemInput.setAttribute('style', 'margin-right:4px;');
                input.appendChild(itemInput);

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '✕';
                removeBtn.setAttribute('type', 'button');
                removeBtn.onclick = () => {
                    input.removeChild(itemInput);
                    input.removeChild(removeBtn);
                };
                input.appendChild(removeBtn);
            });
            const addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.setAttribute('type', 'button');
            addBtn.onclick = () => {
                const idx = input.querySelectorAll('vscode-textfield').length;
                const itemInput = document.createElement('vscode-textfield');
                itemInput.id = `${key}__${idx}`;
                itemInput.setAttribute('value', '');
                itemInput.setAttribute('style', 'margin-right:4px;');
                input.insertBefore(itemInput, addBtn);
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '✕';
                removeBtn.setAttribute('type', 'button');
                removeBtn.onclick = () => {
                    input.removeChild(itemInput);
                    input.removeChild(removeBtn);
                };
                input.insertBefore(removeBtn, addBtn);
            };
            input.appendChild(addBtn);
        } else {
            // fallback: string
            input = document.createElement('vscode-textfield');
            input.id = key;
            input.setAttribute('type', 'text');
            input.setAttribute('value', property.value?.toString() ?? '');
        }

        group.appendChild(labelEl);
        group.appendChild(input);
        container.appendChild(group);
    }


/**
 * Handle save click: gather form values and post update message.
 */
function onSave() {
    if (!currentBlock) {return;}

    const updatedBlock: BlockData = { ...currentBlock };

    // Standard fields
    const labelInput = document.getElementById('label') as HTMLInputElement;
    const xInput = document.getElementById('x') as HTMLInputElement;
    const yInput = document.getElementById('y') as HTMLInputElement;
    updatedBlock.label = labelInput.value;
    updatedBlock.x = Number(xInput.value);
    updatedBlock.y = Number(yInput.value);

    // Properties
    const newProps: Record<string, {type: string, value: any}> = {};
    if (currentBlock.properties) {
        for (const [key, prop] of Object.entries(currentBlock.properties)) {
            const el = document.getElementById(key);
            if (el) {
                if ((el as HTMLInputElement).type === 'checkbox') {
                    newProps[key] = { type: prop.type, value: (el as HTMLInputElement).checked };
                } else if (prop.type.endsWith('[]') && Array.isArray(prop.value)) {
                    const arr: any[] = [];
                    const arrInputs = (el as HTMLElement).querySelectorAll('vscode-textfield');
                    arrInputs.forEach((itemInput: any) => {
                        const v = itemInput.value;
                        if (v !== '') { arr.push(isNaN(Number(v)) ? v : Number(v)); }
                    });
                    newProps[key] = { type: prop.type, value: arr };
                } else if ((el as HTMLInputElement).type === 'number' || prop.type === 'float' || prop.type === 'int' || prop.type === 'number') {
                    newProps[key] = { type: prop.type, value: Number((el as HTMLInputElement).value) };
                } else {
                    newProps[key] = { type: prop.type, value: (el as HTMLInputElement).value };
                }
            }
        }
    }
    updatedBlock.properties = newProps;

    vscode.postMessage({
        type: 'update',
        block: updatedBlock
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
        case 'clearSelection':
            // Clear current selection
            currentBlock = null;
            document.getElementById('app')!.innerHTML = '<p>No block selected</p>';
            document.getElementById('saveBtn')!.removeEventListener('click', onSave);
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
