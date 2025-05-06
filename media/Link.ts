import { debug } from 'console';
import { Block } from './Block';

export class LinkNode {
    id: string;
    x: number; 
    y: number;
    nodeElement: SVGCircleElement | undefined;
    isSelected: boolean = false;
    isHighlighted: boolean = false;

    private moveCallbacks: { (x: number, y: number) : void; }[] = [];

    constructor (id: string, x: number, y: number) {
        this.id = id;
        this.x = x;
        this.y = y;
    }

    public createNodeElement(onMouseDown: (link: LinkNode, e: MouseEvent) => void) {
        this.nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        this.nodeElement.classList.add('link-node');
        this.nodeElement.setAttribute("cx", `${this.x}`);
        this.nodeElement.setAttribute("cy", `${this.y}`);
        this.nodeElement.addEventListener('mousedown', (e: MouseEvent) => onMouseDown(this, e));
        if (this.isSelected) {
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

    public addCallback(callback: (x: number, y: number) => void) {
        this.moveCallbacks.push(callback);
    }

    public select() {
        this.isSelected = true;
        if (this.nodeElement) {
            this.nodeElement.classList.add('selected');
        }
    }

    public unselect() {
        this.isSelected = false;
        if (this.nodeElement) {
            this.nodeElement.classList.remove('selected');
        }
    }
    public toggleSelect() {
        if (this.isSelected) {
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
}

export class SourceNode extends LinkNode {
    connectedPort: undefined | { block: Block, index: number };

    constructor(xOrBlock: number | Block, yOrIndex: number) {
        if (typeof xOrBlock === 'number' && typeof yOrIndex === 'number') {
            super(String(xOrBlock) + String(yOrIndex), xOrBlock, yOrIndex);
        } else if (xOrBlock instanceof Block && typeof yOrIndex === 'number') {
            const connectedPort = { block: xOrBlock, index: yOrIndex };
            const position = connectedPort.block.getPortPosition(connectedPort.index, "output");
            super(connectedPort.block.id + yOrIndex, position.x, position.y);
            this.connectedPort = connectedPort;
        } else {
            throw new Error("Invalid arguments provided to SourceNode constructor");
        }
    }

    public createNodeElement(onMouseDown: (link: LinkNode, e: MouseEvent) => void): void {
        super.createNodeElement(onMouseDown);
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
}

export class TargetNode extends LinkNode {
    connectedPort: undefined | { block: Block, index: number };

    constructor(xOrBlock: number | Block, yOrIndex: number) {
        if (typeof xOrBlock === 'number' && typeof yOrIndex === 'number') {
            super(String(xOrBlock) + String(yOrIndex), xOrBlock, yOrIndex);
        } else if (xOrBlock instanceof Block && typeof yOrIndex === 'number') {
            const connectedPort = { block: xOrBlock, index: yOrIndex };
            const position = connectedPort.block.getPortPosition(connectedPort.index, "input");
            super(connectedPort.block.id + yOrIndex, position.x, position.y);
            this.connectedPort = connectedPort;
        } else {
            throw new Error("Invalid arguments provided to SourceNode constructor");
        }
    }

    public createNodeElement(onMouseDown: (link: LinkNode, e: MouseEvent) => void): void {
        super.createNodeElement(onMouseDown);
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
}

export class LinkSegment {
    sourceLinkNode: LinkNode;
    targetLinkNode: LinkNode;
    segmentElement: SVGPolylineElement | undefined;
    isSelected: boolean = false;

    constructor (sourceLinkNode: LinkNode, targetLinkNode: LinkNode) {
        this.sourceLinkNode = sourceLinkNode;
        this.sourceLinkNode.addCallback(this.updateSourceLinkNodePosition);
        this.targetLinkNode = targetLinkNode;
        this.targetLinkNode.addCallback(this.updateTargetLinkNodePosition);
        console.log(`link created: ${this.sourceLinkNode.x}`);
    }

    public createSegmentElement(onMouseDown: (link: LinkSegment, e: MouseEvent) => void) {
        console.log(`segment element created: ${this.sourceLinkNode.x}`);

        this.segmentElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.segmentElement.classList.add('link-line');
        if (this.isSelected) {
            this.segmentElement.classList.add('selected');
        }
        this.segmentElement.addEventListener('mousedown', (e: MouseEvent) => onMouseDown(this, e));
        this.updatePosition();
    }

    public updatePosition() { 
        const segmentPoints = [
            {x: this.sourceLinkNode.x, y: this.sourceLinkNode.y},
            {x: this.targetLinkNode.x, y: this.targetLinkNode.y}
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

    public select() {
        this.isSelected = true;
        if (this.segmentElement) {
            this.segmentElement.classList.add('selected');
        }
    }
    public unselect() {
        console.log("unselected");
        this.isSelected = false;
        if (this.segmentElement) {
            this.segmentElement.classList.remove('selected');
        }
    }

    public toggleSelect() {
        if (this.isSelected) {
            this.unselect();
        } else {
            this.select();
        }
    }
}

export class Link {
    sourceNode: SourceNode;
    targetNode: TargetNode;
    intermediateNodes: LinkNode[] = [];
    segments: LinkSegment[] = [];
    id: string;

    private onMouseDownSegment: (link: LinkSegment, e: MouseEvent) => void;
    private onMouseDownNode: (link: LinkNode, e: MouseEvent) => void;

    constructor(
        id: string,
        sourceNode: SourceNode,
        targetNode: TargetNode,
        intermediateNodes: LinkNode[] = [],
        onMouseDownSegment: (link: LinkSegment, e: MouseEvent) => void,
        onMouseDownNode: (link: LinkNode, e: MouseEvent) => void
    ) {
        this.id = id;
        this.sourceNode = sourceNode;
        this.targetNode = targetNode;
        this.intermediateNodes = intermediateNodes;
        this.onMouseDownSegment = onMouseDownSegment;
        this.onMouseDownNode = onMouseDownNode;
    }

    public updateSegments() {
        let newSegments: LinkSegment[] = [];
        if (this.intermediateNodes.length === 0) {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments = [existingSegment];
            } else {
                newSegments = [new LinkSegment(this.sourceNode, this.targetNode)];
            }
        } else {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.intermediateNodes[0]);
            if (existingSegment) {
                newSegments = [existingSegment];
            } else {
                newSegments = [new LinkSegment(this.sourceNode, this.intermediateNodes[0])];
            }
            for (let i: number = 0; i < this.intermediateNodes.length - 1; i++) {
                existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[i] && segment.targetLinkNode === this.intermediateNodes[i + 1]);
                if (existingSegment) {
                    newSegments.push(existingSegment);
                } else {
                    newSegments.push(new LinkSegment(this.intermediateNodes[i], this.intermediateNodes[i + 1]));
                }
            }
            existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[this.intermediateNodes.length - 1] && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments.push(existingSegment);
            } else {
                newSegments.push(new LinkSegment(this.intermediateNodes[this.intermediateNodes.length - 1], this.targetNode));
            }
        }
        this.segments = newSegments;
        this.segments.forEach(segment => segment.updatePosition());
    }

    public updatePosition(): void {
        this.sourceNode.moveToAttachedPort();
        this.targetNode.moveToAttachedPort();
        
        this.segments.forEach(segment => segment.updatePosition());
    }

    public addToSvg(svg: SVGSVGElement): void {
        this.updateSegments();
        this.segments.forEach(segment => {
            segment.createSegmentElement(this.onMouseDownSegment);
            console.log(`Total segment amount: ${this.segments.length}`);
            if (segment.segmentElement) {
                svg.appendChild(segment.segmentElement);
            }
            else
            {
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

    removeFromSvg(svg: SVGSVGElement): void {
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

    public getState(): { type: string; id: string; sourceId: string; sourcePort: number; targetId: string; targetPort: number; nodeIndex: number, nodeId: string; x: number, y: number }[] {
        var result: { type: string; id: string; sourceId: string; sourcePort: number; targetId: string; targetPort: number; nodeIndex: number; nodeId: string; x: number; y: number; }[] = [];
        let sourcePort = this.sourceNode.connectedPort;
        let targetPort = this.targetNode.connectedPort;

        this.intermediateNodes.forEach((node, index) => {
            result.push({
                type: 'moveLinkNode',
                id: this.id,
                sourceId: sourcePort? sourcePort.block.id : 'undefined',
                sourcePort: sourcePort? sourcePort.index : -1,
                targetId: targetPort? targetPort.block.id : 'undefined',
                targetPort: targetPort? targetPort.index : -1,
                nodeIndex: index,
                nodeId: node.id,
                x: node.x,
                y: node.y
            });
        });

        result.push({type: 'moveLinkNode', 
            id: this.id,
            sourceId: sourcePort? sourcePort.block.id : 'undefined',
            sourcePort: sourcePort? sourcePort.index : -1,
            targetId: targetPort? targetPort.block.id : 'undefined',
            targetPort: targetPort? targetPort.index : -1,
            nodeIndex: -1, // -1 for sourceNode
            nodeId: this.sourceNode.id,
            x: this.sourceNode.x,
            y: this.sourceNode.y
         });
        
        result.push({type: 'moveLinkNode', 
            id: this.id,
            sourceId: sourcePort? sourcePort.block.id : 'undefined',
            sourcePort: sourcePort? sourcePort.index : -1,
            targetId: targetPort? targetPort.block.id : 'undefined',
            targetPort: targetPort? targetPort.index : -1,
            nodeIndex: -2, // -2 for targetNode
            nodeId: this.targetNode.id,
            x: this.targetNode.x,
            y: this.targetNode.y
         });

        return result;
    }
}
