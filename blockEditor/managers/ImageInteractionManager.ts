import { GenericElementManager } from './GenericElementManager';
import { ImageVisual } from '../visualElements/ImageVisual';
import { ImageData, JsonData, IdType } from '../../shared/JsonTypes';
import { CommunicationManager } from './CommunicationManager';
import { ElementEventBus } from '../events/ElementEventBus';

/**
 * Manages image elements on the canvas.
 * Extends GenericElementManager to provide standard CRUD operations for images.
 */
export class ImageInteractionManager extends GenericElementManager<ImageVisual> {
    constructor(communicationManager: CommunicationManager, eventBus?: ElementEventBus) {
        super(communicationManager, eventBus);
    }

    /**
     * Create an image visual from image data
     */
    protected createVisualFromData(imageData: ImageData): ImageVisual {
        const deleteCallback = (image: ImageVisual) => {
            this.deleteImage(image);
        };
        return new ImageVisual(imageData, this.communicationManager, deleteCallback);
    }

    /**
     * Update images from JSON data
     */
    public updateFromJson(json: JsonData): void {
        const subsystemData = this.communicationManager.getCurrentSubsystemData();
        if (!subsystemData) {
            this.clear();
            return;
        }

        const imagesInJson = subsystemData.images || [];

        // Remove images that are no longer in JSON
        const visuals = [...this.elements];
        visuals.forEach((visual) => {
            if (!imagesInJson.find(i => i.id === visual.getId())) {
                this.removeElement(visual);
            }
        });

        // Create or update images
        imagesInJson.forEach((imageData) => {
            const existing = this.elements.find(v => v.getId() === imageData.id);
            if (!existing) {
                const visual = this.createVisualFromData(imageData);
                this.addElement(visual);
            } else {
                existing.updateFromJson(json, this.communicationManager);
                this.notifyElementModified(existing);
            }
        });
    }

    /**
     * Get all image visuals
     */
    public getImages(): ImageVisual[] {
        return this.getAll();
    }

    /**
     * Delete an image
     */
    private deleteImage = (image: ImageVisual): void => {
        this.removeElement(image);
    };

    /**
     * Get selected images
     */
    public getSelectedImages(): ImageVisual[] {
        return this.getSelected();
    }

    /**
     * Move image
     */
    public moveImage(imageId: IdType, x: number, y: number): void {
        const image = this.getById(imageId);
        if (image) {
            const dx = x - image.getX();
            const dy = y - image.getY();
            image.move(dx, dy);
            this.notifyElementModified(image);
        }
    }

    /**
     * Rotate image
     */
    public rotateImage(imageId: IdType, rotation: number): void {
        const image = this.getById(imageId);
        if (image) {
            image.rotate(rotation);
            this.notifyElementModified(image);
        }
    }

    /**
     * Create a new image
     */
    public createImage(x: number, y: number, src: string, width: number, height: number): ImageData {
        const imageData: ImageData = {
            id: `image_${Date.now()}_${Math.random()}`,
            x,
            y,
            src,
            width,
            height,
            rotation: 0
        };
        
        const visual = this.createVisualFromData(imageData);
        this.addElement(visual);
        return imageData;
    }
}
