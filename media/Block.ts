import { Movable } from "./Movable";
import { Selectable } from "./Selectable";

export class Block extends Selectable implements Movable {
    id: string;
    label: string;
    private x: number;
    private y: number;
    _isSelected: boolean = false;

    public getElement(): HTMLElement | SVGElement {
        return this.element;
    }
    private element: HTMLElement;

    inputPorts: number;
    outputPorts: number;


    constructor(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number) {
        super();
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;

        // Create the DOM element for the block
        this.element = this.createElement();
    }

    public moveTo(x: number, y: number): void {
        this.x = x;
        this.y = y;
        if (this.element) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }
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
        this.moveTo(blockData.x, blockData.y);
        this.label = blockData.label;
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    private createElement(): HTMLElement {
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

        return blockElement;
    }


    public moveDelta(deltaX: number, deltaY: number): void {
        this.moveTo(this.x + deltaX, this.y + deltaY);
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
            if (this.element) {
                return { x: blockX + this.element.offsetWidth, y: blockY + portOffset };
            }
            else {
                return { x: blockX + 20, y: blockY + portOffset };
            }
        }
    }
}