import { debug, timeStamp } from 'console';
import { Block } from './Block';
import { Movable } from './Movable';
import { Selectable } from './Selectable';
import { LinkData } from '../shared/JsonTypes';

export class LinkNode extends Selectable implements Movable {
    id: string;
    private x: number; 
    private y: number;
    nodeElement: SVGCircleElement;
    isHighlighted: boolean = false;

    private onDeleteCallbacks: (() => void)[] = [];


    public getElement(): HTMLElement | SVGElement {
        return this.nodeElement;
    }

    private moveCallbacks: { (x: number, y: number) : void; }[] = [];

    constructor (id: string, x: number, y: number, onDelete: (() => void) | undefined = undefined) {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        if (onDelete) {
            this.onDeleteCallbacks.push(onDelete);
        }

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

    public moveTo(x: number, y: number) {
        this.x = x;
        this.y = y;
        if (this.nodeElement) {
            this.nodeElement.setAttribute("cx", `${this.x}`);
            this.nodeElement.setAttribute("cy", `${this.y}`);
        }
        this.moveCallbacks.forEach(callback => callback(this.x, this.y));
    }

    public moveDelta(deltaX: number, deltaY: number): void {
        this.moveTo(this.x + deltaX, this.y + deltaY);
    }

    public getPosition(): { x: number; y: number; } {
        return { x: this.x, y: this.y };
    }

    public addCallback(callback: (x: number, y: number) => void) {
        this.moveCallbacks.push(callback);
    }

    public select() {
        this._isSelected = true;
        if (this.nodeElement) {
            this.nodeElement.classList.add('selected');
        }
    }

    public unselect() {
        this._isSelected = false;
        if (this.nodeElement) {
            this.nodeElement.classList.remove('selected');
        }
    }
    public toggleSelect() {
        if (this._isSelected) {
            this.unselect();
        } else {
            this.select();
        }
    }

    public highlight(): void {
        this.isHighlighted = true;
        if (this.nodeElement) {
            this.nodeElement.classList.add('highlighted');
        }
    }
    
    public unhighlight(): void {
        this.isHighlighted = false;
        if (this.nodeElement) {
            this.nodeElement.classList.remove('highlighted');
        }
    }

    public delete = (): void => {
        this.onDeleteCallbacks.forEach(callback => callback());
    };

    public addOnDeleteCallback(callback: () => void) {
        this.onDeleteCallbacks.push(callback);
    }
}

export class SourceNode extends LinkNode {
    connectedPort: undefined | { block: Block, index: number };

    constructor(xOrBlock: number | Block, yOrIndex: number, onDelete: (() => void) | undefined = undefined) {
        if (typeof xOrBlock === 'number' && typeof yOrIndex === 'number') {
            super(String(xOrBlock) + String(yOrIndex), xOrBlock, yOrIndex, onDelete);
        } else if (xOrBlock instanceof Block && typeof yOrIndex === 'number') {
            const connectedPort = { block: xOrBlock, index: yOrIndex };
            const position = connectedPort.block.getPortPosition(connectedPort.index, "output");
            super(connectedPort.block.id + yOrIndex, position.x, position.y, onDelete);
            this.connectedPort = connectedPort;
        } else {
            throw new Error("Invalid arguments provided to SourceNode constructor");
        }
    }

    public createNodeElement(): void {
        if (this.nodeElement) {
            this.nodeElement.classList.add('source-node');
        }
    }

    public moveTo(x: number, y: number): void {
        if (this.connectedPort) {
            this.connectedPort = undefined;
        }
        super.moveTo(x, y);
    }

    public attachToPort(block: Block, index: number) {
        this.connectedPort = { block: block, index: index };
        this.moveToAttachedPort();
    }

    public moveToAttachedPort() {
        const position = this.connectedPort?.block.getPortPosition(this.connectedPort.index, "output");
        if (position) {
            super.moveTo(position.x, position.y);
        }
    }

    public disconnect() {
        this.connectedPort = undefined;
    }
}

export class TargetNode extends LinkNode {
    connectedPort: undefined | { block: Block, index: number };

    constructor(xOrBlock: number | Block, yOrIndex: number, onDelete: (() => void) | undefined = undefined) {
        if (typeof xOrBlock === 'number' && typeof yOrIndex === 'number') {
            super(String(xOrBlock) + String(yOrIndex), xOrBlock, yOrIndex, onDelete);
        } else if (xOrBlock instanceof Block && typeof yOrIndex === 'number') {
            const connectedPort = { block: xOrBlock, index: yOrIndex };
            const position = connectedPort.block.getPortPosition(connectedPort.index, "input");
            super(connectedPort.block.id + yOrIndex, position.x, position.y, onDelete);
            this.connectedPort = connectedPort;
        } else {
            throw new Error("Invalid arguments provided to SourceNode constructor");
        }
    }

