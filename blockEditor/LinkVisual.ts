import { debug, timeStamp } from 'console';
import { BlockVisual } from './BlockVisual';
import { Selectable } from './Selectable';
import { IdType, JsonData, LinkData } from '../shared/JsonTypes';
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
    nodeElement: SVGCircleElement;
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

        this.nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        this.nodeElement.classList.add('link-node');
        if (this._isSelected) {
            this.nodeElement.classList.add('selected');
        }
        if (this.isHighlighted) {
            this.nodeElement.classList.add('highlighted');
        }
    }
    
    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        let linkData = communicationManager.getLocalJson()?.links?.find(link => link.intermediateNodes.some(node => node.id === this.id));
        if (linkData) {
            let nodeData = linkData.intermediateNodes.find(node => node.id === this.id);
            if (nodeData) {
                return { x: nodeData.x, y: nodeData.y };
            }
        }
        return undefined;
    }

    private forceNewPosition(communicationManager: CommunicationManager, x: number, y: number): void {
        communicationManager.setPositionForLinkNode(this.linkId, this.id, x, y);
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        console.log(`Link node with id: ${this.getId()} moving to ${x}, ${y}`);
        const linkData = communicationManager.getLocalJson()?.links?.find(link => link.id === this.linkId);
        if (linkData) {
            const linkIndex = linkData.intermediateNodes.findIndex(node => node.id === this.id);

            let sourceId;
            let sourceIdForSearch;
            if (linkIndex === 0) {
                sourceId = "SourceNode";
                sourceIdForSearch = this.linkId + "SourceNode";
            } else {
                sourceId = linkData.intermediateNodes[linkIndex - 1].id;
                sourceIdForSearch = sourceId;
            }

            let previousSegmentId = sourceIdForSearch + this.id;
            const isPreviousSegmentSelected = selectables.some(selectable => selectable.getId() === previousSegmentId && selectable.isSelected());
            if (!isPreviousSegmentSelected) {
                let segmentSelectable = selectables.find(selectable => selectable.getId() === previousSegmentId);
                if (segmentSelectable && isMovable(segmentSelectable)) {
                    console.log(`Everything OK, moving previous segment: ${segmentSelectable.getId()}`);
                    (segmentSelectable as Movable).moveTo(x, y, communicationManager, selectables);
                }
            }            

            let targetId;
            let targetIdForSearch;
            if (linkIndex === linkData.intermediateNodes.length - 1) {
                targetId = "TargetNode";
                targetIdForSearch = this.linkId + "TargetNode";
            } else {
                targetId = linkData.intermediateNodes[linkIndex + 1].id;
                targetIdForSearch = targetId;
            }

            let nextSegmentId = this.id + targetIdForSearch;
            // Check if the previous segment exists and is selected
            const isNextSegmentSelected = selectables.some(selectable => selectable.getId() === nextSegmentId && selectable.isSelected());
            let isNextIntermediateNodeSelected = false;
            if (targetId !== "TargetNode") {
                isNextIntermediateNodeSelected = selectables.some(selectable => selectable.getId() === targetId && selectable.isSelected());
                console.log(`Next intermediate node: ${targetId} is selected: ${isNextIntermediateNodeSelected}`);
            }
            if (!isNextSegmentSelected && !isNextIntermediateNodeSelected) {
                let segmentSelectable = selectables.find(selectable => selectable.getId() === nextSegmentId);
                if (segmentSelectable && isMovable(segmentSelectable)) {
                    console.log(`Everything OK, moving next segment: ${segmentSelectable.getId()}`);
                    (segmentSelectable as Movable).moveTo(x, y, communicationManager, selectables);
                } 
            }
        }
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
        let centralPosition = this.getPosition(communicationManager);
        if (centralPosition) {
            const deltaX = centerX - centralPosition.x;
            const deltaY = centerY - centralPosition.y;

            let targetPosition = {
                x: centerX + deltaY,
                y: centerY - deltaX
            };

            this.forceNewPosition(communicationManager, targetPosition.x, targetPosition.y);
        }
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let centralPosition = this.getPosition(communicationManager);
        if (centralPosition) {
            const deltaX = centerX - centralPosition.x;
            const deltaY = centerY - centralPosition.y;

            let targetPosition = {
                x: centerX - deltaY,
                y: centerY + deltaX
            };

            this.forceNewPosition(communicationManager, targetPosition.x, targetPosition.y);
        }
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const nodeData = json.links
                            ?.flatMap(link => link.intermediateNodes)
                            .find(node => node.id === this.id);

        if (nodeData) {
            this.getElement().setAttribute("cx", String(nodeData.x));
            this.getElement().setAttribute("cy", String(nodeData.y));
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
        const linkData = communicationManager.getLocalJson()?.links?.find(link => link.id === this.linkId);
        if (linkData) {
            const connectedBlock = selectables.find(selectable => selectable.getId() === linkData.sourceId);
            if (connectedBlock && connectedBlock.isSelected()) {
                // Do not move if the connected block is selected
                return;
            }
        }
        communicationManager.moveSourceNode(this.linkId, x, y);
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
        ;
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        ;
    }
}
export class TargetNode extends LinkNode {
    public getId(): IdType {
        return this.linkId + "TargetNode";    
    }
    constructor(linkId: IdType, onDelete: ((communicationManager: CommunicationManager) => void) | undefined = undefined) {
        super(linkId, getNonce(), onDelete);
        this.nodeElement.classList.add('target-node');
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const linkData = json.links?.find(link => link.id === this.linkId);

        if (linkData) {
            this.getElement().setAttribute("cx", String(linkData.targetX));
            this.getElement().setAttribute("cy", String(linkData.targetY));
        } 
    }

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        const linkData = communicationManager.getLocalJson()?.links?.find(link => link.id === this.linkId);
        if (linkData) {
            const connectedBlock = selectables.find(selectable => selectable.getId() === linkData.targetId);
            if (connectedBlock && connectedBlock.isSelected()) {
                // Do not move if the connected block is selected
                return;
            }
        }
        communicationManager.moveTargetNode(this.linkId, x, y);
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
        ;
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        ;
    }
}


