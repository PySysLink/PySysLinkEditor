import { Selectable } from "../interfaces/Selectable";
import { Movable, Rotatable } from "../interfaces/CanvasElement";
import { ImageData, IdType, JsonData, Rotation } from "../../shared/JsonTypes";
import { CommunicationManager } from "../managers/CommunicationManager";

/**
 * Visual representation of an image on the canvas.
 * Images can be moved, rotated, and selected.
 */
export class ImageVisual extends Selectable implements Movable, Rotatable {
    private imageData: ImageData;
    private element!: HTMLDivElement;
    private imgElement!: HTMLImageElement;
    private communicationManager: CommunicationManager;
    private onDeleteCallback: (image: ImageVisual) => void;

    constructor(
        imageData: ImageData,
        communicationManager: CommunicationManager,
        onDeleteCallback: (image: ImageVisual) => void
    ) {
        super();
        this.imageData = imageData;
        this.communicationManager = communicationManager;
        this.onDeleteCallback = onDeleteCallback;
        this.createImageElement();
    }

    private createImageElement(): void {
        this.element = document.createElement('div');
        this.element.className = 'image-element';
        this.element.setAttribute('data-id', this.imageData.id);
        this.element.style.position = 'absolute';
        this.element.style.left = `${this.imageData.x}px`;
        this.element.style.top = `${this.imageData.y}px`;
        this.element.style.width = `${this.imageData.width}px`;
        this.element.style.height = `${this.imageData.height}px`;
        this.element.style.zIndex = `${this.imageData.zIndex || 1}`;
        this.element.style.overflow = 'hidden';
        this.element.style.border = '1px solid #ccc';

        this.imgElement = document.createElement('img');
        this.imgElement.src = this.imageData.src;
        this.imgElement.style.width = '100%';
        this.imgElement.style.height = '100%';
        this.imgElement.style.objectFit = 'contain';
        this.imgElement.style.transform = `rotate(${this.imageData.rotation || 0}deg)`;

        this.element.appendChild(this.imgElement);
    }

    public getElement(): HTMLDivElement {
        return this.element;
    }

    public getId(): IdType {
        return this.imageData.id;
    }

    public move(dx: number, dy: number): void {
        this.imageData.x += dx;
        this.imageData.y += dy;
        this.element.style.left = `${this.imageData.x}px`;
        this.element.style.top = `${this.imageData.y}px`;
    }

    public getX(): number {
        return this.imageData.x;
    }

    public getY(): number {
        return this.imageData.y;
    }

    public rotate(newRotation: number): void {
        this.imageData.rotation = (newRotation % 360) as Rotation;
        this.imgElement.style.transform = `rotate(${this.imageData.rotation}deg)`;
    }

    public getRotation(): number {
        return this.imageData.rotation || 0;
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        // Find this image in the JSON and update if changed
        const images = json.images || [];
        const updatedImage = images.find(img => img.id === this.imageData.id);
        
        if (updatedImage) {
            this.imageData = updatedImage;
            this.element.style.left = `${this.imageData.x}px`;
            this.element.style.top = `${this.imageData.y}px`;
            this.element.style.width = `${this.imageData.width}px`;
            this.element.style.height = `${this.imageData.height}px`;
            this.imgElement.src = this.imageData.src;
            this.imgElement.style.transform = `rotate(${this.imageData.rotation || 0}deg)`;
        }
    }

    public delete(communicationManager: CommunicationManager): void {
        this.onDeleteCallback(this);
    }
}
