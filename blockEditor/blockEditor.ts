import { Link, SourceNode, TargetNode } from './Link';
import { Block } from './Block';
import { BlockInteractionManager } from './BlockInteractionManager';
import { LinkInteractionManager } from './LinkInteractionManager';
import { Selectable } from './Selectable';
import { SelectableManager } from './SelectableManager';
import { link } from 'fs';
import { JsonData } from '../shared/JsonTypes';
import { CommunicationManager } from './CommunicationManager';

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

    blockInteractionManager = new BlockInteractionManager(vscode);
    linkInteractionManager = new LinkInteractionManager(vscode, canvas, document.querySelector('.links') as SVGSVGElement, blockInteractionManager);
    selectableManager = new SelectableManager(vscode, canvas, getZoomLevelReal);

    selectableManager.registerSelectableList(() => blockInteractionManager.blocks);
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkSegments());
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkNodes());
    selectableManager.registerStateList(() => blockInteractionManager.blocks.map(block => block.getState()));
    selectableManager.registerStateList(() => { 
            const stateMessages = linkInteractionManager.links.flatMap(link => link.getState());
            return [{ type: 'moveLinkBatch', updates: stateMessages }];
    });
    selectableManager.addOnMouseMoveListener(linkInteractionManager.highlightNodesNearPorts);
    selectableManager.addOnMouseUpListener(linkInteractionManager.connectNodesToPorts);
    selectableManager.updateSelectables();
    selectableManager.addOnMouseMoveListener(linkInteractionManager.updateLinks);

    let communicationManager = new CommunicationManager(vscode);

    function getZoomLevelReal(): number {
        return zoomLevel/2;
    }
    

    function createRandomLink(): void {
        if (blockInteractionManager.blocks.length < 2) {
            vscode.postMessage({ type: 'print', text: 'Not enough blocks to create a link.' });
            return;
        }
    
        // Randomly select two different blocks
        const sourceIndex = Math.floor(Math.random() * blockInteractionManager.blocks.length);
        let targetIndex = Math.floor(Math.random() * blockInteractionManager.blocks.length);
    
        // Ensure the source and target are not the same
        while (targetIndex === sourceIndex) {
            targetIndex = Math.floor(Math.random() * blockInteractionManager.blocks.length);
        }
    
        const sourceBlock = blockInteractionManager.blocks[sourceIndex];
        const targetBlock = blockInteractionManager.blocks[targetIndex];
    
        // Create a link between the two blocks
        let sourceNode = new SourceNode(sourceBlock, 0);
        let targetNode = new TargetNode(targetBlock, 0);
        linkInteractionManager.createLink(sourceNode, targetNode, []);
    
        vscode.postMessage({ type: 'print', text: `Created link between ${sourceBlock.label} and ${targetBlock.label}` });
    }

    function renderHTML(json: JsonData): void {
        vscode.postMessage({ type: 'print', text: `Render html: ${JSON.stringify(json, null, 2)}` });
        vscode.postMessage({ type: 'print', text: `Rendering ${blockInteractionManager.blocks.length} blocks` });
        canvas.innerHTML = ''; // Clear canvas
        blockInteractionManager.blocks.forEach(block => block.addElementToCanvas(canvas));


        topControls.innerHTML = '';
        // Add button
        const btn = document.createElement('button');
        btn.textContent = 'Add Block';
        btn.addEventListener('click', () => vscode.postMessage({ type: 'addBlock' }));
        topControls.appendChild(btn);

        // Add button to create a link
        const btnCreateLink = document.createElement('button');
        btnCreateLink.textContent = 'Create Link';
        btnCreateLink.addEventListener('click', createRandomLink);
        topControls.appendChild(btnCreateLink);

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

        

        linkInteractionManager.updateLinks();

        centerCanvas();

        setZoom(zoomLevel);

        let svgElement = linkInteractionManager.renderLinks((json.links || []).map(link => ({
            id: link.id,
            sourceId: link.sourceId,
            targetId: link.targetId,
            sourcePort: link.sourcePort, 
            targetPort: link.targetPort, 
            sourceX: link.sourceX,
            sourceY: link.sourceY,
            targetX: link.targetX,
            targetY: link.targetY,
            intermediateNodes: link.intermediateNodes 
        })));

        canvasContainer.appendChild(svgElement);
        linkInteractionManager.updateLinks();
        selectableManager.updateSelectables();      
    }

    

    function centerCanvas(): void {
        // Scroll to the center of the canvas
        // canvasContainer.scrollLeft = (canvas.scrollWidth - canvasContainer.clientWidth) / 2;
        // canvasContainer.scrollTop = (canvas.scrollHeight - canvasContainer.clientHeight) / 2;
    }

    communicationManager.registerLocalJsonChangedCallback(updateWebView);

    function updateWebView(json: JsonData): void {
        vscode.postMessage({ type: 'print', text: `Render html update webview: ${JSON.stringify(json, null, 2)}` });
        vscode.postMessage({ type: 'print', text: `Blocks ${JSON.stringify(json.blocks, null, 2)}` });
        json.blocks?.forEach(blockData => {
            blockInteractionManager.blocks.find(b => b.id === blockData.id)?.moveTo(blockData.x, blockData.y);
            var block = blockInteractionManager.blocks.find(b => b.id === blockData.id);
            if (block) {
                vscode.postMessage({ type: 'print', text: `Block ID exists, updating block: ${blockData.id}, block data: ${blockData}` });
                block.parseStateFromJson(blockData);
            } else {
                vscode.postMessage({ type: 'print', text: `Block ID does not exist, creating block: ${blockData.id}` });
                blockInteractionManager.createBlock(blockData.id, blockData.label, blockData.x, blockData.y, blockData.inputPorts, blockData.outputPorts);
            }
        });

        blockInteractionManager.blocks.forEach((block: Block) => {
            const blockData = json.blocks?.find(b => b.id === block.id);
            if (!blockData) {
                blockInteractionManager.deleteBlock(block, false);
            }
        });

        linkInteractionManager.links.forEach((link: Link) => {
            const linkData = json.links?.find(l => l.id === link.id);
            if (!linkData) {
                linkInteractionManager.deleteLink(link, false);
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

        linkInteractionManager.updateLinks(); // Update the links to match the new zoom level
        vscode.postMessage({ type: 'print', text: `Zoom level: ${zoomLevel}` });
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

        linkInteractionManager.updateLinks();
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