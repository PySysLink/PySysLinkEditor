import { CommunicationManager } from "./CommunicationManager";
import { ZoomController } from "./ZoomController";

interface DroppedBlockMeta {
    library: string;
    blockType: string;
}

export class CanvasDropHandler {
    private static readonly MIME_TYPE =
        'application/vnd.codeblock';

    constructor(
        private readonly canvas: HTMLElement,
        private readonly communicationManager: CommunicationManager,
        private readonly zoomController: ZoomController
    ) {
        this.canvas.addEventListener(
            'dragover',
            this.onDragOver
        );

        this.canvas.addEventListener(
            'drop',
            this.onDrop
        );
    }

    public dispose(): void {
        this.canvas.removeEventListener(
            'dragover',
            this.onDragOver
        );

        this.canvas.removeEventListener(
            'drop',
            this.onDrop
        );
    }

    private onDragOver = (
        e: DragEvent
    ): void => {
        e.preventDefault();
        console.log('Drag over event received');
    };

    private onDrop = (
        e: DragEvent
    ): void => {
        e.preventDefault();

        this.communicationManager.print(
            'Drop event received'
        );

        const meta = this.extractBlockMeta(e);

        if (!meta) {
            return;
        }

        const { x, y } =
            this.computeDropPosition(e);

        this.communicationManager.print(
            `Drop event: ${meta.blockType}, x: ${x}, y: ${y}`
        );

        this.communicationManager.createBlockOfType(
            meta.library,
            meta.blockType,
            x,
            y
        );
    };

    private extractBlockMeta(
        e: DragEvent
    ): DroppedBlockMeta | null {
        const data =
            e.dataTransfer?.getData(
                CanvasDropHandler.MIME_TYPE
            );

        if (!data) {
            return null;
        }

        try {
            const parsed = JSON.parse(data);

            if (!this.isValidBlockMeta(parsed)) {
                this.communicationManager.print(
                    'Drop event: Invalid meta object'
                );

                return null;
            }

            return {
                library: parsed.library,
                blockType: parsed.blockType
            };
        } catch {
            this.communicationManager.print(
                'Drop event: Failed to parse meta'
            );

            return null;
        }
    }

    private isValidBlockMeta(
        value: unknown
    ): value is DroppedBlockMeta {
        return (
            typeof value === 'object' &&
            value !== null &&
            'library' in value &&
            'blockType' in value &&
            typeof value.library === 'string' &&
            typeof value.blockType === 'string'
        );
    }

    private computeDropPosition(
        e: DragEvent
    ): { x: number; y: number } {
        const rect =
            this.canvas.getBoundingClientRect();

        const zoom =
            this.zoomController.getRealZoom();

        return {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom
        };
    }
}