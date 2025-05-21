import { CanvasElement } from "./CanvasElement";
import { CommunicationManager } from "./CommunicationManager";

export abstract class Selectable extends CanvasElement {
    _isSelected: boolean = false;

    private onSelectedCallbacks: ((selected: boolean) => void)[] = [];

    public select(): void {
        let previouslySelected = this._isSelected;
        this._isSelected = true;
        this.getElement().classList.add('selected');
        if (!previouslySelected) {
            this.onSelectedCallbacks.forEach(callback => callback(this._isSelected));
        }
    }

    public unselect(): void {
        let previouslySelected = this._isSelected;
        this._isSelected = false;
        this.getElement().classList.remove('selected');
        if (previouslySelected) {
            this.onSelectedCallbacks.forEach(callback => callback(this._isSelected));
        }
    }

    public isSelected(): boolean {
        return this._isSelected;
    }

    public toggleSelect(): void {
        this._isSelected = !this._isSelected;
        if (this._isSelected) {
            this.select();
        } else {
            this.unselect();
        }
    }   

    public registerOnSelectedCallback(callback: (selected: boolean) => void): void {
        this.onSelectedCallbacks.push(callback);
    }
    
    public abstract delete(communicationManager: CommunicationManager): void;
}