import { BlockPalette } from "./editorCore/BlockPalette";
import { CanvasDropHandler } from "./editorCore/CanvasDropHandler";
import { CanvasPanning } from "./editorCore/CanvasPanning";
import { EditorContext } from "./editorCore/EditorContext";
import { EditorSystems } from "./editorCore/EditorSystems";
import { EditorRenderer } from "./editorCore/EditorRenderer";
import { BlockInteractionManager } from "./managers/BlockInteractionManager";
// import { CommunicationManager } from "./CommunicationManager";
// import { ElementFactory } from "./managers/ElementFactory";
// import { ImageInteractionManager } from "./managers/ImageInteractionManager";
// import { LinkInteractionManager } from "./managers/LinkInteractionManager";
// import { NoteInteractionManager } from "./managers/NoteInteractionManager";
import { SelectableManager } from "./editorCore/SelectableManager";
import { ZoomController } from "./editorCore/ZoomController";
import { Library } from "../shared/BlockPalette";
import { JsonData } from "../shared/JsonTypes";
import { LinkVisual } from "./visualElements/LinkVisual";




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

    private readonly vscode: any;

    constructor(vscode: any) {

        this.vscode = vscode;

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
            this.zoomController,
            this.vscode
        );

        this.renderer = new EditorRenderer(this.context, this.systems, this.zoomController);
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

        this.systems.communicationManager.registerLocalJsonChangedCallback(this.updateWebView);


        // Restore state if reloaded
        const state = vscode.getState();
        if (state) {
            this.systems.communicationManager.print(`Restoring state: ${state.text}`);
            this.systems.communicationManager.newJsonFromServer(JSON.parse(state.text));
        }

        // this.router = new WebviewMessageRouter(
        //     this.systems.communicationManager,
        //     this.handleJsonUpdate
        // );

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

    private lastWebViewUpdateTime = Date.now();
    private minUpdateInterval = 10; 
    private timerRunning = false;

    public updateWebView = (json: JsonData) : void => {
        console.log("Updating webview with JSON");

        const currentTime = Date.now();
        if (currentTime - this.lastWebViewUpdateTime < this.minUpdateInterval) {
            if (!this.timerRunning) {
                this.timerRunning = true;
                setTimeout(() => {
                    const lastJson = this.systems.communicationManager.getLocalJson();
                    if (lastJson) {
                        this.updateWebView(lastJson);
                    }
                    this.timerRunning = false;
                }, this.minUpdateInterval);
            }
            return; 
        }

        this.lastWebViewUpdateTime = currentTime;

        this.systems.elementManagers.forEach(manager => manager.updateFromJson(json));

        this.renderer.render();
    };

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