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
    addElementToCanvas(canvas) {
        canvas.appendChild(this.element);
    }
}
(function () {
    const canvas = document.querySelector('.canvas');
    const zoomContainer = document.querySelector('.zoom-container');
    const topControls = document.querySelector('.top-controls');
    const canvasContainer = document.querySelector('.canvas-container');
    let blocks = [];
    let dragStartX = 0;
    let dragStartY = 0;
    let dragThreshold = 5; // Minimum distance to detect a drag
    let isDragging = false;
    let selectionBox = null;
    let zoomLevel = 2; // Default zoom level
    const zoomStep = 0.1; // Step for zooming in/out
    const minZoom = 1; // Minimum zoom level
    const maxZoom = 4; // Maximum zoom level
    function getZoomLevelReal() {
        return zoomLevel / 2;
    }
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
        if (!block.isSelected()) {
            if (e.shiftKey) {
                // Toggle selection if Shift is pressed
                block.toggleSelect();
            }
            else {
                // Clear selection and select only this block
                unselectAll();
                block.select();
            }
        }
        // Store the initial mouse position
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        isDragging = false; // Reset dragging state
        // Add a temporary mousemove listener to detect drag threshold
        const onMouseMoveThreshold = (moveEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - dragStartX);
            const deltaY = Math.abs(moveEvent.clientY - dragStartY);
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                // Exceeded drag threshold, start dragging
                isDragging = true;
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                // Start dragging selected blocks
                if (!block.isSelected()) {
                    // If the block is not already selected, add it to the selection
                    block.select();
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        };
        document.addEventListener('mousemove', onMouseMoveThreshold);
        // Handle mouseup to detect a simple click
        const onMouseUpThreshold = () => {
            document.removeEventListener('mousemove', onMouseMoveThreshold);
            document.removeEventListener('mouseup', onMouseUpThreshold);
            if (!isDragging) {
                vscode.postMessage({ type: 'print', text: `As simple click on: ${block.label}` });
                // If no drag occurred, treat it as a simple click
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    block.toggleSelect();
                }
                else {
                    // Clear selection and select only this block
                    unselectAll();
                    block.select();
                }
            }
        };
        document.addEventListener('mouseup', onMouseUpThreshold);
    }
    function onMouseDownInCanvas(e) {
        if (e.target !== canvas) {
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
            canvas.removeChild(selectionBox);
            selectionBox = null;
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    function onMouseMove(e) {
        const scaledDeltaX = (e.clientX - dragStartX) / getZoomLevelReal();
        const scaledDeltaY = (e.clientY - dragStartY) / getZoomLevelReal();
        if (isDragging) {
            getSelectedBlocks().forEach(block => {
                block.move(scaledDeltaX, scaledDeltaY);
            });
            dragStartX = e.clientX;
            dragStartY = e.clientY;
        }
        else if (selectionBox) {
            // Update selection box size
            const canvasRect = canvas.getBoundingClientRect();
            const adjustedX = (e.clientX - canvasRect.left) / getZoomLevelReal();
            const adjustedY = (e.clientY - canvasRect.top) / getZoomLevelReal();
            const scaledWidth = (adjustedX - dragStartX);
            const scaledHeight = (adjustedY - dragStartY);
            selectionBox.style.left = `${Math.min(dragStartX, adjustedX)}px`;
            selectionBox.style.top = `${Math.min(dragStartY, adjustedY)}px`;
            selectionBox.style.width = `${Math.abs(scaledWidth)}px`;
            selectionBox.style.height = `${Math.abs(scaledHeight)}px`;
            // Update selected blocks based on the selection box
            updateSelectionBox();
        }
    }
    function startBoxSelection(e) {
        unselectAll();
        vscode.postMessage({ type: 'print', text: `Start box selection at ${e.clientX}, ${e.clientY}` });
        // Get the canvas's bounding rectangle
        const canvasRect = canvas.getBoundingClientRect();
        // Adjust mouse coordinates to be relative to the canvas
        const adjustedX = (e.clientX - canvasRect.left) / getZoomLevelReal();
        const adjustedY = (e.clientY - canvasRect.top) / getZoomLevelReal();
        selectionBox = document.createElement('div');
        selectionBox.className = 'selection-box';
        canvas.appendChild(selectionBox);
        dragStartX = adjustedX;
        dragStartY = adjustedY;
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
        canvas.innerHTML = ''; // Clear canvas
        blocks.forEach(block => block.addElementToCanvas(canvas));
        canvas.addEventListener('mousedown', onMouseDownInCanvas);
        topControls.innerHTML = '';
        // Add button
        const btn = document.createElement('button');
        btn.textContent = 'Add Block';
        btn.addEventListener('click', () => vscode.postMessage({ type: 'add' }));
        topControls.appendChild(btn);
        const btnZoomIn = document.createElement('button');
        btnZoomIn.textContent = 'Zoom In';
        const btnZoomOut = document.createElement('button');
        btnZoomOut.textContent = 'Zoom Out';
        const btnResetZoom = document.createElement('button');
        btnResetZoom.textContent = 'Reset Zoom';
        btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + zoomStep));
        btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - zoomStep));
        btnResetZoom.addEventListener('click', () => setZoom(2));
        topControls.appendChild(btnZoomIn);
        topControls.appendChild(btnZoomOut);
        topControls.appendChild(btnResetZoom);
        centerCanvas();
        setZoom(zoomLevel);
    }
    function centerCanvas() {
        // Scroll to the center of the canvas
        // canvasContainer.scrollLeft = (canvas.scrollWidth - canvasContainer.clientWidth) / 2;
        // canvasContainer.scrollTop = (canvas.scrollHeight - canvasContainer.clientHeight) / 2;
    }
    function updateBlocks(jsonText) {
        let json;
        try {
            json = JSON.parse(jsonText || '{}');
        }
        catch {
            canvas.textContent = 'Invalid JSON';
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
    function setZoom(level) {
        // Clamp the zoom level between minZoom and maxZoom
        zoomLevel = Math.min(maxZoom, Math.max(minZoom, level));
        zoomContainer.style.transform = `scale(${zoomLevel})`;
        // Dynamically adjust the canvas size based on the zoom level
        const scaledWidth = Math.min(2000 / 2 * zoomLevel, 2000 / 2);
        const scaledHeight = Math.min(2000 / 2 * zoomLevel, 2000 / 2);
        zoomContainer.style.width = `${scaledWidth}px`;
        zoomContainer.style.height = `${scaledHeight}px`;
        vscode.postMessage({ type: 'print', text: `Zoom level: ${zoomLevel}` });
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