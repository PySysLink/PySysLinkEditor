import { Block } from './Block';

export class BlockInteractionManager {
    public blocks: Block[] = [];
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private vscode: any;

    constructor(vscode: any) {
        this.vscode = vscode;
    }

    public createBlock(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number): void {
        const block = new Block(id, label, x, y, inputPorts, outputPorts);
        this.blocks.push(block);
    }
    
    
    public getSelectedBlocks(): Block[] {
        return this.blocks.filter(block => block.isSelected());
    }

}
