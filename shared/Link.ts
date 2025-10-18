import { getuid } from 'process';
import { IdType, Orientation } from './JsonTypes';
import { getNonce } from './util';
import { TargetNode } from '../blockEditor/LinkHelpers';

export interface SegmentNode {
    id: IdType;
    orientation: Orientation;
    xOrY: number;
    children: SegmentNode[];
}

export interface TargetNodeInfo {
    targetId: IdType;
    port: number;
    x: number;
    y: number;
}

export interface LinkJson {
    id: IdType;
    sourceId: IdType;
    sourcePort: number;
    sourceX: number;
    sourceY: number;
    targetNodes: { [segmentId: IdType]: TargetNodeInfo };
    segmentNode: SegmentNode;
}

export class Link {
    id: IdType;
    sourceId: IdType;
    sourcePort: number;
    sourceX: number; sourceY: number;
    targetNodes: { [segmentId: IdType]: TargetNodeInfo };

    public segmentNode: SegmentNode;

    constructor(json: LinkJson) {
        this.id = json.id;
        this.sourceId = json.sourceId;
        this.sourcePort = json.sourcePort;
        this.sourceX = json.sourceX;
        this.sourceY = json.sourceY;
        this.targetNodes = json.targetNodes;

        this.segmentNode = this.parseSegmentNode(json.segmentNode);
    }

    private parseSegmentNode(node: SegmentNode): SegmentNode {
        return {
            id: node.id,
            orientation: node.orientation,
            xOrY: node.xOrY,
            children: node.children?.map(child => this.parseSegmentNode(child)) ?? []
        };
    }

    public toJson(): LinkJson {
        return {
            id: this.id,
            sourceId: this.sourceId,
            sourcePort: this.sourcePort,
            sourceX: this.sourceX,
            sourceY: this.sourceY,
            targetNodes: this.targetNodes,
            segmentNode: this.serializeSegmentNode(this.segmentNode)
        };
    }

    private serializeSegmentNode(node: SegmentNode): SegmentNode {
        return {
            id: node.id,
            orientation: node.orientation,
            xOrY: node.xOrY,
            children: node.children.map(child => this.serializeSegmentNode(child))
        };
    }

    public findSegmentNodeById(targetId: IdType): SegmentNode | undefined {
        function dfs(node: SegmentNode): SegmentNode | undefined {
            if (node.id === targetId) {return node;}
            for (const child of node.children) {
                const found = dfs(child);
                if (found) {return found;}
            }
            return undefined;
        }
        return dfs(this.segmentNode);
    }

    public findParentSegmentNode(childId: IdType): SegmentNode | undefined {
        function dfs(node: SegmentNode): SegmentNode | undefined {
            for (const child of node.children) {
                if (child.id === childId) {
                    return node; // found parent
                }
                const found = dfs(child);
                if (found) {return found;}
            }
            return undefined;
        }
        return dfs(this.segmentNode);
    }

    createNewChildLinkFromNode(previousSegmentId: string, nextSegmentId: string): SegmentNode | undefined {
        const previous = this.findSegmentNodeById(previousSegmentId);
        if (!previous) {return undefined;}

        // find the target child inside previous.children
        const childIndex = previous.children.findIndex(c => c.id === nextSegmentId);
        if (childIndex === -1) {return undefined;}

        const next = previous.children[childIndex];

        // create a new intermediate segment
        const newSegment: SegmentNode = {
            id: getNonce(), 
            orientation: next.orientation,               
            xOrY: next.xOrY,                              
            children: []
        };

        // insert new segment between them
        previous.children.push(newSegment);

        const targetNode: TargetNodeInfo = {
            targetId: "undefined",
            port: -1,
            x: previous.orientation === 'Horizontal' ? previous.xOrY : next.xOrY,
            y: previous.orientation === 'Horizontal' ? next.xOrY : previous.xOrY,
        };
        this.targetNodes[newSegment.id] = targetNode;

        return newSegment;
    }

    createNewChildLinkFromSegment(linkId: string, segmentId: string, clickX: number, clickY: number): SegmentNode | undefined {
        const previous = this.findSegmentNodeById(segmentId);
        if (!previous) {return undefined;}

        // create a new intermediate segment
        const newSegment: SegmentNode = {
            id: getNonce(), 
            orientation: previous.orientation === 'Horizontal' ? 'Vertical' : 'Horizontal',              
            xOrY: previous.orientation === 'Horizontal' ? clickX : clickY,                              
            children: []
        };

        // insert new segment between them
        previous.children.push(newSegment);

        return newSegment;
    }

    getLimitsOfSegment(segmentId: IdType): {before: {x: number, y: number}, after: {x: number, y: number}} | undefined {
        const segment = this.findSegmentNodeById(segmentId);
        if (!segment) {return undefined;}

        const parent = this.findParentSegmentNode(segmentId);

        let beforeX: number;
        let beforeY: number;
        if (!parent) {
            // Root segment — before point is link source
            beforeX = this.sourceX;
            beforeY = this.sourceY;
        } else {
            if (parent.orientation === "Horizontal") {
                beforeY = parent.xOrY;
                if (segment.orientation === "Vertical") {
                    beforeX = segment.xOrY;
                } else {
                    let beforeXorUndefined = this.getLimitsOfSegment(parent.id)?.after.x;
                    if (beforeXorUndefined === undefined) {return undefined;}
                    beforeX = beforeXorUndefined;
                }
            } else {
                beforeX = parent.xOrY;
                if (segment.orientation === "Horizontal") {
                    beforeY = segment.xOrY;
                } else {
                    let beforeYorUndefined = this.getLimitsOfSegment(parent.id)?.after.y;
                    if (beforeYorUndefined === undefined) {return undefined;}
                    beforeY = beforeYorUndefined;
                }
            }
        }

        let afterX: number | undefined = undefined;
        let afterY: number | undefined = undefined;

        if (segment.children.length > 0) {
            // Any child with not equal orientation should share the same xOrY
            for (const child of segment.children) {
                if (segment.orientation !== child.orientation) {
                    if (segment.orientation === "Horizontal") {
                        afterY = segment.xOrY;
                        afterX = child.xOrY;
                    } else {
                        afterX = segment.xOrY;
                        afterY = child.xOrY;
                    }
                }
            }
            
        } else {
            // Leaf segment has a target node
            const targetInfo = this.targetNodes[segment.id];
            if (!targetInfo) {return undefined;}
            afterX = targetInfo.x;
            afterY = targetInfo.y;
        }

        if (afterX === undefined || afterY === undefined) {
            return undefined;
        }

        return {
            before: { x: beforeX, y: beforeY },
            after: { x: afterX, y: afterY }
        };
    }

}