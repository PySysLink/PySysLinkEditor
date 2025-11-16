import { link } from 'fs';
import { BlockInteractionManager } from './BlockInteractionManager';
import { LinkVisual } from './LinkVisual';
import { LinkNode, LinkSegment, SourceNode, TargetNode } from './LinkHelpers';
import { BlockVisual } from './BlockVisual';
import { getNonce } from './util';
import { IdType, JsonData } from '../shared/JsonTypes'; 
import { LinkJson, Link } from '../shared/Link';
import { CommunicationManager } from './CommunicationManager';
import { SelectableManager } from './SelectableManager';
import { CanvasElement } from './CanvasElement';

export class LinkInteractionManager {
    public links: LinkVisual[] = [];
    public linksSvg: SVGSVGElement;
    
    private getZoomLevelReal: () => number;

    private canvas: HTMLElement;
    private communicationManager: CommunicationManager;

    private blockInteractionManager: BlockInteractionManager;
    private selectableManager: SelectableManager;

    constructor (communicationManager: CommunicationManager, canvas: HTMLElement, linksSvg: SVGSVGElement, blockInteractionManager: BlockInteractionManager,
        selectableManager: SelectableManager, getZoomLevelReal: () => number
    ) {
        this.communicationManager = communicationManager;
        this.selectableManager = selectableManager;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.blockInteractionManager = blockInteractionManager;
        this.getZoomLevelReal = getZoomLevelReal;
        this.blockInteractionManager.registerOnMouseDownOnPortCallback(this.onMouseDownOnPort);
    }

    public getAllLinkSegments(): LinkSegment[] {
        const seenIds = new Set<string>();
        const result: LinkSegment[] = [];

        this.links.forEach(link => {
            link.segments.forEach(segment => {
                if (!seenIds.has(segment.getId())) {
                    seenIds.add(segment.getId());
                    result.push(segment);
                }
                else {
                    this.communicationManager.print(`Duplicate segment found: ${segment.getId()}`);
                }
            });
        });

        return result;
    }

    public getAllLinkNodes(): LinkNode[] {
        const seenIds = new Set<string>();
        const result: LinkNode[] = [];

        this.links.forEach(link => {
            link.junctionNodes.forEach(node => {
                if (!seenIds.has(node.getId())) {
                    seenIds.add(node.getId());
                    result.push(node);
                }
                else {
                    this.communicationManager.print(`Duplicate node found: ${node.getId()}`);
                }
                
            });
            if (!seenIds.has(link.sourceNode.getId())) {
                seenIds.add(link.sourceNode.getId());
                result.push(link.sourceNode);
            }
            else {
                this.communicationManager.print(`Duplicate source node found: ${link.sourceNode.getId()}`);
            }
            link.targetNodes.forEach(targetNode => {
                if (!seenIds.has(targetNode.getId())) {
                    seenIds.add(targetNode.getId());
                    result.push(targetNode);
                }
                else {
                    this.communicationManager.print(`Duplicate target node found: ${targetNode.getId()}`);
                }
            });
        });
        return result;
    }

    public createLinkVisual(linkData: LinkJson): LinkVisual {
        this.communicationManager.print(`Creating link visual for link: ${linkData.id}`);
        if (this.links.find(link => link.id === linkData.id)) {
            this.communicationManager.print(`Link visual with id ${linkData.id} already exists, skipping creation.`);
            return this.links.find(link => link.id === linkData.id)!;
        }
        let newLink = new LinkVisual(
            new Link(linkData),
            this.deleteLinkFromSegment,
            this.communicationManager
        );

        this.links.push(newLink);
        newLink.addToSvg(this.linksSvg, this.communicationManager);

        return newLink;
    }

    private onMouseDownOnPort = (block: BlockVisual, e: any, portType: "input" | "output", portIndex: number): void => {
        let isLinkOnNode = false;
        this.communicationManager.print(`[link log] Checking if block already have connection`);

        if (portType === "input") {
            this.communicationManager.getLocalJson()?.links?.forEach(link => {
                for (const segmentId in link.targetNodes) {
                    if (link.targetNodes[segmentId].targetId === block.id && link.targetNodes[segmentId].port === portIndex) {
                        this.communicationManager.print(`Connected link found ${link.id}`);
                        isLinkOnNode = true;
                    }
                }
            });
        } else {
            this.communicationManager.getLocalJson()?.links?.forEach(link => {
                if (link.sourceId === block.id && link.sourcePort === portIndex) {
                    this.communicationManager.print(`Connected link found ${link.id}`);
                    isLinkOnNode = true;
                }
            });
        }
        
        if (!isLinkOnNode) {
            this.communicationManager.print(`Mouse down on non connected port, creating link`);

            e.stopPropagation();


            let newLinkData = this.communicationManager.createNewLinkFromPort(block.id, portType, portIndex);
            if (newLinkData) {
                this.communicationManager.print(`Creating new link visual due to click on port id: ${newLinkData.id}`);
                let newLink = this.createLinkVisual(newLinkData);
                newLink.sourceNode.addOnDeleteCallback(() => newLink?.delete(this.communicationManager, newLinkData.segmentNode.id));
                newLink.targetNodes.forEach(targetNode => targetNode.addOnDeleteCallback(() => newLink?.delete(this.communicationManager, newLinkData.segmentNode.id)));

                if (portType === "input") {
                    this.selectableManager.addCallbackToSelectable(newLink.sourceNode);
                    newLink.sourceNode.unselect();
                    newLink.sourceNode.triggerOnMouseDown(e.clientX, e.clientY);
                } else {
                    newLink.targetNodes.forEach(targetNode => {
                        this.selectableManager.addCallbackToSelectable(targetNode);
                        targetNode.unselect();
                        targetNode.triggerOnMouseDown(e.clientX, e.clientY);
                    });
                }
            } else { return; }
        }            
    };

