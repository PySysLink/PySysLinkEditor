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
    onClick = (block, e) => {
        this.vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
    };
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
/* harmony export */   Link: () => (/* binding */ Link),
/* harmony export */   LinkNode: () => (/* binding */ LinkNode),
/* harmony export */   LinkSegment: () => (/* binding */ LinkSegment),
/* harmony export */   SourceNode: () => (/* binding */ SourceNode),
/* harmony export */   TargetNode: () => (/* binding */ TargetNode)
/* harmony export */ });
/* harmony import */ var _Block__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Block */ "./media/Block.ts");

class LinkNode {
    id;
    x;
    y;
    nodeElement;
    isSelected = false;
    isHighlighted = false;
    moveCallbacks = [];
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
    }
    createNodeElement(onMouseDown) {
        this.nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        this.nodeElement.classList.add('link-node');
        this.nodeElement.setAttribute("cx", `${this.x}`);
        this.nodeElement.setAttribute("cy", `${this.y}`);
        this.nodeElement.addEventListener('mousedown', (e) => onMouseDown(this, e));
        if (this.isSelected) {
            this.nodeElement.classList.add('selected');
        }
        if (this.isHighlighted) {
            this.nodeElement.classList.add('highlighted');
        }
        this.moveCallbacks.forEach(callback => callback(this.x, this.y));
    }
    moveTo(x, y) {
        this.x = x;
        this.y = y;
        if (this.nodeElement) {
            this.nodeElement.setAttribute("cx", `${this.x}`);
            this.nodeElement.setAttribute("cy", `${this.y}`);
        }
        this.moveCallbacks.forEach(callback => callback(this.x, this.y));
    }
    addCallback(callback) {
        this.moveCallbacks.push(callback);
    }
    select() {
        this.isSelected = true;
        if (this.nodeElement) {
            this.nodeElement.classList.add('selected');
        }
    }
    unselect() {
        this.isSelected = false;
        if (this.nodeElement) {
            this.nodeElement.classList.remove('selected');
        }
    }
    toggleSelect() {
        if (this.isSelected) {
            this.unselect();
        }
        else {
            this.select();
        }
    }
    highlight() {
        this.isHighlighted = true;
        if (this.nodeElement) {
            this.nodeElement.classList.add('highlighted');
        }
    }
    unhighlight() {
        this.isHighlighted = false;
        if (this.nodeElement) {
            this.nodeElement.classList.remove('highlighted');
        }
    }
}
class SourceNode extends LinkNode {
    connectedPort;
    constructor(xOrBlock, yOrIndex) {
        if (typeof xOrBlock === 'number' && typeof yOrIndex === 'number') {
            super(String(xOrBlock) + String(yOrIndex), xOrBlock, yOrIndex);
        }
        else if (xOrBlock instanceof _Block__WEBPACK_IMPORTED_MODULE_0__.Block && typeof yOrIndex === 'number') {
            const connectedPort = { block: xOrBlock, index: yOrIndex };
            const position = connectedPort.block.getPortPosition(connectedPort.index, "output");
            super(connectedPort.block.id + yOrIndex, position.x, position.y);
            this.connectedPort = connectedPort;
        }
        else {
            throw new Error("Invalid arguments provided to SourceNode constructor");
        }
    }
    createNodeElement(onMouseDown) {
        super.createNodeElement(onMouseDown);
        if (this.nodeElement) {
            this.nodeElement.classList.add('source-node');
        }
    }
    moveTo(x, y) {
        if (this.connectedPort) {
            this.connectedPort = undefined;
        }
        super.moveTo(x, y);
    }
    attachToPort(block, index) {
        this.connectedPort = { block: block, index: index };
        this.moveToAttachedPort();
    }
    moveToAttachedPort() {
        const position = this.connectedPort?.block.getPortPosition(this.connectedPort.index, "output");
        if (position) {
            super.moveTo(position.x, position.y);
        }
    }
}
class TargetNode extends LinkNode {
    connectedPort;
    constructor(xOrBlock, yOrIndex) {
        if (typeof xOrBlock === 'number' && typeof yOrIndex === 'number') {
            super(String(xOrBlock) + String(yOrIndex), xOrBlock, yOrIndex);
        }
        else if (xOrBlock instanceof _Block__WEBPACK_IMPORTED_MODULE_0__.Block && typeof yOrIndex === 'number') {
            const connectedPort = { block: xOrBlock, index: yOrIndex };
            const position = connectedPort.block.getPortPosition(connectedPort.index, "input");
            super(connectedPort.block.id + yOrIndex, position.x, position.y);
            this.connectedPort = connectedPort;
        }
        else {
            throw new Error("Invalid arguments provided to SourceNode constructor");
        }
    }
    createNodeElement(onMouseDown) {
        super.createNodeElement(onMouseDown);
        if (this.nodeElement) {
            this.nodeElement.classList.add('target-node');
        }
    }
    moveTo(x, y) {
        if (this.connectedPort) {
            this.connectedPort = undefined;
        }
        super.moveTo(x, y);
    }
    attachToPort(block, index) {
        this.connectedPort = { block: block, index: index };
        this.moveToAttachedPort();
    }
    moveToAttachedPort() {
        const position = this.connectedPort?.block.getPortPosition(this.connectedPort.index, "input");
        if (position) {
            super.moveTo(position.x, position.y);
        }
    }
}
class LinkSegment {
    sourceLinkNode;
    targetLinkNode;
    segmentElement;
    isSelected = false;
    constructor(sourceLinkNode, targetLinkNode) {
        this.sourceLinkNode = sourceLinkNode;
        this.sourceLinkNode.addCallback(this.updateSourceLinkNodePosition);
        this.targetLinkNode = targetLinkNode;
        this.targetLinkNode.addCallback(this.updateTargetLinkNodePosition);
        console.log(`link created: ${this.sourceLinkNode.x}`);
    }
    createSegmentElement(onMouseDown) {
        console.log(`segment element created: ${this.sourceLinkNode.x}`);
        this.segmentElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.segmentElement.classList.add('link-line');
        if (this.isSelected) {
            this.segmentElement.classList.add('selected');
        }
        this.segmentElement.addEventListener('mousedown', (e) => onMouseDown(this, e));
        this.updatePosition();
    }
    updatePosition() {
        const segmentPoints = [
            { x: this.sourceLinkNode.x, y: this.sourceLinkNode.y },
            { x: this.targetLinkNode.x, y: this.targetLinkNode.y }
        ];
        const pointsString = segmentPoints.map(p => `${p.x},${p.y}`).join(" ");
        this.segmentElement?.setAttribute("points", pointsString);
    }
    updateSourceLinkNodePosition = (x, y) => {
        this.updatePosition();
    };
    updateTargetLinkNodePosition = (x, y) => {
        this.updatePosition();
    };
    select() {
        this.isSelected = true;
        if (this.segmentElement) {
            this.segmentElement.classList.add('selected');
        }
    }
    unselect() {
        console.log("unselected");
        this.isSelected = false;
        if (this.segmentElement) {
            this.segmentElement.classList.remove('selected');
        }
    }
    toggleSelect() {
        if (this.isSelected) {
            this.unselect();
        }
        else {
            this.select();
        }
    }
}
class Link {
    sourceNode;
    targetNode;
    intermediateNodes = [];
    segments = [];
    id;
    onMouseDownSegment;
    onMouseDownNode;
    constructor(id, sourceNode, targetNode, intermediateNodes = [], onMouseDownSegment, onMouseDownNode) {
        this.id = id;
        this.sourceNode = sourceNode;
        this.targetNode = targetNode;
        this.intermediateNodes = intermediateNodes;
        this.onMouseDownSegment = onMouseDownSegment;
        this.onMouseDownNode = onMouseDownNode;
    }
    updateSegments() {
        let newSegments = [];
        if (this.intermediateNodes.length === 0) {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments = [existingSegment];
            }
            else {
                newSegments = [new LinkSegment(this.sourceNode, this.targetNode)];
            }
        }
        else {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.intermediateNodes[0]);
            if (existingSegment) {
                newSegments = [existingSegment];
            }
            else {
                newSegments = [new LinkSegment(this.sourceNode, this.intermediateNodes[0])];
            }
            for (let i = 0; i < this.intermediateNodes.length - 1; i++) {
                existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[i] && segment.targetLinkNode === this.intermediateNodes[i + 1]);
                if (existingSegment) {
                    newSegments.push(existingSegment);
                }
                else {
                    newSegments.push(new LinkSegment(this.intermediateNodes[i], this.intermediateNodes[i + 1]));
                }
            }
            existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[this.intermediateNodes.length - 1] && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments.push(existingSegment);
            }
            else {
                newSegments.push(new LinkSegment(this.intermediateNodes[this.intermediateNodes.length - 1], this.targetNode));
            }
        }
        this.segments = newSegments;
        this.segments.forEach(segment => segment.updatePosition());
    }
    updatePosition() {
        this.sourceNode.moveToAttachedPort();
        this.targetNode.moveToAttachedPort();
        this.segments.forEach(segment => segment.updatePosition());
    }
    addToSvg(svg) {
        this.updateSegments();
        this.segments.forEach(segment => {
            segment.createSegmentElement(this.onMouseDownSegment);
            console.log(`Total segment amount: ${this.segments.length}`);
            if (segment.segmentElement) {
                svg.appendChild(segment.segmentElement);
            }
            else {
                throw RangeError("Segment element should not be null");
            }
        });
        this.intermediateNodes.forEach(node => {
            node.createNodeElement(this.onMouseDownNode);
            if (node.nodeElement) {
                svg.appendChild(node.nodeElement);
            }
        });
        this.sourceNode.createNodeElement(this.onMouseDownNode);
        if (this.sourceNode.nodeElement) {
            svg.appendChild(this.sourceNode.nodeElement);
        }
        this.targetNode.createNodeElement(this.onMouseDownNode);
        if (this.targetNode.nodeElement) {
            svg.appendChild(this.targetNode.nodeElement);
        }
    }
    removeFromSvg(svg) {
        this.segments.forEach(segment => {
            if (segment.segmentElement) {
                svg.removeChild(segment.segmentElement);
            }
        });
        this.intermediateNodes.forEach(node => {
            if (node.nodeElement) {
                svg.removeChild(node.nodeElement);
            }
        });
        if (this.sourceNode.nodeElement) {
            svg.removeChild(this.sourceNode.nodeElement);
        }
        if (this.targetNode.nodeElement) {
            svg.removeChild(this.targetNode.nodeElement);
        }
    }
    select() {
        this.segments.forEach(segment => segment.select());
        this.intermediateNodes.forEach(node => node.select());
        this.sourceNode.select();
        this.targetNode.select();
    }
    unselect() {
        this.segments.forEach(segment => segment.unselect());
        this.intermediateNodes.forEach(node => node.unselect());
        this.sourceNode.unselect();
        this.targetNode.unselect();
    }
    getState() {
        var result = [];
        let sourcePort = this.sourceNode.connectedPort;
        let targetPort = this.targetNode.connectedPort;
        this.intermediateNodes.forEach((node, index) => {
            result.push({
                type: 'moveLinkNode',
                id: this.id,
                sourceId: sourcePort ? sourcePort.block.id : 'undefined',
                sourcePort: sourcePort ? sourcePort.index : -1,
                targetId: targetPort ? targetPort.block.id : 'undefined',
                targetPort: targetPort ? targetPort.index : -1,
                nodeIndex: index,
                nodeId: node.id,
                x: node.x,
                y: node.y
            });
        });
        result.push({ type: 'moveLinkNode',
            id: this.id,
            sourceId: sourcePort ? sourcePort.block.id : 'undefined',
            sourcePort: sourcePort ? sourcePort.index : -1,
            targetId: targetPort ? targetPort.block.id : 'undefined',
            targetPort: targetPort ? targetPort.index : -1,
            nodeIndex: -1, // -1 for sourceNode
            nodeId: this.sourceNode.id,
            x: this.sourceNode.x,
            y: this.sourceNode.y
        });
        result.push({ type: 'moveLinkNode',
            id: this.id,
            sourceId: sourcePort ? sourcePort.block.id : 'undefined',
            sourcePort: sourcePort ? sourcePort.index : -1,
            targetId: targetPort ? targetPort.block.id : 'undefined',
            targetPort: targetPort ? targetPort.index : -1,
            nodeIndex: -2, // -2 for targetNode
            nodeId: this.targetNode.id,
            x: this.targetNode.x,
            y: this.targetNode.y
        });
        return result;
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
    dragStartX = 0;
    dragStartY = 0;
    isDragging = false;
    dragThreshold = 5;
    getZoomLevelReal;
    blockInteractionManager;
    constructor(vscode, canvas, linksSvg, getZoomLevelReal, blockInteractionManager) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.getZoomLevelReal = getZoomLevelReal;
        this.blockInteractionManager = blockInteractionManager;
    }
    createLink(sourceNode, targetNode, intermediateNodes = []) {
        let intermediateNodesData = [];
        intermediateNodes.forEach(node => intermediateNodesData.push({ x: node.x, y: node.y }));
        this.vscode.postMessage({ type: 'addLink',
            sourceId: sourceNode.connectedPort?.block.id,
            sourcePort: sourceNode.connectedPort?.index,
            targetId: targetNode.connectedPort?.block.id,
            targetPort: targetNode.connectedPort?.index,
            intermediateNodes: intermediateNodesData });
    }
    updateLinks = () => {
        this.linksSvg = document.querySelector('.links');
        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
        }
        while (this.linksSvg.firstChild) {
            this.linksSvg.removeChild(this.linksSvg.firstChild);
        }
        this.linksSvg.style.width = `${this.canvas.offsetWidth}px`;
        this.linksSvg.style.height = `${this.canvas.offsetHeight}px`;
        this.linksSvg.style.transform = this.canvas.style.transform; // Match the canvas transform (e.g., scale)
        this.links.forEach(link => link.addToSvg(this.linksSvg));
        this.links.forEach(link => link.updatePosition());
        this.canvas.appendChild(this.linksSvg);
    };
    unselectAll() {
        this.links.forEach(link => link.unselect());
    }
    getSelectedLinkSegments() {
        var result = [];
        this.links.forEach(link => {
            link.segments.forEach(segment => {
                if (segment.isSelected) {
                    result.push(segment);
                }
            });
        });
        return result;
    }
    getSelectedLinkNodes() {
        var result = [];
        this.links.forEach(link => {
            link.intermediateNodes.forEach(node => {
                if (node.isSelected) {
                    result.push(node);
                }
            });
            if (link.sourceNode.isSelected) {
                result.push(link.sourceNode);
            }
            if (link.targetNode.isSelected) {
                result.push(link.targetNode);
            }
        });
        return result;
    }
    getSelectedLinks() {
        var result = [];
        this.links.forEach(link => {
            for (let segment of link.segments) {
                if (segment.isSelected) {
                    result.push(link);
                    break;
                }
            }
        });
        return result;
    }
    deleteLink(link) {
        link.removeFromSvg(this.linksSvg);
        const index = this.links.indexOf(link);
        if (index !== -1) {
            this.links.splice(index, 1);
        }
    }
    renderLinks(linksData) {
        this.vscode.postMessage({ type: 'print', text: `Render links` });
        this.linksSvg = document.querySelector('.links');
        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
        }
        while (this.linksSvg.firstChild) {
            this.linksSvg.removeChild(this.linksSvg.firstChild);
        }
        // Create and render new links
        linksData.forEach(linkData => {
            let currentLink = this.links.find(link => link.id === linkData.id);
            if (currentLink) {
                currentLink.intermediateNodes.forEach((node, index) => {
                    node.x = linkData.intermediateNodes[index].x;
                    node.y = linkData.intermediateNodes[index].y;
                });
            }
            else {
                this.vscode.postMessage({ type: 'print', text: `Link ID does not exist, creating link: ${linkData.id}` });
                let sourceNode;
                let targetNode;
                if (linkData.sourceId !== 'undefined') {
                    let sourceBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.sourceId);
                    if (!sourceBlock) {
                        throw RangeError(`Source block of id: ${linkData.sourceId} not found`);
                    }
                    sourceNode = new _Link__WEBPACK_IMPORTED_MODULE_0__.SourceNode(sourceBlock, linkData.sourcePort);
                }
                else {
                    sourceNode = new _Link__WEBPACK_IMPORTED_MODULE_0__.SourceNode(linkData.sourceX, linkData.sourceY);
                }
                if (linkData.targetId !== 'undefined') {
                    let targetBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.targetId);
                    if (!targetBlock) {
                        throw RangeError(`Target block of id: ${linkData.targetId} not found`);
                    }
                    targetNode = new _Link__WEBPACK_IMPORTED_MODULE_0__.TargetNode(targetBlock, linkData.targetPort);
                }
                else {
                    targetNode = new _Link__WEBPACK_IMPORTED_MODULE_0__.TargetNode(linkData.targetX, linkData.targetY);
                }
                let intermediateNodes = [];
                linkData.intermediateNodes.forEach(intermediateData => {
                    intermediateNodes.push(new _Link__WEBPACK_IMPORTED_MODULE_0__.LinkNode(intermediateData.id, intermediateData.x, intermediateData.y));
                });
                currentLink = new _Link__WEBPACK_IMPORTED_MODULE_0__.Link(linkData.id, sourceNode, targetNode, intermediateNodes, this.onMouseDownSegment, this.onMouseDownNode);
                this.links.push(currentLink);
            }
            currentLink.addToSvg(this.linksSvg);
            currentLink.updatePosition();
            console.log(`Total links: ${this.links.length}`);
        });
        return this.linksSvg;
    }
    onMouseDownSegment = (linkSegment, e) => {
        this.vscode.postMessage({ type: 'print', text: 'Link mouse down' });
        if (e.button !== 1) {
            this.vscode.postMessage({ type: 'print', text: `Mouse down on link segment: ${linkSegment.sourceLinkNode.x}` });
            if (!linkSegment.isSelected) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    linkSegment.toggleSelect();
                }
                else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    linkSegment.select();
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
                    this.vscode.postMessage({ type: 'print', text: `Mouse drag start: ${linkSegment.sourceLinkNode.x}` });
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
                    document.removeEventListener('mouseup', onMouseUpThreshold);
                    // Start dragging selected blocks
                    if (!linkSegment.isSelected) {
                        // If the block is not already selected, add it to the selection
                        linkSegment.select();
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
                    this.vscode.postMessage({ type: 'print', text: `As simple click on link segment: ${linkSegment.sourceLinkNode.x}` });
                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        linkSegment.toggleSelect();
                    }
                    else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        linkSegment.select();
                    }
                }
            };
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    onMouseDownNode = (linkNode, e) => {
        this.vscode.postMessage({ type: 'print', text: 'Link mouse down' });
        if (e.button !== 1) {
            this.vscode.postMessage({ type: 'print', text: `Mouse down on link segment: ${linkNode.id}` });
            if (!linkNode.isSelected) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    linkNode.toggleSelect();
                }
                else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    linkNode.select();
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
                    this.vscode.postMessage({ type: 'print', text: `Mouse drag start: ${linkNode.id}` });
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
                    document.removeEventListener('mouseup', onMouseUpThreshold);
                    // Start dragging selected blocks
                    if (!linkNode.isSelected) {
                        // If the block is not already selected, add it to the selection
                        linkNode.select();
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
                    this.vscode.postMessage({ type: 'print', text: `As simple click on link segment: ${linkNode.id}` });
                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        linkNode.toggleSelect();
                    }
                    else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        linkNode.select();
                    }
                }
            };
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    onMouseUp = () => {
        this.vscode.postMessage({ type: 'print', text: `Mouse up links` });
        if (this.isDragging) {
            this.isDragging = false;
            let nodesToMove = new Set();
            this.getSelectedLinkSegments().forEach(linkSegment => {
                nodesToMove.add(linkSegment.sourceLinkNode);
                nodesToMove.add(linkSegment.targetLinkNode);
            });
            this.getSelectedLinkNodes().forEach(node => nodesToMove.add(node));
            nodesToMove.forEach(node => {
                const port = this.detectPort(node);
                if (port) {
                    node.unhighlight();
                    if (port.portType === "input" && node instanceof _Link__WEBPACK_IMPORTED_MODULE_0__.TargetNode) {
                        node.attachToPort(port.block, port.portIndex);
                    }
                    else if (port.portType === "output" && node instanceof _Link__WEBPACK_IMPORTED_MODULE_0__.SourceNode) {
                        node.attachToPort(port.block, port.portIndex);
                    }
                }
                else {
                    node.unhighlight();
                }
            });
            const stateMessages = this.links.flatMap(link => link.getState());
            this.vscode.postMessage({ type: 'moveLinkBatch', updates: stateMessages });
        }
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    };
    onMouseMove = (e) => {
        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        this.vscode.postMessage({ type: 'print', text: `Move links x: ${scaledDeltaX} y: ${scaledDeltaY}` });
        if (this.isDragging) {
            let nodesToMove = new Set();
            this.getSelectedLinkSegments().forEach(linkSegment => {
                nodesToMove.add(linkSegment.sourceLinkNode);
                nodesToMove.add(linkSegment.targetLinkNode);
            });
            this.getSelectedLinkNodes().forEach(node => nodesToMove.add(node));
            nodesToMove.forEach(node => {
                node.moveTo(node.x + scaledDeltaX, node.y + scaledDeltaY);
                // Detect if the node is over a port
                const port = this.detectPort(node);
                if (port) {
                    if (port.portType === "input" && node instanceof _Link__WEBPACK_IMPORTED_MODULE_0__.TargetNode) {
                        node.highlight();
                    }
                    else if (port.portType === "output" && node instanceof _Link__WEBPACK_IMPORTED_MODULE_0__.SourceNode) {
                        node.highlight();
                    }
                    else {
                        node.unhighlight();
                    }
                }
                else {
                    node.unhighlight();
                }
            });
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }
        this.updateLinks();
    };
    detectPort(node) {
        for (const block of this.blockInteractionManager.blocks) {
            for (let i = 0; i < block.inputPorts; i++) {
                const portPosition = block.getPortPosition(i, "input");
                if (Math.abs(node.x - portPosition.x) < 10 && Math.abs(node.y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "input" };
                }
            }
            for (let i = 0; i < block.outputPorts; i++) {
                const portPosition = block.getPortPosition(i, "output");
                if (Math.abs(node.x - portPosition.x) < 10 && Math.abs(node.y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "output" };
                }
            }
        }
        return null;
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
/* harmony import */ var _Link__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Link */ "./media/Link.ts");
/* harmony import */ var _BlockInteractionManager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./BlockInteractionManager */ "./media/BlockInteractionManager.ts");
/* harmony import */ var _LinkInteractionManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./LinkInteractionManager */ "./media/LinkInteractionManager.ts");



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
    let linkInteractionManager;
    let blockInteractionManager;
    blockInteractionManager = new _BlockInteractionManager__WEBPACK_IMPORTED_MODULE_1__.BlockInteractionManager(vscode, getZoomLevelReal, () => linkInteractionManager.updateLinks());
    linkInteractionManager = new _LinkInteractionManager__WEBPACK_IMPORTED_MODULE_2__.LinkInteractionManager(vscode, canvas, document.querySelector('.links'), getZoomLevelReal, blockInteractionManager);
    function getZoomLevelReal() {
        return zoomLevel / 2;
    }
    function onMouseDownInCanvas(e) {
        vscode.postMessage({ type: 'print', text: 'mouse down in canvas' });
        vscode.postMessage({ type: 'print', text: `e button ${e.button}` });
        if (e.button !== 1) {
            vscode.postMessage({ type: 'print', text: `e target ${e.target}` });
            if (e.target !== canvas) {
                return; // Ignore clicks on child elements
            }
            vscode.postMessage({ type: 'print', text: 'starting box selection' });
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
        linkInteractionManager.updateLinks();
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
        // linkInteractionManager.links.forEach(link => {
        //     link.segments.forEach((segment, index) => {
        //         const blockRect = link.getBoundingBox(index);
        //         if (
        //             blockRect.left < boxRect.right &&
        //             blockRect.right > boxRect.left &&
        //             blockRect.top < boxRect.bottom &&
        //             blockRect.bottom > boxRect.top
        //         ) {
        //             link.select(index);
        //         } else {
        //             link.unselect(index);
        //         }
        //     });
        // });
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
        let sourceNode = new _Link__WEBPACK_IMPORTED_MODULE_0__.SourceNode(sourceBlock, 0);
        let targetNode = new _Link__WEBPACK_IMPORTED_MODULE_0__.TargetNode(targetBlock, 0);
        linkInteractionManager.createLink(sourceNode, targetNode, []);
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
        linkInteractionManager.updateLinks(); // Update the links to match the new zoom level
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
        linkInteractionManager.updateLinks();
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