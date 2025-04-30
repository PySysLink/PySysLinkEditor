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

    public addElementToCanvas(canvas: HTMLElement): void {
        canvas.appendChild(this.element);
    }
}

class Link {
    sourceId: string;
    targetId: string;
    private lineElement: SVGLineElement;

    constructor(sourceId: string, targetId: string) {
        this.sourceId = sourceId;
        this.targetId = targetId;

        // Create the SVG line element
        this.lineElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
        this.lineElement.setAttribute("stroke", "#007acc");
        this.lineElement.setAttribute("stroke-width", "2");
    }

    updatePosition(blocks: Block[]): void {
        const sourceBlock = blocks.find(block => block.id === this.sourceId);
        const targetBlock = blocks.find(block => block.id === this.targetId);

        if (sourceBlock && targetBlock) {
            const sourcePos = sourceBlock.getPosition();
            const targetPos = targetBlock.getPosition();

            this.lineElement.setAttribute("x1", `${sourcePos.x}`); // Adjust for block center
            this.lineElement.setAttribute("y1", `${sourcePos.y}`);
            this.lineElement.setAttribute("x2", `${targetPos.x}`);
            this.lineElement.setAttribute("y2", `${targetPos.y}`);
        }
    }

    addToSvg(svg: SVGSVGElement): void {
        svg.appendChild(this.lineElement);
    }

    removeFromSvg(svg: SVGSVGElement): void {
        svg.removeChild(this.lineElement);
    }
}


