import { debug, timeStamp } from 'console';
import { BlockVisual } from './BlockVisual';
import { Selectable } from './Selectable';
import { IdType, IntermediateSegment, JsonData, LinkData } from '../shared/JsonTypes';
import { getNonce } from './util';
import { isMovable, Movable } from './Movable';
import { CommunicationManager } from './CommunicationManager';
import { link } from 'fs';

export class LinkNode extends Selectable implements Movable {
    id: string;
    protected linkId: IdType;
    public getLinkId(): IdType {
        return this.linkId;    
    }
    public getId(): IdType {
        return this.id;    
    }
    nodeElement: SVGElement;
    isHighlighted: boolean = false;

    private onDeleteCallbacks: ((communicationManager: CommunicationManager) => void)[] = [];


    public getElement(): HTMLElement | SVGElement {
        return this.nodeElement;
    }

    constructor (linkId: IdType, id: string, onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super();
        this.linkId = linkId;
        this.id = id;
        if (onDelete) {
            this.onDeleteCallbacks.push(onDelete);
        }

        this.nodeElement = this.createNodeElement();
        
        this.nodeElement.classList.add('link-node');
        if (this._isSelected) {
            this.nodeElement.classList.add('selected');
        }
        if (this.isHighlighted) {
            this.nodeElement.classList.add('highlighted');
        }
    }

    protected createNodeElement(): SVGElement {
        console.log("Creating a link node element");
        return document.createElementNS("http://www.w3.org/2000/svg", "circle");
    }
    
    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let beforeAndAfterSegments = communicationManager.getNeighboringSegmentsToNode(this.id);
        if (beforeAndAfterSegments) {
            if (beforeAndAfterSegments.before.orientation === "Horizontal" 
                && beforeAndAfterSegments.after.orientation === "Vertical") {
                return {x: beforeAndAfterSegments.after.xOrY, y: beforeAndAfterSegments.before.xOrY};
            }
            else if (beforeAndAfterSegments.before.orientation === "Vertical" 
                && beforeAndAfterSegments.after.orientation === "Horizontal") {
                return {x: beforeAndAfterSegments.before.xOrY, y: beforeAndAfterSegments.after.xOrY};
            }
            else {
                throw RangeError(`Orientations should be opposed, they where before: ${beforeAndAfterSegments.before.orientation}, after: ${beforeAndAfterSegments.after.orientation}`)
            }
        }
        return undefined;
    }

    getPositionForRotation(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        return this.getPosition(communicationManager);
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.print(`Link node with id: ${this.getId()} moving to ${x}, ${y}`);
        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        communicationManager.moveLinkNode(this.id, x, y, selectedSelectableIds);
    }

    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let position = this.getPosition(communicationManager);
        if (position) {
            const newX = position.x + deltaX;
            const newY = position.y + deltaY;
            this.moveTo(newX, newY, communicationManager, selectables);
        }
    }

    moveClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        ;
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        ;
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const beforeAndAfterSegments = communicationManager.getNeighboringSegmentsToNode(this.id, json);
        console.log(`Updating node ${this.id} from JSON, before and after segments: ${JSON.stringify(beforeAndAfterSegments)}`);
        if (beforeAndAfterSegments) {
            if (beforeAndAfterSegments.before.orientation === "Horizontal" 
                && beforeAndAfterSegments.after.orientation === "Vertical") {
                this.getElement().setAttribute("cx", String(beforeAndAfterSegments.after.xOrY));
                this.getElement().setAttribute("cy", String(beforeAndAfterSegments.before.xOrY));
            }
            else if (beforeAndAfterSegments.before.orientation === "Vertical" 
                && beforeAndAfterSegments.after.orientation === "Horizontal") {
                this.getElement().setAttribute("cx", String(beforeAndAfterSegments.before.xOrY));
                this.getElement().setAttribute("cy", String(beforeAndAfterSegments.after.xOrY));            }
            else {
                throw RangeError(`Orientations should be opposed, they where before: ${beforeAndAfterSegments.before.orientation}, after: ${beforeAndAfterSegments.after.orientation}`)
            }
        } 
    }

    public highlight(): void {
        this.isHighlighted = true;
        console.log("Highlighted!");
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

    public delete = (communicationManager: CommunicationManager): void => {
        this.onDeleteCallbacks.forEach(callback => callback(communicationManager));
    };

    public addOnDeleteCallback(callback: (communicationManager: CommunicationManager) => void) {
        this.onDeleteCallbacks.push(callback);
    }
}

