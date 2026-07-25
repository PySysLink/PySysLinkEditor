import { CommunicationManager } from "../editorCore/CommunicationManager";
import { Selectable } from "./Selectable";
import { IdType, Rotation } from "../../shared/JsonTypes";


export interface Resizeable {
    getId(): IdType;
    getResizeConstraints(): { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number };
    getWidthAndHeight(): {width: number, height: number}
    setWidthAndHeight(width: number, height: number, communicationManager: CommunicationManager): void;
}

export type ResizeMode = "t" | "b" | "l" | "r" | "tr" | "tl" | "br" | "bl";

export function isResizeable(object: any): object is Resizeable {
    return (object as Resizeable).getResizeConstraints !== undefined;
}