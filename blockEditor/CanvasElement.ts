import { JsonData } from "../shared/JsonTypes";
import { CommunicationManager } from "./CommunicationManager";

export abstract class CanvasElement {

    abstract getElement(): HTMLElement | SVGElement;

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