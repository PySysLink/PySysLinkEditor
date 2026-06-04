export class EditorContext {
    readonly canvas: HTMLElement;
    readonly zoomContainer: HTMLElement;
    readonly topControls: HTMLElement;
    readonly canvasContainer: HTMLElement;
    readonly sidebar: HTMLElement;
    readonly blockPaletteContent: HTMLElement;
    

    readonly canvasWidth = 8000;
    readonly canvasHeight = 4000;

    constructor() {
        this.canvas = document.querySelector('.canvas') as HTMLElement;
        this.zoomContainer = document.querySelector('.zoom-container') as HTMLElement;
        this.topControls = document.querySelector('.top-controls') as HTMLElement;
        this.canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
        this.sidebar = document.getElementById('block-palette-sidebar') as HTMLElement;
        this.blockPaletteContent = document.getElementById('block-palette-content') as HTMLElement;
    }
};