declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

class Block {
    id: string;
    label: string;
    x: number;
    y: number;
    private element: HTMLElement;

    constructor(id: string, label: string, x: number, y: number, onClick: (block: Block, e: MouseEvent) => void, onMouseDown: (block: Block, e: MouseEvent) => void) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;

        // Create the DOM element for the block
        this.element = this.createElement(onClick, onMouseDown);
    }

    private createElement(onClick: (block: Block, e: MouseEvent) => void, onMouseDown: (block: Block, e: MouseEvent) => void): HTMLElement {
        const el = document.createElement('div');
        el.className = 'block';
        el.style.left = `${this.x}px`;
        el.style.top = `${this.y}px`;
        el.textContent = this.label;
        el.dataset.id = this.id;

        // Attach event listeners
        el.addEventListener('click', (e: MouseEvent) => onClick(this, e));
        el.addEventListener('mousedown', (e: MouseEvent) => onMouseDown(this, e));

        return el;
    }


    move(deltaX: number, deltaY: number): void {
        this.x += deltaX;
        this.y += deltaY;
        this.updatePosition();
    }

    updatePosition(): void {
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
    }

    getElement(): HTMLElement {
        return this.element;
    }
}

class SelectedBlocksManager {
    private selectedBlocks: Set<Block> = new Set();

    select(block: Block): void {
        if (!this.selectedBlocks.has(block)) {
            this.selectedBlocks.add(block);
            block.getElement().classList.add('selected');
        }
    }

    unselect(block: Block): void {
        if (this.selectedBlocks.has(block)) {
            this.selectedBlocks.delete(block);
            block.getElement().classList.remove('selected');
        }
    }

    toggle(block: Block): void {
        if (this.selectedBlocks.has(block)) {
            this.unselect(block);
        } else {
            this.select(block);
        }
    }

    clear(): void {
        this.selectedBlocks.forEach(block => {
            block.getElement().classList.remove('selected');
        });
        this.selectedBlocks.clear();
    }

    getAll(): Set<Block> {
        return this.selectedBlocks;
    }
}

(function () {
    const container = document.querySelector('.notes') as HTMLElement;

    let blocks: Block[] = [];
    const selectedBlocksManager = new SelectedBlocksManager();

    let dragStartX = 0;
    let dragStartY = 0;
    let isDragging = false;
    let selectionBox: HTMLElement | null = null;

    function createBlock(id: string, label: string, x: number, y: number): void {
        const block = new Block(id, label, x, y, onClick, onMouseDown);
        blocks.push(block);
        container.appendChild(block.getElement());
    }


    function onClick(block: Block, e: MouseEvent): void {
        vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
        if (e.shiftKey) {
            // Toggle selection if Shift is pressed
            selectedBlocksManager.toggle(block);
        } else {
            // Clear selection and select only this block
            selectedBlocksManager.clear();
            selectedBlocksManager.select(block);
        }
    }

    function onMouseDown(block: Block, e: MouseEvent): void {
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

    function onMouseMove(e: MouseEvent): void {
        if (isDragging) {
            // Move all selected blocks
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            selectedBlocksManager.getAll().forEach(block => {
                block.move(deltaX, deltaY);
            });

            dragStartX = e.clientX;
            dragStartY = e.clientY;
        } else if (selectionBox) {
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

    function onMouseUp(): void {
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
        } else if (selectionBox) {
            // End box selection
            container.removeChild(selectionBox);
            selectionBox = null;
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    function startBoxSelection(e: MouseEvent): void {
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

    function updateSelectionBox(): void {
        const boxRect = selectionBox!.getBoundingClientRect();

        blocks.forEach(block => {
            const blockEl = block.getElement();
            const blockRect = blockEl.getBoundingClientRect();

            if (
                blockRect.left < boxRect.right &&
                blockRect.right > boxRect.left &&
                blockRect.top < boxRect.bottom &&
                blockRect.bottom > boxRect.top
            ) {
                selectedBlocksManager.select(block);
            } else {
                selectedBlocksManager.unselect(block);
            }
        });
    }

    function updateBlocks(jsonText: string): void {
        let json: { blocks?: { id: string; label: string; x: number; y: number }[] };
        try {
            json = JSON.parse(jsonText || '{}');
        } catch {
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
    window.addEventListener('message', (e: MessageEvent) => {
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