import { BlockData, BlockRenderInformation, IdType, JsonData, Rotation } from "../shared/JsonTypes";
import { CommunicationManager } from "./CommunicationManager";
import { Movable } from "./Movable";
import { Rotatable } from "./Rotatable";
import { Selectable } from "./Selectable";

export class BlockVisual extends Selectable implements Movable, Rotatable {
    id: string;
    _isSelected: boolean = false;

    public getElement(): HTMLElement | SVGElement {
        return this.blockElement;
    }

    public getId(): IdType {
        return this.id;    
    }

    private blockElement: HTMLElement;
    private labelElement: HTMLElement;
    private contentElement: HTMLElement;


    inputPortNumber: number;
    outputPortNumber: number;
    inputPorts: HTMLElement[] = [];
    outputPorts: HTMLElement[] = [];


    onMouseDownOnPortCallbacks: ((e: any, portType: "input" | "output", portIndex: number) => void)[] = [];
    
    onDoubleClickCallbacks: ((e: MouseEvent, block: BlockVisual) => void)[] = [];

    private onDelete: (block: BlockVisual) => void;

    constructor(blockData: BlockData, communicationManager: CommunicationManager, onDelete: (block: BlockVisual) => void) {
        super();
        this.id = blockData.id;
        this.inputPortNumber = blockData.inputPorts;
        this.outputPortNumber = blockData.outputPorts;
        this.onDelete = onDelete;


        // Create block shape element
        this.blockElement = document.createElement('div');
        this.blockElement.classList.add('block');
        this.blockElement.style.position = 'absolute';


        // Content container inside the block
        this.contentElement = document.createElement('div');
        this.contentElement.classList.add('block-content');
        this.blockElement.appendChild(this.contentElement);
        
        this.applyRenderInfo(blockData.blockRenderInformation);

        // Create external label
        this.labelElement = document.createElement('div');
        this.labelElement.classList.add('block-label');
        this.labelElement.textContent = blockData.label;

        // Assemble
        this.blockElement.appendChild(this.labelElement);

        this.blockElement.addEventListener('dblclick', (e: MouseEvent) => {
            this.onDoubleClickCallbacks.forEach(cb => cb(e, this));
        });

        const portWidth = 40;
        const portHeigh = 20;

        for (let j = 0; j < this.inputPortNumber; j++) {
            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.textContent = `In ${j + 1}`;

            const position = communicationManager.getPortPosition(this.id, "input", j, true);
            const thisPosition = this.getPosition(communicationManager);
            if (position && thisPosition) {
                inputPort.style.left = `${position.x - thisPosition.x - portWidth/4}px`;
                inputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
            }
            
            inputPort.addEventListener('mousedown', (e: any) => {
                this.onMouseDownInPort(e, "input", j);
            });

            this.blockElement.appendChild(inputPort);
            this.inputPorts.push(inputPort);
        }
    
        // Add output ports
        for (let i = 0; i < this.outputPortNumber; i++) {
            const outputPort = document.createElement('div');
            outputPort.classList.add('output-port');
            outputPort.textContent = `Out ${i + 1}`;

            const position = communicationManager.getPortPosition(this.id, "output", i, true);
            const thisPosition = this.getPosition(communicationManager);
            if (position && thisPosition) {
                outputPort.style.left = `${position.x - thisPosition.x - 3*portWidth/4}px`;
                outputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
            }

            outputPort.addEventListener('mousedown', (e: any) => {
                this.onMouseDownInPort(e, "output", i);
            });

            this.blockElement.appendChild(outputPort);
            this.outputPorts.push(outputPort);
        }
    }
    getRotation(communicationManager: CommunicationManager): Rotation {
        const blockData = communicationManager.getLocalJson()?.blocks?.find((block: BlockData) => block.id === this.id);
        return blockData?.rotation ?? 0; // Default rotation is 0 if not found
    }

    applyRotation(rotation: Rotation, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.rotateBlock(this.id, rotation);
    }
    rotateClockwise(communicationManager: CommunicationManager, selectables: Selectable[]): void {
        const currentRotation = this.getRotation(communicationManager);
        let newRotation: Rotation = 0;
        if (currentRotation === 270) {
            newRotation = 0;
        } else if (currentRotation === 0) {
            newRotation = 90;
        } else if (currentRotation === 90) {
            newRotation = 180;
        } else if (currentRotation === 180) {
            newRotation = 270;
        }
        this.applyRotation(newRotation, communicationManager, selectables);
    }
    rotateCounterClockwise(communicationManager: CommunicationManager, selectables: Selectable[]): void {
        const currentRotation = this.getRotation(communicationManager);
        let newRotation: Rotation = 0;
        if (currentRotation === 0) {
            newRotation = 270;
        } else if (currentRotation === 90) {
            newRotation = 0;
        } else if (currentRotation === 180) {
            newRotation = 90;
        } else if (currentRotation === 270) {
            newRotation = 180;
        }
        this.applyRotation(newRotation, communicationManager, selectables);
    }

