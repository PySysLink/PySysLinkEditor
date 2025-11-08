import { LinkVisual } from './LinkVisual';
import { BlockVisual } from './BlockVisual';
import { BlockInteractionManager } from './BlockInteractionManager';
import { LinkInteractionManager } from './LinkInteractionManager';
import { Selectable } from './Selectable';
import { SelectableManager } from './SelectableManager';
import { BlockPalette } from './BlockPalette';
import { link } from 'fs';
import { JsonData } from '../shared/JsonTypes';
import { CommunicationManager } from './CommunicationManager';
import { getNonce } from './util';
import { Library } from '../shared/BlockPalette';
import '@vscode-elements/elements/dist/bundled.js';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

setInterval(() => {
    vscode.postMessage({
            type: 'heartbeat',
            text: `Heartbeat from webview at ${new Date().toISOString()}`
        });
}, 1000);

console.log = () => {};

(function () {
    const canvas = document.querySelector('.canvas') as HTMLElement;
    const zoomContainer = document.querySelector('.zoom-container') as HTMLElement;
    const topControls = document.querySelector('.top-controls') as HTMLElement;
    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;
    const sidebar = document.getElementById('block-palette-sidebar') as HTMLElement;
    const blockPaletteContent = document.getElementById('block-palette-content') as HTMLElement;

    if (canvas) {
        // 1) Prevent the default on dragover to allow dropping
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        // 2) On drop, read the dataTransfer payload and create a new block
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            communicationManager.print(`Drop event received`);            

            const data = e.dataTransfer?.getData('application/vnd.codeblock');
            if (!data) {
            return;
            }

            let meta: { library: string; blockType: string } | null = null;
            try {
                const parsed = JSON.parse(data);
                if (
                    typeof parsed === 'object' &&
                    parsed !== null &&
                    typeof parsed.library === 'string' &&
                    typeof parsed.blockType === 'string'
                ) {
                    meta = { library: parsed.library, blockType: parsed.blockType };
                } else {
                    communicationManager.print('Drop event: Invalid meta object');
                    return;
                }
            } catch {
                communicationManager.print('Drop event: Failed to parse meta');
                return;
            }

            // Compute drop coordinates relative to the canvas
            const canvasRect = canvas.getBoundingClientRect();

            const adjustedX = (e.clientX - canvasRect.left) / getZoomLevelReal();
            const adjustedY = (e.clientY - canvasRect.top) / getZoomLevelReal();

            communicationManager.print(`Drop event: ${data}, x: ${adjustedX}, y: ${adjustedY}`);   
            communicationManager.createBlockOfType(meta.library, meta.blockType, adjustedX, adjustedY);         
        });
    }

    let zoomLevel = 2; // Default zoom level
    const zoomStep = 0.1; // Step for zooming in/out
    const minZoom = 1; // Minimum zoom level
    const maxZoom = 4; // Maximum zoom level


    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    let canvasHeigh = 4000;
    let canvasWidth = 8000;

    let linkInteractionManager: LinkInteractionManager;
    let blockInteractionManager: BlockInteractionManager;
    let selectableManager: SelectableManager;
    let blockPalette: BlockPalette;

    let communicationManager = new CommunicationManager(vscode);

    blockInteractionManager = new BlockInteractionManager(communicationManager);
    selectableManager = new SelectableManager(communicationManager, canvas, getZoomLevelReal);
    linkInteractionManager = new LinkInteractionManager(communicationManager, canvas, 
            document.querySelector('.links') as SVGSVGElement, blockInteractionManager, selectableManager,
            getZoomLevelReal);
    blockPalette = new BlockPalette(communicationManager);
    communicationManager.registerLibrariesChangedCallback(blockPalette.updateLibraries);

    selectableManager.registerSelectableList(() => blockInteractionManager.blocks);
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkSegments());
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkNodes());

    selectableManager.addOnMouseMoveListener(linkInteractionManager.highlightNodesNearPorts);
    selectableManager.updateSelectables();
    linkInteractionManager.updateLinkAndNodeClickCallback();


    function getZoomLevelReal(): number {
        return zoomLevel/2;
    }
    
    function renderHTML(json: JsonData): void {
        canvas.innerHTML = ''; // Clear canvas
        blockInteractionManager.blocks.forEach(block => block.addElementToCanvas(canvas));


        topControls.innerHTML = '';
        // Add button

        const btnZoomIn = document.createElement('button');
        btnZoomIn.textContent = 'Zoom In';
        const btnZoomOut = document.createElement('button');
        btnZoomOut.textContent = 'Zoom Out';
        const btnResetZoom = document.createElement('button');
        btnResetZoom.textContent = 'Reset Zoom';
        const btnToggleBlockPalette = document.createElement('button');
        btnToggleBlockPalette.textContent = 'Toggle block palette';

        btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + zoomStep));
        btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - zoomStep));
        btnResetZoom.addEventListener('click', () => setZoom(2));
        btnToggleBlockPalette.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        topControls.appendChild(btnZoomIn);
        topControls.appendChild(btnZoomOut);
        topControls.appendChild(btnResetZoom);
        topControls.appendChild(btnToggleBlockPalette);

        zoomContainer.addEventListener('wheel', handleMouseWheelZoom);
        canvasContainer.addEventListener('mousedown', onMouseDownForPanning);

        setZoom(zoomLevel);

        let svgElement = linkInteractionManager.updateFromJson(json);
        canvas.appendChild(svgElement);

        blockInteractionManager.updateFromJson(json);
        selectableManager.updateSelectables();   
        linkInteractionManager.updateLinkAndNodeClickCallback();
        
        blockPalette.renderPalette(blockPaletteContent);
    }

    

    communicationManager.registerLocalJsonChangedCallback(updateWebView);

    let lastWebViewUpdateTime = Date.now();
    const minUpdateInterval = 10; 
    let timerRunning = false;

    function updateWebView(json: JsonData): void {
        const currentTime = Date.now();
        if (currentTime - lastWebViewUpdateTime < minUpdateInterval) {
            if (!timerRunning) {
                timerRunning = true;
                setTimeout(() => {
                    const lastJson = communicationManager.getLocalJson();
                    if (lastJson) {
                        updateWebView(lastJson);
                    }
                    timerRunning = false;
                }, minUpdateInterval);
            }
            return; 
        }

        lastWebViewUpdateTime = currentTime;
        blockInteractionManager.updateFromJson(json);

        linkInteractionManager.links.forEach((link: LinkVisual) => {
            const linkData = json.links?.find(l => l.id === link.id);
            if (!linkData) {
                linkInteractionManager.deleteLink(link);
            }
        });

        renderHTML(json);
    }


    function setZoom(level: number): void {
    
        // Clamp the zoom level between minZoom and maxZoom
        zoomLevel = Math.min(maxZoom, Math.max(minZoom, level));
        zoomContainer.style.transform = `scale(${zoomLevel})`;

        // Dynamically adjust the canvas size based on the zoom level
        const scaledWidth = Math.min(canvasWidth/2 * zoomLevel, canvasWidth/2); 
        const scaledHeight = Math.min(canvasHeigh/2 * zoomLevel, canvasHeigh/2);
    
        zoomContainer.style.width = `${scaledWidth}px`;
        zoomContainer.style.height = `${scaledHeight}px`;
    }

    function handleMouseWheelZoom(e: WheelEvent): void {
        e.preventDefault(); // Prevent default scrolling behavior

        // Adjust zoom level based on scroll direction
        if (e.deltaY < 0) {
            setZoom(zoomLevel + zoomStep); // Zoom in
        } else if (e.deltaY > 0) {
            setZoom(zoomLevel - zoomStep); // Zoom out
        }
    }

    function onMouseDownForPanning(e: MouseEvent): void {
        if (e.button === 1) { // Middle mouse button
            e.preventDefault(); // Prevent default middle mouse behavior (e.g., auto-scroll)
            isPanning = true;
            canvasContainer.classList.add('panning'); // Add the class

            // Store the initial mouse position
            panStartX = e.clientX;
            panStartY = e.clientY;
    
            // Add event listeners for mousemove and mouseup
            document.addEventListener('mousemove', onMouseMoveForPanning);
            document.addEventListener('mouseup', onMouseUpForPanning);
        }
    }

    function onMouseMoveForPanning(e: MouseEvent): void {
        if (!isPanning) { return; }
    
        // Calculate the distance moved
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;
    
        // Adjust the scroll position of the canvasContainer
        canvasContainer.scrollLeft -= deltaX;
        canvasContainer.scrollTop -= deltaY;
    
        // Update the starting position for the next movement
        panStartX = e.clientX;
        panStartY = e.clientY;
    }
    
    function onMouseUpForPanning(e: MouseEvent): void {
        if (e.button === 1) { // Middle mouse button
            isPanning = false;
            canvasContainer.classList.remove('panning'); // Remove the class

            // Remove the event listeners
            document.removeEventListener('mousemove', onMouseMoveForPanning);
            document.removeEventListener('mouseup', onMouseUpForPanning);
        }
    }

    window.addEventListener('message', (e: MessageEvent) => {
        if (e.data.type === 'update') {
            communicationManager.newJsonFromServer(e.data.json);
        }else if (e.data.type === 'colorThemeKindChanged') {
            applyThemeClass(e.data.kind);
        } else if (e.data.type === 'setBlockLibraries') {
            communicationManager.setBlockLibraries(e.data.model as Library[]);
        }
    });


    function applyThemeClass(kind: string) {
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

    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        communicationManager.print(`Restoring state: ${state.text}`);
        communicationManager.newJsonFromServer(JSON.parse(state.text));
    }
})();