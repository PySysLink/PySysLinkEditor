import { Block } from './Block';

export class BlockInteractionManager {
    public blocks: Block[] = [];
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private vscode: any;

    private onMouseDownOnPortCallbacks: ((block: Block, e: any, portType: "input" | "output", portIndex: number) => void)[] = [];

    constructor(vscode: any) {
        this.vscode = vscode;
    }

    public createBlock(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number): void {
        const block = new Block(id, label, x, y, inputPorts, outputPorts, this.deleteBlock);
        block.registerOnMouseDownOnPortCallback((e: any, portType: "input" | "output", portIndex: number) => {
            this.onMouseDownOnPort(block, e, portType, portIndex);
        });
        this.blocks.push(block);
    }

    private onMouseDownOnPort(block: Block, e: any, portType: "input" | "output", portIndex: number): void {
        this.vscode.postMessage({ type: 'print', text: `Mouse down on ${portType} port ${portIndex} of block ${block.id}` });
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(block, e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (block: Block, e: any, portType: "input" | "output", portIndex: number) => void): void {
        this.onMouseDownOnPortCallbacks.push(callback);
    }
    
    
    public getSelectedBlocks(): Block[] {
        return this.blocks.filter(block => block.isSelected());
    }

    public deleteBlock(block: Block) {
        this.vscode.postMessage({ type: 'deleteBlock', id: block.id});
    }
}
