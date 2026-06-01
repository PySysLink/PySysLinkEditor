import { Selectable } from "../interfaces/Selectable";
import { Movable } from "../interfaces/CanvasElement";
import { NoteData, IdType, JsonData } from "../../shared/JsonTypes";
import { CommunicationManager } from "../managers/CommunicationManager";

/**
 * Visual representation of a note on the canvas.
 * Notes are simple text elements that can be moved and selected.
 */
export class NoteVisual extends Selectable implements Movable {
    private noteData: NoteData;
    private element!: HTMLDivElement;
    private communicationManager: CommunicationManager;
    private onDeleteCallback: (note: NoteVisual) => void;

    constructor(
        noteData: NoteData,
        communicationManager: CommunicationManager,
        onDeleteCallback: (note: NoteVisual) => void
    ) {
        super();
        this.noteData = noteData;
        this.communicationManager = communicationManager;
        this.onDeleteCallback = onDeleteCallback;
        this.createNoteElement();
    }

    private createNoteElement(): void {
        this.element = document.createElement('div');
        this.element.className = 'note-element';
        this.element.setAttribute('data-id', this.noteData.id);
        this.element.style.position = 'absolute';
        this.element.style.left = `${this.noteData.x}px`;
        this.element.style.top = `${this.noteData.y}px`;
        this.element.style.width = `${this.noteData.width || 150}px`;
        this.element.style.height = `${this.noteData.height || 100}px`;
        this.element.style.backgroundColor = this.noteData.color || '#ffffcc';
        this.element.style.border = '1px solid #cccccc';
        this.element.style.borderRadius = '4px';
        this.element.style.padding = '8px';
        this.element.style.overflow = 'auto';
        this.element.style.fontSize = '12px';
        this.element.style.fontFamily = 'Arial, sans-serif';
        this.element.style.zIndex = `${this.noteData.zIndex || 1}`;
        this.element.style.whiteSpace = 'pre-wrap';
        this.element.style.wordWrap = 'break-word';
        this.element.textContent = this.noteData.text;
    }

    public getElement(): HTMLDivElement {
        return this.element;
    }

    public getId(): IdType {
        return this.noteData.id;
    }

    public move(dx: number, dy: number): void {
        this.noteData.x += dx;
        this.noteData.y += dy;
        this.element.style.left = `${this.noteData.x}px`;
        this.element.style.top = `${this.noteData.y}px`;
    }

    public getX(): number {
        return this.noteData.x;
    }

    public getY(): number {
        return this.noteData.y;
    }

    public updateFromJson(json: JsonData, communicationManager: CommunicationManager): void {
        // Find this note in the JSON and update if changed
        const notes = json.notes || [];
        const updatedNote = notes.find(n => n.id === this.noteData.id);
        
        if (updatedNote) {
            this.noteData = updatedNote;
            this.element.style.left = `${this.noteData.x}px`;
            this.element.style.top = `${this.noteData.y}px`;
            this.element.style.width = `${this.noteData.width || 150}px`;
            this.element.style.height = `${this.noteData.height || 100}px`;
            this.element.style.backgroundColor = this.noteData.color || '#ffffcc';
            this.element.textContent = this.noteData.text;
        }
    }

    public delete(communicationManager: CommunicationManager): void {
        this.onDeleteCallback(this);
    }
}
