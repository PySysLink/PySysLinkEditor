import { CommunicationManager } from "./CommunicationManager";
import { Selectable } from "./Selectable";

export interface Movable {
    moveTo(x: number, y: number, communicationManager: CommunicationManager, selectables: Selectable[]): void;
    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager, selectables: Selectable[]): void;
    getPosition(communicationManager: CommunicationManager): { x: number, y: number } | undefined;
    }

export function isMovable(object: any): object is Movable {
    return (object as Movable).moveDelta !== undefined;
}