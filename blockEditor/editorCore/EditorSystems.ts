import { BlockPalette } from "./BlockPalette";
import { BlockInteractionManager } from "../managers/BlockInteractionManager";
import { CommunicationManager } from "./CommunicationManager";
import { LinkInteractionManager } from "../managers/LinkInteractionManager";
import { SelectableManager } from "./SelectableManager";
import { EditorContext } from "./EditorContext";
import { ZoomController } from "./ZoomController";
import { ElementManager } from "../interfaces/ElementManager";

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

export class EditorSystems {
    readonly context: EditorContext;

    readonly elementManagers: ElementManager[] = [ ];

    readonly communicationManager: CommunicationManager;
    // readonly elementEventBus: ElementEventBus;
    // readonly elementFactory: ElementFactory;

    readonly blockManager: BlockInteractionManager;
    readonly linkManager: LinkInteractionManager;
    // readonly noteManager: NoteInteractionManager;
    // readonly imageManager: ImageInteractionManager;
    readonly selectableManager: SelectableManager;
    readonly blockPalette: BlockPalette;

    constructor(
        context: EditorContext,
        private readonly zoomController: ZoomController
    ) {
        this.context = context;

        this.communicationManager =
            new CommunicationManager(vscode);

        // this.elementEventBus = new ElementEventBus();
        // this.elementFactory = new ElementFactory();

        this.blockManager =
            new BlockInteractionManager(this.communicationManager);

        this.elementManagers.push(this.blockManager);

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
        this.elementManagers.push(this.linkManager);
        
        // this.noteManager =
        //     new NoteInteractionManager(
        //         this.communicationManager,
        //         this.elementEventBus
        //     );

        // this.imageManager =
        //     new ImageInteractionManager(
        //         this.communicationManager,
        //         this.elementEventBus
        //     );

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