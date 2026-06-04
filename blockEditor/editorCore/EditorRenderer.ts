import { JsonData } from "../../shared/JsonTypes";
import { EditorSystems } from "./EditorSystems";
import { EditorContext } from "./EditorContext";
import { BlockPalette } from "./BlockPalette";
import { BlockInteractionManager } from "../managers/BlockInteractionManager";
import { CommunicationManager } from "./CommunicationManager";
import { ImageInteractionManager } from "../managers/ImageInteractionManager";
import { LinkInteractionManager } from "../managers/LinkInteractionManager";
import { NoteInteractionManager } from "../managers/NoteInteractionManager";
import { SelectableManager } from "./SelectableManager";

export class EditorRenderer {

    private readonly context: EditorContext;
    private readonly systems: EditorSystems;

    constructor(
        context: EditorContext,
        systems: EditorSystems
    ) {
        this.context = context;
        this.systems = systems;
    }

    public render(json: JsonData): void {
        this.clearCanvas();

        this.renderBlocks();
        this.renderLinks(json);
        // this.renderGenericElements();

        setZoom(zoomLevel);

        this.systems.selectableManager.updateSelectables();
        this.systems.linkManager.updateLinkAndNodeClickCallback();

        this.systems.breadcrumbView.render();

        this.systems.blockPalette.renderPalette(
            this.systems.blockPaletteContent
        );
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

    private renderLinks(json: JsonData): void {
        const svg = this.systems.linkManager.getLinksSvg();

        this.context.canvas.appendChild(svg);
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