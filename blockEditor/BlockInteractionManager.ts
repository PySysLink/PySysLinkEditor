import { BlockData, IdType, JsonData } from '../shared/JsonTypes';
import { BlockVisual } from './BlockVisual';
import { CommunicationManager } from './CommunicationManager';

export class BlockInteractionManager {
    public blocks: BlockVisual[] = [];
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private communicationManager: CommunicationManager;

    private onMouseDownOnPortCallbacks: ((block: BlockVisual, e: any, portType: "input" | "output", portIndex: number) => void)[] = [];
    private onDeleteCallbacks: ((block: BlockVisual) => void)[] = [];

    constructor(communicationManager: CommunicationManager) {
        this.communicationManager = communicationManager;
    }

    public createBlockVisual(blockData: BlockData): void {
        const block = new BlockVisual(blockData, this.deleteBlock);
        block.registerOnMouseDownOnPortCallback((e: any, portType: "input" | "output", portIndex: number) => {
            this.onMouseDownOnPort(block, e, portType, portIndex);
        });
        block.registerOnSelectedCallback((selected: boolean) => {
            this.onBlockSelected(block, selected);
        });
        this.blocks.push(block);
    }

    public updateFromJson(json: JsonData): void {
        json.blocks?.forEach(blockData => {
            var block = this.blocks.find(b => b.id === blockData.id);
            if (!block) {
                this.createBlockVisual(blockData);
            }
        });

        this.blocks.forEach((block: BlockVisual) => {
            const blockData = json.blocks?.find(b => b.id === block.id);
            if (!blockData) {
                this.deleteBlock(block);
            }
        });

        this.blocks.forEach(block => block.updateFromJson(json));
    }

    private onBlockSelected(block: BlockVisual, selected: boolean): void {
        this.communicationManager.print(`Block ${block.id} selected: ${selected}`);
        this.communicationManager.notifyBlockSelected(block.id, selected);
    }

    private onMouseDownOnPort(block: BlockVisual, e: any, portType: "input" | "output", portIndex: number): void {
        this.communicationManager.print( `Mouse down on ${portType} port ${portIndex} of block ${block.id}` );
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(block, e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (block: BlockVisual, e: any, portType: "input" | "output", portIndex: number) => void): void {
        this.onMouseDownOnPortCallbacks.push(callback);
    }
    
    
    public registerOnDeleteCallback(callback: (block: BlockVisual) => void): void {
        this.onDeleteCallbacks.push(callback);
    }
    
    
    public getSelectedBlocks(): BlockVisual[] {
        return this.blocks.filter(block => block.isSelected());
    }

    public deleteBlock = (block: BlockVisual): void => {
        const index = this.blocks.indexOf(block);
        if (index !== -1) {
            this.blocks.splice(index, 1);
        }
        this.onDeleteCallbacks.forEach(callback => callback(block));
    };
}