export class LinkSegment extends Selectable implements Movable {
    sourceLinkNode: LinkNode;
    targetLinkNode: LinkNode;
    segmentElement: SVGPolylineElement;
    public getId(): IdType {
        return this.sourceLinkNode.getId() + this.targetLinkNode.getId();    
    }

    private onDelete: () => void;

    public getElement(): HTMLElement | SVGElement {
        return this.segmentElement;
    }

    constructor (sourceLinkNode: LinkNode, targetLinkNode: LinkNode, onDelete: () => void, communicationManager: CommunicationManager) {
        super();
        this.onDelete = onDelete;
        this.sourceLinkNode = sourceLinkNode;
        this.targetLinkNode = targetLinkNode;
        
        this.segmentElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.segmentElement.classList.add('link-line');
        this.segmentElement.setAttribute("stroke-linejoin", "miter");

        if (this._isSelected) {
            this.segmentElement.classList.add('selected');
        }

        const sourcePosition = this.sourceLinkNode.getPosition(communicationManager);
        const targetPosition = this.targetLinkNode.getPosition(communicationManager);
        
        if (sourcePosition && targetPosition) {
            this.getElement().setAttribute("points", `${sourcePosition.x},${sourcePosition.y} ${targetPosition.x},${targetPosition.y}`);
        }
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const sourcePosition = this.sourceLinkNode.getPosition(communicationManager);
        const targetPosition = this.targetLinkNode.getPosition(communicationManager);
        
        // console.log(`Going to update`);
        if (sourcePosition && targetPosition) {
            // console.log(`Let us update x: ${sourcePosition.x}, y: ${sourcePosition.y}`);
            this.getElement().setAttribute("points", `${sourcePosition.x},${sourcePosition.y} ${targetPosition.x},${targetPosition.y}`);
        }
    }

    public delete = (): void => {
        this.onDelete();
    };

    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        console.log(`Segment with id: ${this.getId()} moving to ${x}, ${y}`);
        const linkData = communicationManager.getLocalJson()?.links?.find(link => link.id === this.sourceLinkNode.getLinkId());

