import { Selectable } from "./Selectable";
import { Movable, isMovable } from "./Movable";
import { CanvasElement } from "./CanvasElement";

export class SelectableManager {
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private selectionBox: HTMLElement | null = null;

    private vscode: any;
    private canvas: HTMLElement;

    private getZoomLevelReal: () => number;

    private registeredSelectableLists: (() => Selectable[])[] = [];

    private onMouseMoveCallbacks: ((e: MouseEvent) => void)[] = [];
    private registeredStateLists: (() => any[])[] = [];


    constructor(vscode: any, canvas: HTMLElement, getZoomLevelReal: () => number) {
        this.vscode = vscode;
        this.canvas = canvas;
        this.getZoomLevelReal = getZoomLevelReal;

        this.canvas.addEventListener('mousedown', this.onMouseDownInCanvas);
    }

    public updateSelectables(): void {
        this.getSelectableList().forEach(selectable => {
            selectable.addOnMouseDownListener(this.onMouseDownInSelectable);
        });
    }

    private getSelectableList(): Selectable[] {
        return this.registeredSelectableLists.flatMap(getSelectableList => getSelectableList());
    }

    private getStateList(): any[] {
        return this.registeredStateLists.flatMap(getStateList => getStateList()).flat();
    }

    private unselectAll(): void {
        this.getSelectableList().forEach(selectable => selectable.unselect());
    }

    public getSelectedSelectables(): Selectable[] {
        return this.getSelectableList().filter(selectable => selectable.isSelected());
    }

    public registerSelectableList(getSelectableList: () => Selectable[]): void {
        this.registeredSelectableLists.push(getSelectableList);
    }

    public registerStateList(getStateList: () => any[]): void {
        this.registeredStateLists.push(getStateList);
    }

    private onMouseDownInSelectable = (canvasElement: CanvasElement, e: MouseEvent): void => {
        let selectable: Selectable;
        if (!(canvasElement instanceof Selectable)) {
            return;
        }
        else {
            selectable = canvasElement as Selectable;
        }
        if (e.button !== 1) {
            if (!selectable.isSelected()) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    selectable.toggleSelect();
                } else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    selectable.select();
                }
            }

            // Store the initial mouse position
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.isDragging = false; // Reset dragging state
        
            // Add a temporary mousemove listener to detect drag threshold
            const onMouseMoveThreshold = (moveEvent: MouseEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - this.dragStartX);
                const deltaY = Math.abs(moveEvent.clientY - this.dragStartY);
        
                if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
                    // Exceeded drag threshold, start dragging
                    this.isDragging = true;
                    document.removeEventListener('mousemove', onMouseMoveThreshold);
        
                    // Start dragging selected blocks
                    if (!selectable.isSelected()) {
                        // If the block is not already selected, add it to the selection
                        selectable.select();
                    }
                    document.addEventListener('mousemove', this.onMouseMoveDrag);
                    document.addEventListener('mouseup', this.onMouseUpDrag);
                }
            };
        
            document.addEventListener('mousemove', onMouseMoveThreshold);
        
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
        
                if (!this.isDragging) {
                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        selectable.toggleSelect();
                    } else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        selectable.select();
                    }
                }
            };
        
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    };

    private onMouseDownInCanvas = (e: MouseEvent): void => {
        if (e.button !== 1) {
            if (e.target !== this.canvas) {
                return; // Ignore clicks on child elements
            }
            this.startBoxSelection(e);
        }
    };

    private startBoxSelection(e: MouseEvent): void {
        this.unselectAll();
        
        // Get the canvas's bounding rectangle
        const canvasRect = this.canvas.getBoundingClientRect();
    
        // Adjust mouse coordinates to be relative to the canvas
        const adjustedX = (e.clientX - canvasRect.left) / this.getZoomLevelReal();
        const adjustedY = (e.clientY - canvasRect.top) / this.getZoomLevelReal();
    
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        this.canvas.appendChild(this.selectionBox);
    
        this.dragStartX = adjustedX;
        this.dragStartY = adjustedY;
    
        this.selectionBox.style.left = `${this.dragStartX}px`;
        this.selectionBox.style.top = `${this.dragStartY}px`;
    
        document.addEventListener('mousemove', this.onMouseMoveSelectionBox);
        document.addEventListener('mouseup', this.onMouseUpSelectionBox);
    }


    public onMouseUpDrag = (): void => {
        this.vscode.postMessage({ type: 'print', text: `Mouse up` });

        if (this.isDragging) {
            let stateMessages = this.getStateList();

            this.vscode.postMessage({ type: 'print', text: stateMessages });

            this.vscode.postMessage({ type: 'updateStates', updates: stateMessages });
        }

        document.removeEventListener('mousemove', this.onMouseMoveDrag);
        document.removeEventListener('mouseup', this.onMouseUpDrag);
    };

    private onMouseUpSelectionBox = (): void => {
        if (this.selectionBox) {
            // End box selection
            this.canvas.removeChild(this.selectionBox);
            this.selectionBox = null;
        }

        document.removeEventListener('mousemove', this.onMouseMoveSelectionBox);
        document.removeEventListener('mouseup', this.onMouseUpSelectionBox);
    };

    private onMouseMoveSelectionBox = (e: MouseEvent): void => {        
        this.vscode?.postMessage({ type: 'print', text: `Mouse move selection box` });
        if (this.selectionBox) {
            // Update selection box size
            const canvasRect = this.canvas.getBoundingClientRect();

            const adjustedX = (e.clientX - canvasRect.left) / this.getZoomLevelReal();
            const adjustedY = (e.clientY - canvasRect.top) / this.getZoomLevelReal();

            const scaledWidth = (adjustedX - this.dragStartX);
            const scaledHeight = (adjustedY - this.dragStartY);

            this.selectionBox.style.left = `${Math.min(this.dragStartX, adjustedX)}px`;
            this.selectionBox.style.top = `${Math.min(this.dragStartY, adjustedY)}px`;
            this.selectionBox.style.width = `${Math.abs(scaledWidth)}px`;
            this.selectionBox.style.height = `${Math.abs(scaledHeight)}px`;
    
            // Update selected blocks based on the selection box
            this.updateSelectionBox();
        }
    };

    private updateSelectionBox(): void {
        const boxRect = this.selectionBox!.getBoundingClientRect();

        this.getSelectableList().forEach(selectable => {
            const selectableEl = selectable.getElement();
            if (selectableEl) {
                const blockRect = selectableEl.getBoundingClientRect();

                if (
                    blockRect.left < boxRect.right &&
                    blockRect.right > boxRect.left &&
                    blockRect.top < boxRect.bottom &&
                    blockRect.bottom > boxRect.top
                ) {
                    selectable.select();
                } else {
                    selectable.unselect();
                }
            }
        });
    }

    public onMouseMoveDrag = (e: MouseEvent): void => {
        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        
        if (this.isDragging) {
            this.getSelectedSelectables().forEach(selectable => {
                if (isMovable(selectable)) {
                    selectable.moveDelta(scaledDeltaX, scaledDeltaY);
                }
            });

            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }

        this.onMouseMoveCallbacks.forEach(callback => {
            callback(e);
        });
    };

    public addOnMouseMoveListener(callback: (e: MouseEvent) => void): void {
        this.onMouseMoveCallbacks.push(callback);
    }

}