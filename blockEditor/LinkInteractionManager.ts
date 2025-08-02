import { link } from 'fs';
import { BlockInteractionManager } from './BlockInteractionManager';
import { LinkVisual, LinkNode, LinkSegment, SourceNode, TargetNode } from './LinkVisual';
import { BlockVisual } from './BlockVisual';
import { getNonce } from './util';
import { IdType, JsonData, LinkData } from '../shared/JsonTypes'; 
import { CommunicationManager } from './CommunicationManager';
import { SelectableManager } from './SelectableManager';

export class LinkInteractionManager {
    public links: LinkVisual[] = [];
    public linksSvg: SVGSVGElement;
    

    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private canvas: HTMLElement;
    private communicationManager: CommunicationManager;

    private blockInteractionManager: BlockInteractionManager;
    private selectableManager: SelectableManager;

    constructor (communicationManager: CommunicationManager, canvas: HTMLElement, linksSvg: SVGSVGElement, blockInteractionManager: BlockInteractionManager,
        selectableManager: SelectableManager
    ) {
        this.communicationManager = communicationManager;
        this.selectableManager = selectableManager;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.blockInteractionManager = blockInteractionManager;
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
            link.intermediateNodes.forEach(node => {
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
            if (!seenIds.has(link.targetNode.getId())) {
                seenIds.add(link.targetNode.getId());
                result.push(link.targetNode);
            }
            else {
                this.communicationManager.print(`Duplicate target node found: ${link.targetNode.getId()}`);
            }
        });
        return result;
    }

    public createLinkVisual(linkData: LinkData): LinkVisual {
        this.communicationManager.print(`Creating link visual for link: ${linkData.id}`);
        if (this.links.find(link => link.id === linkData.id)) {
            this.communicationManager.print(`Link visual with id ${linkData.id} already exists, skipping creation.`);
            return this.links.find(link => link.id === linkData.id)!;
        }
        let newLink = new LinkVisual(
            linkData,
            this.deleteLink,
            this.communicationManager
        );

        this.links.push(newLink);
        
        return newLink;
    }

    private onMouseDownOnPort = (block: BlockVisual, e: any, portType: "input" | "output", portIndex: number): void => {
        let isLinkOnNode = false;
        this.communicationManager.print(`[link log] Checking if block already have connection`);

        if (portType === "input") {
            this.communicationManager.getLocalJson()?.links?.forEach(link => {
                if (link.targetId === block.id && link.targetPort === portIndex) {
                    this.communicationManager.print(`Connected link found ${link.id}`);
                    isLinkOnNode = true;
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

            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            let initialPortPositionX = 0;
            let initialPortPositionY = 0;
            
            e.stopPropagation();

            let newLink: LinkVisual | undefined = undefined;

            let newLinkData = this.communicationManager.createNewLinkFromPort(block.id, portType, portIndex);
            if (newLinkData) {
                this.communicationManager.print(`Creating new link visual due to click on port id: ${newLinkData.id}`);
                newLink = this.createLinkVisual(newLinkData);
                newLink.sourceNode.addOnDeleteCallback(() => newLink?.delete(this.communicationManager));
                newLink.targetNode.addOnDeleteCallback(() => newLink?.delete(this.communicationManager));
            } else { return; }

            if (portType === "input") {
                this.selectableManager.addCallbackToSelectable(newLink.sourceNode);
                newLink.sourceNode.unselect();
                newLink.sourceNode.triggerOnMouseDown(e.clientX, e.clientY);
            } else {
                this.selectableManager.addCallbackToSelectable(newLink.targetNode);
                newLink.targetNode.unselect();
                newLink.targetNode.triggerOnMouseDown(e.clientX, e.clientY);
            }
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
            link.intermediateNodes.forEach(node => {
                if (node.isSelected()) {
                    result.push(node);
                }
            });
            if (link.sourceNode.isSelected()) {result.push(link.sourceNode);}
            if (link.targetNode.isSelected()) {result.push(link.targetNode);}
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

    public connectNodesToPorts = () : void => {
        this.communicationManager.getLocalJson()?.links?.forEach(link => {
            const visualLink = this.links.find(l => l.id === link.id);

            const port1 = this.detectPort(link.sourceX, link.sourceY);
            if (port1) {
                visualLink?.sourceNode.unhighlight();
                if (port1.portType === "output") {
                    this.communicationManager.attachLinkToPort(link.id, port1.blockId, port1.portType, port1.portIndex);
                } else { visualLink?.sourceNode.unhighlight(); }
            }

            const port2 = this.detectPort(link.targetX, link.targetY);
            if (port2) {
                visualLink?.sourceNode.unhighlight();
                if (port2.portType === "input") {
                    this.communicationManager.attachLinkToPort(link.id, port2.blockId, port2.portType, port2.portIndex);
                } else { visualLink?.sourceNode.unhighlight(); }
            }
        });
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
                        visualLink?.targetNode.unhighlight();
                    }
                } else { visualLink?.sourceNode.unhighlight(); }
            } else {
                visualLink?.sourceNode.unhighlight();
            }

            const port2 = this.detectPort(link.targetX, link.targetY);
            if (port2) {
                if (port2.portType === "input") {
                    if (link.targetId === "undefined") {
                        visualLink?.targetNode.highlight();
                    } else {
                        visualLink?.targetNode.unhighlight();
                    }
                } else { visualLink?.targetNode.unhighlight(); }
            } else {
                visualLink?.targetNode.unhighlight();
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
}