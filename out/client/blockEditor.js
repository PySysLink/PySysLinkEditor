"use strict";
const vscode = acquireVsCodeApi();
class Block {
    id;
    label;
    x;
    y;
    element;
    _isSelected = false;
    constructor(id, label, x, y, onClick, onMouseDown) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        // Create the DOM element for the block
        this.element = this.createElement(onClick, onMouseDown);
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
    }
    getState() {
        return [{
                type: 'move',
                id: this.id,
                x: this.x,
                y: this.y
            }];
    }
    parseStateFromJson(blockData) {
        this.setPosition(blockData.x, blockData.y);
        this.label = blockData.label;
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    select() {
        this._isSelected = true;
        this.element.classList.add('selected');
    }
    unselect() {
        if (this._isSelected) {
            vscode.postMessage({ type: 'print', text: `block unselected: ${this.label}` });
        }
        this._isSelected = false;
        this.element.classList.remove('selected');
    }
    isSelected() {
        return this._isSelected;
    }
    toggleSelect() {
        this._isSelected = !this._isSelected;
        if (this._isSelected) {
            this.select();
        }
        else {
            this.unselect();
        }
    }
    createElement(onClick, onMouseDown) {
        const el = document.createElement('div');
        el.className = 'block';
        el.style.left = `${this.x}px`;
        el.style.top = `${this.y}px`;
        el.textContent = this.label;
        el.dataset.id = this.id;
        // Attach event listeners
        el.addEventListener('click', (e) => onClick(this, e));
        el.addEventListener('mousedown', (e) => onMouseDown(this, e));
        return el;
    }
    move(deltaX, deltaY) {
        this.setPosition(this.x + deltaX, this.y + deltaY);
    }
    getElement() {
        return this.element;
    }
    addElementToContainer(container) {
        container.appendChild(this.element);
    }
}
(function () {
    const container = document.querySelector('.notes');
    let blocks = [];
    let dragStartX = 0;
    let dragStartY = 0;
    let dragThreshold = 5; // Minimum distance to detect a drag
    let isDragging = false;
    let selectionBox = null;
    function createBlock(id, label, x, y) {
        const block = new Block(id, label, x, y, onClick, onMouseDown);
        blocks.push(block);
    }
    function unselectAll() {
        blocks.forEach(block => block.unselect());
    }
    function getSelectedBlocks() {
        return blocks.filter(block => block.isSelected());
    }
    function onClick(block, e) {
        vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
    }
    function onMouseDown(block, e) {
        vscode.postMessage({ type: 'print', text: `Mouse down on block: ${block.label}` });
        if (e.shiftKey) {
            // Toggle selection if Shift is pressed
            block.toggleSelect();
        }
        else {
            // Clear selection and select only this block
            unselectAll();
            block.select();
        }
        if (getSelectedBlocks().length > 0) {
            // Start dragging selected blocks
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    }
    function onMouseDownInContainer(e) {
        if (e.target !== container) {
            return; // Ignore clicks on child elements
        }
        startBoxSelection(e);
    }
    function onMouseUp() {
        vscode.postMessage({ type: 'print', text: `Mouse up` });
        if (isDragging) {
            isDragging = false;
            const stateMessages = getSelectedBlocks().flatMap(block => block.getState());
            stateMessages.forEach(message => {
                vscode.postMessage({ type: 'print', text: message });
            });
            vscode.postMessage({ type: 'moveBatch', updates: stateMessages });
        }
        else if (selectionBox) {
            // End box selection
            container.removeChild(selectionBox);
            selectionBox = null;
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    function onMouseMove(e) {
        if (isDragging) {
            // Move all selected blocks
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            getSelectedBlocks().forEach(block => {
                block.move(deltaX, deltaY);
            });
            dragStartX = e.clientX;
            dragStartY = e.clientY;
        }
        else if (selectionBox) {
            // Update selection box size
            const width = e.clientX - dragStartX;
            const height = e.clientY - dragStartY;
            selectionBox.style.width = `${Math.abs(width)}px`;
            selectionBox.style.height = `${Math.abs(height)}px`;
            selectionBox.style.left = `${Math.min(e.clientX, dragStartX)}px`;
            selectionBox.style.top = `${Math.min(e.clientY, dragStartY)}px`;
            // Update selected blocks based on the selection box
            updateSelectionBox();
        }
    }
    function startBoxSelection(e) {
        unselectAll();
        vscode.postMessage({ type: 'print', text: `Start box selection at ${e.clientX}, ${e.clientY}` });
        selectionBox = document.createElement('div');
        selectionBox.className = 'selection-box';
        container.appendChild(selectionBox);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        selectionBox.style.left = `${dragStartX}px`;
        selectionBox.style.top = `${dragStartY}px`;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    function updateSelectionBox() {
        const boxRect = selectionBox.getBoundingClientRect();
        blocks.forEach(block => {
            const blockEl = block.getElement();
            const blockRect = blockEl.getBoundingClientRect();
            if (blockRect.left < boxRect.right &&
                blockRect.right > boxRect.left &&
                blockRect.top < boxRect.bottom &&
                blockRect.bottom > boxRect.top) {
                block.select();
            }
            else {
                block.unselect();
            }
        });
    }
    function renderHTML(blocks) {
        vscode.postMessage({ type: 'print', text: `Rendering ${blocks.length} blocks` });
        container.innerHTML = ''; // Clear container
        blocks.forEach(block => block.addElementToContainer(container));
        // Add button
        const btn = document.createElement('button');
        btn.textContent = 'Add Block';
        btn.addEventListener('click', () => vscode.postMessage({ type: 'add' }));
        container.appendChild(btn);
        container.addEventListener('mousedown', onMouseDownInContainer);
    }
    function updateBlocks(jsonText) {
        let json;
        try {
            json = JSON.parse(jsonText || '{}');
        }
        catch {
            container.textContent = 'Invalid JSON';
            return;
        }
        json.blocks?.forEach(blockData => {
            blocks.find(b => b.id === blockData.id)?.move(blockData.x, blockData.y);
            var block = blocks.find(b => b.id === blockData.id);
            if (block) {
                block.parseStateFromJson(blockData);
            }
            else {
                vscode.postMessage({ type: 'print', text: `Block ID does not exist, creating block: ${blockData.id}` });
                createBlock(blockData.id, blockData.label, blockData.x, blockData.y);
            }
        });
        renderHTML(blocks);
    }
    // Listen for messages from extension
    window.addEventListener('message', (e) => {
        if (e.data.type === 'update') {
            updateBlocks(e.data.text);
            vscode.setState({ text: e.data.text });
        }
    });
    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        updateBlocks(state.text);
    }
})();
//# sourceMappingURL=blockEditor.js.map