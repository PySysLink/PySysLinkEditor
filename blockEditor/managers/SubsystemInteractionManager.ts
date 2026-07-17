import { SubsystemData, IdType, JsonData } from '../../shared/JsonTypes';
import { ElementManager } from '../interfaces/ElementManager';
import { SubsystemVisual } from '../visualElements/SubsystemVisual';
import { CommunicationManager } from '../editorCore/CommunicationManager';

export class SubsystemInteractionManager extends ElementManager {
    public subsystems: SubsystemVisual[] = [];

    private communicationManager: CommunicationManager;

    private onMouseDownOnPortCallbacks: ((elementId: IdType, e: any, portType: "input" | "output", portIndex: number) => void)[] = [];
    private onDeleteCallbacks: ((subsystem: SubsystemVisual) => void)[] = [];

    constructor(communicationManager: CommunicationManager) {
        super();
        this.communicationManager = communicationManager;
    }

    public createSubsystemVisual(subsystemData: SubsystemData): void {
        const subsystem = new SubsystemVisual(subsystemData, this.communicationManager, this.deleteSubsystem);
        subsystem.registerOnDoubleClickCallback(this.doubleClickOnSubsystem);
        subsystem.registerOnMouseDownOnPortCallback((e: any, portType: "input" | "output", portIndex: number) => {
            this.onMouseDownOnPort(subsystem, e, portType, portIndex);
        });
        subsystem.registerOnSelectedCallback((selected: boolean) => {
            this.onSubsystemSelected(subsystem, selected);
        });
        this.subsystems.push(subsystem);
    }

    public updateFromJson(json: JsonData): void {
        json.subsystems?.forEach(subsystemData => {
            var subsystem = this.subsystems.find(b => b.id === subsystemData.id);
            if (!subsystem) {
                this.createSubsystemVisual(subsystemData);
            }
        });

        for (let i = this.subsystems.length - 1; i >= 0; i--) {
            const subsystem = this.subsystems[i];
            const subsystemData = json.subsystems?.find(b => b.id === subsystem.id);
            if (!subsystemData) {
                this.deleteSubsystem(subsystem);
            }
        }

        this.subsystems.forEach(subsystem => subsystem.updateFromJson(json, this.communicationManager));
    }
    

    private onSubsystemSelected(subsystem: SubsystemVisual, selected: boolean): void {
        this.communicationManager.print(`Subsystem ${subsystem.id} selected: ${selected}`);
        this.communicationManager.notifySubsystemSelected(subsystem.id, selected);
    }

    private onMouseDownOnPort(subsystem: SubsystemVisual, e: any, portType: "input" | "output", portIndex: number): void {
        this.communicationManager.print( `Mouse down on ${portType} port ${portIndex} of subsystem ${subsystem.id}` );
        this.onMouseDownOnPortCallbacks.forEach(callback => {
            callback(subsystem.id, e, portType, portIndex);
        });
    }

    public registerOnMouseDownOnPortCallback(callback: (elementId: IdType, e: any, portType: "input" | "output", portIndex: number) => void): void {
        this.onMouseDownOnPortCallbacks.push(callback);
    }
    
    
    public registerOnDeleteCallback(callback: (subsystem: SubsystemVisual) => void): void {
        this.onDeleteCallbacks.push(callback);
    }
    
    
    public getSelectedSubsystems(): SubsystemVisual[] {
        return this.subsystems.filter(subsystem => subsystem.isSelected());
    }

    public deleteSubsystem = (subsystem: SubsystemVisual): void => {
        const index = this.subsystems.indexOf(subsystem);
        if (index !== -1) {
            this.subsystems.splice(index, 1);
        }
        this.onDeleteCallbacks.forEach(callback => callback(subsystem));
    };

    public doubleClickOnSubsystem = (e: MouseEvent, subsystem: SubsystemVisual): void => {
        this.communicationManager.notifyDoubleClickOnSubsystem(subsystem.id);
    };
}