        if (linkData) {
            let sourceId = this.sourceLinkNode.getId();
            let targetId = this.targetLinkNode.getId();
            if (this.sourceLinkNode instanceof SourceNode) {
                let isSourceLinkSelected = selectables.some(selectable => selectable.getId() === this.sourceLinkNode.getId() && selectable.isSelected());
                if (isSourceLinkSelected) {
                    // Do not move if the source link is selected
                    return;
                }
                if (linkData.sourceId !== "undefined") {
                    let sourceBlockId = communicationManager.getLocalJson()?.blocks?.find(block => block.id === linkData.sourceId)?.id;
                    let isSourceBlockSelected = selectables.some(selectable => selectable.getId() === sourceBlockId && selectable.isSelected());
                    if (isSourceBlockSelected) {
                        // Do not move if the source block is selected
                        return;
                    }
                }
                sourceId = "SourceNode";
            }
            if (this.targetLinkNode instanceof TargetNode) {
                let isTargetLinkSelected = selectables.some(selectable => selectable.getId() === this.targetLinkNode.getId() && selectable.isSelected());
                if (isTargetLinkSelected) {
                    // Do not move if the target link is selected
                    return;
                }
                if (linkData.targetId !== "undefined") {
                    let targetBlockId = communicationManager.getLocalJson()?.blocks?.find(block => block.id === linkData.targetId)?.id;
                    let isTargetBlockSelected = selectables.some(selectable => selectable.getId() === targetBlockId && selectable.isSelected());
                    if (isTargetBlockSelected) {
                        // Do not move if the target block is selected
                        return;
                    }
                }
                targetId = "TargetNode";
            }
            communicationManager.moveLinkSegment(linkData, sourceId, targetId, x, y);
        }
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
        let isSourceLinkSelected = selectables.some(selectable => selectable.getId() === this.sourceLinkNode.getId() && selectable.isSelected());
        let isTargetLinkSelected = selectables.some(selectable => selectable.getId() === this.targetLinkNode.getId() && selectable.isSelected());
        
        if (!isSourceLinkSelected) {
            this.sourceLinkNode.moveClockwiseAround(centerX, centerY, communicationManager, selectables);
        }
        if (!isTargetLinkSelected) {
            this.targetLinkNode.moveClockwiseAround(centerX, centerY, communicationManager, selectables);
        }
    }

    moveCounterClockwiseAround(centerX: number, centerY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void {
        let isSourceLinkSelected = selectables.some(selectable => selectable.getId() === this.sourceLinkNode.getId() && selectable.isSelected());
        let isTargetLinkSelected = selectables.some(selectable => selectable.getId() === this.targetLinkNode.getId() && selectable.isSelected());
        
        if (!isSourceLinkSelected) {
            this.sourceLinkNode.moveCounterClockwiseAround(centerX, centerY, communicationManager, selectables);
        }
        if (!isTargetLinkSelected) {
            this.targetLinkNode.moveCounterClockwiseAround(centerX, centerY, communicationManager, selectables);
        }
    }

    getPosition(communicationManager: CommunicationManager): { x: number; y: number; } | undefined {
        return this.sourceLinkNode.getPosition(communicationManager);
    }

    public selectCondition(): "Intersect" | "FullyWithing" {
        return "FullyWithing";
    }
}

export class LinkVisual {
    sourceNode: SourceNode;
    targetNode: TargetNode;
    intermediateNodes: LinkNode[] = [];
    segments: LinkSegment[] = [];
    id: string;

    private onDelete: (link: LinkVisual) => void;

    constructor(
        linkData: LinkData,
        onDelete: (link: LinkVisual) => void
    ) {
        this.id = linkData.id;
        this.sourceNode = new SourceNode(this.id, (communicationManager: CommunicationManager) => this.delete(communicationManager));
        this.targetNode = new TargetNode(this.id, (communicationManager: CommunicationManager) => this.delete(communicationManager));
        this.intermediateNodes = linkData.intermediateNodes.map(nodeData => new LinkNode(this.id, nodeData.id, (communicationManager: CommunicationManager) => this.delete(communicationManager)));
        this.onDelete = onDelete;
    }
    