    public updateFromJson(json: JsonData): SVGSVGElement {
        this.linksSvg = document.querySelector('.links') as SVGSVGElement;
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

        json.links?.forEach(linkData => {
            var link = this.links.find(l => l.id === linkData.id);
            if (!link) {
                this.communicationManager.print(`Creating new link visual due to not found id: ${linkData.id}`);
                this.createLinkVisual(linkData);
            }
        });

        this.links.forEach((link: LinkVisual) => {
            const linkData = json.links?.find(l => l.id === link.id);
            if (!linkData) {
                this.deleteLink(link);
            }
        });

        // this.links.forEach(link => link.removeFromSvg(this.linksSvg));
        this.links.forEach(link => link.updateFromJson(json, this.communicationManager));
        this.links.forEach(link => link.addToSvg(this.linksSvg, this.communicationManager));

        this.highlightNodesNearPorts();


        return this.linksSvg;

    }


    public getSelectedLinkSegments(): LinkSegment[] {
        var result: LinkSegment[] = [];
        this.links.forEach(link => {
            link.segments.forEach(segment => {
                if (segment.isSelected()) {
                    result.push(segment);
                }
            });
        });
        return result;
    }

    public getSelectedLinkNodes(): LinkNode[] {
        var result: LinkNode[] = [];
        this.links.forEach(link => {
            link.junctionNodes.forEach(node => {
                if (node.isSelected()) {
                    result.push(node);
                }
            });
            if (link.sourceNode.isSelected()) {result.push(link.sourceNode);}
            link.targetNodes.forEach(targetNode => {
                if (targetNode.isSelected()) {result.push(targetNode);}
            });
        });
        return result;
    }


    public getSelectedLinks(): LinkVisual[] {
        var result: LinkVisual[] = [];
        this.links.forEach(link => {
            for (let segment of link.segments) {
                if (segment.isSelected()) {
                    result.push(link);
                    break;
                }
            }
            for (let node of link.junctionNodes) {
                if (node.isSelected()) {
                    result.push(link);
                    break;
                }
            }
            if (link.sourceNode.isSelected() || link.targetNodes.some(targetNode => targetNode.isSelected())) {
                result.push(link);
            }
        });
        return result;
    }

    public deleteLink = (link: LinkVisual): void => {
        this.communicationManager.print(`Deleting link visual: ${link.id}`);
        link.removeFromSvg(this.linksSvg);
        const index = this.links.indexOf(link);
        if (index !== -1) {
            this.links.splice(index, 1);
        }
    };

    public deleteLinkFromSegment = (linkId: IdType, segmentId: IdType): void => {
        this.communicationManager.deleteLinkFromSegment(linkId, segmentId);
    };

    public highlightNodesNearPorts = (e: MouseEvent | undefined=undefined) : void => {
        this.communicationManager.getLocalJson()?.links?.forEach(link => {
            const visualLink = this.links.find(l => l.id === link.id);

            const port1 = this.detectPort(link.sourceX, link.sourceY);
            if (port1) {
                if (port1.portType === "output") {
                    if (link.sourceId === "undefined") {
                        visualLink?.sourceNode.highlight();
                    } else {
                        visualLink?.sourceNode.unhighlight();
                    }
                } else { visualLink?.sourceNode.unhighlight(); }
            } else {
                visualLink?.sourceNode.unhighlight();
            }

            for (const segmentId in link.targetNodes) {
                const targetInfo = link.targetNodes[segmentId];
                if (!targetInfo) {continue;}
                const portI = this.detectPort(targetInfo.x, targetInfo.y);
                if (portI) {
                    if (portI.portType === "input") {
                        if (targetInfo.targetId === "undefined") {
                            visualLink?.targetNodes.find(targetNode => targetNode.id === segmentId)?.highlight();
                        }
                    } else { 
                            visualLink?.targetNodes.find(targetNode => targetNode.id === segmentId)?.unhighlight();
                    }
                } else {
                    visualLink?.targetNodes.find(targetNode => targetNode.id === segmentId)?.unhighlight();
                }
            }
            
        });
    };

    
    private detectPort(x: number, y: number): { blockId: IdType; portType: "input" | "output"; portIndex: number } | undefined {
        let localJson = this.communicationManager.getLocalJson();
        if (!localJson) {
            return undefined;
        }
        if (!localJson.blocks) {
            return undefined;
        }
        for (const block of localJson.blocks) {
            for (let i = 0; i < block.inputPorts; i++) {
                const portPosition = this.communicationManager.getPortPosition(block.id, "input", i);
                if (portPosition) {
                    if (Math.abs(x - portPosition.x) < 10 && Math.abs(y - portPosition.y) < 10) {
                        return { blockId: block.id, portIndex: i, portType: "input" };
                    }
                }
            }
            for (let i = 0; i < block.outputPorts; i++) {
                const portPosition = this.communicationManager.getPortPosition(block.id, "output", i);
                if (portPosition) {
                    if (Math.abs(x - portPosition.x) < 10 && Math.abs(y - portPosition.y) < 10) {
                        return { blockId: block.id, portIndex: i, portType: "output" };
                    }
                }
            }
        }
        return undefined;
    }

