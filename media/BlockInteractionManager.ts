import { Block } from './Block';

export class BlockInteractionManager {
    public blocks: Block[] = [];
    private dragStartX = 0;
    private dragStartY = 0;

    private dragThreshold = 5; // Minimum distance to detect a drag
    private isDragging = false;

    private vscode: any;

    private getZoomLevelReal: () => number;

    constructor(vscode: any, getZoomLevelReal: () => number) {
        this.vscode = vscode;
        this.getZoomLevelReal = getZoomLevelReal;
    }

    public createBlock(id: string, label: string, x: number, y: number, inputPorts: number, outputPorts: number): void {
        const block = new Block(id, label, x, y, inputPorts, outputPorts, this.onClick, this.onMouseDown);
        this.blocks.push(block);
    }
    
    
    public unselectAll(): void {
        this.blocks.forEach(block => block.unselect());
    }
    
    public getSelectedBlocks(): Block[] {
        return this.blocks.filter(block => block.isSelected());
    }


    public onClick(block: Block, e: MouseEvent): void {
        this.vscode.postMessage({ type: 'print', text: `Block clicked: ${block.label}` });
    }

    public onMouseDown(block: Block, e: MouseEvent): void {
        if (e.button !== 1) {
            this.vscode.postMessage({ type: 'print', text: `Mouse down on block: ${block.label}` });
            if (!block.isSelected()) {
                if (e.shiftKey) {
                    // Toggle selection if Shift is pressed
                    block.toggleSelect();
                } else {
                    // Clear selection and select only this block
                    this.unselectAll();
                    block.select();
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
                    if (!block.isSelected()) {
                        // If the block is not already selected, add it to the selection
                        block.select();
                    }
                    document.addEventListener('mousemove', this.onMouseMove);
                    document.addEventListener('mouseup', this.onMouseUp);
                }
            };
        
            document.addEventListener('mousemove', onMouseMoveThreshold);
        
            // Handle mouseup to detect a simple click
            const onMouseUpThreshold = () => {
                document.removeEventListener('mousemove', onMouseMoveThreshold);
                document.removeEventListener('mouseup', onMouseUpThreshold);
        
                if (!this.isDragging) {
                    this.vscode.postMessage({ type: 'print', text: `As simple click on: ${block.label}` });

                    // If no drag occurred, treat it as a simple click
                    if (e.shiftKey) {
                        // Toggle selection if Shift is pressed
                        block.toggleSelect();
                    } else {
                        // Clear selection and select only this block
                        this.unselectAll();
                        block.select();
                    }
                }
            };
        
            document.addEventListener('mouseup', onMouseUpThreshold);
        }
    }

    public onMouseUp(): void {
        this.vscode.postMessage({ type: 'print', text: `Mouse up` });

        if (this.isDragging) {
            this.isDragging = false;
            const stateMessages = this.getSelectedBlocks().flatMap(block => block.getState());

            stateMessages.forEach(message => {
                this.vscode.postMessage({ type: 'print', text: message});
            }); 

            
            this.vscode.postMessage({ type: 'moveBatch', updates: stateMessages });

        }

        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    public onMouseMove(e: MouseEvent): void {
        const scaledDeltaX = (e.clientX - this.dragStartX) / this.getZoomLevelReal();
        const scaledDeltaY = (e.clientY - this.dragStartY) / this.getZoomLevelReal();
        
        if (this.isDragging) {
            this.getSelectedBlocks().forEach(block => {
                block.move(scaledDeltaX, scaledDeltaY);
            });

            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;


        }

    }

}