    public updateSegments(communicationManager: CommunicationManager) {
        let newSegments: LinkSegment[] = [];
        if (this.intermediateNodes.length === 0) {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments = [existingSegment];
            } else {
                newSegments = [new LinkSegment(this.sourceNode, this.targetNode, () => this.onDelete(this), communicationManager)];
            }
        } else {
            let existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.sourceNode && segment.targetLinkNode === this.intermediateNodes[0]);
            if (existingSegment) {
                newSegments = [existingSegment];
            } else {
                newSegments = [new LinkSegment(this.sourceNode, this.intermediateNodes[0], () => this.onDelete(this), communicationManager)];
            }
            for (let i: number = 0; i < this.intermediateNodes.length - 1; i++) {
                existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[i] && segment.targetLinkNode === this.intermediateNodes[i + 1]);
                if (existingSegment) {
                    newSegments.push(existingSegment);
                } else {
                    newSegments.push(new LinkSegment(this.intermediateNodes[i], this.intermediateNodes[i + 1], () => this.onDelete(this), communicationManager));
                }
            }
            existingSegment = this.segments.find(segment => segment.sourceLinkNode === this.intermediateNodes[this.intermediateNodes.length - 1] && segment.targetLinkNode === this.targetNode);
            if (existingSegment) {
                newSegments.push(existingSegment);
            } else {
                newSegments.push(new LinkSegment(this.intermediateNodes[this.intermediateNodes.length - 1], this.targetNode, () => this.onDelete(this), communicationManager));
            }
        }
        this.segments.forEach(segment => {
            if (segment.isSelected()) {
                if (segment.sourceLinkNode instanceof SourceNode) {
                    if (segment.targetLinkNode instanceof TargetNode) {
                        newSegments.forEach(newSegment => {
                            if (!(newSegment.sourceLinkNode instanceof SourceNode) && !(newSegment.targetLinkNode instanceof TargetNode)) {
                                newSegment.select();
                            }
                        });
                    } else {
                        newSegments.forEach(newSegment => {
                            if (newSegment.targetLinkNode.getId() === segment.targetLinkNode.getId()) {
                                newSegment.select();
                            }
                        });
                    }
                }
                else if (segment.targetLinkNode instanceof TargetNode) {
                    newSegments.forEach(newSegment => {
                        if (newSegment.sourceLinkNode.getId() === segment.sourceLinkNode.getId()) {
                            newSegment.select();
                        }
                    });
                }
                newSegments.forEach(newSegment => {
                    if (newSegment.getId() === segment.getId()) {
                        newSegment.select();
                    }
                });
            }
        });
        this.segments = newSegments;
    }

    public addToSvg(svg: SVGSVGElement, communicationManager: CommunicationManager): void {
        this.updateSegments(communicationManager);
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

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        this.sourceNode.updateFromJson(json, communicationManager);
        this.targetNode.updateFromJson(json, communicationManager);
        
        // If no intermediate nodes actually present, and both source and target selected, do not allow new creations
        if (this.intermediateNodes.length === 0 && this.sourceNode.isSelected() && this.targetNode.isSelected()) {
            this.updateSegments(communicationManager);
            this.segments.forEach(segment => segment.updateFromJson(json, communicationManager));
            return;
        }

        // Sync intermediateNodes with json
        const jsonNodes = json.links?.find(link => link.id === this.id)?.intermediateNodes ?? [];
        const newNodes: LinkNode[] = [];

        let previousExistingNode: SourceNode | LinkNode = this.sourceNode;
        for (let i = 0; i < jsonNodes.length; i++) {
            const jsonNode = jsonNodes[i];
            
            // Try to find an existing node with the same id
            let existingNode = this.intermediateNodes.find(node => node.id === jsonNode.id);
            if (!existingNode) {
                existingNode = new LinkNode(this.id, jsonNode.id, (cm: CommunicationManager) => this.delete(cm));

                // previousExistingNodeIndexInCurrent will be -1 when previousExistingNode is SourceNode, which is nice for the application
                const previousExistingNodeIndexInCurrent = this.intermediateNodes.findIndex(intermediateNode => intermediateNode.id === previousExistingNode.id);
                

                // Check if both adjacent nodes are selected
                let nextExistingNode: LinkNode | TargetNode | undefined = undefined;

                if (previousExistingNodeIndexInCurrent === this.intermediateNodes.length - 1) {
                    nextExistingNode = this.targetNode;
                } else {
                    nextExistingNode = this.intermediateNodes[previousExistingNodeIndexInCurrent + 1];
                }

                if (previousExistingNode && nextExistingNode && previousExistingNode.isSelected() && nextExistingNode.isSelected()) {
                    // Both adjacent nodes are selected, select also new node
                    existingNode.select();
                }
                // Create new node if not found
            } else {previousExistingNode = existingNode;}
            newNodes.push(existingNode);
            existingNode.updateFromJson(json, communicationManager);
        }

        // Remove SVG elements for nodes that are no longer present
        const removedNodes = this.intermediateNodes.filter(node => !newNodes.includes(node));
        removedNodes.forEach(node => {
            if (node.nodeElement && node.nodeElement.parentNode) {
                node.nodeElement.parentNode.removeChild(node.nodeElement);
            }
        });

        this.intermediateNodes = newNodes;

        // Update segments after nodes are synced
        this.updateSegments(communicationManager);
        this.segments.forEach(segment => segment.updateFromJson(json, communicationManager));
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

    public delete = (communicationManager: CommunicationManager): void => {
        communicationManager.print(`Delete link: ${this.id}`);
        communicationManager.deleteLink(this.id);
        this.onDelete(this);
    };
}
