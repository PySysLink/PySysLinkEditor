import { BlockInteractionManager } from './BlockInteractionManager';
import { Link } from './Link';

export class LinkInteractionManager {
    public links: Link[] = [];
    public linksSvg: SVGSVGElement;

    private canvas: HTMLElement;
    private vscode: any;

    private dragStartX: number;
    private dragStartY: number;
    private isDragging: boolean = false;
    private dragThreshold: number = 5;

    private getZoomLevelReal: () => number;

    constructor (vscode: any, canvas: HTMLElement, linksSvg: SVGSVGElement, getZoomLevelReal: () => number) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
        this.getZoomLevelReal = getZoomLevelReal;
    }

    public createLink(sourceId: string, sourcePort: number, targetId: string, targetPort: number, intermediateNodes: { x: number; y: number }[], blockInteractionManager: BlockInteractionManager): void {
        const link = new Link(sourceId, sourcePort, targetId, targetPort, intermediateNodes);
        this.links.push(link);
        this.vscode.postMessage({ type: 'addLink', sourceId: link.sourceId, sourcePort: link.sourcePort, targetId: link.targetId, targetPort: link.targetPort, intermediateNodes: link.intermediateNodes });
        link.addToSvg(this.linksSvg);
        this.updateLinks(blockInteractionManager);
    }
    
    public updateLinks = (blockInteractionManager: BlockInteractionManager): void => {
        this.linksSvg = document.querySelector('.links') as SVGSVGElement;
        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
        }
        
        this.linksSvg.style.width = `${this.canvas.offsetWidth}px`;
        this.linksSvg.style.height = `${this.canvas.offsetHeight}px`;
        this.linksSvg.style.transform = this.canvas.style.transform; // Match the canvas transform (e.g., scale)


        this.links.forEach(link => link.addToSvg(this.linksSvg));
        this.links.forEach(link => link.updatePosition(blockInteractionManager.blocks));
        this.canvas.appendChild(this.linksSvg);
    };

    public unselectAll(): void {
        this.links.forEach(link => {
            link.unselect();
        });
    }

    public getSelectedLinks(): Link[] {
        return this.links.filter(link => link.isSelected());
    }

    public deleteLink(link: Link): void {
        link.removeFromSvg(this.linksSvg);
        const index = this.links.indexOf(link);
        if (index !== -1) {
            this.links.splice(index, 1);
        }
    }

    public renderLinks(
            linksData: { sourceId: string; sourcePort: number; targetId: string; targetPort: number; intermediateNodes: { x: number; y: number }[] }[], 
            blockInteractionManager: BlockInteractionManager): SVGSVGElement {
        
        this.vscode.postMessage({ type: 'print', text: `Render links` });

        if (!this.linksSvg) {
            this.linksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            this.linksSvg.classList.add('links');
            this.linksSvg.style.position = 'absolute';
            this.linksSvg.style.top = '0';
            this.linksSvg.style.left = '0';
            this.linksSvg.style.width = '100%';
            this.linksSvg.style.height = '100%';
            this.linksSvg.style.pointerEvents = 'all';
        }

        // Clear existing links
        this.links.forEach(link => link.removeFromSvg(this.linksSvg));
        this.links.length = 0;
    
        // Create and render new links
        linksData.forEach(linkData => {
            const link = new Link(
                linkData.sourceId,
                linkData.sourcePort,
                linkData.targetId,
                linkData.targetPort,
                linkData.intermediateNodes
            );
            this.links.push(link);
            link.addToSvg(this.linksSvg);
            link.updatePosition(blockInteractionManager.blocks);
        });

        return this.linksSvg;
    }


    public onMouseDown = (link: Link, e: MouseEvent): void => {
            this.vscode.postMessage({ type: 'print', text: 'Link mouse down'});
            if (e.button !== 1) {
                this.vscode.postMessage({ type: 'print', text: `Mouse down on link: ${link.sourceId}` });
                if (!link.isSelected()) {
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        link.toggleSelect();
                    } else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        link.select();
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
                        document.removeEventListener('mousemove', onMouseMoveThreshold);
            
                        // Start dragging selected blocks
                        if (!link.isSelected()) {
                            // If the block is not already selected, add it to the selection
                            link.select();
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
                        this.vscode.postMessage({ type: 'print', text: `As simple click on link: ${link.sourceId}` });
    
                        // If no drag occurred, treat it as a simple click
                        if (e.shiftKey) {
                            // Toggle selection if Shift is pressed
                            link.toggleSelect();
                        } else {
                            // Clear selection and select only this block
                            this.unselectAll();
                            link.select();
                        }
                    }
                };
            
                document.addEventListener('mouseup', onMouseUpThreshold);
            }
        };
    
        public onMouseUp = (): void => {
            this.vscode.postMessage({ type: 'print', text: `Mouse up` });
    
            if (this.isDragging) {
                this.isDragging = false;
                const stateMessages = this.getSelectedLinks().flatMap(block => block.getState());
    
                stateMessages.forEach(message => {
                    this.vscode.postMessage({ type: 'print', text: message});
                }); 
    
                
                this.vscode.postMessage({ type: 'moveBatch', updates: stateMessages });
    
            }
    
            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);
        };
    
        public onMouseMove = (e: MouseEvent): void => {
            const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
            const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
            
            if (this.isDragging) {
                this.getSelectedLinks().forEach(link => {
                    link.move(scaledDeltaX, scaledDeltaY);
                });
    
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
    
    
            }    
        };
}