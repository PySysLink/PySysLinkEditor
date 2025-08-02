
export type IdType = string;

export type Rotation = 0 | 90 | 180 | 270;

export interface BlockData {
    id: IdType;
    blockLibrary: string;
    blockType: string;
    label: string;
    x: number; y: number;
    rotation: Rotation;
    inputPorts: number; outputPorts: number;
    properties: Record<string, {type: string, value: any}>;
    blockRenderInformation?: BlockRenderInformation;
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
    masterLinkId?: IdType;
    branchNodeId?: IdType;
}

export interface JsonData {
    version: number;
    simulation_configuration: string;
    initialization_python_script_path: string;
    toolkit_configuration_path: string;
    blocks: BlockData[] | undefined;
    links: LinkData[] | undefined;
}

export type BlockShape = "square" | "triangle" | "circle";

export interface FigurePath {
    x_values: number[];
    y_values: number[];
    color?: string; // default: '#000000'
}

export interface BlockRenderFigure {
    paths: FigurePath[];
    show_grid?: boolean; // default: false
    show_axes?: boolean; // default: true
}

export interface BlockRenderInformation {
    shape: BlockShape;
    icon: string;
    figure?: BlockRenderFigure | null;
    text: string;
    show_image_and_text: boolean;

    default_width: number;
    default_height: number;
    min_width: number;
    min_height: number;
    max_width: number;
    max_height: number;

    input_ports: number;
    output_ports: number;
}
