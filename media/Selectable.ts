import { CanvasElement } from "./CanvasElement";

export abstract class Selectable extends CanvasElement {
    _isSelected: boolean = false;

    public select(): void {
        this._isSelected = true;
        this.getElement().classList.add('selected');
    }

    public unselect(): void {
        this._isSelected = false;
        this.getElement().classList.remove('selected');
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
    
    public abstract delete(): void;
}