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

    inputPortNumber: number;
    outputPortNumber: number;
    inputPorts: HTMLElement[] = [];
    outputPorts: HTMLElement[] = [];


    constructor(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number) {
        super();
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.inputPortNumber = inputPorts;
        this.outputPortNumber = outputPorts;

        const blockElement = document.createElement('div');
        this.element = blockElement;
        blockElement.classList.add('block');
        blockElement.style.left = `${this.x}px`;
        blockElement.style.top = `${this.y}px`;
        
        const labelElement = document.createElement('div');
        labelElement.textContent = this.label;
        blockElement.appendChild(labelElement);

        for (let j = 0; j < this.inputPortNumber; j++) {
            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.textContent = `In ${j + 1}`;

            const position = this.getPortPosition(j, "input");
            inputPort.style.position = "relative";
            inputPort.style.left = `${position.x - this.x}px`;
            inputPort.style.top = `${position.y - this.y}px`;
            blockElement.appendChild(inputPort);
            this.inputPorts.push(inputPort);
        }
    
        // Add output ports
        for (let i = 0; i < this.outputPortNumber; i++) {
            const outputPort = document.createElement('div');
            outputPort.classList.add('output-port');
            outputPort.textContent = `Out ${i + 1}`;
           
            const position = this.getPortPosition(i, "output");
            outputPort.style.position = "relative";
            outputPort.style.left = `${position.x - this.x}px`;
            outputPort.style.top = `${position.y - this.y}px`;
            blockElement.appendChild(outputPort);
            this.outputPorts.push(outputPort);
        }
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
            return { 
                x: blockX - 5, // Position input ports slightly to the left of the block
                y: blockY + portOffset + 5 // Offset vertically based on the index
            };
        } else {
            return { 
                x: blockX + 140 + 5, // Position output ports slightly to the right of the block
                y: blockY + portOffset + 5 // Offset vertically based on the index
            };
        }
    }
}