    public createNodeElement(): void {
        if (this.nodeElement) {
            this.nodeElement.classList.add('target-node');
        }
    }

    public moveTo(x: number, y: number): void {
        if (this.connectedPort) {
            this.connectedPort = undefined;
        }
        super.moveTo(x, y);
    }

    public attachToPort(block: Block, index: number) {
        this.connectedPort = { block: block, index: index };
        this.moveToAttachedPort();
    }

    public moveToAttachedPort() {
        const position = this.connectedPort?.block.getPortPosition(this.connectedPort.index, "input");
        if (position) {
            super.moveTo(position.x, position.y);
        }
    }

    public disconnect() {
        this.connectedPort = undefined;
    }
}

export class LinkSegment extends Selectable implements Movable {
    sourceLinkNode: LinkNode;
    targetLinkNode: LinkNode;
    segmentElement: SVGPolylineElement;

    private onDelete: () => void;

    public getElement(): HTMLElement | SVGElement {
        return this.segmentElement;
    }

    constructor (sourceLinkNode: LinkNode, targetLinkNode: LinkNode, onDelete: () => void) {
        super();
        this.onDelete = onDelete;
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

    public updatePosition() { 
        const segmentPoints = [
            {x: this.sourceLinkNode.getPosition().x, y: this.sourceLinkNode.getPosition().y},
            {x: this.targetLinkNode.getPosition().x, y: this.targetLinkNode.getPosition().y}
        ];
        const pointsString = segmentPoints.map(p => `${p.x},${p.y}`).join(" ");
        this.segmentElement?.setAttribute("points", pointsString);
    }

    private updateSourceLinkNodePosition = (x: number, y: number) : void => {
        this.updatePosition();
    };

    private updateTargetLinkNodePosition = (x: number, y: number) : void => {
        this.updatePosition();
    };

    public moveTo(x: number, y: number): void {
        let deltaX = x - this.sourceLinkNode.getPosition().x;
        let deltaY = y - this.sourceLinkNode.getPosition().y;
        if (!this.sourceLinkNode.isSelected()) {
            this.sourceLinkNode.select();
            this.sourceLinkNode.moveTo(x, y);
        }
        if (!this.targetLinkNode.isSelected()) {
            this.targetLinkNode.select();
            this.targetLinkNode.moveDelta(deltaX, deltaY);
        }
        this.updatePosition();
    }

    public getPosition(): { x: number; y: number; } {
        return this.sourceLinkNode.getPosition();
    }

    public moveDelta(deltaX: number, deltaY: number): void {
        if (!this.sourceLinkNode.isSelected()) {
            this.sourceLinkNode.select();
            this.sourceLinkNode.moveDelta(deltaX, deltaY);
        }
        if (!this.targetLinkNode.isSelected()) {
            this.targetLinkNode.select();
            this.targetLinkNode.moveDelta(deltaX, deltaY);
        }
        this.updatePosition();
    }

    public delete = (): void => {
        this.onDelete();
    };
}

export class Link {
    sourceNode: SourceNode;
    targetNode: TargetNode;
    intermediateNodes: LinkNode[] = [];
    segments: LinkSegment[] = [];
    id: string;

    private onDelete: (link: Link) => void;
    private onUpdate: (link: LinkData) => void;

    constructor(
        id: string,
        sourceNode: SourceNode,
        targetNode: TargetNode,
        intermediateNodes: LinkNode[] = [],
        onDelete: (link: Link) => void,
        onUpdate: (link: LinkData) => void
    ) {
        this.id = id;
        this.sourceNode = sourceNode;
        this.targetNode = targetNode;
        this.intermediateNodes = intermediateNodes;
        this.onDelete = onDelete;
        this.onUpdate = onUpdate;

        this.sourceNode.addCallback((x: number, y: number) => {
            this.updatePosition();
        });

        this.targetNode.addCallback((x: number, y: number) => {
            this.updatePosition();
        });

        this.intermediateNodes.forEach(node => {
            node.addCallback((x: number, y: number) => {
                this.updatePosition();
            });
        });

        this.onUpdate(this.toLinkData());
    }
    
