import { BlockData, BlockRenderInformation, IdType, JsonData, Rotation, SubsystemData, SubsystemRenderInformation } from "../../shared/JsonTypes";
import { CommunicationManager } from "../editorCore/CommunicationManager";
import { Copiable } from "../interfaces/Copiable";
import { Movable } from "../interfaces/Movable";
import { Resizeable, ResizeMode } from "../interfaces/Resizeable";
import { Rotatable } from "../interfaces/Rotatable";
import { Selectable } from "../interfaces/Selectable";
import { BlockVisual } from "./BlockVisual";

export class SubsystemVisual extends Copiable implements Movable, Rotatable, Resizeable {
    id: string;
    _isSelected: boolean = false;

    private currentRenderInfo?: SubsystemRenderInformation | null;

    private startResize: (resizableId: IdType, e: MouseEvent, mode: ResizeMode) => void;

    public getElement(): HTMLElement | SVGElement {
        return this.subsystemElement;
    }

    public getId(): IdType {
        return this.id;    
    }

    private subsystemElement: HTMLElement;
    private subsystemVisual: HTMLElement;
    private labelElement: HTMLElement;
    private contentElement: HTMLElement;


    inputPortNumber: number;
    outputPortNumber: number;
    inputPorts: HTMLElement[] = [];
    outputPorts: HTMLElement[] = [];


    onMouseDownOnPortCallbacks: ((e: any, portType: "input" | "output", portIndex: number) => void)[] = [];
    
    onDoubleClickCallbacks: ((e: MouseEvent, subsystem: SubsystemVisual) => void)[] = [];

    private onDelete: (subsystem: SubsystemVisual) => void;

