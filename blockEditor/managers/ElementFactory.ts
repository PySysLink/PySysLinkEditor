import { CanvasElement } from "../interfaces/CanvasElement";
import { IdType, BlockData, NoteData, ImageData } from "../../shared/JsonTypes";
import { CommunicationManager } from "./CommunicationManager";
import { BlockVisual } from "../visualElements/BlockVisual";

export interface ElementCreator {
    createVisual(data: any, communicationManager: CommunicationManager): CanvasElement;
}

/**
 * Factory for creating canvas elements polymorphically.
 * Registers element types and creates visuals based on type.
 */
export class ElementFactory {
    private creators: Map<string, ElementCreator> = new Map();

    public registerElementType(type: string, creator: ElementCreator): void {
        this.creators.set(type, creator);
    }

    public createVisual(type: string, data: any, communicationManager: CommunicationManager): CanvasElement | null {
        const creator = this.creators.get(type);
        if (!creator) {
            console.warn(`No creator registered for element type: ${type}`);
            return null;
        }
        return creator.createVisual(data, communicationManager);
    }

    public isTypeRegistered(type: string): boolean {
        return this.creators.has(type);
    }
}

/**
 * Built-in creator for Block elements
 */
export class BlockElementCreator implements ElementCreator {
    createVisual(data: BlockData, communicationManager: CommunicationManager): CanvasElement {
        return new BlockVisual(data, communicationManager, (block: BlockVisual) => {
            // Deletion is handled by manager
        });
    }
}
