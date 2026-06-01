import { IdType, JsonData } from "../../shared/JsonTypes";
import { CommunicationManager } from "../managers/CommunicationManager";

// Capability interfaces
export interface Movable {
    move(dx: number, dy: number): void;
    getX(): number;
    getY(): number;
}

export interface Rotatable {
    rotate(newRotation: number): void;
    getRotation(): number;
}

export interface Connectable {
    getPortPositions(): Array<{ x: number; y: number; type: "input" | "output"; index: number }>;
}

export abstract class CanvasElement {

    abstract getElement(): HTMLElement | SVGElement;

    public getId(): IdType {
        return "undefinedElement";
    }

    private onMouseDownListenersIds: string[] = [];
    private onMouseDownListeners: ((canvasElement: CanvasElement, e: any) => void)[] = [];

    public addElementToCanvas(canvas: HTMLElement): void {
        if (this.getElement()) {
            canvas.appendChild(this.getElement());
        }
    }

    public triggerOnMouseDown(x: number, y: number)
    {
        let event = new MouseEvent('mousedown', {clientX: x, clientY: y});
        this.onMouseDownListeners.forEach(listener => listener(this, event));
    }

    public addOnMouseDownListener(id: string, onMouseDown: (canvasElement: CanvasElement, e: any) => void): void {
        if (!this.onMouseDownListenersIds.find(element => element === id)) {
            this.onMouseDownListenersIds.push(id);
            this.onMouseDownListeners.push(onMouseDown);
            this.getElement().addEventListener('mousedown', (e: any) => {
                onMouseDown(this, e);
            });
        }
    }

    public abstract updateFromJson(json: JsonData, communicationManager: CommunicationManager): void;
}