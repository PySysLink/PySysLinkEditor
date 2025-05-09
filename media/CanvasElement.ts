export abstract class CanvasElement {

    abstract getElement(): HTMLElement | SVGElement;

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

    public addOnMouseDownListener(onMouseDown: (canvasElement: CanvasElement, e: any) => void): void {
        this.onMouseDownListeners.push(onMouseDown);
        this.getElement().addEventListener('mousedown', (e: any) => {
            onMouseDown(this, e);
        });
    }
}