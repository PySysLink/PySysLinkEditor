import { getuid } from 'process';
import { IdType, Orientation } from './JsonTypes';
import { getNonce } from './util';
import { link } from 'fs';

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

    public toJson(removeColinearSegments: boolean=true): LinkJson {
        if (removeColinearSegments) {
            this.removeColinearSegments(3);
        }

        this.alignColinearSegments();
        console.log(`Colinear segments aligned.`);

        if (removeColinearSegments) {
            this.removeLastColinearSegments(3);

            this.correctOverlappingBranches();
        }

        console.log(`All alignment done with removeColinear: ${removeColinearSegments}.`);

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

    private alignColinearSegments() {
        const self = this;

        const process = (node: SegmentNode): SegmentNode => {
            console.log(`Processing alignment at node ${node.id}`);
            // recurse children first
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = process(node.children[i]);
            }

            // collapse chains where node has exactly one child with same orientation
            while (node.children.length === 1 && node.children[0].orientation === node.orientation) {
                console.log(`Aligning colinear segments at node ${node.id}`);
                console.log(`Current segments: ${JSON.stringify(self.serializeSegmentNode(self.segmentNode))}`);
                const sole = node.children[0];

                // transfer target mapping from child to node if needed
                if (self.targetNodes[sole.id]) {
                    self.targetNodes[node.id] = self.targetNodes[sole.id];
                    delete self.targetNodes[sole.id];
                }

                // adopt child's children (effectively removing the intermediate segment)
                node.children = sole.children;
                // continue loop in case the new single child is also colinear
            }

            // if node has multiple children, align children's coordinate when they share the same orientation
            if (node.children.length > 1) {
                for (const child of node.children) {
                    if (child.orientation === node.orientation && child.xOrY !== node.xOrY) {
                        if (child.children.length === 0) {
                            console.log(`Aligning leaf colinear segment at node ${node.id}`);
                            console.log(`Current segments: ${JSON.stringify(self.serializeSegmentNode(self.segmentNode))}`);
                            let newSegment: SegmentNode = {
                                id: getNonce(),
                                orientation: child.orientation === "Horizontal" ? "Vertical" : "Horizontal",
                                xOrY: child.orientation === "Horizontal" ? self.targetNodes[child.id].x : self.targetNodes[child.id].y,
                                children: []
                            };
                            child.children.push(newSegment);
                            self.targetNodes[newSegment.id] = self.targetNodes[child.id];
                            delete self.targetNodes[child.id];
                        }
                        else {
                            child.xOrY = node.xOrY;
                        }
                    }
                }
            }

            return node;
        };

        this.segmentNode = process(this.segmentNode);
    }

    private correctOverlappingBranches() {
        const self = this;

        const process = (node: SegmentNode): SegmentNode => {
            console.log(`Processing overlapping branch correction at node ${node.id}`);
            // recurse children first
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = process(node.children[i]);
            }

            let count = 0;
            while (node.children.length === 2 && count < 100) {
                count++;
                console.log(`Checking overlapping branches at node ${node.id}`);
                if (node.children[0].orientation === node.children[1].orientation) {
                    console.warn(`Children of node ${node.id} have same orientation; cannot correct overlapping branches.`);
                    break;
                }

                const colinearChild = node.children[0].orientation === node.orientation ? node.children[0] : node.children[1];
                const nonColinearChild = node.children[0].orientation === node.orientation ? node.children[1] : node.children[0];

                const limitsParent = self.getLimitsOfSegment(node.id);
                const limitsColinearChild = self.getLimitsOfSegment(colinearChild.id);

                if (limitsParent && limitsColinearChild) {
                    console.log(`Limits parent: ${JSON.stringify(limitsParent)}, colinear child: ${JSON.stringify(limitsColinearChild)}`);
                    if (node.orientation === "Horizontal") {
                        // compute X ranges for parent and colinear child
                        const pStart = Math.min(limitsParent.before.x, limitsParent.after.x);
                        const pEnd = Math.max(limitsParent.before.x, limitsParent.after.x);
                        const cStart = Math.min(limitsColinearChild.before.x, limitsColinearChild.after.x);
                        const cEnd = Math.max(limitsColinearChild.before.x, limitsColinearChild.after.x);

                        const overlapStart = Math.max(pStart, cStart);
                        const overlapEnd = Math.min(pEnd, cEnd);

                        if (overlapStart < overlapEnd) {
                            if (Math.abs(nonColinearChild.xOrY - limitsParent.before.x) < Math.abs(nonColinearChild.xOrY - limitsColinearChild.after.x)) {
                                // Closer to parent, move up on tree
                                const parentOfNode = self.findParentSegmentNode(node.id);
                                if (parentOfNode) {
                                    if (parentOfNode.children.length > 1) {
                                        break;
                                    }
                                    const newSegment: SegmentNode = {
                                        id: getNonce(),
                                        orientation: "Horizontal",
                                        xOrY: node.xOrY,
                                        children: [nonColinearChild]
                                    };
                                    parentOfNode.children.push(newSegment);
                                    node.children = [colinearChild];
                                    node.orientation = "Vertical";
                                    node.xOrY = parentOfNode.xOrY;
                                }
                            }
                            else {
                                // Closer to colinear child, move down on tree, only if child has a single child
                                if (colinearChild.children.length > 1) {
                                    if (colinearChild.children.length === 2) {
                                        let nonColinearChildOfChild: SegmentNode | null = null;
                                        for (const grandChild of colinearChild.children) {
                                            if (grandChild.orientation !== colinearChild.orientation) {
                                                nonColinearChildOfChild = grandChild;
                                                break;
                                            }
                                        }
                                        if (nonColinearChildOfChild) {
                                            // Swap non colinear child with nonColinearChildOfChild
                                            colinearChild.children = colinearChild.children.filter(c => c.id !== nonColinearChildOfChild!.id);
                                            colinearChild.children.push(nonColinearChild);
                                            node.children = [colinearChild, nonColinearChildOfChild];
                                        }
                                    }
                                    break;
                                }
                                const newSegment: SegmentNode = {
                                    id: getNonce(),
                                    orientation: "Horizontal",
                                    xOrY: colinearChild.xOrY,
                                    children: [nonColinearChild]
                                };
                                colinearChild.children.push(newSegment);
                                node.children = [colinearChild];
                                colinearChild.orientation = "Vertical";
                                colinearChild.xOrY = limitsColinearChild.after.x;
                            }
                        }
                        else {
                            break;
                        }
                    } else { // Vertical
                        // compute Y ranges for parent and colinear child
                        const pStart = Math.min(limitsParent.before.y, limitsParent.after.y);
                        const pEnd = Math.max(limitsParent.before.y, limitsParent.after.y);
                        const cStart = Math.min(limitsColinearChild.before.y, limitsColinearChild.after.y);
                        const cEnd = Math.max(limitsColinearChild.before.y, limitsColinearChild.after.y);

                        const overlapStart = Math.max(pStart, cStart);
                        const overlapEnd = Math.min(pEnd, cEnd);

                        if (overlapStart < overlapEnd) {
                            if (Math.abs(nonColinearChild.xOrY - limitsParent.before.y) < Math.abs(nonColinearChild.xOrY - limitsColinearChild.after.y)) {
                                // Closer to parent, move up on tree
                                const parentOfNode = self.findParentSegmentNode(node.id);
                                if (parentOfNode) {
                                    if (parentOfNode.children.length > 1) {
                                        break;
                                    }
                                    const newSegment: SegmentNode = {
                                        id: getNonce(),
                                        orientation: "Vertical",
                                        xOrY: node.xOrY,
                                        children: [nonColinearChild]
                                    };
                                    parentOfNode.children.push(newSegment);
                                    node.children = [colinearChild];
                                    node.orientation = "Horizontal";
                                    node.xOrY = parentOfNode.xOrY;
                                }
                            } else {
                                // Closer to colinear child, move down on tree, only if child has a single child
                                if (colinearChild.children.length > 1) {
                                    if (colinearChild.children.length === 2) {
                                        let nonColinearChildOfChild: SegmentNode | null = null;
                                        for (const grandChild of colinearChild.children) {
                                            if (grandChild.orientation !== colinearChild.orientation) {
                                                nonColinearChildOfChild = grandChild;
                                                break;
                                            }
                                        }
                                        if (nonColinearChildOfChild) {
                                            // Swap non colinear child with nonColinearChildOfChild
                                            colinearChild.children = colinearChild.children.filter(c => c.id !== nonColinearChildOfChild!.id);
                                            colinearChild.children.push(nonColinearChild);
                                            node.children = [colinearChild, nonColinearChildOfChild];
                                        }
                                    }
                                    break;
                                }
                                const newSegment: SegmentNode = {
                                    id: getNonce(),
                                    orientation: "Vertical",
                                    xOrY: colinearChild.xOrY,
                                    children: [nonColinearChild]
                                };
                                colinearChild.children.push(newSegment);
                                node.children = [colinearChild];
                                colinearChild.orientation = "Horizontal";
                                colinearChild.xOrY = limitsColinearChild.after.y;
                            }
                        }
                        else {
                            break;
                        }
                    }
                } 
            }

            return node;
        };

        this.segmentNode = process(this.segmentNode);

        console.log(`Overlapping branches corrected. Current segments: ${JSON.stringify(self.serializeSegmentNode(self.segmentNode))}`);
    }

    private removeLastColinearSegments(tolerance: number) {
        const self = this;

        const process = (node: SegmentNode): SegmentNode => {
            console.log(`Processing last colinear removal at node ${node.id}`);
            // recurse first
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = process(node.children[i]);
            }

            // handle parent -> single child (leaf with target) where orientations alternate
            // and the target lies aligned with the parent so the middle segment is removable.
            if (node.children.length === 1 &&
                this.targetNodes[node.children[0].id] &&
                node.orientation !== node.children[0].orientation
            ) {
                const targetInfo = this.targetNodes[node.children[0].id];
                if ((node.orientation === "Horizontal" && Math.abs(node.xOrY - targetInfo.y) <= tolerance) ||
                    (node.orientation === "Vertical" && Math.abs(node.xOrY - targetInfo.x) <= tolerance)) {
                    console.log(`Removing colinear leaf segment at node ${node.children[0].id}`);
                    console.log(`Current segments: ${JSON.stringify(self.serializeSegmentNode(self.segmentNode))}`);
                    // transfer target mapping to parent
                    self.targetNodes[node.id] = targetInfo;
                    delete self.targetNodes[node.children[0].id];
                    node.children = [];
                }

            }

            return node;
        };

        this.segmentNode = process(this.segmentNode);
    }

    private removeColinearSegments(tolerance: number) {
        const self = this;

        const process = (node: SegmentNode): SegmentNode => {
            // recurse first
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = process(node.children[i]);
            }

            // collapse patterns: parent -> single child -> single grandchild
            // where parent and grandchild have the same orientation and the middle child is the opposite.
            // If the parent's xOrY and grandchild's xOrY differ by <= tolerance, merge them.
            while (
                node.children.length === 1 &&
                node.children[0].children &&
                node.children[0].children.length === 1
            ) {
                const child = node.children[0];
                const grand = child.children[0];

                // require alternating orientations: parent === grand && child !== parent
                if (child.orientation === node.orientation) { break; }
                if (grand.orientation !== node.orientation) { break; }

                console.log(`Distance between node ${node.id} and grandchild ${grand.id}: ${Math.abs(node.xOrY - grand.xOrY)}`);    

                // if the end coordinates are too far apart, don't merge
                if (Math.abs(node.xOrY - grand.xOrY) > tolerance) { break; }

                console.log(`Removing colinear segment at node ${child.id}`);
                console.log(`Current segments: ${JSON.stringify(self.serializeSegmentNode(self.segmentNode))}`);
                console.trace();
                // transfer any target mapping from grand (or middle child) to parent if needed
                self.targetNodes[node.id] = self.targetNodes[grand.id];
                delete self.targetNodes[grand.id];


                node.children = grand.children;

                node.xOrY = grand.xOrY;
            }

            return node;
        };

        this.segmentNode = process(this.segmentNode);

        console.log(`Colinear segments removed.`);
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

    createNewChildLinkFromNode(previousSegmentId: string, nextSegmentId: string): SegmentNode[] | undefined {
        const previous = this.findSegmentNodeById(previousSegmentId);
        if (!previous) {return undefined;}

        if (previous.children.length < 2) 
        {

        }

        // find the target child inside previous.children
        const childIndex = previous.children.findIndex(c => c.id === nextSegmentId);
        if (childIndex === -1) {return undefined;}

        const next = previous.children[childIndex];

        return this.createNewChildLinkFromSegment(this.id, previous.id, 
                                                    previous.orientation === 'Horizontal' ? next.xOrY : previous.xOrY,
                                                    previous.orientation === 'Horizontal' ? previous.xOrY : next.xOrY);
    }

    createNewChildLinkFromSegment(linkId: string, segmentId: string, clickX: number, clickY: number): SegmentNode[] | undefined {
        const segment = this.findSegmentNodeById(segmentId);
        if (!segment) {return undefined;}

        const parent = this.findParentSegmentNode(segmentId);

        const splitNode: SegmentNode = {
            id: getNonce(),
            orientation: segment.orientation,
            xOrY: segment.xOrY,
            children: []
        };

        splitNode.children.push(segment);

        const branchOrientation: Orientation = splitNode.orientation === "Horizontal" ? "Vertical" : "Horizontal";
        const branchNode: SegmentNode = {
            id: getNonce(),
            orientation: branchOrientation,
            xOrY: branchOrientation === "Horizontal" ? clickY : clickX,
            children: []
        };

        splitNode.children.push(branchNode);

        const nextNode: SegmentNode = {
            id: getNonce(),
            orientation: splitNode.orientation,
            xOrY: splitNode.orientation === "Horizontal" ? clickY + 10 : clickX + 10,
            children: []
        };

        branchNode.children.push(nextNode);

        if (parent) {
            // replace `segment` in parent's children with `splitNode`
            const idx = parent.children.findIndex(c => c.id === segmentId);
            if (idx === -1) {
                // unexpected; fallback: append
                parent.children.push(splitNode);
            } else {
                parent.children.splice(idx, 1, splitNode);
            }
        } else {
            // segment was the root: make splitNode the new root
            // (splitNode.children already contains the old root segment)
            this.segmentNode = splitNode;
        }

        const targetNode: TargetNodeInfo = {
            targetId: "undefined",
            port: -1,
            x: clickX + 10,
            y: clickY + 10,
        };
        this.targetNodes[nextNode.id] = targetNode;

        return [branchNode, nextNode];
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

    moveLinkSegment(segmentId: string, targetPositionX: number, targetPositionY: number, selectedSelectableIds: string[]) {
        let segment = this.findSegmentNodeById(segmentId);
        if (!segment) {return;}
        if (segment === this.segmentNode) {
            if (selectedSelectableIds.includes(this.id + "SourceNode")) {
                return;
            }
            if (segment.orientation === "Horizontal" && this.sourceY !== targetPositionY) {
                segment.xOrY = targetPositionY;
                let newSegment: SegmentNode = {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: this.sourceX,
                    children: [segment]
                };
                this.segmentNode = newSegment;
            } else if (segment.orientation === "Vertical" && this.sourceX !== targetPositionX) {
                segment.xOrY = targetPositionX;
                let newSegment: SegmentNode = {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: this.sourceY,
                    children: [segment]
                };
                this.segmentNode = newSegment;
            }
        } 
        else if (this.targetNodes[segment.id]) {
            if (selectedSelectableIds.includes(segment.id + "TargetNode")) {
                return;
            }
            if (segment.orientation === "Horizontal" && this.targetNodes[segment.id].y !== targetPositionY) {
                segment.xOrY = targetPositionY;
                let newSegment: SegmentNode = {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: this.targetNodes[segment.id].x,
                    children: []
                };
                segment.children.push(newSegment);
                this.targetNodes[newSegment.id] = this.targetNodes[segment.id];
                delete this.targetNodes[segment.id];
            } else if (segment.orientation === "Vertical" && this.targetNodes[segment.id].x !== targetPositionX) {
                segment.xOrY = targetPositionX;
                let newSegment: SegmentNode = {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: this.targetNodes[segment.id].y,
                    children: []
                };
                segment.children.push(newSegment);
                this.targetNodes[newSegment.id] = this.targetNodes[segment.id];
                delete this.targetNodes[segment.id];
            }
        }
        else {
            if (segment.orientation === "Horizontal") {
                segment.xOrY = targetPositionY;
            } else {
                segment.xOrY = targetPositionX;
            }
        }
        let parent = this.findParentSegmentNode(segmentId);
        if (parent && parent.orientation === segment.orientation) {
            if (selectedSelectableIds.find(selectable => selectable.includes(parent.id))) {
                return;
            }
            this.moveLinkSegment(parent.id, targetPositionX, targetPositionY, selectedSelectableIds);
        }
    }

    moveLinkNode(beforeId: string, afterId: string, targetPositionX: number, targetPositionY: number, selectedSelectableIds: string[]) {
        if (!selectedSelectableIds.includes(beforeId)) {
            this.moveLinkSegment(beforeId, targetPositionX, targetPositionY, selectedSelectableIds);
        }
        if (!selectedSelectableIds.includes(afterId)) {
            this.moveLinkSegment(afterId, targetPositionX, targetPositionY, selectedSelectableIds);
        }
    }

    moveSourceNode(x: number, y: number, selectedSelectableIds: string[]) {
        console.log(`Moving link source node: ${this.id} to x: ${x} y: ${y}`);
        this.sourceX = x;
        this.sourceY = y;

        if (this.segmentNode.orientation === "Horizontal" && this.segmentNode.xOrY !== y) {
            this.segmentNode.xOrY = y;
        } else if (this.segmentNode.orientation === "Vertical" && this.segmentNode.xOrY !== x) {
            this.segmentNode.xOrY = x;
        }

        if (this.segmentNode.children.length === 0) {
            if (selectedSelectableIds.includes(this.segmentNode.id)) {
                return;
            }
            const targetNode = this.targetNodes[this.segmentNode.id];
            if (!targetNode) {
                console.warn("No target node found for segment node");
                return;
            }
            console.log(`Selected selectable ids: ${JSON.stringify(selectedSelectableIds)}`);
            console.log(`Processing segment node: ${this.segmentNode.id}`);
            if (this.segmentNode.orientation === "Horizontal" && this.sourceY !== this.targetNodes[this.segmentNode.id].y) {
                console.log("Creating horizontal dog leg");
                console.log(`Current segments: ${JSON.stringify(this.serializeSegmentNode(this.segmentNode))}`);
                const newSegmentNode1: SegmentNode = {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: (this.targetNodes[this.segmentNode.id].x + this.sourceX) / 2,
                    children: []
                };
                const newSegmentNode2: SegmentNode = {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: this.targetNodes[this.segmentNode.id].y,
                    children: []
                };
                newSegmentNode1.children.push(newSegmentNode2);
                this.segmentNode.children.push(newSegmentNode1);
                this.targetNodes[newSegmentNode2.id] = this.targetNodes[this.segmentNode.id];
                delete this.targetNodes[this.segmentNode.id];
            } 
            else if (this.segmentNode.orientation === "Vertical" && this.sourceX !== this.targetNodes[this.segmentNode.id].x) {
                console.log("Creating vertical dog leg");
                console.log(`Current segments: ${JSON.stringify(this.serializeSegmentNode(this.segmentNode))}`);
                const newSegmentNode1: SegmentNode = {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: (this.targetNodes[this.segmentNode.id].y + this.sourceY) / 2,
                    children: []
                };
                const newSegmentNode2: SegmentNode = {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: this.targetNodes[this.segmentNode.id].x,
                    children: []
                };
                newSegmentNode1.children.push(newSegmentNode2);
                this.segmentNode.children.push(newSegmentNode1);
                this.targetNodes[newSegmentNode2.id] = this.targetNodes[this.segmentNode.id];
                delete this.targetNodes[this.segmentNode.id];
            }
        }
    }

    moveTargetNode(segmentId: IdType, x: number, y: number) {
        console.log(`Moving link target node: ${this.id} segment: ${segmentId} to x: ${x} y: ${y}`);
        const targetNode = this.targetNodes[segmentId];
        if (!targetNode) {
            console.warn("No target node found for segment node");
            return;
        }
        targetNode.x = x;
        targetNode.y = y;

        const segment = this.findSegmentNodeById(segmentId);
        if (!segment) {
            console.warn("No segment node found for segment id");
            return;
        }

        const parentSegment = this.findParentSegmentNode(segmentId);
        if (parentSegment && parentSegment.orientation === segment.orientation) {
            if (segment.orientation === "Horizontal" && parentSegment.xOrY !== y) {
                const newSegment: SegmentNode = {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: parentSegment.xOrY,
                    children: [segment]
                };
                parentSegment.children.push(newSegment);
                parentSegment.children = parentSegment.children.filter(c => c.id !== segment.id);
                segment.orientation = "Vertical";
                segment.xOrY = x;
            } else if (segment.orientation === "Vertical" && parentSegment.xOrY !== x) {
                const newSegment: SegmentNode = {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: parentSegment.xOrY,
                    children: [segment]
                };
                parentSegment.children.push(newSegment);
                parentSegment.children = parentSegment.children.filter(c => c.id !== segment.id);
                segment.orientation = "Horizontal";
                segment.xOrY = y;
            }
        } else if (segment.orientation === "Horizontal" && segment.xOrY !== y) {
            segment.xOrY = y;
        } else if (segment.orientation === "Vertical" && segment.xOrY !== x) {
            segment.xOrY = x;
        }
    }

    insertLinkBranch(mergedLink: Link, segmentId: string, mergeX: number, mergeY: number) {
        const segment = this.findSegmentNodeById(segmentId);
        if (!segment) {
            console.warn(`Segment ${segmentId} not found in link ${this.id}`);
            return;
        }

        const newSegmentNode: SegmentNode = {
            id: getNonce(),
            orientation: segment.orientation,
            xOrY: segment.xOrY,
            children: segment.children
        };

        segment.children = [];
        segment.children.push(newSegmentNode);

        if (segment.orientation === mergedLink.segmentNode.orientation) {
            const branchSegmentNode: SegmentNode = {
                id: getNonce(),
                orientation: segment.orientation === "Horizontal" ? "Vertical" : "Horizontal",
                xOrY: segment.orientation === "Horizontal" ? mergeX : mergeY,
                children: []
            };
            segment.children.push(branchSegmentNode);
            branchSegmentNode.children.push(mergedLink.segmentNode);
        }
        else {
            segment.children.push(mergedLink.segmentNode);
        }

        for (const [segId, targetInfo] of Object.entries(mergedLink.targetNodes)) {
            this.targetNodes[segId] = targetInfo;
        }
    }

    deleteFromSegment(segmentId: IdType) : boolean {
        // Check if segment exists
        const segment = this.findSegmentNodeById(segmentId);
        if (!segment) {
            console.warn(`Segment ${segmentId} not found in link ${this.id}`);
            return true;
        }

        let parent = this.findParentSegmentNode(segmentId);
        if (!parent) {
            // reached root (first segment) — nothing to delete as branch root
            return false;
        }

        // climb up until we find a node that has 2 (or more) children
        // or we reach the root
        let current = parent;
        while (current && current.children.length === 1) {
            current = this.findParentSegmentNode(current.id) ?? undefined as any;
        }

        // if we climbed to root (no parent with >1 children) return false
        if (!current) {
            console.warn("Cannot delete branch: no parent with multiple children found.");
            return false;
        }

        const branchRoot = current; // node that has at least 2 children

        // helper: check if subtree contains the target segment id
        const containsSegment = (node: SegmentNode, id: IdType): boolean => {
            if (node.id === id) { return true; }
            for (const c of node.children) {
                if (containsSegment(c, id)) { return true; }
            }
            return false;
        };

        // helper: collect all segment ids from a subtree
        const collectIds = (node: SegmentNode, acc: IdType[]) => {
            acc.push(node.id);
            for (const c of node.children) {
                collectIds(c, acc);
            }
        };

        // find which child of branchRoot contains the original segment and remove that child
        const idx = branchRoot.children.findIndex(c => containsSegment(c, segmentId));
        if (idx === -1) {
            // should not happen, but be safe
            return true;
        }

        const removed = branchRoot.children.splice(idx, 1)[0];

        // remove any targetNodes entries that belonged to the removed subtree
        const idsToRemove: IdType[] = [];
        collectIds(removed, idsToRemove);
        for (const id of idsToRemove) {
            if (this.targetNodes[id]) {
                delete this.targetNodes[id];
            }
        }

        return true;
    }

    rotateLink(rotationDirection: string, centralX: number, centralY: number, selectedSelectableIds: string[]) {
        const isSourceSelected = selectedSelectableIds.includes(this.id + "SourceNode");
        const areAllTargetsSelected = Object.keys(this.targetNodes).every(segmentId => selectedSelectableIds.includes(segmentId + "TargetNode"));

        function rotateSegmentNode(node: SegmentNode, centralX: number, centralY: number): SegmentNode {
            if (node.orientation === "Horizontal") {
                // Horizontal -> Vertical
                const distance = node.xOrY - centralY;
                const newXOrY = rotationDirection === "clockwise" ? centralX + distance : centralX - distance;
                node.orientation = "Vertical";
                node.xOrY = newXOrY;
            } else {
                // Vertical -> Horizontal
                const distance = node.xOrY - centralX;
                const newXOrY = rotationDirection === "clockwise" ? centralY - distance : centralY + distance;
                node.orientation = "Horizontal";
                node.xOrY = newXOrY;
            }
            node.children = node.children.map(child => rotateSegmentNode(child, centralX, centralY));
            return node;
        }

        if (isSourceSelected && areAllTargetsSelected) {
            // Rotate entire link 
            this.segmentNode = rotateSegmentNode(this.segmentNode, centralX, centralY);
            
            const deltaX = this.sourceX - centralX;
            const deltaY = this.sourceY - centralY;

            this.sourceX = rotationDirection === "clockwise" ? centralX + deltaY : centralX - deltaY;
            this.sourceY = rotationDirection === "clockwise" ? centralY - deltaX : centralY + deltaX;

            for (const targetInfo of Object.values(this.targetNodes)) {
                const tDeltaX = targetInfo.x - centralX;
                const tDeltaY = targetInfo.y - centralY;

                targetInfo.x = rotationDirection === "clockwise" ? centralX + tDeltaY : centralX - tDeltaY;
                targetInfo.y = rotationDirection === "clockwise" ? centralY - tDeltaX : centralY + tDeltaX;  
            }
        }
    }
}
