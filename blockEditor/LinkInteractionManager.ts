import { link } from 'fs';
import { BlockInteractionManager } from './BlockInteractionManager';
import { Link, LinkNode, LinkSegment, SourceNode, TargetNode } from './Link';
import { Block } from './Block';
import { getNonce } from './util';
import { LinkData } from '../shared/JsonTypes'; 
import { CommunicationManager } from './CommunicationManager';

export class LinkInteractionManager {
    public links: Link[] = [];
    public linksSvg: SVGSVGElement;
    

    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 50; // Minimum distance to detect a drag
    private isDragging = false;

    private canvas: HTMLElement;
    private communicationManager: CommunicationManager;

    private blockInteractionManager: BlockInteractionManager;

    constructor (communicationManager: CommunicationManager, canvas: HTMLElement, linksSvg: SVGSVGElement, blockInteractionManager: BlockInteractionManager) {
        this.communicationManager = communicationManager;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.blockInteractionManager = blockInteractionManager;
        this.blockInteractionManager.registerOnMouseDownOnPortCallback(this.onMouseDownOnPort);
        this.blockInteractionManager.registerOnDeleteCallback(this.onBlockDeleted);
    }

    public getAllLinkSegments(): LinkSegment[] {
        let result: LinkSegment[] = [];
        this.links.forEach(link => {
            link.segments.forEach(segment => {
                result.push(segment);
            });
        });
        return result;
    }
    public getAllLinkNodes(): LinkNode[] {
        let result: LinkNode[] = [];
        this.links.forEach(link => {
            link.intermediateNodes.forEach(node => {
                result.push(node);
            });
            result.push(link.sourceNode);
            result.push(link.targetNode);
        });
        return result;
    }

    public createLink(sourceNode: SourceNode, targetNode: TargetNode, intermediateNodes: LinkNode[] = []): Link {
        let intermediateNodesData: {id: string, x: number, y: number}[] = [];
        intermediateNodes.forEach(node => intermediateNodesData.push({id: node.id, x: node.getPosition().x, y: node.getPosition().y}));

        let newLink = new Link(
            getNonce(),
            sourceNode,
            targetNode,
            intermediateNodes,
            this.deleteLink,
            this.communicationManager.updateLink
        );

        this.links.push(newLink);

        this.communicationManager.addLink({id: newLink.id,
            sourceId: sourceNode.connectedPort?.block.id, 
            sourcePort: sourceNode.connectedPort ? sourceNode.connectedPort.index : -1, 
            targetId: targetNode.connectedPort?.block.id, 
            targetPort: targetNode.connectedPort ? targetNode.connectedPort.index : -1, 
            sourceX: sourceNode.getPosition().x,
            sourceY: sourceNode.getPosition().y,
            targetX: targetNode.getPosition().x,
            targetY: targetNode.getPosition().y,
            intermediateNodes: intermediateNodesData});
        
        return newLink;
    }

    private onMouseDownOnPort = (block: Block, e: any, portType: "input" | "output", portIndex: number): void => {
        let isLinkOnNode = false;
        this.communicationManager.print(`Checking if block already have connection`);

        if (portType === "input") {
            this.links.forEach(link => {
                if (link.targetNode.connectedPort?.block.id === block.id && link.targetNode.connectedPort?.index === portIndex) {
                    this.communicationManager.print(`Connected link found ${link.id}`);
                    isLinkOnNode = true;
                }
            });
        } else {
            this.links.forEach(link => {
                if (link.sourceNode.connectedPort?.block.id === block.id && link.sourceNode.connectedPort?.index === portIndex) {
                    this.communicationManager.print(`Connected link found ${link.id}`);
                    isLinkOnNode = true;
                }
            });
        }
        
        if (!isLinkOnNode) {
            this.communicationManager.print(`Mouse down on non connected port, creating link`);
            let newLink: Link;
            if (portType === "output") {
                newLink = this.createLink(new SourceNode(block, portIndex), 
                                new TargetNode(block.getPortPosition(portIndex, portType).x, block.getPortPosition(portIndex, portType).y));
                newLink.sourceNode.addOnDeleteCallback(() => newLink?.delete());
                newLink.targetNode.addOnDeleteCallback(() => newLink?.delete());
                e.stopPropagation();
            } else if (portType === "input") {
                newLink = this.createLink(new SourceNode(block.getPortPosition(portIndex, portType).x, block.getPortPosition(portIndex, portType).y),
                                new TargetNode(block, portIndex));
                newLink.sourceNode.addOnDeleteCallback(() => newLink?.delete());
                newLink.targetNode.addOnDeleteCallback(() => newLink?.delete());
                e.stopPropagation();
            }

            // Add a temporary mousemove listener to detect drag threshold
            const onMouseMoveThreshold = (moveEvent: MouseEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - this.dragStartX);
                const deltaY = Math.abs(moveEvent.clientY - this.dragStartY);
        
                if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
                    // Exceeded drag threshold, start dragging
                    this.isDragging = true;
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
                    this.communicationManager.print(`Threshold rebased, trigger on mouse down`);

                    if (portType === "input") {
                        newLink.sourceNode.unselect();
                        newLink.sourceNode.triggerOnMouseDown(e.clientX, e.clientY);
                    } else {
                        newLink.targetNode.unselect();
                        newLink.targetNode.triggerOnMouseDown(e.clientX, e.clientY);

                    }
                }   
            };
        
            document.addEventListener('mousemove', onMouseMoveThreshold);
        
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
        
