import { CommunicationManager } from "./CommunicationManager";
import { Selectable } from "./Selectable";
import { Rotation } from "../shared/JsonTypes";

export type RotationDirection = 'clockwise' | 'counterClockwise';

export interface Rotatable {
    getRotation(communicationManager: CommunicationManager): Rotation;
    applyRotation(rotation: Rotation, communicationManager: CommunicationManager, selectables: Selectable[]): void;
    rotateClockwise(communicationManager: CommunicationManager, selectables: Selectable[]): void;
    rotateCounterClockwise(communicationManager: CommunicationManager, selectables: Selectable[]): void
}

export function isRotatable(object: any): object is Rotatable {
    return (object as Rotatable).rotateClockwise !== undefined;
}