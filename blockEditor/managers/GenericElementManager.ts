import { CanvasElement } from "../interfaces/CanvasElement";
import { CommunicationManager } from "./CommunicationManager";
import { JsonData, IdType } from "../../shared/JsonTypes";
import { ElementEventBus } from "../events/ElementEventBus";

/**
 * Base class for managing canvas elements of a specific type.
 * Provides common CRUD operations and callback registration.
 * Subclasses (BlockInteractionManager, LinkInteractionManager, etc.)
 * extend this and provide type-specific logic.
 * 
 * T is the visual element type (e.g., BlockVisual, LinkVisual)
 */
export abstract class GenericElementManager<T extends CanvasElement> {
    protected elements: T[] = [];
    protected communicationManager: CommunicationManager;
    protected eventBus?: ElementEventBus;
    protected currentPath: string[] = ['root'];

    private onElementCreatedCallbacks: ((element: T) => void)[] = [];
    private onElementDeletedCallbacks: ((element: T) => void)[] = [];
    private onElementModifiedCallbacks: ((element: T) => void)[] = [];

    constructor(communicationManager: CommunicationManager, eventBus?: ElementEventBus) {
        this.communicationManager = communicationManager;
        this.eventBus = eventBus;
    }

    /**
     * Set the current subsystem context path
     */
    public setCurrentPath(path: string[]): void {
        this.currentPath = path;
    }

    /**
     * Get all elements at the current level
     */
    public getAll(): T[] {
        return this.elements;
    }

    /**
     * Get element by ID
     */
    public getById(id: IdType): T | undefined {
        return this.elements.find(el => el.getId() === id);
    }

    /**
     * Get selected elements
     */
    public getSelected(): T[] {
        return this.elements.filter(el => {
            const asAny = el as any;
            return asAny.isSelected && asAny.isSelected();
        });
    }

    /**
     * Abstract method to update from JSON
     * Subclasses implement type-specific update logic
     */
    public abstract updateFromJson(json: JsonData): void;

    /**
     * Abstract method to create a visual element
     * Subclasses implement type-specific creation logic
     */
    protected abstract createVisualFromData(data: any): T;

    /**
     * Register callback for element creation
     */
    public registerOnElementCreated(callback: (element: T) => void): void {
        this.onElementCreatedCallbacks.push(callback);
    }

    /**
     * Register callback for element deletion
     */
    public registerOnElementDeleted(callback: (element: T) => void): void {
        this.onElementDeletedCallbacks.push(callback);
    }

    /**
     * Register callback for element modification
     */
    public registerOnElementModified(callback: (element: T) => void): void {
        this.onElementModifiedCallbacks.push(callback);
    }

    /**
     * Add element to the managed collection
     */
    protected addElement(element: T): void {
        this.elements.push(element);
        this.onElementCreatedCallbacks.forEach(cb => cb(element));
        if (this.eventBus) {
            this.eventBus.emit('elementCreated', { 
                elementId: element.getId(),
                path: this.currentPath
            });
        }
    }

    /**
     * Remove element from the managed collection
     */
    protected removeElement(element: T): void {
        const index = this.elements.indexOf(element);
        if (index !== -1) {
            this.elements.splice(index, 1);
            this.onElementDeletedCallbacks.forEach(cb => cb(element));
            if (this.eventBus) {
                this.eventBus.emit('elementDeleted', { 
                    elementId: element.getId(),
                    path: this.currentPath
                });
            }
        }
    }

    /**
     * Notify listeners of element modification
     */
    protected notifyElementModified(element: T): void {
        this.onElementModifiedCallbacks.forEach(cb => cb(element));
        if (this.eventBus) {
            this.eventBus.emit('elementModified', { 
                elementId: element.getId(),
                path: this.currentPath
            });
        }
    }

    /**
     * Clear all managed elements
     */
    protected clear(): void {
        this.elements = [];
    }
}
