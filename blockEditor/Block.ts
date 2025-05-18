import { BlockData } from "../shared/JsonTypes";
import { Movable } from "./Movable";
import { Selectable } from "./Selectable";

export class Block extends Selectable implements Movable {
    id: string;
    label: string;
    private x: number;
    private y: number;
    _isSelected: boolean = false;

    public getElement(): HTMLElement | SVGElement {
        this.updatePortPositions();
        return this.element;
    }
    private element: HTMLElement;

    inputPortNumber: number;
    outputPortNumber: number;
    inputPorts: HTMLElement[] = [];
    outputPorts: HTMLElement[] = [];

    labelElement: HTMLElement;

    onMouseDownOnPortCallbacks: ((e: any, portType: "input" | "output", portIndex: number) => void)[] = [];

    private onDelete: (block: Block) => void;
    private onUpdate: (blockData: BlockData) => void;

    constructor(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number, onDelete: (block: Block) => void, onUpdate: (blockData: BlockData) => void) {
        super();
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.inputPortNumber = inputPorts;
        this.outputPortNumber = outputPorts;
        this.onDelete = onDelete;
        this.onUpdate = onUpdate;

        this.element = document.createElement('div');
        
        this.element.classList.add('block');
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
        
        this.labelElement = document.createElement('div');
        this.labelElement.textContent = this.label;
        this.element.appendChild(this.labelElement);

        for (let j = 0; j < this.inputPortNumber; j++) {
            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.textContent = `In ${j + 1}`;

            inputPort.addEventListener('mousedown', (e: any) => {
                this.onMouseDownInPort(e, "input", j);
            });

            this.element.appendChild(inputPort);
            this.inputPorts.push(inputPort);
        }
    
        // Add output ports
        for (let i = 0; i < this.outputPortNumber; i++) {
            const outputPort = document.createElement('div');
            outputPort.classList.add('output-port');
            outputPort.textContent = `Out ${i + 1}`;
            
            outputPort.addEventListener('mousedown', (e: any) => {
                this.onMouseDownInPort(e, "output", i);
            });

            this.element.appendChild(outputPort);
            this.outputPorts.push(outputPort);
        }

        this.onUpdate(this.toBlockData());
    }

    private toBlockData(): BlockData {
        return {
            id: this.id,
            label: this.label,
            x: this.x,
            y: this.y,
            inputPorts: this.inputPortNumber,
            outputPorts: this.outputPortNumber,
            properties: {}
        };
    }

    private onMouseDownInPort(e: any, portType: "input" | "output", portIndex: number): void {
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (e: any, portType: "input" | "output", portIndex: number) => void): void {
        this.onMouseDownOnPortCallbacks.push(callback);
    }

    public moveTo(x: number, y: number): void {
        this.x = x;
        this.y = y;
        if (this.element) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }
        this.onUpdate(this.toBlockData());
    }

    public parseStateFromJson(blockData: { x: number; y: number; label: string }): void {
        this.moveTo(blockData.x, blockData.y);
        this.label = blockData.label;
        this.labelElement.textContent = this.label;
        this.onUpdate(this.toBlockData());
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    public moveDelta(deltaX: number, deltaY: number): void {
        this.moveTo(this.x + deltaX, this.y + deltaY);
    }

    private updatePortPositions(): void {
        for (let j = 0; j < this.inputPortNumber; j++) {
            const inputPort = this.inputPorts[j];

            const position = this.getPortPosition(j, "input");
            inputPort.style.left = `${position.x - this.x - inputPort.offsetWidth/4}px`;
            inputPort.style.top = `${position.y - this.y - inputPort.offsetHeight/2}px`;
        }
    
        // Add output ports
        for (let i = 0; i < this.outputPortNumber; i++) {
            const outputPort = this.outputPorts[i];
           
            const position = this.getPortPosition(i, "output");
            outputPort.style.left = `${position.x - this.x - 3*outputPort.offsetWidth/4}px`;
            outputPort.style.top = `${position.y - this.y - outputPort.offsetHeight/2}px`;
        }
    }

    public getPortPosition(portIndex: number, portType: "input" | "output"): { x: number; y: number } {
        const portSpacing = 20; // Spacing between ports
        const portOffset = portIndex * portSpacing;
    
        // Get the block's position relative to the canvas
        const blockX = this.x;
        const blockY = this.y;
    
        // Adjust for the port type
        if (portType === "input") {
            return { x: blockX, y: blockY + portOffset + 20 };
        } else {
            if (this.element) {
                return { x: blockX + this.element.offsetWidth, y: blockY + portOffset + 20 };
            }
            else {
                return { x: blockX + 20, y: blockY + portOffset + 20};
            }
        }
    }

    public delete(): void {
        // Remove the block's DOM element from the canvas
        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }

        // Notify any managers or listeners that the block has been deleted
        // (e.g., remove it from a block manager or update links)
        this.onDelete(this);
    }
}