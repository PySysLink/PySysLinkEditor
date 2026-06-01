import { BlockPalette } from "./BlockPalette";
import { CanvasDropHandler } from "./CanvasDropHandler";
import { CanvasPanning } from "./CanvasPanning";
import { EditorRenderer } from "./EditorRenderer";
import { ElementEventBus } from "./events/ElementEventBus";
import { BlockInteractionManager } from "./managers/BlockInteractionManager";
import { CommunicationManager } from "./managers/CommunicationManager";
import { ElementFactory } from "./managers/ElementFactory";
import { ImageInteractionManager } from "./managers/ImageInteractionManager";
import { LinkInteractionManager } from "./managers/LinkInteractionManager";
import { NoteInteractionManager } from "./managers/NoteInteractionManager";
import { SelectableManager } from "./managers/SelectableManager";
import { ZoomController } from "./ZoomController";

export class EditorSystems {
    readonly context: EditorContext;

    readonly communicationManager: CommunicationManager;
    readonly elementEventBus: ElementEventBus;
    readonly elementFactory: ElementFactory;

    readonly blockManager: BlockInteractionManager;
    readonly linkManager: LinkInteractionManager;
    readonly noteManager: NoteInteractionManager;
    readonly imageManager: ImageInteractionManager;
    readonly selectableManager: SelectableManager;
    readonly blockPalette: BlockPalette;

    constructor(
        context: EditorContext,
        private readonly zoomController: ZoomController
    ) {
        this.context = context;

        this.communicationManager =
            new CommunicationManager(vscode);

        this.elementEventBus = new ElementEventBus();
        this.elementFactory = new ElementFactory();

        this.blockManager =
            new BlockInteractionManager(this.communicationManager);

        this.selectableManager =
            new SelectableManager(
                this.communicationManager,
                this.context.canvas,
                this.zoomController.getRealZoom
            );

        this.linkManager =
            new LinkInteractionManager(
                this.communicationManager,
                this.context.canvas,
                linksLayer,
                this.blockManager,
                this.selectableManager,
                this.zoomController.getRealZoom
            );

        this.noteManager =
            new NoteInteractionManager(
                this.communicationManager,
                this.elementEventBus
            );

        this.imageManager =
            new ImageInteractionManager(
                this.communicationManager,
                this.elementEventBus
            );

        this.blockPalette =
            new BlockPalette(this.communicationManager);

        this.wire();
    }

    private wire(): void {
        this.communicationManager
            .registerLibrariesChangedCallback(
                this.blockPalette.updateLibraries
            );

        this.selectableManager.registerSelectableList(
            () => this.blockManager.blocks
        );

        this.selectableManager.registerSelectableList(
            () => this.linkManager.getAllLinkSegments()
        );

        this.selectableManager.registerSelectableList(
            () => this.linkManager.getAllLinkNodes()
        );

        this.selectableManager.registerSelectableList(
            () => this.noteManager.getNotes()
        );

        this.selectableManager.registerSelectableList(
            () => this.imageManager.getImages()
        );

        this.selectableManager.addRotationListener(
            this.linkManager.rotateSelectedLinks
        );

        this.selectableManager.addOnMouseMoveListener(
            this.linkManager.highlightNodesNearPorts
        );
    }
}

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

export class BlockEditorApp {
    private readonly context: EditorContext;
    private readonly systems: EditorSystems;

    private readonly renderer: EditorRenderer;
    // private readonly synchronizer: EditorSynchronizer;
    // private readonly scheduler: UpdateScheduler;

    private readonly zoomController: ZoomController;
    private readonly canvasPanning: CanvasPanning;
    private readonly dropHandler: CanvasDropHandler;
    // private readonly router: WebviewMessageRouter;

    constructor() {

        this.context = new EditorContext();

        this.zoomController = new ZoomController(
            this.context.zoomContainer,
            this.context.canvasContainer,
            {
                canvasWidth: this.context.canvasWidth,
                canvasHeight: this.context.canvasHeight
            }
        );



        this.systems = new EditorSystems(
            this.context,
            this.zoomController
        );

        this.renderer = new EditorRenderer(this.context);
        this.synchronizer = new EditorSynchronizer(this.systems);
        this.scheduler = new UpdateScheduler();

        this.canvasPanning = new CanvasPanning(
            this.context.canvasContainer
        );

        this.dropHandler = new CanvasDropHandler(
            this.context.canvas,
            this.systems.communicationManager,
            this.zoomController
        );

        this.router = new WebviewMessageRouter(
            this.systems.communicationManager,
            this.handleJsonUpdate
        );
    }
}