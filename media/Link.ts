import { Block } from './Block';

export class Link {
    sourceId: string;
    sourcePort: number;
    targetId: string;
    targetPort: number;
    intermediateNodes: { x: number; y: number }[];
    private polylineElement: SVGPolylineElement;
    private nodeElementsMap: Map<number, SVGCircleElement> = new Map(); // Map to track node elements
    private _isSelected: boolean = false;

    private onMouseDown: (link: Link, e: MouseEvent) => void;

    constructor(
        sourceId: string,
        sourcePort: number,
        targetId: string,
        targetPort: number,
        intermediateNodes: { x: number; y: number }[] = [],
        onMouseDown: (link: Link, e: MouseEvent) => void
    ) {
        this.sourceId = sourceId;
        this.sourcePort = sourcePort;
        this.targetId = targetId;
        this.targetPort = targetPort;
        this.intermediateNodes = intermediateNodes;
        this.onMouseDown = onMouseDown;

        // Create the SVG polyline element
        this.polylineElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.polylineElement.classList.add('link-line');
        this.polylineElement.setAttribute("stroke", "#007acc");
        this.polylineElement.setAttribute("stroke-width", "2");
        this.polylineElement.setAttribute("fill", "none");
        this.polylineElement.addEventListener('mousedown', (e: MouseEvent) => onMouseDown(this, e));

    }

    public getId(): string {
        return this.sourceId + this.sourcePort + this.targetId + this.targetPort;
    }

    updatePosition(blocks: Block[]): void {
        const sourceBlock = blocks.find(block => block.id === this.sourceId);
        const targetBlock = blocks.find(block => block.id === this.targetId);

        if (sourceBlock && targetBlock) {
            const sourcePos = sourceBlock.getPortPosition(this.sourcePort, "output");
            const targetPos = targetBlock.getPortPosition(this.targetPort, "input");

            // Combine source, intermediate nodes, and target into a single points string
            const points = [
                `${sourcePos.x},${sourcePos.y}`,
                ...this.intermediateNodes
                    .filter(node => node && typeof node.x === 'number' && typeof node.y === 'number') // Ensure valid nodes
                    .map(node => `${node.x},${node.y}`),
                `${targetPos.x},${targetPos.y}`
            ].join(" ");
    
            this.polylineElement.setAttribute("points", points);
    
            // Update intermediate node positions
            this.intermediateNodes.forEach((intermediateNode, index) => {
                const element = this.nodeElementsMap.get(index);
                if (intermediateNode && element) {
                    element.setAttribute('cx', `${intermediateNode.x}`);
                    element.setAttribute('cy', `${intermediateNode.y}`);
                }
            });
        }
    }

    addToSvg(svg: SVGSVGElement): void {
        svg.appendChild(this.polylineElement);            

        // Add intermediate node elements
        this.intermediateNodes.forEach((node, index) => {
            var nodeElement = this.nodeElementsMap.get(index);
            if (!nodeElement) {
                nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                nodeElement.classList.add('link-node');
                this.nodeElementsMap.set(index, nodeElement);
            }
            nodeElement.setAttribute("cx", `${node.x}`);
            nodeElement.setAttribute("cy", `${node.y}`);
            svg.appendChild(nodeElement);
            this.nodeElementsMap.set(index, nodeElement);
        });
    }

    removeFromSvg(svg: SVGSVGElement): void {
        svg.removeChild(this.polylineElement);
        this.intermediateNodes.forEach((intermediateNode, index) => {
            const element = this.nodeElementsMap.get(index);
            if (element) {
                svg.removeChild(element);
            }
        });
    }


    public select() {
        this._isSelected = true;
        this.polylineElement.classList.add('selected');
    }

    public unselect(): void {
        this._isSelected = false;
        this.polylineElement.classList.remove('selected');
    }

    public isSelected(): boolean {
        return this._isSelected;
    }

    public toggleSelect(): void {
        this._isSelected = !this._isSelected;
        if (this._isSelected) {
            this.select();
        } else {
            this.unselect();
        }
    }

    public getBoundingBox(): {top: number, bottom: number, right: number, left: number} {
        const points = [
            ...this.intermediateNodes,
            { x: this.polylineElement.getBBox().x, y: this.polylineElement.getBBox().y }
        ];
    
        // Calculate the bounding box
        const left = Math.min(...points.map(point => point.x));
        const right = Math.max(...points.map(point => point.x));
        const top = Math.min(...points.map(point => point.y));
        const bottom = Math.max(...points.map(point => point.y));
    
        return { top, bottom, right, left };
    }

    public getState(): { type: string; sourceId: string; sourcePort: number; targetId: string; targetPort: number; nodeIndex: number, x: number, y: number }[] {
        var result: { type: string; sourceId: string; sourcePort: number; targetId: string; targetPort: number; nodeIndex: number; x: number; y: number; }[] = [];
        this.intermediateNodes.forEach((element, index) => {
            result.push({
                type: 'moveLinkNode',
                sourceId: this.sourceId,
                sourcePort: this.sourcePort,
                targetId: this.targetId,
                targetPort: this.targetPort,
                nodeIndex: index,
                x: element.x,
                y: element.y
            });
        });
        return result;
    }

    public moveAllNodes(deltaX: number, deltaY: number): void {
        this.intermediateNodes.forEach(node => {
            node.x += deltaX;
            node.y += deltaY;
        });
    }
}
