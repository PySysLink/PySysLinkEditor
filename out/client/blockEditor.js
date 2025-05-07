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
/* harmony import */ var _Selectable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Selectable */ "./media/Selectable.ts");

class Block extends _Selectable__WEBPACK_IMPORTED_MODULE_0__.Selectable {
    id;
    label;
    x;
    y;
    _isSelected = false;
    getElement() {
        return this.element;
    }
    element;
    inputPorts;
    outputPorts;
    constructor(id, label, x, y, inputPorts, outputPorts) {
        super();
        this.id = id;
        this.label = label;
        this.x = x;
        this.y = y;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        // Create the DOM element for the block
        this.element = this.createElement();
    }
    moveTo(x, y) {
        this.x = x;
        this.y = y;
        if (this.element) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }
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
        this.moveTo(blockData.x, blockData.y);
        this.label = blockData.label;
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    createElement() {
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
        return blockElement;
    }
    moveDelta(deltaX, deltaY) {
        this.moveTo(this.x + deltaX, this.y + deltaY);
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
            if (this.element) {
                return { x: blockX + this.element.offsetWidth, y: blockY + portOffset };
            }
            else {
                return { x: blockX + 20, y: blockY + portOffset };
            }
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
    constructor(vscode) {
        this.vscode = vscode;
    }
    createBlock(id, label, x, y, inputPorts, outputPorts) {
        const block = new _Block__WEBPACK_IMPORTED_MODULE_0__.Block(id, label, x, y, inputPorts, outputPorts);
        this.blocks.push(block);
    }
    getSelectedBlocks() {
        return this.blocks.filter(block => block.isSelected());
    }
}


/***/ }),

/***/ "./media/CanvasElement.ts":
/*!********************************!*\
  !*** ./media/CanvasElement.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CanvasElement: () => (/* binding */ CanvasElement)
/* harmony export */ });
class CanvasElement {
    addElementToCanvas(canvas) {
        if (this.getElement()) {
            canvas.appendChild(this.getElement());
        }
    }
    addOnMouseDownListener(onMouseDown) {
        this.getElement().addEventListener('mousedown', (e) => {
            onMouseDown(this, e);
        });
    }
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
/* harmony import */ var _Selectable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Selectable */ "./media/Selectable.ts");


