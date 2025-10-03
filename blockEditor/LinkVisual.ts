import { IdType, JsonData } from "../shared/JsonTypes";
import { CommunicationManager } from "./CommunicationManager";
import { Link, SegmentNode } from "../shared/Link";
import { SourceNode, TargetNode, LinkNode, LinkSegment } from "./LinkHelpers"; // reuse your existing classes, just adapt constructors

export class LinkVisual {
    id: IdType;
    sourceNode: SourceNode;
    targetNodes: TargetNode[];
    segments: LinkSegment[] = [];
    junctionNodes: LinkNode[] = [];

    private onDelete: (link: LinkVisual) => void;

    constructor(
        link: Link,
        onDelete: (link: LinkVisual) => void,
        communicationManager: CommunicationManager
    ) {
        this.id = link.id;
        this.sourceNode = new SourceNode(this.id, () => this.delete(communicationManager));
        this.targetNodes = [];
        this.onDelete = onDelete;

        this.buildSegmentsFromTree(link.segmentNode, communicationManager);
    }

    private buildSegmentsFromTree(segmentNode: SegmentNode, communicationManager: CommunicationManager, parent?: SegmentNode) {
        if (parent) {
            // create a segment between parent and this node
            const seg = new LinkSegment(segmentNode.id, () => this.delete(communicationManager), communicationManager);
            this.segments.push(seg);

            // if parent has >1 child, create a junction node
            if (parent.children.length > 1) {
                const nodeId = `${parent.id}-${segmentNode.id}`;
                const node = new LinkNode(this.id, nodeId, cm => this.delete(cm));
                this.junctionNodes.push(node);
            }
        }

        if (segmentNode.children.length === 0) {
            // leaf node, create target node
            const targetNode = new TargetNode(segmentNode.id, () => this.delete(communicationManager));
            this.targetNodes.push(targetNode);
        } else {
            // recurse for children
            segmentNode.children.forEach(child => {
                this.buildSegmentsFromTree(child, communicationManager, segmentNode);
            });
        }
    }

    public addToSvg(svg: SVGSVGElement, communicationManager: CommunicationManager): void {
        this.segments.forEach(seg => svg.appendChild(seg.getElement()));
        this.junctionNodes.forEach(node => svg.appendChild(node.getElement()));
        svg.appendChild(this.sourceNode.getElement());
        this.targetNodes.forEach(tn => {
            svg.appendChild(tn.getElement());
        });
    }

    public removeFromSvg(svg: SVGSVGElement): void {
        this.segments.forEach(seg => svg.removeChild(seg.getElement()));
        this.junctionNodes.forEach(node => svg.removeChild(node.getElement()));
        svg.removeChild(this.sourceNode.getElement());
        this.targetNodes.forEach(tn => {
            svg.removeChild(tn.getElement());
        });    
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        const link = json.links?.find(l => l.id === this.id);
        if (!link) {return;}

        // Save selected state
        const selectedSegmentIds = new Set(this.segments.filter(s => s.isSelected()).map(s => s.id));
        const selectedJunctionIds = new Set(this.junctionNodes.filter(n => n.isSelected()).map(n => n.id));
        const selectedTargetIds = new Set(this.targetNodes.filter(t => t.isSelected()).map(t => t.getId()));
        const sourceSelected = this.sourceNode.isSelected();

        // Reset everything
        this.segments = [];
        this.junctionNodes = [];
        this.targetNodes = [];

        // Rebuild from tree
        this.buildSegmentsFromTree(link.segmentNode, communicationManager);

        // Restore selection state
        this.segments.forEach(seg => {
            if (selectedSegmentIds.has(seg.id)) {seg.select();}
        });
        this.junctionNodes.forEach(jn => {
            if (selectedJunctionIds.has(jn.id)) {jn.select();}
        });
        this.targetNodes.forEach(tn => {
            if (selectedTargetIds.has(tn.getId())) {tn.select();}
        });
        if (sourceSelected) {this.sourceNode.select();}

        // Update positions
        this.sourceNode.updateFromJson(json, communicationManager);
        this.targetNodes.forEach(tn => tn.updateFromJson(json, communicationManager));
        this.segments.forEach(seg => seg.updateFromJson(json, communicationManager));
        this.junctionNodes.forEach(node => node.updateFromJson(json, communicationManager));
    }

    public select() {
        this.segments.forEach(s => s.select());
        this.junctionNodes.forEach(n => n.select());
        this.sourceNode.select();
        this.targetNodes.forEach(tn => tn.select());
    }

    public unselect() {
        this.segments.forEach(s => s.unselect());
        this.junctionNodes.forEach(n => n.unselect());
        this.sourceNode.unselect();
        this.targetNodes.forEach(tn => tn.unselect());
    }

    public delete = (communicationManager: CommunicationManager): void => {
        communicationManager.deleteLink(this.id);
        this.onDelete(this);
    };
}