                if (!this.isDragging) {
                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        block.toggleSelect();
                    } else {
                        // Clear selection and select only this block
                        block.select();
                    }
                }
            };
        
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    
    public updateLinks = (): void => {
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


        this.links.forEach(link => link.addToSvg(this.linksSvg));
        this.links.forEach(link => link.updatePosition());
        this.canvas.appendChild(this.linksSvg);
    };


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


    public getSelectedLinks(): Link[] {
        var result: Link[] = [];
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

    public deleteLink = (link: Link, sendMessage: boolean = true): void => {
        link.removeFromSvg(this.linksSvg);
        const index = this.links.indexOf(link);
        if (index !== -1) {
            this.links.splice(index, 1);
        }
        if (sendMessage) {
            this.communicationManager.deleteLink(link.id);
        }
    };

    public renderLinks(linksData: LinkData[]): SVGSVGElement {
        
        this.communicationManager.print(`Render links: ${JSON.stringify(linksData, null, 2)}`);

        this.linksSvg = document.querySelector('.links') as SVGSVGElement;
        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
        }

        while (this.linksSvg.firstChild) {
            this.linksSvg.removeChild(this.linksSvg.firstChild);
        }

    
        // Create and render new links
        linksData.forEach(linkData => {
            let currentLink = this.links.find(link => link.id === linkData.id);
            if (currentLink) {
                currentLink.intermediateNodes.forEach((node, index) => {
                    node.moveTo(linkData.intermediateNodes[index].x, linkData.intermediateNodes[index].y);
                });
            } else {
                this.communicationManager.print(`Link ID does not exist, creating link: ${linkData.id}`);
                let sourceNode;
                let targetNode;
                if (linkData.sourceId !== 'undefined') {
                    let sourceBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.sourceId);
                    if (!sourceBlock) {
                        this.communicationManager.print(`Target block of id: ${linkData.targetId} not found`);
                        sourceNode = new SourceNode(linkData.sourceX, linkData.sourceY);
                    } else {
                        sourceNode = new SourceNode(sourceBlock, linkData.sourcePort);
                    }
                } else {
                    sourceNode = new SourceNode(linkData.sourceX, linkData.sourceY);
                }

                if (linkData.targetId !== 'undefined') {
                    let targetBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.targetId);
                    if (!targetBlock) {
                        this.communicationManager.print(`Target block of id: ${linkData.targetId} not found`);
                        targetNode = new TargetNode(linkData.targetX, linkData.targetY);
                    } else {
                        targetNode = new TargetNode(targetBlock, linkData.targetPort);
                    }
                } else {
                    targetNode = new TargetNode(linkData.targetX, linkData.targetY);
                }

                let intermediateNodes: LinkNode[] = [];
                linkData.intermediateNodes.forEach(intermediateData => {
                    intermediateNodes.push(new LinkNode(intermediateData.id, intermediateData.x, intermediateData.y));
                });

                currentLink = new Link(
                    linkData.id,
                    sourceNode,
                    targetNode,
                    intermediateNodes,
                    this.deleteLink,
                    this.communicationManager.updateLink
                );
                if (currentLink) {
                    sourceNode.addOnDeleteCallback(() => currentLink?.delete());
                    targetNode.addOnDeleteCallback(() => currentLink?.delete());
                }

                this.links.push(currentLink);
            }
            currentLink.addToSvg(this.linksSvg);
            currentLink.updatePosition();
        });

        return this.linksSvg;
    }

    public connectNodesToPorts = () : void => {
        this.getAllLinkNodes().forEach(node => {
            const port = this.detectPort(node);
            if (port) {
                node.unhighlight();
                if (port.portType === "input" && node instanceof TargetNode) {
                    node.attachToPort(port.block, port.portIndex);
                } else if (port.portType === "output" && node instanceof SourceNode) {
                    node.attachToPort(port.block, port.portIndex);
                }
            } else {
                node.unhighlight();
            }
        });
    };

    public highlightNodesNearPorts = (e: MouseEvent) : void => {
        this.getAllLinkNodes().forEach(node => {
            // Detect if the node is over a port
            const port = this.detectPort(node);
            
            if (port) {
                if (port.portType === "input" && node instanceof TargetNode) {
                    if (!node.connectedPort) {
                        node.highlight();
                    }
                } else if (port.portType === "output" && node instanceof SourceNode) {
                    if (!node.connectedPort) {
                        node.highlight();
                    }
                } else {
                    node.unhighlight();
                }
            } else {
                node.unhighlight();
            }
        });
    };

    
    private detectPort(node: LinkNode): { block: Block; portIndex: number; portType: "input" | "output" } | null {
        for (const block of this.blockInteractionManager.blocks) {
            for (let i = 0; i < block.inputPortNumber; i++) {
                const portPosition = block.getPortPosition(i, "input");
                if (Math.abs(node.getPosition().x - portPosition.x) < 10 && Math.abs(node.getPosition().y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "input" };
                }
            }
            for (let i = 0; i < block.outputPortNumber; i++) {
                const portPosition = block.getPortPosition(i, "output");
                if (Math.abs(node.getPosition().x - portPosition.x) < 10 && Math.abs(node.getPosition().y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "output" };
                }
            }
        }
        return null;
    }

    public onBlockDeleted = (block: Block): void => {
        this.links.forEach(link => {
            if (link.sourceNode.connectedPort?.block.id === block.id) {
                link.sourceNode.connectedPort = undefined;
            }
            if (link.targetNode.connectedPort?.block.id === block.id) {
                link.targetNode.connectedPort = undefined;
            }
        });
    };
}