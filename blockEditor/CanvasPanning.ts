export interface CanvasPanningOptions {
    mouseButton?: number;
    panningClassName?: string;
}

export class CanvasPanning {
    private isPanning = false;
    private panStartX = 0;
    private panStartY = 0;

    private readonly mouseButton: number;
    private readonly panningClassName: string;

    constructor(
        private readonly canvasContainer: HTMLElement,
        options: CanvasPanningOptions = {}
    ) {
        this.mouseButton = options.mouseButton ?? 1; // middle mouse
        this.panningClassName =
            options.panningClassName ?? 'panning';
    }

    public initialize(): void {
        this.canvasContainer.addEventListener(
            'mousedown',
            this.onMouseDown
        );
    }

    public dispose(): void {
        this.canvasContainer.removeEventListener(
            'mousedown',
            this.onMouseDown
        );

        document.removeEventListener(
            'mousemove',
            this.onMouseMove
        );

        document.removeEventListener(
            'mouseup',
            this.onMouseUp
        );
    }

    public isActive(): boolean {
        return this.isPanning;
    }

    private startPanning(e: MouseEvent): void {
        this.isPanning = true;

        this.canvasContainer.classList.add(
            this.panningClassName
        );

        this.panStartX = e.clientX;
        this.panStartY = e.clientY;

        document.addEventListener(
            'mousemove',
            this.onMouseMove
        );

        document.addEventListener(
            'mouseup',
            this.onMouseUp
        );
    }

    private stopPanning(): void {
        this.isPanning = false;

        this.canvasContainer.classList.remove(
            this.panningClassName
        );

        document.removeEventListener(
            'mousemove',
            this.onMouseMove
        );

        document.removeEventListener(
            'mouseup',
            this.onMouseUp
        );
    }

    private onMouseDown = (
        e: MouseEvent
    ): void => {
        if (e.button !== this.mouseButton) {
            return;
        }

        e.preventDefault();

        this.startPanning(e);
    };

    private onMouseMove = (
        e: MouseEvent
    ): void => {
        if (!this.isPanning) {
            return;
        }

        const deltaX = e.clientX - this.panStartX;
        const deltaY = e.clientY - this.panStartY;

        this.canvasContainer.scrollLeft -= deltaX;
        this.canvasContainer.scrollTop -= deltaY;

        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
    };

    private onMouseUp = (
        e: MouseEvent
    ): void => {
        if (e.button !== this.mouseButton) {
            return;
        }

        this.stopPanning();
    };
}