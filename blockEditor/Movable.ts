import { CommunicationManager } from "./CommunicationManager";

export interface Movable {
    moveTo(x: number, y: number, communicationManager: CommunicationManager): void;
    moveDelta(deltaX: number, deltaY: number, communicationManager: CommunicationManager): void;
    getPosition(communicationManager: CommunicationManager): { x: number, y: number } | undefined;
    }

export function isMovable(object: any): object is Movable {
    return (object as Movable).moveDelta !== undefined;
}