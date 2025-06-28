export interface BlockConfigurationValue {
  name: string;
  defaultValue: any;
  type: string;
}

export interface BlockType {
  name: string;
  configurationValues?: { [name: string]: BlockConfigurationValue };
}

export interface Library {
  name: string;
  blockTypes: BlockType[];
}