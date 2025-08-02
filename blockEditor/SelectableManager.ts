import { Selectable } from "./Selectable";
import { Movable, isMovable } from "./Movable";
import { CanvasElement } from "./CanvasElement";
import { CommunicationManager } from "./CommunicationManager";
import { IdType } from "../shared/JsonTypes";
import { isRotatable } from "./Rotatable";

export class SelectableManager {
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private pendingRotations = 0;
    private rotationTimer: number | null = null;

    private selectionBox: HTMLElement | null = null;

    private communicationManager: CommunicationManager;
    private canvas: HTMLElement;

    private getZoomLevelReal: () => number;

    private registeredSelectableLists: (() => Selectable[])[] = [];

    private onMouseUpCallbacks: (() => void)[] = [];
    private onMouseMoveCallbacks: ((e: MouseEvent) => void)[] = [];


    constructor(communicationManager: CommunicationManager, canvas: HTMLElement, getZoomLevelReal: () => number) {
        this.communicationManager = communicationManager;
        this.canvas = canvas;
        this.getZoomLevelReal = getZoomLevelReal;

        this.canvas.addEventListener('mousedown', this.onMouseDownInCanvas);

        document.addEventListener('keydown', this.onKeyDown);
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Delete') {
            this.communicationManager.print(`Delete called`);
            const selectedSelectables = this.getSelectedSelectables();
            this.communicationManager.freeze();
            selectedSelectables.forEach(selectable => {
                this.communicationManager.print(`Delete selectable`);
                selectable.delete(this.communicationManager);
            });
            this.communicationManager.unfreeze();
            
            this.unselectAll();
            return;
        } 

