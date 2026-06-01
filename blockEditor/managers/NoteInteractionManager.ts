import { GenericElementManager } from './GenericElementManager';
import { NoteVisual } from '../visualElements/NoteVisual';
import { NoteData, JsonData, IdType } from '../../shared/JsonTypes';
import { CommunicationManager } from './CommunicationManager';
import { ElementEventBus } from '../events/ElementEventBus';

/**
 * Manages note elements on the canvas.
 * Extends GenericElementManager to provide standard CRUD operations for notes.
 */
export class NoteInteractionManager extends GenericElementManager<NoteVisual> {
    constructor(communicationManager: CommunicationManager, eventBus?: ElementEventBus) {
        super(communicationManager, eventBus);
    }

    /**
     * Create a note visual from note data
     */
    protected createVisualFromData(noteData: NoteData): NoteVisual {
        const deleteCallback = (note: NoteVisual) => {
            this.deleteNote(note);
        };
        return new NoteVisual(noteData, this.communicationManager, deleteCallback);
    }

    /**
     * Update notes from JSON data
     */
    public updateFromJson(json: JsonData): void {
        const subsystemData = this.communicationManager.getCurrentSubsystemData();
        if (!subsystemData) {
            this.clear();
            return;
        }

        const notesInJson = subsystemData.notes || [];

        // Remove notes that are no longer in JSON
        const visuals = [...this.elements];
        visuals.forEach((visual) => {
            if (!notesInJson.find(n => n.id === visual.getId())) {
                this.removeElement(visual);
            }
        });

        // Create or update notes
        notesInJson.forEach((noteData) => {
            const existing = this.elements.find(v => v.getId() === noteData.id);
            if (!existing) {
                const visual = this.createVisualFromData(noteData);
                this.addElement(visual);
            } else {
                existing.updateFromJson(json, this.communicationManager);
                this.notifyElementModified(existing);
            }
        });
    }

    /**
     * Get all note visuals
     */
    public getNotes(): NoteVisual[] {
        return this.getAll();
    }

    /**
     * Delete a note
     */
    private deleteNote = (note: NoteVisual): void => {
        this.removeElement(note);
    };

    /**
     * Get selected notes
     */
    public getSelectedNotes(): NoteVisual[] {
        return this.getSelected();
    }

    /**
     * Move note
     */
    public moveNote(noteId: IdType, x: number, y: number): void {
        const note = this.getById(noteId);
        if (note) {
            const dx = x - note.getX();
            const dy = y - note.getY();
            note.move(dx, dy);
            this.notifyElementModified(note);
        }
    }

    /**
     * Create a new note
     */
    public createNote(x: number, y: number, text: string = 'New note', color?: string): NoteData {
        const noteData: NoteData = {
            id: `note_${Date.now()}_${Math.random()}`,
            x,
            y,
            text,
            color: color || '#ffffcc',
            width: 150,
            height: 100
        };
        
        const visual = this.createVisualFromData(noteData);
        this.addElement(visual);
        return noteData;
    }
}