    constructor(subsystemData: SubsystemData, communicationManager: CommunicationManager, onDelete: (subsystem: SubsystemVisual) => void,
                startResize: (resizableId: IdType, e: MouseEvent, mode: ResizeMode) => void) {
        super();
        this.id = subsystemData.id;
        this.inputPortNumber = subsystemData.inputPorts;
        this.outputPortNumber = subsystemData.outputPorts;
        this.onDelete = onDelete;
        this.startResize = startResize;


        this.subsystemElement = document.createElement('div');
        this.subsystemElement.classList.add('subsystem');
        this.subsystemElement.style.position = 'absolute';

        this.subsystemVisual = document.createElement('div');
        this.subsystemVisual.classList.add('subsystem-visual');
        this.subsystemElement.appendChild(this.subsystemVisual);


        this.contentElement = document.createElement('div');
        this.contentElement.classList.add('subsystem-content');
        this.subsystemElement.appendChild(this.contentElement);
        
        this.applyRenderInfo(subsystemData.subsystemRenderInformation);

        this.subsystemElement.appendChild(this.createResizeHandle('r'));
        this.subsystemElement.appendChild(this.createResizeHandle('l'));
        this.subsystemElement.appendChild(this.createResizeHandle('b'));
        this.subsystemElement.appendChild(this.createResizeHandle('t'));
        this.subsystemElement.appendChild(this.createResizeHandle('tr'));
        this.subsystemElement.appendChild(this.createResizeHandle('tl'));
        this.subsystemElement.appendChild(this.createResizeHandle('br'));
        this.subsystemElement.appendChild(this.createResizeHandle('bl'));

        // Create external label
        this.labelElement = document.createElement('div');
        this.labelElement.classList.add('subsystem-label');
        this.labelElement.textContent = subsystemData.label;

        // Assemble
        this.subsystemElement.appendChild(this.labelElement);

        this.subsystemElement.addEventListener('dblclick', (e: MouseEvent) => {
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

            this.subsystemElement.appendChild(inputPort);
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

            this.subsystemElement.appendChild(outputPort);
            this.outputPorts.push(outputPort);
        }
    }

    public copy(selectedSelectables: Selectable[], communicationManager: CommunicationManager): [JsonData, IdType[]] {
        const [subsystemData, idsToReplace] = communicationManager.getIdsOfSubsystem(this.id, selectedSelectables);
        return [subsystemData, idsToReplace];
    }

    getRotation(communicationManager: CommunicationManager): Rotation {
        const subsystemData = communicationManager.getLocalJson()?.subsystems?.find((subsystem: SubsystemData) => subsystem.id === this.id);
        return subsystemData?.rotation ?? 0; // Default rotation is 0 if not found
    }

    applyRotation(rotation: Rotation, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.rotateSubsystem(this.id, rotation);
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

    getPositionForRotation(communicationManager: CommunicationManager): { x: number, y: number } | undefined {
        const subsystemData = communicationManager.getLocalJson()?.subsystems?.find((subsystem: SubsystemData) => subsystem.id === this.id);
        if (subsystemData) {
            return { x: subsystemData.x + this.subsystemElement.offsetWidth / 2, y: subsystemData.y + this.subsystemElement.offsetHeight / 2 };
        }
        return undefined;
    }

    moveClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let centralPosition = this.getPosition(communicationManager);
        if (centralPosition) {
            centralPosition.x += this.subsystemElement.offsetWidth / 2;
            centralPosition.y += this.subsystemElement.offsetHeight / 2;
            const deltaX = centerX - centralPosition.x;
            const deltaY = centerY - centralPosition.y;

            let targetPosition = {
                x: centerX + deltaY - this.subsystemElement.offsetWidth / 2,
                y: centerY - deltaX - this.subsystemElement.offsetHeight / 2
            };

            this.moveTo(targetPosition.x, targetPosition.y, communicationManager, []);
        }
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let centralPosition = this.getPosition(communicationManager);
        if (centralPosition) {
            centralPosition.x += this.subsystemElement.offsetWidth / 2;
            centralPosition.y += this.subsystemElement.offsetHeight / 2;
            const deltaX = centerX - centralPosition.x;
            const deltaY = centerY - centralPosition.y;

            let targetPosition = {
                x: centerX - deltaY - this.subsystemElement.offsetWidth / 2,
                y: centerY + deltaX - this.subsystemElement.offsetHeight / 2
            };

            this.moveTo(targetPosition.x, targetPosition.y, communicationManager, []);
        }
    }

    private createResizeHandle(mode: ResizeMode): HTMLElement {
        const handle = document.createElement('div');
        handle.classList.add('block-resize-handle', `block-resize-handle--${mode}`);
        handle.addEventListener('mousedown', (e: MouseEvent) => {
            this.startResize(this.getId(), e, mode);
        });
        return handle;
    }

    public getResizeConstraints(): { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number } {
        const minWidth = this.currentRenderInfo?.min_width ?? (parseFloat(this.subsystemElement.style.minWidth || '0') || 0);
        const minHeight = this.currentRenderInfo?.min_height ?? (parseFloat(this.subsystemElement.style.minHeight || '0') || 0);
        const maxWidth = this.currentRenderInfo?.max_width ?? (parseFloat(this.subsystemElement.style.maxWidth || '100000') || 100000);
        const maxHeight = this.currentRenderInfo?.max_height ?? (parseFloat(this.subsystemElement.style.maxHeight || '100000') || 100000);

        return { minWidth, minHeight, maxWidth, maxHeight };
    }

    public getWidthAndHeight(): {width: number, height: number} {
        const rect = this.subsystemElement.getBoundingClientRect();
        return {width: rect.width, height: rect.height};
    }

    public setWidthAndHeight(width: number, height: number, communicationManager: CommunicationManager) {
        this.subsystemElement.style.width = `${width}px`;
        this.subsystemElement.style.height = `${height}px`;
        this.subsystemVisual.style.width = '100%';
        this.subsystemVisual.style.height = '100%';
        this.contentElement.style.width = '100%';
        this.contentElement.style.height = '100%';
        this.updatePorts(communicationManager);
        communicationManager.resizeSubsystem(this.id, width, height, [this.id]);

    }

    private updatePorts(communicationManager: CommunicationManager): void {
        const portWidth = 40;
        const portHeight = 20;

        this.inputPorts.forEach((portEl, index) => {
            const position = communicationManager.getPortPosition(this.id, 'input', index, true);
            const thisPosition = this.getPosition(communicationManager);
            if (position && thisPosition) {
                portEl.style.left = `${position.x - thisPosition.x - portWidth / 4}px`;
                portEl.style.top = `${position.y - thisPosition.y - portHeight / 2}px`;
            }
        });

        this.outputPorts.forEach((portEl, index) => {
            const position = communicationManager.getPortPosition(this.id, 'output', index, true);
            const thisPosition = this.getPosition(communicationManager);
            if (position && thisPosition) {
                portEl.style.left = `${position.x - thisPosition.x - 3 * portWidth / 4}px`;
                portEl.style.top = `${position.y - thisPosition.y - portHeight / 2}px`;
            }
        });
    }
    
    private applyRenderInfo(renderInfo?: SubsystemRenderInformation | null) {
        this.currentRenderInfo = renderInfo;
        if (!renderInfo) {return;}
        // Shape classes: square, circle, triangle

        // Size constraints
        if (renderInfo.width) {
            this.subsystemElement.style.width = `${renderInfo.width}px`;
        } else {
            this.subsystemElement.style.width = `${renderInfo.default_width}px`;
        }
        if (renderInfo.width) {
            this.subsystemElement.style.height = `${renderInfo.height}px`;
        } else {
            this.subsystemElement.style.height = `${renderInfo.default_height}px`;
        }
        this.subsystemElement.style.minWidth = `${renderInfo.min_width}px`;
        this.subsystemElement.style.minHeight = `${renderInfo.min_height}px`;
        this.subsystemElement.style.maxWidth = `${renderInfo.max_width}px`;
        this.subsystemElement.style.maxHeight = `${renderInfo.max_height}px`;
        this.subsystemVisual.style.width = '100%';
        this.subsystemVisual.style.height = '100%';
    
        if (renderInfo.text) {
            const txt = document.createElement('div');
            txt.classList.add('block-text');
            txt.textContent = renderInfo.text;
            // Clear childs
            if (this.contentElement.lastChild) {
                this.contentElement.removeChild(this.contentElement.lastChild);
            }
            this.contentElement.appendChild(txt);
        }

        this.subsystemVisual.classList.add('block--square');

        for (let i = 0; i < this.inputPorts.length; i++) {
            if (renderInfo.input_port_labels.length <= i) { break; }
            this.inputPorts[i].textContent = renderInfo.input_port_labels[i] ?? `In ${i + 1}`;
        }

        for (let i = 0; i < this.outputPorts.length; i++) {
            if (renderInfo.output_port_labels.length <= i) { break; }
            this.outputPorts[i].textContent = renderInfo.output_port_labels[i] ?? `Out ${i + 1}`;
        }
    }

    public select(): void {
        super.select();
        this.subsystemVisual.classList.add('selected');
    }

    public unselect(): void {
        super.unselect();
        this.subsystemVisual.classList.remove('selected');
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.moveSubsystem(this.id, x, y, selectables.map(s => s.getId()));
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
        const subsystemData = communicationManager.getLocalJson()?.subsystems?.find((subsystem: SubsystemData) => subsystem.id === this.id);
        if (subsystemData) {
            return { x: subsystemData.x, y: subsystemData.y };
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

    public registerOnDoubleClickCallback(callback: (e: MouseEvent, subsystem: SubsystemVisual) => void): void {
        this.onDoubleClickCallbacks.push(callback);
    }


    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const subsystemData = json.subsystems?.find((subsystem: SubsystemData) => subsystem.id === this.id);
        if (subsystemData) {
            this.labelElement.textContent = subsystemData.label;
            this.subsystemElement.style.left = `${subsystemData.x}px`;
            this.subsystemElement.style.top = `${subsystemData.y}px`;
            this.subsystemElement.style.transform = `rotate(${subsystemData.rotation}deg)`;
            this.subsystemElement.style.transformOrigin = "center center";


            // --- Update ports if the amount has changed ---
            const portWidth = 40;
            const portHeigh = 20;

            this.applyRenderInfo(subsystemData.subsystemRenderInformation);

            // Remove old input ports if count changed
            if (subsystemData.inputPorts !== this.inputPortNumber) {
                // Remove old input port elements from DOM
                this.inputPorts.forEach(portEl => this.subsystemElement.removeChild(portEl));
                this.inputPorts = [];
                this.inputPortNumber = subsystemData.inputPorts;

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

                    this.subsystemElement.appendChild(inputPort);
                    this.inputPorts.push(inputPort);
                }
            }

            this.updatePorts(communicationManager);

            // Remove old output ports if count changed
            if (subsystemData.outputPorts !== this.outputPortNumber) {
                // Remove old output port elements from DOM
                this.outputPorts.forEach(portEl => this.subsystemElement.removeChild(portEl));
                this.outputPorts = [];
                this.outputPortNumber = subsystemData.outputPorts;

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

                    this.subsystemElement.appendChild(outputPort);
                    this.outputPorts.push(outputPort);
                }
            }

            this.updatePorts(communicationManager);
        }
    }

    public delete(communicationManager: CommunicationManager): void {
        communicationManager.deleteSubsystem(this.id);
        this.onDelete(this);
    }
}