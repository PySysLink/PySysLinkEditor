import { JsonData } from "../../shared/JsonTypes";
import { EditorSystems } from "./EditorSystems";
import { EditorContext } from "./EditorContext";
import { BlockPalette } from "./BlockPalette";
import { BlockInteractionManager } from "../managers/BlockInteractionManager";
import { CommunicationManager } from "./CommunicationManager";
// import { ImageInteractionManager } from "../managers/ImageInteractionManager";
// import { LinkInteractionManager } from "../managers/LinkInteractionManager";
// import { NoteInteractionManager } from "../managers/NoteInteractionManager";
import { SelectableManager } from "./SelectableManager";
import { ZoomController } from "./ZoomController";

export class EditorRenderer {

    private readonly context: EditorContext;
    private readonly systems: EditorSystems;
    private readonly zoomController: ZoomController;

    constructor(
        context: EditorContext,
        systems: EditorSystems,
        zoomController: ZoomController
    ) {
        this.context = context;
        this.systems = systems;
        this.zoomController = zoomController;
    }

    public render(): void {
        this.clearCanvas();

        this.renderTopControls();

        this.renderBlocks();
        this.renderLinks();
        // this.renderGenericElements();

        this.renderBlockPallete();


        this.systems.selectableManager.updateSelectablesCallbacks();
        this.systems.linkManager.updateElementCallbacks();

        // this.systems.breadcrumbView.render();
    }

    private clearCanvas(): void {
        this.context.canvas.innerHTML = '';
    }

    private renderBlocks(): void {
        this.systems.blockManager.blocks.forEach(
            block => {
                block.addElementToCanvas(this.context.canvas);
            }
        );
    }

    private renderLinks(): void {
        const svg = this.systems.linkManager.getLinksSvg();

        this.context.canvas.appendChild(svg);
    }

    private renderTopControls(): void {
        this.context.topControls.innerHTML = '';
        // Add button

        const btnZoomIn = document.createElement('vscode-button');
        btnZoomIn.textContent = 'Zoom In';
        const btnZoomOut = document.createElement('vscode-button');
        btnZoomOut.textContent = 'Zoom Out';
        const btnResetZoom = document.createElement('vscode-button');
        btnResetZoom.textContent = 'Reset Zoom';
        const btnToggleBlockPalette = document.createElement('vscode-button');
        btnToggleBlockPalette.textContent = 'Toggle block palette';
        const btnActivateGridSnapping: any = document.createElement('vscode-checkbox');
        btnActivateGridSnapping.toggle = true;
        btnActivateGridSnapping.textContent = 'Grid Snapping';
        btnActivateGridSnapping.checked = this.systems.selectableManager.isGridSnappingActive();


        btnZoomIn.addEventListener('click', () => this.zoomController.zoomIn());
        btnZoomOut.addEventListener('click', () => this.zoomController.zoomOut());
        btnResetZoom.addEventListener('click', () => this.zoomController.reset());
        // btnToggleBlockPalette.addEventListener('click', () => {
        //     sidebar.classList.toggle('collapsed');
        // });
        // btnActivateGridSnapping.addEventListener('click', () => {
        //     selectableManager.toggleGridSnapping(btnActivateGridSnapping.checked); 
        // });

        this.context.topControls.appendChild(btnZoomIn);
        this.context.topControls.appendChild(btnZoomOut);
        this.context.topControls.appendChild(btnResetZoom);
        this.context.topControls.appendChild(btnToggleBlockPalette);
        this.context.topControls.appendChild(btnActivateGridSnapping);
    }

    private renderBlockPallete(): void {
        this.systems.blockPalette.renderPalette(this.context.blockPaletteContent);
    }

    // private renderGenericElements(): void {
    //     this.renderNotes();
    //     this.renderImages();
    // }

    // private renderNotes(): void {
    //     this.noteInteractionManager
    //         .getNotes()
    //         .forEach(note => {
    //             note.addElementToCanvas(
    //                 this.context.canvas
    //             );
    //         });
    // }

    // private renderImages(): void {
    //     this.imageInteractionManager
    //         .getImages()
    //         .forEach(image => {
    //             image.addElementToCanvas(
    //                 this.context.canvas
    //             );
    //         });
    // }
}


export class BreadcrumbView {
    constructor(
        private readonly container: HTMLElement,
        private readonly communicationManager: CommunicationManager,
        private readonly onNavigate: () => void
    ) {}

    public render(): void {
        const path =
            this.communicationManager
                .getCurrentPath();

        this.container.innerHTML = '';

        path.forEach((segment, index) => {
            const button =
                document.createElement(
                    'vscode-button'
                );

            button.textContent = segment;

            if (index === path.length - 1) {
                button.classList.add(
                    'current-path'
                );
            }

            button.addEventListener(
                'click',
                () => {
                    if (
                        index >=
                        path.length - 1
                    ) {
                        return;
                    }

                    this.communicationManager
                        .navigateToPath(
                            path.slice(
                                0,
                                index + 1
                            )
                        );

                    this.onNavigate();
                }
            );

            this.container
                .appendChild(button);

            if (
                index <
                path.length - 1
            ) {
                const separator =
                    document.createElement(
                        'span'
                    );

                separator.textContent =
                    ' / ';

                this.container
                    .appendChild(
                        separator
                    );
            }
        });
    }
}