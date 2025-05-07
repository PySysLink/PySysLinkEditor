export abstract class CanvasElement {

    abstract getElement(): HTMLElement | SVGElement;

    public addElementToCanvas(canvas: HTMLElement): void {
        if (this.getElement()) {
            canvas.appendChild(this.getElement());
        }
    }

    public addOnMouseDownListener(onMouseDown: (canvasElement: CanvasElement, e: any) => void): void {
        this.getElement().addEventListener('mousedown', (e: any) => {
            onMouseDown(this, e);
        });
    }
}