/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./media/Block.ts":
/*!************************!*\
  !*** ./media/Block.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Block: () => (/* binding */ Block)
/* harmony export */ });
class Block {
    id;
    label;
    x;
    y;
    element;
    _isSelected = false;
    inputPorts;
    outputPorts;
    constructor(id, label, x, y, inputPorts, outputPorts, onClick, onMouseDown) {
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        // Create the DOM element for the block
        this.element = this.createElement(onClick, onMouseDown);
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
    }
    getState() {
        return [{
                type: 'move',
                id: this.id,
                x: this.x,
                y: this.y
            }];
    }
    parseStateFromJson(blockData) {
        this.setPosition(blockData.x, blockData.y);
        this.label = blockData.label;
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    select() {
        this._isSelected = true;
        this.element.classList.add('selected');
    }
    unselect() {
        this._isSelected = false;
        this.element.classList.remove('selected');
    }
    isSelected() {
        return this._isSelected;
    }
    toggleSelect() {
        this._isSelected = !this._isSelected;
        if (this._isSelected) {
            this.select();
        }
        else {
            this.unselect();
        }
    }
    createElement(onClick, onMouseDown) {
        const blockElement = document.createElement('div');
        blockElement.classList.add('block');
        blockElement.style.left = `${this.x}px`;
        blockElement.style.top = `${this.y}px`;
        const label = document.createElement('div');
        label.textContent = this.label;
        blockElement.appendChild(label);
        for (let i = 0; i < this.inputPorts; i++) {
            const inputPort = document.createElement('div');
            inputPort.classList.add('input-port');
            inputPort.textContent = `In ${i + 1}`;
            blockElement.appendChild(inputPort);
        }
        // Add output ports
        for (let i = 0; i < this.outputPorts; i++) {
            const outputPort = document.createElement('div');
            outputPort.classList.add('output-port');
            outputPort.textContent = `Out ${i + 1}`;
            blockElement.appendChild(outputPort);
        }
        // Attach event listeners
        blockElement.addEventListener('click', (e) => onClick(this, e));
        blockElement.addEventListener('mousedown', (e) => onMouseDown(this, e));
        return blockElement;
    }
    move(deltaX, deltaY) {
        this.setPosition(this.x + deltaX, this.y + deltaY);
    }
    getElement() {
        return this.element;
    }
    addElementToCanvas(canvas) {
        canvas.appendChild(this.element);
    }
    getPortPosition(portIndex, portType) {
        const portSpacing = 20; // Spacing between ports
        const portOffset = portIndex * portSpacing;
        // Get the block's position relative to the canvas
        const blockX = this.x;
        const blockY = this.y;
        // Adjust for the port type
        if (portType === "input") {
            return { x: blockX, y: blockY + portOffset };
        }
        else {
            return { x: blockX + this.element.offsetWidth, y: blockY + portOffset };
        }
    }
}


/***/ }),

/***/ "./media/BlockInteractionManager.ts":
/*!******************************************!*\
  !*** ./media/BlockInteractionManager.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BlockInteractionManager: () => (/* binding */ BlockInteractionManager)
/* harmony export */ });
/* harmony import */ var _Block__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Block */ "./media/Block.ts");