(function () {
    const canvas = document.querySelector('.canvas') as HTMLElement;
    const zoomContainer = document.querySelector('.zoom-container') as HTMLElement;
    const topControls = document.querySelector('.top-controls') as HTMLElement;
    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
    const linksSvg = document.querySelector('.links') as SVGSVGElement;

    let blocks: Block[] = [];
    const links: Link[] = [];

    let dragStartX = 0;
    let dragStartY = 0;

    let dragThreshold = 5; // Minimum distance to detect a drag
    let isDragging = false;
    let selectionBox: HTMLElement | null = null;

    let zoomLevel = 2; // Default zoom level
    const zoomStep = 0.1; // Step for zooming in/out
    const minZoom = 1; // Minimum zoom level
    const maxZoom = 4; // Maximum zoom level


    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    let canvasHeigh = 4000;
    let canvasWidth = 8000;

    function getZoomLevelReal(): number {
        return zoomLevel/2;
    }

    function createLink(sourceId: string, targetId: string): void {
        const link = new Link(sourceId, targetId);
        links.push(link);
        link.addToSvg(linksSvg);
    }
    
    function updateLinks(): void {
        links.forEach(link => link.updatePosition(blocks));
    }

    function deleteLink(link: Link): void {
        link.removeFromSvg(linksSvg);
        const index = links.indexOf(link);
        if (index !== -1) {
            links.splice(index, 1);
        }
    }

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
        if (e.button !== 1) {
            vscode.postMessage({ type: 'print', text: `Mouse down on block: ${block.label}` });
            if (!block.isSelected()) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    block.toggleSelect();
                } else {
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
                    vscode.postMessage({ type: 'print', text: `As simple click on: ${block.label}` });

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
    }

    function onMouseDownInCanvas(e: MouseEvent): void {
        if (e.button !== 1) {
            if (e.target !== canvas) {
                return; // Ignore clicks on child elements
            }
            startBoxSelection(e);
        }
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
            canvas.removeChild(selectionBox);
            selectionBox = null;
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e: MouseEvent): void {
        const scaledDeltaX = (e.clientX - dragStartX) / getZoomLevelReal();
        const scaledDeltaY = (e.clientY - dragStartY) / getZoomLevelReal();

        if (isDragging) {
            getSelectedBlocks().forEach(block => {
                block.move(scaledDeltaX, scaledDeltaY);
            });

            dragStartX = e.clientX;
            dragStartY = e.clientY;

            updateLinks();

        } else if (selectionBox) {
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


    function startBoxSelection(e: MouseEvent): void {
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

    function createRandomLink(): void {
        if (blocks.length < 2) {
            vscode.postMessage({ type: 'print', text: 'Not enough blocks to create a link.' });
            return;
        }
    
        // Randomly select two different blocks
        const sourceIndex = Math.floor(Math.random() * blocks.length);
        let targetIndex = Math.floor(Math.random() * blocks.length);
    
        // Ensure the source and target are not the same
        while (targetIndex === sourceIndex) {
            targetIndex = Math.floor(Math.random() * blocks.length);
        }
    
        const sourceBlock = blocks[sourceIndex];
        const targetBlock = blocks[targetIndex];
    
        // Create a link between the two blocks
        createLink(sourceBlock.id, targetBlock.id);
    
        vscode.postMessage({ type: 'print', text: `Created link between ${sourceBlock.label} and ${targetBlock.label}` });
    }

    function renderHTML(blocks: Block[]): void {
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

        // Add button to create a link
        const btnCreateLink = document.createElement('button');
        btnCreateLink.textContent = 'Create Link';
        btnCreateLink.addEventListener('click', createRandomLink);
        topControls.appendChild(btnCreateLink);

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

        zoomContainer.addEventListener('wheel', handleMouseWheelZoom);
        canvasContainer.addEventListener('mousedown', onMouseDownForPanning);

        centerCanvas();

        setZoom(zoomLevel);
    }

    function centerCanvas(): void {
        // Scroll to the center of the canvas
        // canvasContainer.scrollLeft = (canvas.scrollWidth - canvasContainer.clientWidth) / 2;
        // canvasContainer.scrollTop = (canvas.scrollHeight - canvasContainer.clientHeight) / 2;
    }

    function updateBlocks(jsonText: string): void {
        let json: { blocks?: { id: string; label: string; x: number; y: number }[] };
        try {
            json = JSON.parse(jsonText || '{}');
        } catch {
            canvas.textContent = 'Invalid JSON';
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


    function setZoom(level: number): void {
    
        // Clamp the zoom level between minZoom and maxZoom
        zoomLevel = Math.min(maxZoom, Math.max(minZoom, level));
        zoomContainer.style.transform = `scale(${zoomLevel})`;

        // Dynamically adjust the canvas size based on the zoom level
        const scaledWidth = Math.min(canvasWidth/2 * zoomLevel, canvasWidth/2); 
        const scaledHeight = Math.min(canvasHeigh/2 * zoomLevel, canvasHeigh/2);
    
        zoomContainer.style.width = `${scaledWidth}px`;
        zoomContainer.style.height = `${scaledHeight}px`;
       
        vscode.postMessage({ type: 'print', text: `Zoom level: ${zoomLevel}` });
    }

    function handleMouseWheelZoom(e: WheelEvent): void {
        e.preventDefault(); // Prevent default scrolling behavior

        // Adjust zoom level based on scroll direction
        if (e.deltaY < 0) {
            setZoom(zoomLevel + zoomStep); // Zoom in
        } else if (e.deltaY > 0) {
            setZoom(zoomLevel - zoomStep); // Zoom out
        }
    }

    function onMouseDownForPanning(e: MouseEvent): void {
        if (e.button === 1) { // Middle mouse button
            e.preventDefault(); // Prevent default middle mouse behavior (e.g., auto-scroll)
            isPanning = true;
            canvasContainer.classList.add('panning'); // Add the class

            // Store the initial mouse position
            panStartX = e.clientX;
            panStartY = e.clientY;
    
            // Add event listeners for mousemove and mouseup
            document.addEventListener('mousemove', onMouseMoveForPanning);
            document.addEventListener('mouseup', onMouseUpForPanning);
        }
    }

    function onMouseMoveForPanning(e: MouseEvent): void {
        if (!isPanning) return;
    
        // Calculate the distance moved
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;
    
        // Adjust the scroll position of the canvasContainer
        canvasContainer.scrollLeft -= deltaX;
        canvasContainer.scrollTop -= deltaY;
    
        // Update the starting position for the next movement
        panStartX = e.clientX;
        panStartY = e.clientY;
    }
    
    function onMouseUpForPanning(e: MouseEvent): void {
        if (e.button === 1) { // Middle mouse button
            isPanning = false;
            canvasContainer.classList.remove('panning'); // Remove the class

            // Remove the event listeners
            document.removeEventListener('mousemove', onMouseMoveForPanning);
            document.removeEventListener('mouseup', onMouseUpForPanning);
        }
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