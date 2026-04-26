import { PortType } from "./JsonTypes";

export interface BlockConfigurationValue {
  name: string;
  defaultValue: any;
  type: string;
}

export interface BlockType {
  name: string;
  configurationValues?: { [name: string]: BlockConfigurationValue };
  inputPortNumber: number;
  outputPortNumber: number;
  inputPortTypes: PortType[];
  outputPortTypes: PortType[];
}

export interface Library {
  name: string;
  blockTypes: BlockType[];
}