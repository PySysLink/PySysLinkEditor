export interface ZoomControllerOptions {
    defaultZoom?: number;
    zoomStep?: number;
    minZoom?: number;
    maxZoom?: number;
    canvasWidth?: number;
    canvasHeight?: number;
}

export class ZoomController {
    private zoomLevel: number;

    private readonly zoomStep: number;
    private readonly minZoom: number;
    private readonly maxZoom: number;

    private readonly canvasWidth: number;
    private readonly canvasHeight: number;

    constructor(
        private readonly zoomContainer: HTMLElement,
        private readonly eventTarget?: HTMLElement,
        options: ZoomControllerOptions = {}
    ) {
        this.zoomLevel = options.defaultZoom ?? 2;

        this.zoomStep = options.zoomStep ?? 0.1;
        this.minZoom = options.minZoom ?? 1;
        this.maxZoom = options.maxZoom ?? 4;

        this.canvasWidth = options.canvasWidth ?? 8000;
        this.canvasHeight = options.canvasHeight ?? 4000;

        this.applyZoom();
    }

    public initialize(): void {
        this.eventTarget?.addEventListener(
            'wheel',
            this.handleMouseWheelZoom
        );
    }

    public dispose(): void {
        this.eventTarget?.removeEventListener(
            'wheel',
            this.handleMouseWheelZoom
        );
    }

    public zoomIn(): void {
        this.set(this.zoomLevel + this.zoomStep);
    }

    public zoomOut(): void {
        this.set(this.zoomLevel - this.zoomStep);
    }

    public reset(): void {
        this.set(2);
    }

    public set(level: number): void {
        this.zoomLevel = Math.min(
            this.maxZoom,
            Math.max(this.minZoom, level)
        );

        this.applyZoom();
    }

    public getZoomLevel(): number {
        return this.zoomLevel;
    }

    public getRealZoom(): number {
        return this.zoomLevel / 2;
    }

    private applyZoom(): void {
        this.zoomContainer.style.transform =
            `scale(${this.zoomLevel})`;

        const scaledWidth = Math.min(
            (this.canvasWidth / 2) * this.zoomLevel,
            this.canvasWidth / 2
        );

        const scaledHeight = Math.min(
            (this.canvasHeight / 2) * this.zoomLevel,
            this.canvasHeight / 2
        );

        this.zoomContainer.style.width =
            `${scaledWidth}px`;

        this.zoomContainer.style.height =
            `${scaledHeight}px`;
    }

    private handleMouseWheelZoom = (
        e: WheelEvent
    ): void => {
        e.preventDefault();

        if (e.deltaY < 0) {
            this.zoomIn();
        } else if (e.deltaY > 0) {
            this.zoomOut();
        }
    };
}