import { BlockInteractionManager } from './BlockInteractionManager';
import { Link } from './Link';

export class LinkInteractionManager {
    public links: Link[] = [];
    public linksSvg: SVGSVGElement;

    private canvas: HTMLElement;
    private vscode: any;

    constructor (vscode: any, canvas: HTMLElement, linksSvg: SVGSVGElement) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.linksSvg = linksSvg;
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
}