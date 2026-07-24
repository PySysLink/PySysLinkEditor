import { BlockData, IdType, JsonData } from '../../shared/JsonTypes';
import { ElementManager } from '../interfaces/ElementManager';
import { BlockVisual } from '../visualElements/BlockVisual';
import { CommunicationManager } from '../editorCore/CommunicationManager';

export class BlockInteractionManager extends ElementManager {
    public blocks: BlockVisual[] = [];

    private communicationManager: CommunicationManager;

    private onMouseDownOnPortCallbacks: ((elementId: IdType, e: any, portType: "input" | "output", portIndex: number) => void)[] = [];
    private onDeleteCallbacks: ((block: BlockVisual) => void)[] = [];

    constructor(communicationManager: CommunicationManager) {
        super();
        this.communicationManager = communicationManager;
    }

    public createBlockVisual(blockData: BlockData): void {
        const block = new BlockVisual(blockData, this.communicationManager, this.deleteBlock);
        block.registerOnDoubleClickCallback(this.doubleClickOnBlock);
        block.registerOnMouseDownOnPortCallback((e: any, portType: "input" | "output", portIndex: number) => {
            this.onMouseDownOnPort(block, e, portType, portIndex);
        });
        block.registerOnSelectedCallback((selected: boolean) => {
            this.onBlockSelected(block, selected);
        });
        this.blocks.push(block);
    }

    public updateFromJson(json: JsonData): void {
        console.log('Updating blocks from JSON:', json.blocks);
        console.log('Current blocks:', this.blocks.map(b => b.id));
        json.blocks?.forEach(blockData => {
            var block = this.blocks.find(b => b.id === blockData.id);
            if (!block) {
                this.createBlockVisual(blockData);
            }
        });

        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            const blockData = json.blocks?.find(b => b.id === block.id);
            if (!blockData) {
                this.deleteBlock(block);
            }
        }

        this.blocks.forEach(block => block.updateFromJson(json, this.communicationManager));

        console.log('Updated blocks:', this.blocks.map(b => b.id));
    }

    private onBlockSelected(block: BlockVisual, selected: boolean): void {
        this.communicationManager.print(`Block ${block.id} selected: ${selected}`);
        console.trace();
        this.communicationManager.notifyBlockSelected(block.id, selected);
    }

    private onMouseDownOnPort(block: BlockVisual, e: any, portType: "input" | "output", portIndex: number): void {
        this.communicationManager.print( `Mouse down on ${portType} port ${portIndex} of block ${block.id}` );
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(block.id, e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (elementId: IdType, e: any, portType: "input" | "output", portIndex: number) => void): void {
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

    public doubleClickOnBlock = (e: MouseEvent, block: BlockVisual): void => {
        this.communicationManager.notifyDoubleClickOnBlock(block.id);
    };
}