        // Handle Ctrl+R (or Cmd+R on Mac) for rotate
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        if (isCtrlOrCmd && e.key.toLowerCase() === 'r') {
            e.preventDefault(); // prevent browser refresh
            e.stopPropagation(); // prevent event from bubbling up

            this.pendingRotations++;
            if (this.rotationTimer !== null) {
                clearTimeout(this.rotationTimer);
            }

            this.rotationTimer = window.setTimeout(() => {
                this.rotateSelectables();
                this.pendingRotations = 0;
                this.rotationTimer = null;
            }, 300); 
            return;
        }
    };

    private setDragging(value: boolean) {
        this.isDragging = value;
        if (this.isDragging) {
            this.communicationManager.freeze();
        } else {
            this.communicationManager.unfreeze();
        }
    }

    public updateSelectables(): void {
        this.getSelectableList().forEach(selectable => {
            selectable.addOnMouseDownListener("selectable_manager", this.onMouseDownInSelectable);
        });
    }

    public addCallbackToSelectable(selectable: Selectable): void {
        selectable.addOnMouseDownListener("selectable_manager", this.onMouseDownInSelectable);
    }

    private getSelectableList(): Selectable[] {
        return this.registeredSelectableLists.flatMap(getSelectableList => getSelectableList());
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

    private onMouseDownInSelectable = (canvasElement: CanvasElement, e: MouseEvent): void => {
        this.communicationManager.print(`[link log]: Mouse down event happened`);
        let selectable: Selectable;
        if (!(canvasElement instanceof Selectable)) {
            return;
        }
        else {
            selectable = canvasElement as Selectable;
        }
        
        // Ignore Ctrl + Left Click
        if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
            this.communicationManager.print(`[link log]: Ctrl + Left Click ignored`);
            return;
        }
        if (e.button !== 1) {
            this.communicationManager.print(`button not 1`);
            let wasSelectableSelected = selectable.isSelected();
            if (!selectable.isSelected()) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    this.communicationManager.print(`Toggle` );

                    selectable.select();
                } else {
                    // Clear selection and select only this block
                    this.communicationManager.print(`Select only selectable: ${selectable}`);

                    this.unselectAll();
                    selectable.select();
                }
            }

            this.communicationManager.print(`Selectable selected: ${selectable.isSelected()}`);


            // Store the initial mouse position
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.setDragging(false); // Reset dragging state
        
            // Add a temporary mousemove listener to detect drag threshold
            const onMouseMoveThreshold = (moveEvent: MouseEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - this.dragStartX);
                const deltaY = Math.abs(moveEvent.clientY - this.dragStartY);
        
                if (deltaX > this.dragThreshold || deltaY > this.dragThreshold) {
                    // Exceeded drag threshold, start dragging
                    this.setDragging(true);
                    this.communicationManager.freeze();
                    this.communicationManager.print(`Drag started`);

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
                        if (wasSelectableSelected) {
                            selectable.unselect();
                        }
                    } else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        selectable.select();
                    }
                }
                this.communicationManager.print(`Selectable selected 2: ${selectable.isSelected()}`);
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
        this.communicationManager.print(`Mouse up` );

        document.removeEventListener('mousemove', this.onMouseMoveDrag);
        document.removeEventListener('mouseup', this.onMouseUpDrag);

        this.onMouseUpCallbacks.forEach(callback => callback());
        this.setDragging(false);
    };

    private onMouseUpSelectionBox = (): void => {
        if (this.selectionBox) {
            try {
                this.canvas.removeChild(this.selectionBox);
            } catch (e) {}
            // End box selection
            this.selectionBox = null;
        }

        document.removeEventListener('mousemove', this.onMouseMoveSelectionBox);
        document.removeEventListener('mouseup', this.onMouseUpSelectionBox);
    };

    private onMouseMoveSelectionBox = (e: MouseEvent): void => {        
        this.communicationManager.print(`Mouse move selection box` );
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

                const condition = selectable.selectCondition();

                const toBeSelected =
                    condition === "Intersect"
                        ? (
                            blockRect.left < boxRect.right &&
                            blockRect.right > boxRect.left &&
                            blockRect.top < boxRect.bottom &&
                            blockRect.bottom > boxRect.top
                        )
                        : (
                            blockRect.left >= boxRect.left &&
                            blockRect.right <= boxRect.right &&
                            blockRect.top >= boxRect.top &&
                            blockRect.bottom <= boxRect.bottom
                        );

                if (toBeSelected) {
                    selectable.select();
                } else {
                    selectable.unselect();
                }
            }
        });
    }

    public onMouseMoveDrag = (e: MouseEvent): void => {
        this.communicationManager.print(`Drag move`);

        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        
        if (this.isDragging) {
            let selectables = this.getSelectableList();
            let selectedSelectables = this.getSelectedSelectables();
            this.communicationManager.freezeLocalJsonCallback();
            selectedSelectables.forEach(selectable => {
                if (isMovable(selectable)) {
                    this.communicationManager.print(`Move selectable: ${selectable.getId()}`);
                    selectable.moveDelta(scaledDeltaX, scaledDeltaY, this.communicationManager, selectables);
                }
            });

            this.communicationManager.unfreezeLocalJsonCallback();


            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }

        this.onMouseMoveCallbacks.forEach(callback => {
            callback(e);
        });
    };

    public rotateSelectables(): void {
        this.communicationManager.freeze();
        while (this.pendingRotations > 0) {
            let centerPosition = { x: 0, y: 0 };
            let count = 0;

            this.communicationManager.print(`Rotate selectables`);
            const selectedSelectables = this.getSelectedSelectables();

            this.communicationManager.freezeLinkUpdates();

            selectedSelectables.forEach(selectable => {
                if (isMovable(selectable)) {
                    const position = selectable.getPosition(this.communicationManager);
                    const element = selectable.getElement();
                    if (position) {
                        centerPosition.x += position.x + (element instanceof HTMLElement ? element.offsetWidth / 2 : 0);
                        centerPosition.y += position.y + (element instanceof HTMLElement ? element.offsetHeight / 2 : 0);
                        count++;
                    }
                }
                if (isRotatable(selectable)) {
                    selectable.rotateClockwise(this.communicationManager, selectedSelectables);
                }
            });

            if (count > 0) {
                centerPosition.x /= count;
                centerPosition.y /= count;

                selectedSelectables.forEach(selectable => {
                    if (isMovable(selectable)) {
                        selectable.moveClockwiseAround(centerPosition.x, centerPosition.y, this.communicationManager, selectedSelectables);
                    }
                });
            }

            this.communicationManager.unfreezeLinkUpdates();

            this.pendingRotations--;
        }
        this.communicationManager.unfreeze();
    }

    public addOnMouseMoveListener(callback: (e: MouseEvent) => void): void {
        this.onMouseMoveCallbacks.push(callback);
    }
    
    public addOnMouseUpListener(callback: () => void): void {
        this.onMouseUpCallbacks.push(callback);
    }

}