export class SourceNode extends LinkNode implements Movable {
    public getId(): IdType {
        return this.linkId + "SourceNode";    
    }
    constructor(linkId: IdType, onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super(linkId, getNonce(), onDelete);
        this.nodeElement.classList.add('source-node');
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const linkData = json.links?.find(link => link.id === this.linkId);

        if (linkData) {
            this.getElement().setAttribute("cx", String(linkData.sourceX));
            this.getElement().setAttribute("cy", String(linkData.sourceY));
        }
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.print(`Source node with id: ${this.getId()} moving to ${x}, ${y}`);

        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        communicationManager.moveSourceNode(this.linkId, x, y, selectedSelectableIds);
    }

    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let position = this.getPosition(communicationManager);
        if (position) {
            const newX = position.x + deltaX;
            const newY = position.y + deltaY;
            this.moveTo(newX, newY, communicationManager, selectables);
        }
    }

    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let linkData = communicationManager.getLocalJson()?.links?.find(link => link.id === this.linkId);
        if (linkData) {
            return { x: linkData.sourceX, y: linkData.sourceY };
        }
        return undefined;
    }

    moveClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let centralPosition = this.getPosition(communicationManager);
        if (centralPosition) {
            const deltaX = centerX - centralPosition.x;
            const deltaY = centerY - centralPosition.y;

            let targetPosition = {
                x: centerX + deltaY,
                y: centerY - deltaX
            };

            this.moveTo(targetPosition.x, targetPosition.y, communicationManager, selectables);
        }
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        ;
    }
}
export class TargetNode extends LinkNode implements Movable {


    private setArrowDirection(direction: string): void {
        const poly = this.nodeElement as SVGPolygonElement;
        if (!poly || poly.tagName !== 'polygon') {
            console.warn("Not a polygon, can't set arrow");
            return;
        }

        console.log(`Setting arrow direction to: ${direction} on arrow polygon: ${poly}`);
        switch (direction) {
            case 'up':
                poly.setAttribute("points", "0,-6 6,6 -6,6"); // up-pointing arrow
                break;
            case 'down':
                poly.setAttribute("points", "0,6 6,-6 -6,-6"); // down-pointing arrow
                break;
            case 'left':
                poly.setAttribute("points", "-6,0 6,6 6,-6"); // left-pointing arrow
                break;
            case 'right':
                poly.setAttribute("points", "6,0 -6,6 -6,-6"); // right-pointing arrow
                break;
            default:
                console.warn(`Unknown direction: ${direction}. Using default right-pointing arrow.`);
                poly.setAttribute("points", "-6,-6 6,0 -6,6"); // default right-pointing arrow
                break;
        }
    }

    public getId(): IdType {
        return this.linkId + "TargetNode";    
    }
    constructor(linkId: IdType, onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super(linkId, getNonce(), onDelete);
        this.nodeElement.classList.add('target-node');
    }

