"use strict";
const vscode = acquireVsCodeApi();
class Block {
    id;
    label;
    x;
    y;
    element;
    constructor(id, label, x, y, onClick, onMouseDown) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        // Create the DOM element for the block
        this.element = this.createElement(onClick, onMouseDown);
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
        this.x += deltaX;
        this.y += deltaY;
        this.updatePosition();
    }
    updatePosition() {
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
    }
    getElement() {
        return this.element;
    }
}
class SelectedBlocksManager {
    selectedBlocks = new Set();
    select(block) {
        if (!this.selectedBlocks.has(block)) {
            this.selectedBlocks.add(block);
            block.getElement().classList.add('selected');
        }
    }
    unselect(block) {
        if (this.selectedBlocks.has(block)) {
            this.selectedBlocks.delete(block);
            block.getElement().classList.remove('selected');
        }
    }
    toggle(block) {
        if (this.selectedBlocks.has(block)) {
            this.unselect(block);
        }
        else {
            this.select(block);
        }
    }
    clear() {
        this.selectedBlocks.forEach(block => {
            block.getElement().classList.remove('selected');
        });
        this.selectedBlocks.clear();
    }
    getAll() {
        return this.selectedBlocks;
    }
}
(function () {
    const container = document.querySelector('.notes');
    let blocks = [];
    const selectedBlocksManager = new SelectedBlocksManager();
    let dragStartX = 0;
    let dragStartY = 0;
    let isDragging = false;
    let selectionBox = null;
    function createBlock(id, label, x, y) {
        const block = new Block(id, label, x, y, onClick, onMouseDown);
        blocks.push(block);
        container.appendChild(block.getElement());
    }
    function onClick(block, e) {
        vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
        if (e.shiftKey) {
            // Toggle selection if Shift is pressed
            selectedBlocksManager.toggle(block);
        }
        else {
            // Clear selection and select only this block
            selectedBlocksManager.clear();
            selectedBlocksManager.select(block);
        }
    }
    function onMouseDown(block, e) {
        vscode.postMessage({ type: 'print', text: `Mouse down on block: ${block.label}` });
        if (selectedBlocksManager.getAll().size > 0) {
            // Start dragging selected blocks
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    }
    function onMouseMove(e) {
        if (isDragging) {
            // Move all selected blocks
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            selectedBlocksManager.getAll().forEach(block => {
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
    function onMouseUp() {
        if (isDragging) {
            // Send updated positions to the extension
            selectedBlocksManager.getAll().forEach(block => {
                vscode.postMessage({
                    type: 'move',
                    id: block.id,
                    x: block.x,
                    y: block.y
                });
            });
            isDragging = false;
        }
        else if (selectionBox) {
            // End box selection
            container.removeChild(selectionBox);
            selectionBox = null;
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    function startBoxSelection(e) {
        selectedBlocksManager.clear();
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
                selectedBlocksManager.select(block);
            }
            else {
                selectedBlocksManager.unselect(block);
            }
        });
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
        blocks = [];
        container.innerHTML = ''; // Clear container
        // Render each block
        json.blocks?.forEach(blockData => {
            createBlock(blockData.id, blockData.label, blockData.x, blockData.y);
        });
        // Add button
        const btn = document.createElement('button');
        btn.textContent = 'Add Block';
        btn.addEventListener('click', () => vscode.postMessage({ type: 'add' }));
        container.appendChild(btn);
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