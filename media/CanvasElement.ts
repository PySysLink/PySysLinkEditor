export class CanvasElement {
    protected element: HTMLElement;

    getElement(): HTMLElement {
        return this.element;
    }

    public addElementToCanvas(canvas: HTMLElement): void {
        if (this.element) {
            canvas.appendChild(this.element);
        }
    }
}