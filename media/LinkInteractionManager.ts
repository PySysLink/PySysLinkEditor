import { link } from 'fs';
import { BlockInteractionManager } from './BlockInteractionManager';
import { Link, LinkNode, LinkSegment, SourceNode, TargetNode } from './Link';

export class LinkInteractionManager {
    public links: Link[] = [];
    public linksSvg: SVGSVGElement;

    private canvas: HTMLElement;
    private vscode: any;

    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private isDragging: boolean = false;
    private dragThreshold: number = 5;

    private getZoomLevelReal: () => number;

    private blockInteractionManager: BlockInteractionManager;

    constructor (vscode: any, canvas: HTMLElement, linksSvg: SVGSVGElement, getZoomLevelReal: () => number, blockInteractionManager: BlockInteractionManager) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.getZoomLevelReal = getZoomLevelReal;
        this.blockInteractionManager = blockInteractionManager;
    }

    public createLink(sourceNode: SourceNode, targetNode: TargetNode, intermediateNodes: LinkNode[] = []): void {
        let intermediateNodesData: {x: number, y: number}[] = [];
        intermediateNodes.forEach(node => intermediateNodesData.push({x: node.x, y: node.y}));
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

    public unselectAll(): void {
        this.links.forEach(link => link.unselect());
    }

    public getSelectedLinkSegments(): LinkSegment[] {
        var result: LinkSegment[] = [];
        this.links.forEach(link => {
            link.segments.forEach(segment => {
                if (segment.isSelected) {
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
                if (node.isSelected) {
                    result.push(node);
                }
            });
        });
        return result;
    }


    public getSelectedLinks(): Link[] {
        var result: Link[] = [];
        this.links.forEach(link => {
            for (let segment of link.segments) {
                if (segment.isSelected) {
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
            linksData: { id: string, sourceId: string; sourcePort: number; targetId: string; targetPort: number; intermediateNodes: { id: string; x: number; y: number }[] }[]): SVGSVGElement {
        
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
                    node.x = linkData.intermediateNodes[index].x;
                    node.y = linkData.intermediateNodes[index].y;
                });
            } else {
                this.vscode.postMessage({ type: 'print', text: `Link ID does not exist, creating link: ${linkData.id}` });
                let sourceBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.sourceId);
                if (!sourceBlock) {
                    throw RangeError(`Source block of id: ${linkData.sourceId} not found`);
                }
                let targetBlock = this.blockInteractionManager.blocks.find(block => block.id === linkData.targetId);
                if (!targetBlock) {
                    throw RangeError(`Target block of id: ${linkData.targetId} not found`);
                }
                let sourceNode = new SourceNode(sourceBlock, linkData.sourcePort);
                let targetNode = new TargetNode(targetBlock, linkData.targetPort);

                let intermediateNodes: LinkNode[] = [];
                linkData.intermediateNodes.forEach(intermediateData => {
                    intermediateNodes.push(new LinkNode(intermediateData.id, intermediateData.x, intermediateData.y));
                });

                currentLink = new Link(
                    linkData.id,
                    sourceNode,
                    targetNode,
                    intermediateNodes,
                    this.onMouseDownSegment,
                    this.onMouseDownNode
                );
            }
            this.links.push(currentLink);
            currentLink.addToSvg(this.linksSvg);
            currentLink.updatePosition();
            
        });

        return this.linksSvg;
    }


    public onMouseDownSegment = (linkSegment: LinkSegment, e: MouseEvent): void => {
        this.vscode.postMessage({ type: 'print', text: 'Link mouse down'});
        if (e.button !== 1) {
            this.vscode.postMessage({ type: 'print', text: `Mouse down on link segment: ${linkSegment.sourceLinkNode.x}` });
            if (!linkSegment.isSelected) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    linkSegment.toggleSelect();
                } else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    linkSegment.select();
                }
            }

            // Store the initial mouse position
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.isDragging = false; // Reset dragging state
        
            // Add a temporary mousemove listener to detect drag threshold
            const onMouseMoveThreshold = (moveEvent: MouseEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - this.dragStartX);
                const deltaY = Math.abs(moveEvent.clientY - this.dragStartY);
        
                if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
                    // Exceeded drag threshold, start dragging
                    this.isDragging = true;
                    this.vscode.postMessage({ type: 'print', text: `Mouse drag start: ${linkSegment.sourceLinkNode.x}` });
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
                    document.removeEventListener('mouseup', onMouseUpThreshold);

                    // Start dragging selected blocks
                    if (!linkSegment.isSelected) {
                        // If the block is not already selected, add it to the selection
                        linkSegment.select();
                    }
                    document.addEventListener('mousemove', this.onMouseMove);
                    document.addEventListener('mouseup', this.onMouseUp);
                }
            };
        
            document.addEventListener('mousemove', onMouseMoveThreshold);
        
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
        
                if (!this.isDragging) {
                    this.vscode.postMessage({ type: 'print', text: `As simple click on link segment: ${linkSegment.sourceLinkNode.x}` });

                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        linkSegment.toggleSelect();
                    } else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        linkSegment.select();
                    }
                }
            };
        
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    
    public onMouseDownNode = (linkNode: LinkNode, e: MouseEvent): void => {
        this.vscode.postMessage({ type: 'print', text: 'Link mouse down'});
        if (e.button !== 1) {
            this.vscode.postMessage({ type: 'print', text: `Mouse down on link segment: ${linkNode.id}` });
            if (!linkNode.isSelected) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    linkNode.toggleSelect();
                } else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    linkNode.select();
                }
            }

            // Store the initial mouse position
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.isDragging = false; // Reset dragging state
        
            // Add a temporary mousemove listener to detect drag threshold
            const onMouseMoveThreshold = (moveEvent: MouseEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - this.dragStartX);
                const deltaY = Math.abs(moveEvent.clientY - this.dragStartY);
        
                if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
                    // Exceeded drag threshold, start dragging
                    this.isDragging = true;
                    this.vscode.postMessage({ type: 'print', text: `Mouse drag start: ${linkNode.id}` });
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
                    document.removeEventListener('mouseup', onMouseUpThreshold);

                    // Start dragging selected blocks
                    if (!linkNode.isSelected) {
                        // If the block is not already selected, add it to the selection
                        linkNode.select();
                    }
                    document.addEventListener('mousemove', this.onMouseMove);
                    document.addEventListener('mouseup', this.onMouseUp);
                }
            };
        
            document.addEventListener('mousemove', onMouseMoveThreshold);
        
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
        
                if (!this.isDragging) {
                    this.vscode.postMessage({ type: 'print', text: `As simple click on link segment: ${linkNode.id}` });

                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        linkNode.toggleSelect();
                    } else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        linkNode.select();
                    }
                }
            };
        
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };
    
    public onMouseUp = (): void => {
        this.vscode.postMessage({ type: 'print', text: `Mouse up links` });

        if (this.isDragging) {
            this.isDragging = false;
            const stateMessages = this.links.flatMap(link => link.getState());

            stateMessages.forEach(message => {
                this.vscode.postMessage({ type: 'print', text: message});
            }); 

            
            this.vscode.postMessage({ type: 'moveLinkBatch', updates: stateMessages });

        }

        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    };
    
    public onMouseMove = (e: MouseEvent): void => {
        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        
        this.vscode.postMessage({ type: 'print', text: `Move links x: ${scaledDeltaX} y: ${scaledDeltaY}`});
        if (this.isDragging) {
            let nodesToMove = new Set<LinkNode>();

            this.getSelectedLinkSegments().forEach(linkSegment => {
                nodesToMove.add(linkSegment.sourceLinkNode);
                nodesToMove.add(linkSegment.targetLinkNode);
            });

            this.getSelectedLinkNodes().forEach(node => nodesToMove.add(node));

            nodesToMove.forEach(node => {
                node.moveTo(node.x + scaledDeltaX, node.y + scaledDeltaY);
            });

            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }  
        this.updateLinks();  
    };        
}