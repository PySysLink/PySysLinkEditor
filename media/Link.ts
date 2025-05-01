import { Block } from './Block';

export class Link {
    sourceId: string;
    sourcePort: number;
    targetId: string;
    targetPort: number;
    intermediateNodes: { x: number; y: number }[];
    private polylineElement: SVGPolylineElement;

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
        this.polylineElement.setAttribute("stroke", "#007acc");
        this.polylineElement.setAttribute("stroke-width", "2");
        this.polylineElement.setAttribute("fill", "none");
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
                ...this.intermediateNodes.map(node => `${node.x},${node.y}`),
                `${targetPos.x},${targetPos.y}`
            ].join(" ");

            this.polylineElement.setAttribute("points", points);
        }
    }

    addToSvg(svg: SVGSVGElement): void {
        svg.appendChild(this.polylineElement);
    }

    removeFromSvg(svg: SVGSVGElement): void {
        svg.removeChild(this.polylineElement);
    }
}
