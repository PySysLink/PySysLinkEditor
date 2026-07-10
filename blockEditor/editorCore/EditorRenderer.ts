import { JsonData } from "../../shared/JsonTypes";
import { EditorSystems } from "./EditorSystems";
import { EditorContext } from "./EditorContext";
import { BlockPalette } from "./BlockPalette";
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

    public render(jsonData: JsonData, subsystemIds: string[]): void {
        this.clearCanvas();

        this.renderTopControls(jsonData, subsystemIds);
        this.renderSubsystemNavigation(subsystemIds);

        this.renderBlocks();
        this.renderSubsystems();
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

    private renderSubsystems(): void {
        this.systems.subsystemManager.subsystems.forEach(
            subsystem => {
                subsystem.addElementToCanvas(this.context.canvas);
            }
        );
    }

    private renderLinks(): void {
        const svg = this.systems.linkManager.getLinksSvg();

        this.context.canvas.appendChild(svg);
    }

    private renderTopControls(jsonData: JsonData, subsystemIds: string[]): void {
        this.context.topControls.innerHTML = '';

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

        this.context.topControls.appendChild(
            this.createFileSelector(
                'Simulation Options',
                'simulation_options_file',
                () => this.systems.communicationManager.openSimulationOptionsFileSelector(),
                jsonData.simulation_configuration
            )
        );

        this.context.topControls.appendChild(
            this.createFileSelector(
                'Initialization Script',
                'initialization_script_file',
                () => this.systems.communicationManager.openInitializationScriptFileSelector(), 
                jsonData.initialization_python_script_path
            )
        );

        this.context.topControls.appendChild(
            this.createFileSelector(
                'Toolkit Config',
                'toolkit_configuration_file',
                () => this.systems.communicationManager.openToolkitConfigurationFileSelector(),
                jsonData.toolkit_configuration_path
            )
        );

        this.context.topControls.appendChild(btnToggleBlockPalette);
        this.context.topControls.appendChild(btnActivateGridSnapping);
    }


    private renderSubsystemNavigation(subsystemIds: string[]): void {
        this.context.subsystemNavigation.innerHTML = '';

        console.log("Rendering subsystem navigation for IDs:", subsystemIds);
        if (subsystemIds.length === 0) {
            return;
        }

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.alignItems = 'center';
        container.style.gap = '6px';
        container.style.marginTop = '8px';
        container.style.width = '100%';

        // Top subsystem navigation button
        const btnGoToRoot = document.createElement('vscode-button');
        btnGoToRoot.textContent = 'Go to root subsystem';
        btnGoToRoot.style.width = '140px';
        btnGoToRoot.style.minWidth = '140px';
        btnGoToRoot.style.maxWidth = '140px';

        btnGoToRoot.addEventListener('click', () => {
            this.systems.communicationManager.goToRootSubsystem();
        });

        container.appendChild(btnGoToRoot);

        subsystemIds.forEach(subsystemId => {
            const button = document.createElement('vscode-button');

            button.textContent = subsystemId;
            button.style.width = '140px';
            button.style.minWidth = '140px';
            button.style.maxWidth = '140px';

            button.addEventListener('click', () => {
                this.systems.communicationManager.goToSubsystem(subsystemId);
            });

            container.appendChild(button);
        });
        
        console.log("Appending subsystem navigation container to top controls");
        this.context.subsystemNavigation.appendChild(container);
    }

    private renderBlockPallete(): void {
        this.systems.blockPalette.renderPalette(this.context.blockPaletteContent);
    }


    private createFileSelector(
        labelText: string,
        id: string,
        onBrowse: () => void,
        textFieldValue: string = ''
    ): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
        container.style.marginTop = '6px';

        const label = document.createElement('span');
        label.textContent = labelText;

        const input = document.createElement('vscode-textfield') as any;
        input.id = id;
        input.setAttribute('placeholder', 'Select a file...');
        input.style.width = '350px';
        if (textFieldValue !== '') {
            input.value = textFieldValue;
        }

        const browseBtn = document.createElement('vscode-button');
        browseBtn.textContent = 'Browse';
        browseBtn.addEventListener('click', onBrowse);

        container.appendChild(label);
        container.appendChild(input);
        container.appendChild(browseBtn);

        return container;
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