class BlockInteractionManager {
    blocks = [];
    dragStartX = 0;
    dragStartY = 0;
    dragThreshold = 5; // Minimum distance to detect a drag
    isDragging = false;
    vscode;
    getZoomLevelReal;
    updateLinks;
    constructor(vscode, getZoomLevelReal, updateLinks) {
        this.vscode = vscode;
        this.getZoomLevelReal = getZoomLevelReal;
        this.updateLinks = updateLinks;
    }
    createBlock(id, label, x, y, inputPorts, outputPorts) {
        const block = new _Block__WEBPACK_IMPORTED_MODULE_0__.Block(id, label, x, y, inputPorts, outputPorts, this.onClick, this.onMouseDown);
        this.blocks.push(block);
    }
    unselectAll() {
        this.blocks.forEach(block => block.unselect());
    }
    getSelectedBlocks() {
        return this.blocks.filter(block => block.isSelected());
    }
    onClick(block, e) {
        this.vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
    }
    onMouseDown = (block, e) => {
        this.vscode.postMessage({ type: 'print', text: 'Block mouse down' });
        if (e.button !== 1) {
            this.vscode.postMessage({ type: 'print', text: `Mouse down on block: ${block.label}` });
            if (!block.isSelected()) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    block.toggleSelect();
                }
                else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    block.select();
                }
            }
            // Store the initial mouse position
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.isDragging = false; // Reset dragging state
            // Add a temporary mousemove listener to detect drag threshold
            const onMouseMoveThreshold = (moveEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - this.dragStartX);
                const deltaY = Math.abs(moveEvent.clientY - this.dragStartY);
                if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
                    // Exceeded drag threshold, start dragging
                    this.isDragging = true;
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
                    // Start dragging selected blocks
                    if (!block.isSelected()) {
                        // If the block is not already selected, add it to the selection
                        block.select();
                    }
                    document.addEventListener('mousemove', this.onMouseMove);
                    document.addEventListener('mouseup', this.onMouseUp);
                }
            };
            document.addEventListener('mousemove', onMouseMoveThreshold);
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
                if (!this.isDragging) {
                    this.vscode.postMessage({ type: 'print', text: `As simple click on: ${block.label}` });
                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        block.toggleSelect();
                    }
                    else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        block.select();
                    }
                }
            };
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    onMouseUp = () => {
        this.vscode.postMessage({ type: 'print', text: `Mouse up` });
        if (this.isDragging) {
            this.isDragging = false;
            const stateMessages = this.getSelectedBlocks().flatMap(block => block.getState());
            stateMessages.forEach(message => {
                this.vscode.postMessage({ type: 'print', text: message });
            });
            this.vscode.postMessage({ type: 'moveBatch', updates: stateMessages });
        }
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    };
    onMouseMove = (e) => {
        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        if (this.isDragging) {
            this.getSelectedBlocks().forEach(block => {
                block.move(scaledDeltaX, scaledDeltaY);
            });
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }
        this.updateLinks(this);
    };
}


/***/ }),

/***/ "./media/Link.ts":
/*!***********************!*\
  !*** ./media/Link.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Link: () => (/* binding */ Link)
/* harmony export */ });
class Link {
    sourceId;
    sourcePort;
    targetId;
    targetPort;
    intermediateNodes;
    polylineElement;
    nodeElements = [];
    _isSelected = false;
    constructor(sourceId, sourcePort, targetId, targetPort, intermediateNodes = []) {
        this.sourceId = sourceId;
        this.sourcePort = sourcePort;
        this.targetId = targetId;
        this.targetPort = targetPort;
        this.intermediateNodes = intermediateNodes;
        // Create the SVG polyline element
        this.polylineElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.polylineElement.setAttribute("stroke", "#007acc");
        this.polylineElement.setAttribute("stroke-width", "2");
        this.polylineElement.setAttribute("fill", "none");
        // Add event listeners for interaction
        this.polylineElement.addEventListener('click', this.onClick);
        this.polylineElement.addEventListener('dblclick', this.onDoubleClick);
    }
    updatePosition(blocks) {
        const sourceBlock = blocks.find(block => block.id === this.sourceId);
        const targetBlock = blocks.find(block => block.id === this.targetId);
        if (sourceBlock && targetBlock) {
            const sourcePos = sourceBlock.getPortPosition(this.sourcePort, "output");
            const targetPos = targetBlock.getPortPosition(this.targetPort, "input");
            // Combine source, intermediate nodes, and target into a single points string
            const points = [
                `${sourcePos.x},${sourcePos.y}`,
                ...this.intermediateNodes.map(node => `${node.x},${node.y}`),
                `${targetPos.x},${targetPos.y}`
            ].join(" ");
            this.polylineElement.setAttribute("points", points);
            this.nodeElements.forEach((nodeElement, index) => {
                const node = this.intermediateNodes[index];
                nodeElement.setAttribute('cx', `${node.x}`);
                nodeElement.setAttribute('cy', `${node.y}`);
            });
        }
    }
    addToSvg(svg) {
        svg.appendChild(this.polylineElement);
        // Add intermediate node elements
        this.intermediateNodes.forEach(node => {
            const nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            nodeElement.setAttribute("r", "5");
            nodeElement.setAttribute("fill", "#007acc");
            nodeElement.setAttribute("cx", `${node.x}`);
            nodeElement.setAttribute("cy", `${node.y}`);
            nodeElement.addEventListener('mousedown', this.onNodeMouseDown(node));
            svg.appendChild(nodeElement);
            this.nodeElements.push(nodeElement);
        });
    }
    removeFromSvg(svg) {
        svg.removeChild(this.polylineElement);
    }
    onClick = (e) => {
        this.toggleSelect();
    };
    onDoubleClick = (e) => {
        const rect = this.polylineElement.getBoundingClientRect();
        const newNode = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.intermediateNodes.push(newNode);
        this.updatePosition([]);
    };
    onNodeMouseDown = (node) => (e) => {
        const onMouseMove = (moveEvent) => {
            node.x = moveEvent.clientX;
            node.y = moveEvent.clientY;
            this.updatePosition([]);
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    select() {
        this._isSelected = true;
        // this.element.classList.add('selected');
        this.polylineElement.setAttribute("stroke", this._isSelected ? "#ff0000" : "#007acc");
    }
    unselect() {
        this._isSelected = false;
        // this.element.classList.remove('selected');
        this.polylineElement.setAttribute("stroke", this._isSelected ? "#ff0000" : "#007acc");
    }
    isSelected() {
        return this._isSelected;
    }
    toggleSelect() {
        this._isSelected = !this._isSelected;
        if (this._isSelected) {
            this.select();
        }
        else {
            this.unselect();
        }
    }
    getBoundingBox() {
        const points = [
            ...this.intermediateNodes,
            { x: this.polylineElement.getBBox().x, y: this.polylineElement.getBBox().y }
        ];
        // Calculate the bounding box
        const left = Math.min(...points.map(point => point.x));
        const right = Math.max(...points.map(point => point.x));
        const top = Math.min(...points.map(point => point.y));
        const bottom = Math.max(...points.map(point => point.y));
        return { top, bottom, right, left };
    }
}


/***/ }),