class LinkNode extends _Selectable__WEBPACK_IMPORTED_MODULE_1__.Selectable {
    id;
    x;
    y;
    nodeElement;
    isHighlighted = false;
    getElement() {
        return this.nodeElement;
    }
    moveCallbacks = [];
    constructor(id, x, y) {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        this.nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        this.nodeElement.classList.add('link-node');
        this.nodeElement.setAttribute("cx", `${this.x}`);
        this.nodeElement.setAttribute("cy", `${this.y}`);
        if (this._isSelected) {
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
    moveDelta(deltaX, deltaY) {
        this.moveTo(this.x + deltaX, this.y + deltaY);
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    addCallback(callback) {
        this.moveCallbacks.push(callback);
    }
    select() {
        this._isSelected = true;
        if (this.nodeElement) {
            this.nodeElement.classList.add('selected');
        }
    }
    unselect() {
        this._isSelected = false;
        if (this.nodeElement) {
            this.nodeElement.classList.remove('selected');
        }
    }
    toggleSelect() {
        if (this._isSelected) {
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
    createNodeElement() {
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
    createNodeElement() {
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
class LinkSegment extends _Selectable__WEBPACK_IMPORTED_MODULE_1__.Selectable {
    sourceLinkNode;
    targetLinkNode;
    segmentElement;
    getElement() {
        return this.segmentElement;
    }
    constructor(sourceLinkNode, targetLinkNode) {
        super();
        this.sourceLinkNode = sourceLinkNode;
        this.sourceLinkNode.addCallback(this.updateSourceLinkNodePosition);
        this.targetLinkNode = targetLinkNode;
        this.targetLinkNode.addCallback(this.updateTargetLinkNodePosition);
        console.log(`link created: ${this.sourceLinkNode.id}`);
        console.log(`segment element created: ${this.sourceLinkNode.id}`);
        this.segmentElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.segmentElement.classList.add('link-line');
        if (this._isSelected) {
            this.segmentElement.classList.add('selected');
        }
        this.updatePosition();
    }
    updatePosition() {
        const segmentPoints = [
            { x: this.sourceLinkNode.getPosition().x, y: this.sourceLinkNode.getPosition().y },
            { x: this.targetLinkNode.getPosition().x, y: this.targetLinkNode.getPosition().y }
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
    moveTo(x, y) {
        let deltaX = x - this.sourceLinkNode.getPosition().x;
        let deltaY = y - this.sourceLinkNode.getPosition().y;
        if (!this.sourceLinkNode.isSelected()) {
            this.sourceLinkNode.moveTo(x, y);
        }
        if (!this.targetLinkNode.isSelected()) {
            this.targetLinkNode.moveDelta(deltaX, deltaY);
        }
        this.updatePosition();
    }
    getPosition() {
        return this.sourceLinkNode.getPosition();
    }
    moveDelta(deltaX, deltaY) {
        if (!this.sourceLinkNode.isSelected()) {
            this.sourceLinkNode.moveDelta(deltaX, deltaY);
        }
        if (!this.targetLinkNode.isSelected()) {
            this.targetLinkNode.moveDelta(deltaX, deltaY);
        }
        this.updatePosition();
    }
}
class Link {
    sourceNode;
    targetNode;
    intermediateNodes = [];
    segments = [];
    id;
    constructor(id, sourceNode, targetNode, intermediateNodes = []) {
        this.id = id;
        this.sourceNode = sourceNode;
        this.targetNode = targetNode;
        this.intermediateNodes = intermediateNodes;
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
            if (segment.segmentElement) {
                svg.appendChild(segment.segmentElement);
            }
            else {
                throw RangeError("Segment element should not be null");
            }
        });
        this.intermediateNodes.forEach(node => {
            if (node.nodeElement) {
                svg.appendChild(node.nodeElement);
            }
        });
        this.sourceNode.createNodeElement();
        if (this.sourceNode.nodeElement) {
            svg.appendChild(this.sourceNode.nodeElement);
        }
        this.targetNode.createNodeElement();
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
                x: node.getPosition().x,
                y: node.getPosition().y
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
            x: this.sourceNode.getPosition().x,
            y: this.sourceNode.getPosition().y
        });
        result.push({ type: 'moveLinkNode',
            id: this.id,
            sourceId: sourcePort ? sourcePort.block.id : 'undefined',
            sourcePort: sourcePort ? sourcePort.index : -1,
            targetId: targetPort ? targetPort.block.id : 'undefined',
            targetPort: targetPort ? targetPort.index : -1,
            nodeIndex: -2, // -2 for targetNode
            nodeId: this.targetNode.id,
            x: this.targetNode.getPosition().x,
            y: this.targetNode.getPosition().y
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
    blockInteractionManager;
    constructor(vscode, canvas, linksSvg, blockInteractionManager) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.blockInteractionManager = blockInteractionManager;
    }
    getAllLinkSegments() {
        let result = [];
        this.links.forEach(link => {
            link.segments.forEach(segment => {
                result.push(segment);
            });
        });
        return result;
    }
    getAllLinkNodes() {
        let result = [];
        this.links.forEach(link => {
            link.intermediateNodes.forEach(node => {
                result.push(node);
            });
            result.push(link.sourceNode);
            result.push(link.targetNode);
        });
        return result;
    }
    createLink(sourceNode, targetNode, intermediateNodes = []) {
        let intermediateNodesData = [];
        intermediateNodes.forEach(node => intermediateNodesData.push({ x: node.getPosition().x, y: node.getPosition().y }));
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
    getSelectedLinkSegments() {
        var result = [];
        this.links.forEach(link => {
            link.segments.forEach(segment => {
                if (segment.isSelected()) {
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
                if (node.isSelected()) {
                    result.push(node);
                }
            });
            if (link.sourceNode.isSelected()) {
                result.push(link.sourceNode);
            }
            if (link.targetNode.isSelected()) {
                result.push(link.targetNode);
            }
        });
        return result;
    }
    getSelectedLinks() {
        var result = [];
        this.links.forEach(link => {
            for (let segment of link.segments) {
                if (segment.isSelected()) {
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
                    node.moveTo(linkData.intermediateNodes[index].x, linkData.intermediateNodes[index].y);
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
                currentLink = new _Link__WEBPACK_IMPORTED_MODULE_0__.Link(linkData.id, sourceNode, targetNode, intermediateNodes);
                this.links.push(currentLink);
            }
            currentLink.addToSvg(this.linksSvg);
            currentLink.updatePosition();
        });
        return this.linksSvg;
    }
    detectPort(node) {
        for (const block of this.blockInteractionManager.blocks) {
            for (let i = 0; i < block.inputPorts; i++) {
                const portPosition = block.getPortPosition(i, "input");
                if (Math.abs(node.getPosition().x - portPosition.x) < 10 && Math.abs(node.getPosition().y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "input" };
                }
            }
            for (let i = 0; i < block.outputPorts; i++) {
                const portPosition = block.getPortPosition(i, "output");
                if (Math.abs(node.getPosition().x - portPosition.x) < 10 && Math.abs(node.getPosition().y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "output" };
                }
            }
        }
        return null;
    }
}


/***/ }),

/***/ "./media/Movable.ts":
/*!**************************!*\
  !*** ./media/Movable.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isMovable: () => (/* binding */ isMovable)
/* harmony export */ });
function isMovable(object) {
    return object.moveDelta !== undefined;
}


/***/ }),

/***/ "./media/Selectable.ts":
/*!*****************************!*\
  !*** ./media/Selectable.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Selectable: () => (/* binding */ Selectable)
/* harmony export */ });
/* harmony import */ var _CanvasElement__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./CanvasElement */ "./media/CanvasElement.ts");

