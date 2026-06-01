import { IdType } from "../../shared/JsonTypes";

export type ElementEventType = 
    | 'elementCreated'
    | 'elementDeleted'
    | 'elementModified'
    | 'selectionChanged'
    | 'subsystemEntered'
    | 'subsystemExited';

export interface ElementEventData {
    elementId?: IdType;
    elementType?: string;
    path?: string[];
    [key: string]: any;
}

/**
 * Simple pub/sub event bus for canvas element events.
 * Reduces tight coupling between managers and components.
 */
export class ElementEventBus {
    private listeners: Map<ElementEventType, Array<(data: ElementEventData) => void>> = new Map();

    public on(event: ElementEventType, callback: (data: ElementEventData) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    public off(event: ElementEventType, callback: (data: ElementEventData) => void): void {
        if (!this.listeners.has(event)) {
            return;
        }
        const callbacks = this.listeners.get(event)!;
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    public emit(event: ElementEventType, data: ElementEventData = {}): void {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event)!.forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error(`Error in event listener for ${event}:`, err);
            }
        });
    }

    public clear(): void {
        this.listeners.clear();
    }
}