    protected createNodeElement(): SVGElement {
        console.log("Creating a target node element with arrow");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        return poly;
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const linkData = json.links?.find(link => link.id === this.linkId);

        if (linkData) {
            this.getElement().setAttribute('transform',
                `translate(${String(linkData.targetX)}, ${String(linkData.targetY)})`
            );

            const previousSegment: IntermediateSegment | undefined = linkData.intermediateSegments?.at(-1);
            const antePreviousSegment: IntermediateSegment | undefined = linkData.intermediateSegments?.at(-2);
            const targetNodePosition = {x: linkData.targetX, y: linkData.targetY};

            if (!previousSegment) {
                if (targetNodePosition.x < linkData.sourceX) {
                    this.setArrowDirection('left');
                } else {
                    this.setArrowDirection('right');
                }
            } else if (!antePreviousSegment) {
                if (previousSegment.orientation === "Horizontal") {
                    if (targetNodePosition.x < linkData.sourceX) {
                        this.setArrowDirection('left');
                    } else {
                        this.setArrowDirection('right');
                    }
                } else {
                    if (targetNodePosition.y < linkData.sourceY) {
                        this.setArrowDirection('up');
                    } else {
                        this.setArrowDirection('down');
                    }
                }
            } else {
                if (antePreviousSegment.orientation === "Vertical") {
                    if (targetNodePosition.x < antePreviousSegment.xOrY) {
                        this.setArrowDirection('left');
                    } else {
                        this.setArrowDirection('right');
                    }
                } else {
                    if (targetNodePosition.y < antePreviousSegment.xOrY) {
                        this.setArrowDirection('up');
                    } else {
                        this.setArrowDirection('down');
                    }
                }
            }
        } 
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.print(`Target node with id: ${this.getId()} moving to ${x}, ${y}`);
        
        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        communicationManager.moveTargetNode(this.linkId, x, y, selectedSelectableIds);
    }

    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let position = this.getPosition(communicationManager);
        if (position) {
            const newX = position.x + deltaX;
            const newY = position.y + deltaY;
            this.moveTo(newX, newY, communicationManager, selectables);
        }
    }

    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let linkData = communicationManager.getLocalJson()?.links?.find(link => link.id === this.linkId);
        if (linkData) {
            return { x: linkData.targetX, y: linkData.targetY };
        }
        return undefined;
    }

    moveClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let centralPosition = this.getPosition(communicationManager);
        if (centralPosition) {
            const deltaX = centerX - centralPosition.x;
            const deltaY = centerY - centralPosition.y;

            let targetPosition = {
                x: centerX + deltaY,
                y: centerY - deltaX
            };

            this.moveTo(targetPosition.x, targetPosition.y, communicationManager, selectables);
        }
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        ;
    }
}


export class LinkSegment extends Selectable implements Movable {
    id: IdType;
    segmentElement: SVGPolylineElement;
    public getId(): IdType {
        return this.id;    
    }

    private onDelete: () => void;

    public getElement(): HTMLElement | SVGElement {
        return this.segmentElement;
    }

    constructor (id: IdType, onDelete: () => void, communicationManager: CommunicationManager) {
        super();
        this.onDelete = onDelete;
        this.id = id;
        
        this.segmentElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.segmentElement.classList.add('link-line');
        this.segmentElement.setAttribute("stroke-linejoin", "miter");

        if (this._isSelected) {
            this.segmentElement.classList.add('selected');
        }

        const segmentLimits = communicationManager.getLimitsOfSegment(this.id);
        
        if (segmentLimits) {
            this.getElement().setAttribute("points", `${segmentLimits.before.x},${segmentLimits.before.y} ${segmentLimits.after.x},${segmentLimits.after.y}`);
        }
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const segmentLimits = communicationManager.getLimitsOfSegment(this.id);
        
        if (segmentLimits) {
            this.getElement().setAttribute("points", `${segmentLimits.before.x},${segmentLimits.before.y} ${segmentLimits.after.x},${segmentLimits.after.y}`);
        }
    }

    public delete = (): void => {
        this.onDelete();
    };

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.print(`Segment with id: ${this.getId()} moving to ${x}, ${y}`);
        
        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        communicationManager.moveLinkSegment(this.id, x, y, selectedSelectableIds);
    }

    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let position = this.getPosition(communicationManager);
        if (position) {
            const newX = position.x + deltaX;
            const newY = position.y + deltaY;
            this.moveTo(newX, newY, communicationManager, selectables);
        }
    }

    moveClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.rotateLinkSegmentClockwise(this.id, centerX, centerY);
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.rotateLinkSegmentCounterClockwise(this.id, centerX, centerY);
    }

    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let limits = communicationManager.getLimitsOfSegment(this.id);
        if (limits) {
            return { x: (limits.before.x + limits.after.x) / 2, y: (limits.before.y + limits.after.y) / 2 };
        }
        return undefined;
    }

    getPositionForRotation(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        return this.getPosition(communicationManager);
    }

    public selectCondition(): "Intersect" | "FullyWithing" {
        return "FullyWithing";
    }
}

export class LinkVisual {
    sourceNode: SourceNode;
    targetNode: TargetNode;
    intermediateSegments: LinkSegment[] = [];
    nodes: LinkNode[] = [];
    id: string;