class Selectable extends _CanvasElement__WEBPACK_IMPORTED_MODULE_0__.CanvasElement {
    _isSelected = false;
    select() {
        this._isSelected = true;
        this.getElement().classList.add('selected');
    }
    unselect() {
        this._isSelected = false;
        this.getElement().classList.remove('selected');
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
}


/***/ }),

/***/ "./media/SelectableManager.ts":
/*!************************************!*\
  !*** ./media/SelectableManager.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SelectableManager: () => (/* binding */ SelectableManager)
/* harmony export */ });
/* harmony import */ var _Selectable__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Selectable */ "./media/Selectable.ts");
/* harmony import */ var _Movable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Movable */ "./media/Movable.ts");


class SelectableManager {
    dragStartX = 0;
    dragStartY = 0;
    dragThreshold = 5; // Minimum distance to detect a drag
    isDragging = false;
    selectionBox = null;
    vscode;
    canvas;
    getZoomLevelReal;
    registeredSelectableLists = [];
    onMouseMoveCallbacks = [];
    registeredStateLists = [];
    constructor(vscode, canvas, getZoomLevelReal) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.getZoomLevelReal = getZoomLevelReal;
        this.canvas.addEventListener('mousedown', this.onMouseDownInCanvas);
    }
    updateSelectables() {
        this.getSelectableList().forEach(selectable => {
            selectable.addOnMouseDownListener(this.onMouseDownInSelectable);
        });
    }
    getSelectableList() {
        return this.registeredSelectableLists.flatMap(getSelectableList => getSelectableList());
    }
    getStateList() {
        return this.registeredStateLists.flatMap(getStateList => getStateList()).flat();
    }
    unselectAll() {
        this.getSelectableList().forEach(selectable => selectable.unselect());
    }
    getSelectedSelectables() {
        return this.getSelectableList().filter(selectable => selectable.isSelected());
    }
    registerSelectableList(getSelectableList) {
        this.registeredSelectableLists.push(getSelectableList);
    }
    registerStateList(getStateList) {
        this.registeredStateLists.push(getStateList);
    }
    onMouseDownInSelectable = (canvasElement, e) => {
        let selectable;
        if (!(canvasElement instanceof _Selectable__WEBPACK_IMPORTED_MODULE_0__.Selectable)) {
            return;
        }
        else {
            selectable = canvasElement;
        }
        if (e.button !== 1) {
            if (!selectable.isSelected()) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    selectable.toggleSelect();
                }
                else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    selectable.select();
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
                    if (!selectable.isSelected()) {
                        // If the block is not already selected, add it to the selection
                        selectable.select();
                    }
                    document.addEventListener('mousemove', this.onMouseMoveDrag);
                    document.addEventListener('mouseup', this.onMouseUpDrag);
                }
            };
            document.addEventListener('mousemove', onMouseMoveThreshold);
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
                if (!this.isDragging) {
                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        selectable.toggleSelect();
                    }
                    else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        selectable.select();
                    }
                }
            };
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    onMouseDownInCanvas = (e) => {
        if (e.button !== 1) {
            if (e.target !== this.canvas) {
                return; // Ignore clicks on child elements
            }
            this.startBoxSelection(e);
        }
    };
    startBoxSelection(e) {
        this.unselectAll();
        // Get the canvas's bounding rectangle
        const canvasRect = this.canvas.getBoundingClientRect();
        // Adjust mouse coordinates to be relative to the canvas
        const adjustedX = (e.clientX - canvasRect.left) / this.getZoomLevelReal();
        const adjustedY = (e.clientY - canvasRect.top) / this.getZoomLevelReal();
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        this.canvas.appendChild(this.selectionBox);
        this.dragStartX = adjustedX;
        this.dragStartY = adjustedY;
        this.selectionBox.style.left = `${this.dragStartX}px`;
        this.selectionBox.style.top = `${this.dragStartY}px`;
        document.addEventListener('mousemove', this.onMouseMoveSelectionBox);
        document.addEventListener('mouseup', this.onMouseUpSelectionBox);
    }
    onMouseUpDrag = () => {
        this.vscode.postMessage({ type: 'print', text: `Mouse up` });
        if (this.isDragging) {
            let stateMessages = this.getStateList();
            this.vscode.postMessage({ type: 'print', text: stateMessages });
            this.vscode.postMessage({ type: 'updateStates', updates: stateMessages });
        }
        document.removeEventListener('mousemove', this.onMouseMoveDrag);
        document.removeEventListener('mouseup', this.onMouseUpDrag);
    };
    onMouseUpSelectionBox = () => {
        if (this.selectionBox) {
            // End box selection
            this.canvas.removeChild(this.selectionBox);
            this.selectionBox = null;
        }
        document.removeEventListener('mousemove', this.onMouseMoveSelectionBox);
        document.removeEventListener('mouseup', this.onMouseUpSelectionBox);
    };
    onMouseMoveSelectionBox = (e) => {
        this.vscode?.postMessage({ type: 'print', text: `Mouse move selection box` });
        if (this.selectionBox) {
            // Update selection box size
            const canvasRect = this.canvas.getBoundingClientRect();
            const adjustedX = (e.clientX - canvasRect.left) / this.getZoomLevelReal();
            const adjustedY = (e.clientY - canvasRect.top) / this.getZoomLevelReal();
            const scaledWidth = (adjustedX - this.dragStartX);
            const scaledHeight = (adjustedY - this.dragStartY);
            this.selectionBox.style.left = `${Math.min(this.dragStartX, adjustedX)}px`;
            this.selectionBox.style.top = `${Math.min(this.dragStartY, adjustedY)}px`;
            this.selectionBox.style.width = `${Math.abs(scaledWidth)}px`;
            this.selectionBox.style.height = `${Math.abs(scaledHeight)}px`;
            // Update selected blocks based on the selection box
            this.updateSelectionBox();
        }
    };
    updateSelectionBox() {
        const boxRect = this.selectionBox.getBoundingClientRect();
        this.getSelectableList().forEach(selectable => {
            const selectableEl = selectable.getElement();
            if (selectableEl) {
                const blockRect = selectableEl.getBoundingClientRect();
                if (blockRect.left < boxRect.right &&
                    blockRect.right > boxRect.left &&
                    blockRect.top < boxRect.bottom &&
                    blockRect.bottom > boxRect.top) {
                    selectable.select();
                }
                else {
                    selectable.unselect();
                }
            }
        });
    }
    onMouseMoveDrag = (e) => {
        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        if (this.isDragging) {
            this.getSelectedSelectables().forEach(selectable => {
                if ((0,_Movable__WEBPACK_IMPORTED_MODULE_1__.isMovable)(selectable)) {
                    selectable.moveDelta(scaledDeltaX, scaledDeltaY);
                }
            });
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }
        this.onMouseMoveCallbacks.forEach(callback => {
            callback(e);
        });
    };
    addOnMouseMoveListener(callback) {
        this.onMouseMoveCallbacks.push(callback);
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
/* harmony import */ var _SelectableManager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./SelectableManager */ "./media/SelectableManager.ts");