    private applyRenderInfo(renderInfo?: BlockRenderInformation | null) {
        if (!renderInfo) {return;}
        // Shape classes: square, circle, triangle
        this.blockElement.classList.add(`block--${renderInfo.shape}`);

        // Size constraints
        this.blockElement.style.width = `${renderInfo.default_width}px`;
        this.blockElement.style.height = `${renderInfo.default_height}px`;
        this.blockElement.style.minWidth = `${renderInfo.min_width}px`;
        this.blockElement.style.minHeight = `${renderInfo.min_height}px`;
        this.blockElement.style.maxWidth = `${renderInfo.max_width}px`;
        this.blockElement.style.maxHeight = `${renderInfo.max_height}px`;

        // Content: icon, text, both
        this.contentElement.innerHTML = '';
        if (renderInfo.icon) {
            const img = document.createElement('img');
            img.src = renderInfo.icon;
            img.classList.add('block-icon');
            this.contentElement.appendChild(img);
        }
        if (renderInfo.show_image_and_text && renderInfo.icon && renderInfo.text) {
            const txt = document.createElement('div');
            txt.classList.add('block-text');
            txt.textContent = renderInfo.text;
            this.contentElement.appendChild(txt);
        } else if (!renderInfo.icon && renderInfo.text) {
            const txt = document.createElement('div');
            txt.classList.add('block-text');
            txt.textContent = renderInfo.text;
            this.contentElement.appendChild(txt);
        }

        if (renderInfo.shape === "circle") {
            this.blockElement.classList.add('block--circle');
        }
        else if (renderInfo.shape === "triangle") {
            this.blockElement.classList.add('block--triangle');
        }
        else {
            this.blockElement.classList.add('block--square');
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

    public registerOnDoubleClickCallback(callback: (e: MouseEvent, block: BlockVisual) => void): void {
        this.onDoubleClickCallbacks.push(callback);
    }


    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const blockData = json.blocks?.find((block: BlockData) => block.id === this.id);
        if (blockData) {
            this.labelElement.textContent = blockData.label;
            this.blockElement.style.left = `${blockData.x}px`;
            this.blockElement.style.top = `${blockData.y}px`;
            this.blockElement.style.transform = `rotate(${blockData.rotation}deg)`;
            this.blockElement.style.transformOrigin = "center center";


            // --- Update ports if the amount has changed ---
            const portWidth = 40;
            const portHeigh = 20;

            this.applyRenderInfo(blockData.blockRenderInformation);

            // Remove old input ports if count changed
            if (blockData.inputPorts !== this.inputPortNumber) {
                // Remove old input port elements from DOM
                this.inputPorts.forEach(portEl => this.blockElement.removeChild(portEl));
                this.inputPorts = [];
                this.inputPortNumber = blockData.inputPorts;

                // Add new input ports
                for (let j = 0; j < this.inputPortNumber; j++) {
                    const inputPort = document.createElement('div');
                    inputPort.classList.add('input-port');
                    inputPort.textContent = `In ${j + 1}`;

                    const position = communicationManager.getPortPosition(this.id, "input", j, true);
                    const thisPosition = this.getPosition(communicationManager);
                    if (position && thisPosition) {
                        inputPort.style.left = `${position.x - thisPosition.x - portWidth/4}px`;
                        inputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
                    }

                    inputPort.addEventListener('mousedown', (e: any) => {
                        this.onMouseDownInPort(e, "input", j);
                    });

                    this.blockElement.appendChild(inputPort);
                    this.inputPorts.push(inputPort);
                }
            }

            // Remove old output ports if count changed
            if (blockData.outputPorts !== this.outputPortNumber) {
                // Remove old output port elements from DOM
                this.outputPorts.forEach(portEl => this.blockElement.removeChild(portEl));
                this.outputPorts = [];
                this.outputPortNumber = blockData.outputPorts;

                // Add new output ports
                for (let i = 0; i < this.outputPortNumber; i++) {
                    const outputPort = document.createElement('div');
                    outputPort.classList.add('output-port');
                    outputPort.textContent = `Out ${i + 1}`;

                    const position = communicationManager.getPortPosition(this.id, "output", i, true);
                    const thisPosition = this.getPosition(communicationManager);
                    if (position && thisPosition) {
                        outputPort.style.left = `${position.x - thisPosition.x - 3*portWidth/4}px`;
                        outputPort.style.top = `${position.y - thisPosition.y - portHeigh/2}px`;
                    }

                    outputPort.addEventListener('mousedown', (e: any) => {
                        this.onMouseDownInPort(e, "output", i);
                    });

                    this.blockElement.appendChild(outputPort);
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