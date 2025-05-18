import { Block } from './Block';
import { CommunicationManager } from './CommunicationManager';

export class BlockInteractionManager {
    public blocks: Block[] = [];
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private communicationManager: CommunicationManager;

    private onMouseDownOnPortCallbacks: ((block: Block, e: any, portType: "input" | "output", portIndex: number) => void)[] = [];
    private onDeleteCallbacks: ((block: Block) => void)[] = [];

    constructor(communicationManager: CommunicationManager) {
        this.communicationManager = communicationManager;
    }

    public createBlock(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number): void {
        const block = new Block(id, label, x, y, inputPorts, outputPorts, this.deleteBlock, this.communicationManager.updateBlock);
        block.registerOnMouseDownOnPortCallback((e: any, portType: "input" | "output", portIndex: number) => {
            this.onMouseDownOnPort(block, e, portType, portIndex);
        });
        block.registerOnSelectedCallback((selected: boolean) => {
            this.onBlockSelected(block, selected);
        });
        this.blocks.push(block);
    }

    private onBlockSelected(block: Block, selected: boolean): void {
        this.communicationManager.print(`Block ${block.id} selected: ${selected}`);
        this.communicationManager.notifyBlockSelected(block.id, selected);
    }

    private onMouseDownOnPort(block: Block, e: any, portType: "input" | "output", portIndex: number): void {
        this.communicationManager.print( `Mouse down on ${portType} port ${portIndex} of block ${block.id}` );
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(block, e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (block: Block, e: any, portType: "input" | "output", portIndex: number) => void): void {
        this.onMouseDownOnPortCallbacks.push(callback);
    }
    
    
    public registerOnDeleteCallback(callback: (block: Block) => void): void {
        this.onDeleteCallbacks.push(callback);
    }
    
    
    public getSelectedBlocks(): Block[] {
        return this.blocks.filter(block => block.isSelected());
    }

    public deleteBlock = (block: Block, sendMessage: boolean = true): void => {
        const index = this.blocks.indexOf(block);
        if (index !== -1) {
            this.blocks.splice(index, 1);
        }
        this.onDeleteCallbacks.forEach(callback => callback(block));
        if (sendMessage) {
            this.communicationManager.deleteBlock(block.id);
        }
    };
}