const vscode = acquireVsCodeApi();
(function () {
    const canvas = document.querySelector('.canvas');
    const zoomContainer = document.querySelector('.zoom-container');
    const topControls = document.querySelector('.top-controls');
    const canvasContainer = document.querySelector('.canvas-container');
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
    let selectableManager;
    blockInteractionManager = new _BlockInteractionManager__WEBPACK_IMPORTED_MODULE_1__.BlockInteractionManager(vscode);
    linkInteractionManager = new _LinkInteractionManager__WEBPACK_IMPORTED_MODULE_2__.LinkInteractionManager(vscode, canvas, document.querySelector('.links'), blockInteractionManager);
    selectableManager = new _SelectableManager__WEBPACK_IMPORTED_MODULE_3__.SelectableManager(vscode, canvas, getZoomLevelReal);
    selectableManager.registerSelectableList(() => blockInteractionManager.blocks);
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkSegments());
    selectableManager.registerSelectableList(() => linkInteractionManager.getAllLinkNodes());
    selectableManager.registerStateList(() => blockInteractionManager.blocks.map(block => block.getState()));
    selectableManager.registerStateList(() => {
        const stateMessages = linkInteractionManager.links.flatMap(link => link.getState());
        return [{ type: 'moveLinkBatch', updates: stateMessages }];
    });
    selectableManager.updateSelectables();
    selectableManager.addOnMouseMoveListener(linkInteractionManager.updateLinks);
    function getZoomLevelReal() {
        return zoomLevel / 2;
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
            blockInteractionManager.blocks.find(b => b.id === blockData.id)?.moveTo(blockData.x, blockData.y);
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