import { IdType, Orientation } from './JsonTypes';

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

}