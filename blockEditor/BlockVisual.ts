import { BlockData, IdType, JsonData } from "../shared/JsonTypes";
import { CommunicationManager } from "./CommunicationManager";
import { Movable } from "./Movable";
import { Selectable } from "./Selectable";

export class BlockVisual extends Selectable implements Movable {
    id: string;
    _isSelected: boolean = false;

    public getElement(): HTMLElement | SVGElement {
        return this.element;
    }

    public getId(): IdType {
        return this.id;    
    }

    private element: HTMLElement;

    inputPortNumber: number;
    outputPortNumber: number;
    inputPorts: HTMLElement[] = [];
    outputPorts: HTMLElement[] = [];

    labelElement: HTMLElement;

    onMouseDownOnPortCallbacks: ((e: any, portType: "input" | "output", portIndex: number) => void)[] = [];

    private onDelete: (block: BlockVisual) => void;

    constructor(blockData: BlockData, communicationManager: CommunicationManager, onDelete: (block: BlockVisual) => void) {
        super();
        this.id = blockData.id;
        this.inputPortNumber = blockData.inputPorts;
        this.outputPortNumber = blockData.outputPorts;
        this.onDelete = onDelete;

        this.element = document.createElement('div');
        
        this.element.classList.add('block');
        
        this.labelElement = document.createElement('div');
        this.element.appendChild(this.labelElement);

        const portWidth = 40;
        const portHeigh = 20;

        for (let j = 0; j < this.inputPortNumber; j++) {
            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.textContent = `In ${j + 1}`;

            const position = communicationManager.getPortPosition(this.id, "input", j);
            const thisPosition = this.getPosition(communicationManager);
            if (position && thisPosition) {
                inputPort.style.left = `${position.x - thisPosition.x - portWidth/4}px`;
                inputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
            }
            
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

            const position = communicationManager.getPortPosition(this.id, "output", i);
            const thisPosition = this.getPosition(communicationManager);
            if (position && thisPosition) {
                outputPort.style.left = `${position.x - thisPosition.x - 3*portWidth/4}px`;
                outputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
            }

            outputPort.addEventListener('mousedown', (e: any) => {
                this.onMouseDownInPort(e, "output", i);
            });

            this.element.appendChild(outputPort);
            this.outputPorts.push(outputPort);
        }
    }
    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.moveBlock(this.id, x, y);
    }

    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let position = this.getPosition(communicationManager);
        if (position) {
            const newX = position.x + deltaX;
            const newY = position.y + deltaY;
            this.moveTo(newX, newY, communicationManager, selectables);
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


    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const blockData = json.blocks?.find((block: BlockData) => block.id === this.id);
        if (blockData) {
            this.labelElement.textContent = blockData.label;
            this.element.style.left = `${blockData.x}px`;
            this.element.style.top = `${blockData.y}px`;

            // --- Update ports if the amount has changed ---
            const portWidth = 40;
            const portHeigh = 20;

            // Remove old input ports if count changed
            if (blockData.inputPorts !== this.inputPortNumber) {
                // Remove old input port elements from DOM
                this.inputPorts.forEach(portEl => this.element.removeChild(portEl));
                this.inputPorts = [];
                this.inputPortNumber = blockData.inputPorts;

                // Add new input ports
                for (let j = 0; j < this.inputPortNumber; j++) {
                    const inputPort = document.createElement('div');
                    inputPort.classList.add('input-port');
                    inputPort.textContent = `In ${j + 1}`;

                    const position = communicationManager.getPortPosition(this.id, "input", j);
                    const thisPosition = this.getPosition(communicationManager);
                    if (position && thisPosition) {
                        inputPort.style.left = `${position.x - thisPosition.x - portWidth/4}px`;
                        inputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
                    }

                    inputPort.addEventListener('mousedown', (e: any) => {
                        this.onMouseDownInPort(e, "input", j);
                    });

                    this.element.appendChild(inputPort);
                    this.inputPorts.push(inputPort);
                }
            }

            // Remove old output ports if count changed
            if (blockData.outputPorts !== this.outputPortNumber) {
                // Remove old output port elements from DOM
                this.outputPorts.forEach(portEl => this.element.removeChild(portEl));
                this.outputPorts = [];
                this.outputPortNumber = blockData.outputPorts;

                // Add new output ports
                for (let i = 0; i < this.outputPortNumber; i++) {
                    const outputPort = document.createElement('div');
                    outputPort.classList.add('output-port');
                    outputPort.textContent = `Out ${i + 1}`;

                    const position = communicationManager.getPortPosition(this.id, "output", i);
                    const thisPosition = this.getPosition(communicationManager);
                    if (position && thisPosition) {
                        outputPort.style.left = `${position.x - thisPosition.x - 3*portWidth/4}px`;
                        outputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
                    }

                    outputPort.addEventListener('mousedown', (e: any) => {
                        this.onMouseDownInPort(e, "output", i);
                    });

                    this.element.appendChild(outputPort);
                    this.outputPorts.push(outputPort);
                }
            }
        }
    }

    public delete(communicationManager: CommunicationManager): void {
        communicationManager.deleteBlock(this.id);
        this.onDelete(this);
    }
}