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
}

export interface Library {
  name: string;
  blockTypes: BlockType[];
}