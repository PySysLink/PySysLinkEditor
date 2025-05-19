import { BlockData, JsonData } from "../shared/JsonTypes";
import { CommunicationManager } from "./CommunicationManager";
import { Movable } from "./Movable";
import { Selectable } from "./Selectable";

export class BlockVisual extends Selectable implements Movable {
    id: string;
    _isSelected: boolean = false;

    public getElement(): HTMLElement | SVGElement {
        return this.element;
    }
    private element: HTMLElement;

    inputPortNumber: number;
    outputPortNumber: number;
    inputPorts: HTMLElement[] = [];
    outputPorts: HTMLElement[] = [];

    labelElement: HTMLElement;

    onMouseDownOnPortCallbacks: ((e: any, portType: "input" | "output", portIndex: number) => void)[] = [];

    private onDelete: (block: BlockVisual) => void;

    constructor(blockData: BlockData, onDelete: (block: BlockVisual) => void) {
        super();
        this.id = blockData.id;
        this.inputPortNumber = blockData.inputPorts;
        this.outputPortNumber = blockData.outputPorts;
        this.onDelete = onDelete;

        this.element = document.createElement('div');
        
        this.element.classList.add('block');
        
        this.labelElement = document.createElement('div');
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
    }
    moveTo(x: number, y: number, communicationManager: CommunicationManager): void {
        communicationManager.moveBlock(this.id, x, y);
    }

    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager): void {
        let position = this.getPosition(communicationManager);
        if (position) {
            const newX = position.x + deltaX;
            const newY = position.y + deltaY;
            this.moveTo(newX, newY, communicationManager);
        }
    }

    getPosition(communicationManager: CommunicationManager): { x: number, y: number } | undefined {
        const blockData = communicationManager.getLocalJson()?.blocks?.find((block: BlockData) => block.id === this.id);
        if (blockData) {
            return { x: blockData.x, y: blockData.y };
        }
        return undefined;
    }

    private onMouseDownInPort(e: any, portType: "input" | "output", portIndex: number): void {
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (e: any, portType: "input" | "output", portIndex: number) => void): void {
        this.onMouseDownOnPortCallbacks.push(callback);
    }


    public updateFromJson(json: JsonData): void {
        const blockData = json.blocks?.find((block: BlockData) => block.id === this.id);
        if (blockData) {
            this.labelElement.textContent = blockData.label;
            this.element.style.left = `${blockData.x}px`;
            this.element.style.top = `${blockData.y}px`;
        }
    }

    public delete(): void {
        this.onDelete(this);
    }
}