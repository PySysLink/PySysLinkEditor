declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

class Block {
    id: string;
    label: string;
    private x: number;
    private y: number;
    private element: HTMLElement;
    _isSelected: boolean = false;


    constructor(id: string, label: string, x: number, y: number, onClick: (block: Block, e: MouseEvent) => void, onMouseDown: (block: Block, e: MouseEvent) => void) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;

        // Create the DOM element for the block
        this.element = this.createElement(onClick, onMouseDown);
    }

    public setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        
    }

    public getState(): { type: string; id: string; x: number; y: number}[] {
        return [{
            type: 'move',
            id: this.id,
            x: this.x,
            y: this.y
        }];
    }

    public parseStateFromJson(blockData: { x: number; y: number; label: string }): void {
        this.setPosition(blockData.x, blockData.y);
        this.label = blockData.label;
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    public select(): void {
        this._isSelected = true;
        this.element.classList.add('selected');
    }

    public unselect(): void {
        if (this._isSelected) {
            vscode.postMessage({ type: 'print', text: `block unselected: ${this.label}` });
        }
        this._isSelected = false;
        this.element.classList.remove('selected');
    }

    public isSelected(): boolean {
        return this._isSelected;
    }

    public toggleSelect(): void {
        this._isSelected = !this._isSelected;
        if (this._isSelected) {
            this.select();
        } else {
            this.unselect();
        }
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


    public move(deltaX: number, deltaY: number): void {
        this.setPosition(this.x + deltaX, this.y + deltaY);
    }

    getElement(): HTMLElement {
        return this.element;
    }

    public addElementToContainer(container: HTMLElement): void {
        container.appendChild(this.element);
    }
}


(function () {
    const container = document.querySelector('.notes') as HTMLElement;

    let blocks: Block[] = [];

    let dragStartX = 0;
    let dragStartY = 0;

    let dragThreshold = 5; // Minimum distance to detect a drag
    let isDragging = false;
    let selectionBox: HTMLElement | null = null;

    function createBlock(id: string, label: string, x: number, y: number): void {
        const block = new Block(id, label, x, y, onClick, onMouseDown);
        blocks.push(block);
    }
    

    function unselectAll(): void {
        blocks.forEach(block => block.unselect());
    }
    
    function getSelectedBlocks(): Block[] {
        return blocks.filter(block => block.isSelected());
    }


    function onClick(block: Block, e: MouseEvent): void {
        vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
    }

    function onMouseDown(block: Block, e: MouseEvent): void {
        vscode.postMessage({ type: 'print', text: `Mouse down on block: ${block.label}` });
    
        // Store the initial mouse position
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        isDragging = false; // Reset dragging state
    
        // Add a temporary mousemove listener to detect drag threshold
        const onMouseMoveThreshold = (moveEvent: MouseEvent) => {
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
                // If no drag occurred, treat it as a simple click
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    block.toggleSelect();
                } else {
                    // Clear selection and select only this block
                    unselectAll();
                    block.select();
                }
            }
        };
    
        document.addEventListener('mouseup', onMouseUpThreshold);
    }

    function onMouseDownInContainer(e: MouseEvent): void {
        if (e.target !== container) {
            return; // Ignore clicks on child elements
        }
        startBoxSelection(e);
    }

    function onMouseUp(): void {
        vscode.postMessage({ type: 'print', text: `Mouse up` });

        if (isDragging) {
            isDragging = false;
            const stateMessages = getSelectedBlocks().flatMap(block => block.getState());

            stateMessages.forEach(message => {
                vscode.postMessage({ type: 'print', text: message});
            }); 

            
            vscode.postMessage({ type: 'moveBatch', updates: stateMessages });

        } else if (selectionBox) {
            // End box selection
            container.removeChild(selectionBox);
            selectionBox = null;
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e: MouseEvent): void {
        if (isDragging) {
            // Move all selected blocks
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            getSelectedBlocks().forEach(block => {
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


    function startBoxSelection(e: MouseEvent): void {
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
                block.select();
            } else {
                block.unselect();
            }
        });
    }

    function renderHTML(blocks: Block[]): void {
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

    function updateBlocks(jsonText: string): void {
        let json: { blocks?: { id: string; label: string; x: number; y: number }[] };
        try {
            json = JSON.parse(jsonText || '{}');
        } catch {
            container.textContent = 'Invalid JSON';
            return;
        }

        json.blocks?.forEach(blockData => {
            blocks.find(b => b.id === blockData.id)?.move(blockData.x, blockData.y);
            var block = blocks.find(b => b.id === blockData.id);
            if (block) {
                block.parseStateFromJson(blockData);
            } else {
                vscode.postMessage({ type: 'print', text: `Block ID does not exist, creating block: ${blockData.id}` });
                createBlock(blockData.id, blockData.label, blockData.x, blockData.y);
            }
        });

        renderHTML(blocks);
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