export interface Movable {
    moveTo(x: number, y: number): void;
    moveDelta(deltaX: number, deltaY: number): void;
    getPosition(): { x: number; y: number };
    getUpdatePositionMessages(): { type: string; id: string; x: number; y: number }[];
}

export function isMovable(object: any): object is Movable {
    return (object as Movable).moveDelta !== undefined;
}