/***/ "./media/LinkInteractionManager.ts":
/*!*****************************************!*\
  !*** ./media/LinkInteractionManager.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LinkInteractionManager: () => (/* binding */ LinkInteractionManager)
/* harmony export */ });
/* harmony import */ var _Link__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Link */ "./media/Link.ts");

class LinkInteractionManager {
    links = [];
    linksSvg;
    canvas;
    vscode;
    constructor(vscode, canvas, linksSvg) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
    }
    createLink(sourceId, sourcePort, targetId, targetPort, intermediateNodes, blockInteractionManager) {
        const link = new _Link__WEBPACK_IMPORTED_MODULE_0__.Link(sourceId, sourcePort, targetId, targetPort, intermediateNodes);
        this.links.push(link);
        this.vscode.postMessage({ type: 'addLink', sourceId: link.sourceId, sourcePort: link.sourcePort, targetId: link.targetId, targetPort: link.targetPort, intermediateNodes: link.intermediateNodes });
        link.addToSvg(this.linksSvg);
        this.updateLinks(blockInteractionManager);
    }
    updateLinks = (blockInteractionManager) => {
        this.linksSvg = document.querySelector('.links');
        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
        }
        this.linksSvg.style.width = `${this.canvas.offsetWidth}px`;
        this.linksSvg.style.height = `${this.canvas.offsetHeight}px`;
        this.linksSvg.style.transform = this.canvas.style.transform; // Match the canvas transform (e.g., scale)
        this.links.forEach(link => link.addToSvg(this.linksSvg));
        this.links.forEach(link => link.updatePosition(blockInteractionManager.blocks));
        this.canvas.appendChild(this.linksSvg);
    };
    unselectAll() {
        this.links.forEach(link => {
            link.unselect();
        });
    }
    deleteLink(link) {
        link.removeFromSvg(this.linksSvg);
        const index = this.links.indexOf(link);
        if (index !== -1) {
            this.links.splice(index, 1);
        }
    }
    renderLinks(linksData, blockInteractionManager) {
        this.vscode.postMessage({ type: 'print', text: `Render links` });
        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
            this.linksSvg.style.position = 'absolute';
            this.linksSvg.style.top = '0';
            this.linksSvg.style.left = '0';
            this.linksSvg.style.width = '100%';
            this.linksSvg.style.height = '100%';
            this.linksSvg.style.pointerEvents = 'all';
        }
        // Clear existing links
        this.links.forEach(link => link.removeFromSvg(this.linksSvg));
        this.links.length = 0;
        // Create and render new links
        linksData.forEach(linkData => {
            const link = new _Link__WEBPACK_IMPORTED_MODULE_0__.Link(linkData.sourceId, linkData.sourcePort, linkData.targetId, linkData.targetPort, linkData.intermediateNodes);
            this.links.push(link);
            link.addToSvg(this.linksSvg);
            link.updatePosition(blockInteractionManager.blocks);
        });
        return this.linksSvg;
    }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!******************************!*\
  !*** ./media/blockEditor.ts ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _BlockInteractionManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./BlockInteractionManager */ "./media/BlockInteractionManager.ts");
/* harmony import */ var _LinkInteractionManager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./LinkInteractionManager */ "./media/LinkInteractionManager.ts");


