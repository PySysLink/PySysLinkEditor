import { debug, timeStamp } from 'console';
import { BlockVisual } from './BlockVisual';
import { Selectable } from './Selectable';
import { IdType, JsonData } from '../shared/JsonTypes';
import { getNonce } from './util';
import { isMovable, Movable } from './Movable';
import { CommunicationManager } from './CommunicationManager';
import { link } from 'fs';

export class LinkNode extends Selectable implements Movable {
    id: string;
    getNeighboringSegmentsToNode: (nodeId: IdType) => { before: LinkSegment; after: LinkSegment; } | undefined;

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

    constructor (linkId: IdType, id: string, 
                getNeighboringSegmentsToNode: (nodeId: IdType) => { before: LinkSegment; after: LinkSegment; } | undefined,
                onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super();
        this.linkId = linkId;
        this.id = id;
        this.getNeighboringSegmentsToNode = getNeighboringSegmentsToNode;
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
        // console.log("Creating a link node element");
        return document.createElementNS("http://www.w3.org/2000/svg", "circle");
    }
    
    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let beforeAndAfterSegments = this.getNeighboringSegmentsToNode(this.id);
        if (beforeAndAfterSegments) {
            return communicationManager.getLimitsOfSegment(this.linkId, beforeAndAfterSegments?.before.id)?.after;
        }
        return undefined;
    }

    getPositionForRotation(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        return this.getPosition(communicationManager);
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        const neighboringSegments = this.getNeighboringSegmentsToNode(this.id);
        if (neighboringSegments === undefined) {
            console.error(`Cannot move link node ${this.id} because neighboring segments are undefined.`);
            return;
        }
        communicationManager.moveLinkNode(this.linkId, neighboringSegments.before.id, neighboringSegments.after.id, x, y, selectedSelectableIds);
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
        const position = this.getPosition(communicationManager);
        if (position) {
            this.getElement().setAttribute("cx", String(position.x));
            this.getElement().setAttribute("cy", String(position.y));
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
    constructor(linkId: IdType, 
        getNeighboringSegmentsToNode: (nodeId: IdType) => { before: LinkSegment; after: LinkSegment; } | undefined,
        onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super(linkId, linkId + "SourceNode", getNeighboringSegmentsToNode, onDelete);
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
    segmentId: IdType;
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
        return this.segmentId + "TargetNode";    
    }
    constructor(linkId: IdType, segmentId: IdType, 
        getNeighboringSegmentsToNode: (nodeId: IdType) => { before: LinkSegment; after: LinkSegment; } | undefined,
        onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super(linkId, segmentId + "TargetNode", getNeighboringSegmentsToNode, onDelete);
        this.segmentId = segmentId;
        this.nodeElement.classList.add('target-node');
    }

    protected createNodeElement(): SVGElement {
        // console.log("Creating a target node element with arrow");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        return poly;
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        // Find the segment node that corresponds to this target
        communicationManager.print(`Updating target node ${this.getId()} from JSON`);
        const segmentNode = communicationManager.findSegmentNodeById(this.linkId, this.segmentId);
        communicationManager.print(`Found segment node: ${JSON.stringify(segmentNode)}`);
        if (!segmentNode) {return;}

        const position = this.getPosition(communicationManager);
        if (!position) {return;}
        // Place target node at its position
        this.getElement().setAttribute(
            "transform",
            `translate(${position.x}, ${position.y})`
        );

        // Find parent (the segment leading into this target)
        const parent = communicationManager.findParentSegmentNode(this.linkId, segmentNode.id);
        if (!parent) {
            const linkData = json.links?.find(link => link.id === this.linkId);
            if (!linkData) {return;}
            // No parent? Fallback to source position
            if (position.x < linkData.sourceX) {
                this.setArrowDirection("left");
            } else {
                this.setArrowDirection("right");
            }
            return;
        }

        // Direction is determined by parent orientation and relative position
        if (parent.orientation === "Vertical") {
            if (position.x < parent.xOrY) {
                this.setArrowDirection("left");
            } else {
                this.setArrowDirection("right");
            }
        } else { // Vertical
            if (position.y < parent.xOrY) {
                this.setArrowDirection("up");
            } else {
                this.setArrowDirection("down");
            }
        }
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.print(`Target node with id: ${this.getId()} moving to ${x}, ${y}`);
        
        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        communicationManager.moveTargetNode(this.linkId, this.segmentId, x, y, selectedSelectableIds);
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
        if (linkData && linkData.targetNodes[this.segmentId]) {
            console.log(`Getting position for target node ${this.id}: ${JSON.stringify(linkData.targetNodes[this.segmentId])}`);
            console.log(`X: ${linkData.targetNodes[this.segmentId].x}, Y: ${linkData.targetNodes[this.segmentId].y}`);
            return { x: linkData.targetNodes[this.segmentId].x, y: linkData.targetNodes[this.segmentId].y };
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
    orientation: "Horizontal" | "Vertical";
    xOrY: number;
    linkId: IdType;

    segmentElement: SVGPolylineElement;
    public getId(): IdType {
        return this.id;    
    }

    private onDelete: (communicationManager: CommunicationManager) => void;

    public getElement(): HTMLElement | SVGElement {
        return this.segmentElement;
    }

    constructor (id: IdType, orientation: "Horizontal" | "Vertical",
                xOrY: number,
                linkId: IdType,
                onDelete: (communicationManager: CommunicationManager) => void, communicationManager: CommunicationManager) {
        super();
        this.onDelete = onDelete;
        this.id = id;
        this.orientation = orientation;
        this.xOrY = xOrY;
        this.linkId = linkId;
        
        this.segmentElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.segmentElement.classList.add('link-line');
        this.segmentElement.setAttribute("stroke-linejoin", "miter");

        if (this._isSelected) {
            this.segmentElement.classList.add('selected');
        }

        const segmentLimits = communicationManager.getLimitsOfSegment(this.linkId, this.id);
        
        if (segmentLimits) {
            this.getElement().setAttribute("points", `${segmentLimits.before.x},${segmentLimits.before.y} ${segmentLimits.after.x},${segmentLimits.after.y}`);
        }
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {

        const segmentNode = communicationManager.findSegmentNodeById(this.linkId, this.id);
        if (!segmentNode) {return;}

        this.orientation = segmentNode.orientation;
        this.xOrY = segmentNode.xOrY;

        const segmentLimits = communicationManager.getLimitsOfSegment(this.linkId, this.id);
        
        if (segmentLimits) {
            this.getElement().setAttribute("points", `${segmentLimits.before.x},${segmentLimits.before.y} ${segmentLimits.after.x},${segmentLimits.after.y}`);
        }
    }

    public delete = (communicationManager: CommunicationManager): void => {
        this.onDelete(communicationManager);
    };

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {        
        const selectedSelectableIds: IdType[] = selectables.filter(selectable => selectable.isSelected()).map(selectable => selectable.getId());
        communicationManager.moveLinkSegment(this.linkId, this.id, x, y, selectedSelectableIds);
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
        communicationManager.rotateLinkSegmentClockwise(this.linkId, this.id, centerX, centerY);
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        communicationManager.rotateLinkSegmentCounterClockwise(this.linkId, this.id, centerX, centerY);
    }

    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let limits = communicationManager.getLimitsOfSegment(this.linkId, this.id);
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
