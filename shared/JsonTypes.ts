
export type IdType = string;


export interface BlockData {
    id: IdType;
    blockLibrary: string;
    blockType: string;
    label: string;
    x: number; y: number;
    inputPorts: number; outputPorts: number;
    properties: Record<string, any>;
    
}

export interface LinkData {
    id: IdType;
    sourceId: IdType;
    sourcePort: number;
    targetId: IdType;
    targetPort: number;
    sourceX: number; sourceY: number;
    targetX: number; targetY: number;
    intermediateNodes: { id: IdType; x: number; y: number }[];
}

export interface JsonData {
    version: number;
    blocks: BlockData[] | undefined;
    links: LinkData[] | undefined;
}