const vscode = acquireVsCodeApi();
(function () {
    const canvas = document.querySelector('.canvas');
    const zoomContainer = document.querySelector('.zoom-container');
    const topControls = document.querySelector('.top-controls');
    const canvasContainer = document.querySelector('.canvas-container');
    let dragStartX = 0;
    let dragStartY = 0;
    let selectionBox = null;
    let zoomLevel = 2; // Default zoom level
    const zoomStep = 0.1; // Step for zooming in/out
    const minZoom = 1; // Minimum zoom level
    const maxZoom = 4; // Maximum zoom level
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let canvasHeigh = 4000;
    let canvasWidth = 8000;
    let linkInteractionManager = new _LinkInteractionManager__WEBPACK_IMPORTED_MODULE_1__.LinkInteractionManager(vscode, canvas, document.querySelector('.links'));
    let blockInteractionManager = new _BlockInteractionManager__WEBPACK_IMPORTED_MODULE_0__.BlockInteractionManager(vscode, getZoomLevelReal, linkInteractionManager.updateLinks);
    function getZoomLevelReal() {
        return zoomLevel / 2;
    }
    function onMouseDownInCanvas(e) {
        if (e.button !== 1) {
            if (e.target !== canvas) {
                return; // Ignore clicks on child elements
            }
            startBoxSelection(e);
        }
    }
    function onMouseUp() {
        vscode.postMessage({ type: 'print', text: `Mouse up` });
        if (selectionBox) {
            // End box selection
            canvas.removeChild(selectionBox);
            selectionBox = null;
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    function onMouseMove(e) {
        linkInteractionManager.updateLinks(blockInteractionManager);
        if (selectionBox) {
            // Update selection box size
            const canvasRect = canvas.getBoundingClientRect();
            const adjustedX = (e.clientX - canvasRect.left) / getZoomLevelReal();
            const adjustedY = (e.clientY - canvasRect.top) / getZoomLevelReal();
            const scaledWidth = (adjustedX - dragStartX);
            const scaledHeight = (adjustedY - dragStartY);
            selectionBox.style.left = `${Math.min(dragStartX, adjustedX)}px`;
            selectionBox.style.top = `${Math.min(dragStartY, adjustedY)}px`;
            selectionBox.style.width = `${Math.abs(scaledWidth)}px`;
            selectionBox.style.height = `${Math.abs(scaledHeight)}px`;
            // Update selected blocks based on the selection box
            updateSelectionBox();
        }
    }
    function startBoxSelection(e) {
        blockInteractionManager.unselectAll();
        linkInteractionManager.unselectAll();
        vscode.postMessage({ type: 'print', text: `Start box selection at ${e.clientX}, ${e.clientY}` });
        // Get the canvas's bounding rectangle
        const canvasRect = canvas.getBoundingClientRect();
        // Adjust mouse coordinates to be relative to the canvas
        const adjustedX = (e.clientX - canvasRect.left) / getZoomLevelReal();
        const adjustedY = (e.clientY - canvasRect.top) / getZoomLevelReal();
        selectionBox = document.createElement('div');
        selectionBox.className = 'selection-box';
        canvas.appendChild(selectionBox);
        dragStartX = adjustedX;
        dragStartY = adjustedY;
        selectionBox.style.left = `${dragStartX}px`;
        selectionBox.style.top = `${dragStartY}px`;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    function updateSelectionBox() {
        const boxRect = selectionBox.getBoundingClientRect();
        blockInteractionManager.blocks.forEach(block => {
            const blockEl = block.getElement();
            const blockRect = blockEl.getBoundingClientRect();
            if (blockRect.left < boxRect.right &&
                blockRect.right > boxRect.left &&
                blockRect.top < boxRect.bottom &&
                blockRect.bottom > boxRect.top) {
                block.select();
            }
            else {
                block.unselect();
            }
        });
        linkInteractionManager.links.forEach(link => {
            const blockRect = link.getBoundingBox();
            if (blockRect.left < boxRect.right &&
                blockRect.right > boxRect.left &&
                blockRect.top < boxRect.bottom &&
                blockRect.bottom > boxRect.top) {
                link.select();
            }
            else {
                link.unselect();
            }
        });
    }
    function createRandomLink() {
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
        linkInteractionManager.createLink(sourceBlock.id, 0, targetBlock.id, 0, [], blockInteractionManager);
        vscode.postMessage({ type: 'print', text: `Created link between ${sourceBlock.label} and ${targetBlock.label}` });
    }
    function renderHTML(json) {
        vscode.postMessage({ type: 'print', text: `Render html` });
        vscode.postMessage({ type: 'print', text: `Rendering ${blockInteractionManager.blocks.length} blocks` });
        canvas.innerHTML = ''; // Clear canvas
        blockInteractionManager.blocks.forEach(block => block.addElementToCanvas(canvas));
        canvas.addEventListener('mousedown', onMouseDownInCanvas);
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
        linkInteractionManager.updateLinks(blockInteractionManager);
        centerCanvas();
        setZoom(zoomLevel);
        let svgElement = linkInteractionManager.renderLinks((json.links || []).map(link => ({
            sourceId: link.sourceId,
            targetId: link.targetId,
            sourcePort: link.sourcePort,
            targetPort: link.targetPort,
            intermediateNodes: link.intermediateNodes
        })), blockInteractionManager);
        canvasContainer.appendChild(svgElement);
        linkInteractionManager.updateLinks(blockInteractionManager);
    }
    function centerCanvas() {
        // Scroll to the center of the canvas
        // canvasContainer.scrollLeft = (canvas.scrollWidth - canvasContainer.clientWidth) / 2;
        // canvasContainer.scrollTop = (canvas.scrollHeight - canvasContainer.clientHeight) / 2;
    }
    function updateWebView(jsonText) {
        vscode.postMessage({ type: 'print', text: `Update blocks` });
        let json;
        try {
            json = JSON.parse(jsonText || '{}');
        }
        catch {
            canvas.textContent = 'Invalid JSON';
            return;
        }
        json.blocks?.forEach(blockData => {
            blockInteractionManager.blocks.find(b => b.id === blockData.id)?.move(blockData.x, blockData.y);
            var block = blockInteractionManager.blocks.find(b => b.id === blockData.id);
            if (block) {
                block.parseStateFromJson(blockData);
            }
            else {
                vscode.postMessage({ type: 'print', text: `Block ID does not exist, creating block: ${blockData.id}` });
                blockInteractionManager.createBlock(blockData.id, blockData.label, blockData.x, blockData.y, blockData.inputPorts, blockData.outputPorts);
            }
        });
        renderHTML(json);
    }
    function setZoom(level) {
        // Clamp the zoom level between minZoom and maxZoom
        zoomLevel = Math.min(maxZoom, Math.max(minZoom, level));
        zoomContainer.style.transform = `scale(${zoomLevel})`;
        // Dynamically adjust the canvas size based on the zoom level
        const scaledWidth = Math.min(canvasWidth / 2 * zoomLevel, canvasWidth / 2);
        const scaledHeight = Math.min(canvasHeigh / 2 * zoomLevel, canvasHeigh / 2);
        zoomContainer.style.width = `${scaledWidth}px`;
        zoomContainer.style.height = `${scaledHeight}px`;
        linkInteractionManager.updateLinks(blockInteractionManager); // Update the links to match the new zoom level
        vscode.postMessage({ type: 'print', text: `Zoom level: ${zoomLevel}` });
    }
    function handleMouseWheelZoom(e) {
        e.preventDefault(); // Prevent default scrolling behavior
        // Adjust zoom level based on scroll direction
        if (e.deltaY < 0) {
            setZoom(zoomLevel + zoomStep); // Zoom in
        }
        else if (e.deltaY > 0) {
            setZoom(zoomLevel - zoomStep); // Zoom out
        }
    }
    function onMouseDownForPanning(e) {
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
    function onMouseMoveForPanning(e) {
        if (!isPanning) {
            return;
        }
        // Calculate the distance moved
        const deltaX = e.clientX - panStartX;
        const deltaY = e.clientY - panStartY;
        // Adjust the scroll position of the canvasContainer
        canvasContainer.scrollLeft -= deltaX;
        canvasContainer.scrollTop -= deltaY;
        // Update the starting position for the next movement
        panStartX = e.clientX;
        panStartY = e.clientY;
        linkInteractionManager.updateLinks(blockInteractionManager);
    }
    function onMouseUpForPanning(e) {
        if (e.button === 1) { // Middle mouse button
            isPanning = false;
            canvasContainer.classList.remove('panning'); // Remove the class
            // Remove the event listeners
            document.removeEventListener('mousemove', onMouseMoveForPanning);
            document.removeEventListener('mouseup', onMouseUpForPanning);
        }
    }
    // Listen for messages from extension
    window.addEventListener('message', (e) => {
        if (e.data.type === 'update') {
            updateWebView(e.data.text);
            vscode.setState({ text: e.data.text });
        }
    });
    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        updateWebView(state.text);
    }
})();

})();

/******/ })()
;
//# sourceMappingURL=blockEditor.js.map