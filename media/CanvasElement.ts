export abstract class CanvasElement {

    abstract getElement(): HTMLElement | SVGElement;

    private onMouseDownListeners: ((canvasElement: CanvasElement, e: any) => void)[] = [];

    public addElementToCanvas(canvas: HTMLElement): void {
        if (this.getElement()) {
            canvas.appendChild(this.getElement());
        }
    }

    public triggerOnMouseDown()
    {
        this.onMouseDownListeners.forEach(listener => listener(this, new Event('mousedown')));
    }

    public addOnMouseDownListener(onMouseDown: (canvasElement: CanvasElement, e: any) => void): void {
        this.onMouseDownListeners.push(onMouseDown);
        this.getElement().addEventListener('mousedown', (e: any) => {
            onMouseDown(this, e);
        });
    }
}