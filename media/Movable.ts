export interface Movable {
    moveTo(x: number, y: number): void;
    moveDelta(deltaX: number, deltaY: number): void;
    getPosition(): { x: number; y: number };
}