    public updateLinkAndNodeClickCallback(): void {
        this.links.forEach(linkVisual => {
            linkVisual.segments.forEach(segment => {
                segment.addOnMouseDownListener("link_interaction_manager", this.onMouseDownInSegment);
            });
            linkVisual.junctionNodes.forEach(node => {
                node.addOnMouseDownListener("link_interaction_manager", this.onMouseDownInNode);
            });
        });
    }

    private onMouseDownInSegment = (canvasElement: CanvasElement, e: MouseEvent): void => {
        this.communicationManager.print(`[link log]: Segment clicked`);
        if (e.button === 0 && (e.ctrlKey || e.metaKey)) { // Left click + Ctrl or Meta
            const segment = canvasElement as LinkSegment;

            const canvasRect = this.canvas.getBoundingClientRect();

            const adjustedX = (e.clientX - canvasRect.left) / this.getZoomLevelReal();
            const adjustedY = (e.clientY - canvasRect.top) / this.getZoomLevelReal();

            e.stopPropagation();
            let link = this.links.find(l => l.id === segment.linkId);

            let newSegmentIds = this.communicationManager.createNewChildLinkFromSegment(segment.linkId, segment.getId(), adjustedX, adjustedY);
            if (newSegmentIds) {
                this.communicationManager.print(`Creating new link visual due to click on segment id: ${newSegmentIds}`);
                let newJson = this.communicationManager.getLocalJson();
                if (!newJson || !link) { return; }

                link.updateFromJson(newJson, this.communicationManager);

                console.log(`Trying to trigger mouse down on segment id: ${newSegmentIds}`);
                let targetNode: TargetNode | undefined = undefined;
                for (const newSegmentId of newSegmentIds) {
                    targetNode = link.targetNodes.find(tn => tn.segmentId === newSegmentId);
                    if (targetNode) { break; }
                }
                if (!targetNode) {
                    this.communicationManager.print(`Target node for new segment id ${newSegmentIds} not found.`);
                    return;
                }
                console.log(`Found target node: ${targetNode}`);
                
                this.selectableManager.addCallbackToSelectable(targetNode);
                targetNode.unselect();
                targetNode.triggerOnMouseDown(e.clientX, e.clientY);  
                
            } else { return; }
        }
    };

    private onMouseDownInNode = (canvasElement: CanvasElement, e: MouseEvent): void => {
        this.communicationManager.print(`[link log]: Node clicked`);
        if (e.button === 0 && (e.ctrlKey || e.metaKey)) { // Left click + Ctrl or Meta
            const node = canvasElement as LinkNode;
            let link = this.links.find(l => l.id === node.getLinkId());
            let segments = node.getNeighboringSegmentsToNode(node.getId());
            if (!segments) { return; }

            e.stopPropagation();
                        
            let newSegmentIds = this.communicationManager.createNewChildLinkFromNode(node.getLinkId(), segments?.before.id, segments?.after.id);
            if (newSegmentIds) {
                this.communicationManager.print(`Creating new link visual due to click on segment id: ${newSegmentIds}`);

                let newJson = this.communicationManager.getLocalJson();
                if (!newJson || !link) { return; }

                link.updateFromJson(newJson, this.communicationManager);

                console.log(`Trying to trigger mouse down on segment id: ${newSegmentIds}`);
                let targetNode: TargetNode | undefined = undefined;
                for (const newSegmentId of newSegmentIds) {
                    targetNode = link.targetNodes.find(tn => tn.segmentId === newSegmentId);
                    if (targetNode) { break; }
                }
                if (!targetNode) {
                    this.communicationManager.print(`Target node for new segment id ${newSegmentIds} not found.`);
                    return;
                }
                console.log(`Found target node: ${targetNode}`);
                
                this.selectableManager.addCallbackToSelectable(targetNode);
                targetNode.unselect();
                targetNode.triggerOnMouseDown(e.clientX, e.clientY);  
  
            } else { return; }
        }
    };
}