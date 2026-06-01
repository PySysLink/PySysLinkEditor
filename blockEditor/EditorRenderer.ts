import { JsonData } from "../shared/JsonTypes";
import { BlockPalette } from "./BlockPalette";
import { BlockInteractionManager } from "./managers/BlockInteractionManager";
import { CommunicationManager } from "./managers/CommunicationManager";
import { ImageInteractionManager } from "./managers/ImageInteractionManager";
import { LinkInteractionManager } from "./managers/LinkInteractionManager";
import { NoteInteractionManager } from "./managers/NoteInteractionManager";
import { SelectableManager } from "./managers/SelectableManager";

export class EditorRenderer {
    constructor(
        private readonly canvas: HTMLElement,
        private readonly blockInteractionManager: BlockInteractionManager,
        private readonly linkInteractionManager: LinkInteractionManager,
        private readonly noteInteractionManager: NoteInteractionManager,
        private readonly imageInteractionManager: ImageInteractionManager,
        private readonly selectableManager: SelectableManager,
        private readonly breadcrumbView: BreadcrumbView,
        private readonly blockPalette: BlockPalette,
        private readonly blockPaletteContent: HTMLElement
    ) {}

    public render(json: JsonData): void {
        this.clearCanvas();

        this.renderBlocks();
        this.renderLinks(json);
        this.renderGenericElements();

        this.selectableManager.updateSelectables();
        this.linkInteractionManager.updateLinkAndNodeClickCallback();

        this.breadcrumbView.render();

        this.blockPalette.renderPalette(
            this.blockPaletteContent
        );
    }

    private clearCanvas(): void {
        this.canvas.innerHTML = '';
    }

    private renderBlocks(): void {
        this.blockInteractionManager.blocks.forEach(
            block => {
                block.addElementToCanvas(this.canvas);
            }
        );
    }

    private renderLinks(json: JsonData): void {
        const svg =
            this.linkInteractionManager
                .updateFromJson(json);

        this.canvas.appendChild(svg);
    }

    private renderGenericElements(): void {
        this.renderNotes();
        this.renderImages();
    }

    private renderNotes(): void {
        this.noteInteractionManager
            .getNotes()
            .forEach(note => {
                note.addElementToCanvas(
                    this.canvas
                );
            });
    }

    private renderImages(): void {
        this.imageInteractionManager
            .getImages()
            .forEach(image => {
                image.addElementToCanvas(
                    this.canvas
                );
            });
    }
}


export class BreadcrumbView {
    constructor(
        private readonly container: HTMLElement,
        private readonly communicationManager:
            CommunicationManager,
        private readonly onNavigate:
            () => void
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