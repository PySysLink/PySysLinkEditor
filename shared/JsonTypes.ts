import { LinkJson } from "./Link";

export type IdType = string;

export type Rotation = 0 | 90 | 180 | 270;
export type Orientation = "Horizontal" | "Vertical";

export enum FullySupportedSignalValueType {
    Int = "int",
    Double = "double",
    Bool = "bool",
    ComplexDouble = "complex_double",
    String = "string"
}

export enum PortCategory {
    fully_supported_signal_value = "FullySupportedSignalValue",
    enumeration = "Enumeration",
    structure = "Structure",
    pointer_to_object = "PointerToObject",
    other_type = "OtherType",
    inherited = "Inherited",
    unknown = "Unknown"
}

export interface PortType {
    port_category: PortCategory;
    signal_value_type?: FullySupportedSignalValueType;
    enumeration_name?: string;
    structure_name?: string;
    pointing_object_class_name?: string;
    other_type_name?: string;
    supported_port_types_for_inheritance?: PortType[];
}

export interface BlockData {
    id: IdType;
    blockLibrary: string;
    blockType: string;
    label: string;
    x: number; y: number;
    rotation: Rotation;
    inputPorts: number; outputPorts: number;
    inputPortTypes: PortType[]; outputPortTypes: PortType[];
    properties: Record<string, {type: string, value: any}>;
    blockRenderInformation?: BlockRenderInformation;
}

export interface JsonData {
    version: number;
    simulation_configuration: string;
    initialization_python_script_path: string;
    toolkit_configuration_path: string;
    blocks: BlockData[] | undefined;
    links: LinkJson[] | undefined;
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

    input_port_types: PortType[];
    output_port_types: PortType[];
}