    private onDelete: (link: LinkVisual) => void;

    constructor(
        linkData: LinkData,
        onDelete: (link: LinkVisual) => void,
        communicationManager: CommunicationManager
    ) {
        this.id = linkData.id;

        this.sourceNode = new SourceNode(this.id, (communicationManager: CommunicationManager) => this.delete(communicationManager));
        this.targetNode = new TargetNode(this.id, (communicationManager: CommunicationManager) => this.delete(communicationManager));
        this.intermediateSegments = linkData.intermediateSegments.map(segmentData => new LinkSegment(segmentData.id, () => this.onDelete(this), communicationManager));
        this.onDelete = onDelete;
    }


    public updateIntermediateNodes(communicationManager: CommunicationManager): void {
        let newNodes: LinkNode[] = [];

        for (let i = 0; i < this.intermediateSegments.length - 1; i++) {
            const segment = this.intermediateSegments[i];
            const nextSegment = this.intermediateSegments[i + 1];
            const nodeId = segment.id + nextSegment.id;
            let existingNode = this.nodes.find(node => node.id === nodeId);
            
            if (!existingNode) {
                existingNode = new LinkNode(this.id, nodeId, (cm: CommunicationManager) => this.delete(cm));
                newNodes.push(existingNode);
            } else {
                newNodes.push(existingNode);
            }

            existingNode.updateFromJson(communicationManager.getLocalJson()!, communicationManager);

            if (segment.isSelected() && nextSegment.isSelected()) {
                existingNode.select();
            }
        }

        this.nodes = newNodes;
    }
    

    public addToSvg(svg: SVGSVGElement, communicationManager: CommunicationManager): void {
        this.updateIntermediateNodes(communicationManager);
        this.intermediateSegments.forEach(segment => {
            if (segment.segmentElement) {
                svg.appendChild(segment.segmentElement);
            }
            else
            {
                throw RangeError("Segment element should not be null");
            }
        });

        console.log(`Adding ${this.nodes.length} nodes to SVG for link ${this.id}`);

        this.nodes.forEach(node => {
            if (node.nodeElement) {
                svg.appendChild(node.nodeElement);
            }
        });

        if (this.sourceNode.nodeElement) {
            svg.appendChild(this.sourceNode.nodeElement);
        }

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
            this.intermediateSegments.forEach(segment => {
                if (segment.segmentElement && svg.contains(segment.segmentElement)) {
                    svg.removeChild(segment.segmentElement);
                } else {
                    console.warn(`Segment element not found in SVG or is null: ${segment.segmentElement}`);
                }
            });

            // Remove intermediate nodes
            this.nodes.forEach(node => {
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

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        this.sourceNode.updateFromJson(json, communicationManager);
        this.targetNode.updateFromJson(json, communicationManager);

        const jsonSegments = json.links?.find(link => link.id === this.id)?.intermediateSegments ?? [];
        const newSegments: LinkSegment[] = [];

        for (let i = 0; i < jsonSegments.length; i++) {
            const jsonSegment = jsonSegments[i];
            let existingSegment = this.intermediateSegments.find(segment => segment.id === jsonSegment.id);
            if (!existingSegment) {
                existingSegment = new LinkSegment(jsonSegment.id, () => this.delete(communicationManager), communicationManager);
            }
            newSegments.push(existingSegment);
            existingSegment.updateFromJson(json, communicationManager);
        }

        this.intermediateSegments = newSegments;

        // Update segments after nodes are synced
        this.updateIntermediateNodes(communicationManager);
        this.nodes.forEach(node => node.updateFromJson(json, communicationManager));
    }


    public select() {
        this.intermediateSegments.forEach(segment => segment.select());
        this.nodes.forEach(node => node.select());
        this.sourceNode.select();
        this.targetNode.select();

    }

    public unselect(): void {
        this.intermediateSegments.forEach(segment => segment.unselect());
        this.nodes.forEach(node => node.unselect());
        this.sourceNode.unselect();
        this.targetNode.unselect();
    }

    public delete = (communicationManager: CommunicationManager): void => {
        communicationManager.print(`Delete link: ${this.id}`);
        communicationManager.deleteLink(this.id);
        this.onDelete(this);
    };
}
