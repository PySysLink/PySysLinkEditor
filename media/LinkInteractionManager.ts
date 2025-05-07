import { link } from 'fs';
import { BlockInteractionManager } from './BlockInteractionManager';
import { Link, LinkNode, LinkSegment, SourceNode, TargetNode } from './Link';
import { Block } from './Block';

export class LinkInteractionManager {
    public links: Link[] = [];
    public linksSvg: SVGSVGElement;

    private canvas: HTMLElement;
    private vscode: any;

    private blockInteractionManager: BlockInteractionManager;

    constructor (vscode: any, canvas: HTMLElement, linksSvg: SVGSVGElement, blockInteractionManager: BlockInteractionManager) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.blockInteractionManager = blockInteractionManager;
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

    public createLink(sourceNode: SourceNode, targetNode: TargetNode, intermediateNodes: LinkNode[] = []): void {
        let intermediateNodesData: {x: number, y: number}[] = [];
        intermediateNodes.forEach(node => intermediateNodesData.push({x: node.getPosition().x, y: node.getPosition().y}));
        this.vscode.postMessage({ type: 'addLink', 
                                    sourceId: sourceNode.connectedPort?.block.id, 
                                    sourcePort: sourceNode.connectedPort?.index, 
                                    targetId: targetNode.connectedPort?.block.id, 
                                    targetPort: targetNode.connectedPort?.index, 
                                    intermediateNodes: intermediateNodesData});
    }
    
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

    public deleteLink(link: Link): void {
        link.removeFromSvg(this.linksSvg);
        const index = this.links.indexOf(link);
        if (index !== -1) {
            this.links.splice(index, 1);
        }
    }

    public renderLinks(
            linksData: { id: string, sourceId: string; sourcePort: number; targetId: string; targetPort: number; 
                sourceX: number; sourceY: number; targetX: number; targetY: number; intermediateNodes: { id: string; x: number; y: number }[] }[]): SVGSVGElement {
        
        this.vscode.postMessage({ type: 'print', text: `Render links` });

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
                this.vscode.postMessage({ type: 'print', text: `Link ID does not exist, creating link: ${linkData.id}` });
                let sourceNode;
                let targetNode;
                if (linkData.sourceId !== 'undefined') {
                    let sourceBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.sourceId);
                    if (!sourceBlock) {
                        throw RangeError(`Source block of id: ${linkData.sourceId} not found`);
                    }
                    sourceNode = new SourceNode(sourceBlock, linkData.sourcePort);
                } else {
                    sourceNode = new SourceNode(linkData.sourceX, linkData.sourceY);
                }

                if (linkData.targetId !== 'undefined') {
                    let targetBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.targetId);
                    if (!targetBlock) {
                        throw RangeError(`Target block of id: ${linkData.targetId} not found`);
                    }
                    targetNode = new TargetNode(targetBlock, linkData.targetPort);
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
                    intermediateNodes
                );

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
    }

    
    private detectPort(node: LinkNode): { block: Block; portIndex: number; portType: "input" | "output" } | null {
        for (const block of this.blockInteractionManager.blocks) {
            for (let i = 0; i < block.inputPorts; i++) {
                const portPosition = block.getPortPosition(i, "input");
                if (Math.abs(node.getPosition().x - portPosition.x) < 10 && Math.abs(node.getPosition().y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "input" };
                }
            }
            for (let i = 0; i < block.outputPorts; i++) {
                const portPosition = block.getPortPosition(i, "output");
                if (Math.abs(node.getPosition().x - portPosition.x) < 10 && Math.abs(node.getPosition().y - portPosition.y) < 10) {
                    return { block, portIndex: i, portType: "output" };
                }
            }
        }
        return null;
    }
}