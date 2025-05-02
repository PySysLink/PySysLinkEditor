import { Block } from './Block';

export class Link {
    sourceId: string;
    sourcePort: number;
    targetId: string;
    targetPort: number;
    intermediateNodes: { x: number; y: number }[];
    private polylineElement: SVGPolylineElement;
    private nodeElements: SVGCircleElement[] = [];
    private _isSelected: boolean = false;

    constructor(
        sourceId: string,
        sourcePort: number,
        targetId: string,
        targetPort: number,
        intermediateNodes: { x: number; y: number }[] = []
    ) {
        this.sourceId = sourceId;
        this.sourcePort = sourcePort;
        this.targetId = targetId;
        this.targetPort = targetPort;
        this.intermediateNodes = intermediateNodes;

        // Create the SVG polyline element
        this.polylineElement = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.polylineElement.classList.add('link-line');
        this.polylineElement.setAttribute("stroke", "#007acc");
        this.polylineElement.setAttribute("stroke-width", "2");
        this.polylineElement.setAttribute("fill", "none");

        // Add event listeners for interaction
        this.polylineElement.addEventListener('click', this.onClick);
        this.polylineElement.addEventListener('dblclick', this.onDoubleClick);
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
            this.nodeElements.forEach((nodeElement, index) => {
                const node = this.intermediateNodes[index];
                if (node) {
                    nodeElement.setAttribute('cx', `${node.x}`);
                    nodeElement.setAttribute('cy', `${node.y}`);
                }
            });
        }
    }

    addToSvg(svg: SVGSVGElement): void {
        svg.appendChild(this.polylineElement);

        // this.nodeElements.forEach(nodeElement => svg.removeChild(nodeElement));
        // this.nodeElements = [];

        // Add intermediate node elements
        this.intermediateNodes.forEach(node => {
            const nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            nodeElement.classList.add('link-node');
            nodeElement.setAttribute("cx", `${node.x}`);
            nodeElement.setAttribute("cy", `${node.y}`);
            nodeElement.addEventListener('mousedown', this.onNodeMouseDown(node));
            svg.appendChild(nodeElement);
            this.nodeElements.push(nodeElement);
        });
    }

    removeFromSvg(svg: SVGSVGElement): void {
        svg.removeChild(this.polylineElement);
    }

    private onClick = (e: MouseEvent): void => {
        this.toggleSelect();
    };

    private onDoubleClick = (e: MouseEvent): void => {
        const rect = this.polylineElement.getBoundingClientRect();
        const newNode = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.intermediateNodes.push(newNode);
        this.updatePosition([]);
    };

    private onNodeMouseDown = (node: { x: number; y: number }) => (e: MouseEvent): void => {
        const onMouseMove = (moveEvent: MouseEvent) => {
            node.x = moveEvent.clientX;
            node.y = moveEvent.clientY;
            this.updatePosition([]);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

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
}
