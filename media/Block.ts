export class Block {
    id: string;
    label: string;
    private x: number;
    private y: number;
    private element: HTMLElement;
    _isSelected: boolean = false;

    inputPorts: number;
    outputPorts: number;


    constructor(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number, onClick: (block: Block, e: MouseEvent) => void, onMouseDown: (block: Block, e: MouseEvent) => void) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;

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
        const blockElement = document.createElement('div');
        blockElement.classList.add('block');
        blockElement.style.left = `${this.x}px`;
        blockElement.style.top = `${this.y}px`;
        
        const label = document.createElement('div');
        label.textContent = this.label;
        blockElement.appendChild(label);

        for (let i = 0; i < this.inputPorts; i++) {
            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.textContent = `In ${i + 1}`;
            blockElement.appendChild(inputPort);
        }
    
        // Add output ports
        for (let i = 0; i < this.outputPorts; i++) {
            const outputPort = document.createElement('div');
            outputPort.classList.add('output-port');
            outputPort.textContent = `Out ${i + 1}`;
            blockElement.appendChild(outputPort);
        }

        // Attach event listeners
        blockElement.addEventListener('click', (e: MouseEvent) => onClick(this, e));
        blockElement.addEventListener('mousedown', (e: MouseEvent) => onMouseDown(this, e));

        return blockElement;
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

    public getPortPosition(portIndex: number, portType: "input" | "output"): { x: number; y: number } {
        const portSpacing = 20; // Spacing between ports
        const portOffset = portIndex * portSpacing;
    
        // Get the block's position relative to the canvas
        const blockX = this.x;
        const blockY = this.y;
    
        // Adjust for the port type
        if (portType === "input") {
            return { x: blockX, y: blockY + portOffset };
        } else {
            return { x: blockX + this.element.offsetWidth, y: blockY + portOffset };
        }
    }
}