    public toLinkData(): LinkData {
        return {
            id: this.id,
            sourceId: this.sourceNode.connectedPort ? this.sourceNode.connectedPort.block.id : undefined,
            sourcePort: this.sourceNode.connectedPort ? this.sourceNode.connectedPort.index : -1,
            targetId: this.targetNode.connectedPort ? this.targetNode.connectedPort.block.id : undefined,
            targetPort: this.targetNode.connectedPort ? this.targetNode.connectedPort.index : -1,
            intermediateNodes: this.intermediateNodes.map(node => ({
                id: node.id,
                x: node.getPosition().x,
                y: node.getPosition().y
            })),
            sourceX: this.sourceNode.getPosition().x,
            sourceY: this.sourceNode.getPosition().y,
            targetX: this.targetNode.getPosition().x,
            targetY: this.targetNode.getPosition().y
        };
    }

    public updateSegments() {
        let newSegments: LinkSegment[] = [];
        if (this.intermediateNodes.length === 0) {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments = [existingSegment];
            } else {
                newSegments = [new LinkSegment(this.sourceNode, this.targetNode, () => this.onDelete(this))];
            }
        } else {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.intermediateNodes[0]);
            if (existingSegment) {
                newSegments = [existingSegment];
            } else {
                newSegments = [new LinkSegment(this.sourceNode, this.intermediateNodes[0], () => this.onDelete(this))];
            }
            for (let i: number = 0; i < this.intermediateNodes.length - 1; i++) {
                existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[i] && segment.targetLinkNode === this.intermediateNodes[i + 1]);
                if (existingSegment) {
                    newSegments.push(existingSegment);
                } else {
                    newSegments.push(new LinkSegment(this.intermediateNodes[i], this.intermediateNodes[i + 1], () => this.onDelete(this)));
                }
            }
            existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[this.intermediateNodes.length - 1] && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments.push(existingSegment);
            } else {
                newSegments.push(new LinkSegment(this.intermediateNodes[this.intermediateNodes.length - 1], this.targetNode, () => this.onDelete(this)));
            }
        }
        this.segments = newSegments;
        this.segments.forEach(segment => segment.updatePosition());
    }

    public updatePosition(sendMessages: boolean=true): void {
        this.sourceNode.moveToAttachedPort();
        this.targetNode.moveToAttachedPort();
        
        this.segments.forEach(segment => segment.updatePosition());
        if (sendMessages) {
            this.onUpdate(this.toLinkData());
        }
    }

    public addToSvg(svg: SVGSVGElement): void {
        this.updateSegments();
        this.segments.forEach(segment => {
            if (segment.segmentElement) {
                svg.appendChild(segment.segmentElement);
            }
            else
            {
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

    removeFromSvg(svg: SVGSVGElement): void {
        if (!svg) {
            console.error("SVG element is null or undefined.");
            return;
        }

        try {
            // Remove segments
            this.segments.forEach(segment => {
                if (segment.segmentElement && svg.contains(segment.segmentElement)) {
                    svg.removeChild(segment.segmentElement);
                } else {
                    console.warn(`Segment element not found in SVG or is null: ${segment.segmentElement}`);
                }
            });

            // Remove intermediate nodes
            this.intermediateNodes.forEach(node => {
                if (node.nodeElement && svg.contains(node.nodeElement)) {
                    svg.removeChild(node.nodeElement);
                } else {
                    console.warn(`Intermediate node element not found in SVG or is null: ${node.nodeElement}`);
                }
            });

            // Remove source node
            if (this.sourceNode.nodeElement && svg.contains(this.sourceNode.nodeElement)) {
                svg.removeChild(this.sourceNode.nodeElement);
            } else {
                console.warn(`Source node element not found in SVG or is null: ${this.sourceNode.nodeElement}`);
            }

            // Remove target node
            if (this.targetNode.nodeElement && svg.contains(this.targetNode.nodeElement)) {
                svg.removeChild(this.targetNode.nodeElement);
            } else {
                console.warn(`Target node element not found in SVG or is null: ${this.targetNode.nodeElement}`);
            }
        } catch (error) {
            console.error("An error occurred while removing elements from SVG:", error);
        }
    }


    public select() {
        this.segments.forEach(segment => segment.select());
        this.intermediateNodes.forEach(node => node.select());
        this.sourceNode.select();
        this.targetNode.select();

    }

    public unselect(): void {
        this.segments.forEach(segment => segment.unselect());
        this.intermediateNodes.forEach(node => node.unselect());
        this.sourceNode.unselect();
        this.targetNode.unselect();
    }

    public delete = (): void => {
        this.onDelete(this);
    };
}
