import { BlockPalette } from "./editorCore/BlockPalette";
import { CanvasDropHandler } from "./editorCore/CanvasDropHandler";
import { CanvasPanning } from "./editorCore/CanvasPanning";
import { EditorContext } from "./editorCore/EditorContext";
import { EditorSystems } from "./editorCore/EditorSystems";
import { EditorRenderer } from "./editorCore/EditorRenderer";
import { ElementEventBus } from "./events/ElementEventBus";
import { BlockInteractionManager } from "./managers/BlockInteractionManager";
import { CommunicationManager } from "./managers/CommunicationManager";
import { ElementFactory } from "./managers/ElementFactory";
import { ImageInteractionManager } from "./managers/ImageInteractionManager";
import { LinkInteractionManager } from "./managers/LinkInteractionManager";
import { NoteInteractionManager } from "./managers/NoteInteractionManager";
import { SelectableManager } from "./managers/SelectableManager";
import { ZoomController } from "./editorCore/ZoomController";
import { Library } from "../shared/BlockPalette";

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();





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

        this.renderer = new EditorRenderer(this.context, this.systems);
        // this.synchronizer = new EditorSynchronizer(this.systems);
        // this.scheduler = new UpdateScheduler();

        this.canvasPanning = new CanvasPanning(
            this.context.canvasContainer
        );

        this.dropHandler = new CanvasDropHandler(
            this.context.canvas,
            this.systems.communicationManager,
            this.zoomController
        );

        // this.router = new WebviewMessageRouter(
        //     this.systems.communicationManager,
        //     this.handleJsonUpdate
        // );
    }

    public start(): void {
        window.addEventListener('message', (e: MessageEvent) => {
        if (e.data.type === 'update') {
            this.systems.communicationManager.newJsonFromServer(e.data.json);
        }else if (e.data.type === 'colorThemeKindChanged') {
            this.applyThemeClass(e.data.kind);
        } else if (e.data.type === 'setBlockLibraries') {
            this.systems.communicationManager.setBlockLibraries(e.data.model as Library[]);
        }
    });
    }

    public applyThemeClass(kind: string) {
        if (kind === "light") {
            document.body.classList.add('pysyslink-light');
            document.body.classList.remove('pysyslink-dark');
            document.body.classList.remove('pysyslink-high-contrast');
        } else if (kind === "dark") {
            document.body.classList.remove('pysyslink-light');
            document.body.classList.add('pysyslink-dark');
            document.body.classList.remove('pysyslink-high-contrast');
        } else {
            document.body.classList.remove('pysyslink-light');
            document.body.classList.remove('pysyslink-dark');
            document.body.classList.add('pysyslink-high-contrast');
        }
        
    }

}