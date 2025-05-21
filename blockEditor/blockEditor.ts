import { LinkVisual, SourceNode, TargetNode } from './LinkVisual';
import { BlockVisual } from './BlockVisual';
import { BlockInteractionManager } from './BlockInteractionManager';
import { LinkInteractionManager } from './LinkInteractionManager';
import { Selectable } from './Selectable';
import { SelectableManager } from './SelectableManager';
import { link } from 'fs';
import { JsonData } from '../shared/JsonTypes';
import { CommunicationManager } from './CommunicationManager';
import { getNonce } from './util';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();


(function () {
    const canvas = document.querySelector('.canvas') as HTMLElement;
    const zoomContainer = document.querySelector('.zoom-container') as HTMLElement;
    const topControls = document.querySelector('.top-controls') as HTMLElement;
    const canvasContainer = document.querySelector('.canvas-container') as HTMLElement;


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

    let communicationManager = new CommunicationManager(vscode);

    blockInteractionManager = new BlockInteractionManager(communicationManager);
    linkInteractionManager = new LinkInteractionManager(communicationManager, canvas, document.querySelector('.links') as SVGSVGElement, blockInteractionManager);
    selectableManager = new SelectableManager(communicationManager, canvas, getZoomLevelReal);

    selectableManager.registerSelectableList(() => blockInteractionManager.blocks);
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkSegments());
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkNodes());

    selectableManager.addOnMouseMoveListener(linkInteractionManager.highlightNodesNearPorts);
    selectableManager.addOnMouseUpListener(linkInteractionManager.connectNodesToPorts);
    selectableManager.updateSelectables();


    function getZoomLevelReal(): number {
        return zoomLevel/2;
    }
    
    function renderHTML(json: JsonData): void {
        canvas.innerHTML = ''; // Clear canvas
        blockInteractionManager.blocks.forEach(block => block.addElementToCanvas(canvas));


        topControls.innerHTML = '';
        // Add button
        const btn = document.createElement('button');
        btn.textContent = 'Add Block';
        btn.addEventListener('click', () => communicationManager.createNewBlock());
        topControls.appendChild(btn);

        const btnZoomIn = document.createElement('button');
        btnZoomIn.textContent = 'Zoom In';
        const btnZoomOut = document.createElement('button');
        btnZoomOut.textContent = 'Zoom Out';
        const btnResetZoom = document.createElement('button');
        btnResetZoom.textContent = 'Reset Zoom';

        btnZoomIn.addEventListener('click', () => setZoom(zoomLevel + zoomStep));
        btnZoomOut.addEventListener('click', () => setZoom(zoomLevel - zoomStep));
        btnResetZoom.addEventListener('click', () => setZoom(2));

        topControls.appendChild(btnZoomIn);
        topControls.appendChild(btnZoomOut);
        topControls.appendChild(btnResetZoom);

        zoomContainer.addEventListener('wheel', handleMouseWheelZoom);
        canvasContainer.addEventListener('mousedown', onMouseDownForPanning);

        setZoom(zoomLevel);

        let svgElement = linkInteractionManager.updateFromJson(json);
        canvas.appendChild(svgElement);

        blockInteractionManager.updateFromJson(json);
        selectableManager.updateSelectables();      
    }

    

    communicationManager.registerLocalJsonChangedCallback(updateWebView);

    function updateWebView(json: JsonData): void {
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


    // Listen for messages from extension
    window.addEventListener('message', (e: MessageEvent) => {
        if (e.data.type === 'update') {            
            communicationManager.newJsonFromServer(e.data.json);
            vscode.setState({ text: e.data.text });
        }
    });

    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        communicationManager.newJsonFromServer(state.text);
    }
})();