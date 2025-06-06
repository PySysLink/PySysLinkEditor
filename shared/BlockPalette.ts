export interface BlockConfigurationValue {
  name: string;
  defaultValue: any;
  type: string;
}

export interface BlockType {
  name: string;
  configurationValues?: BlockConfigurationValue[];
}

export interface Library {
  name: string;
  blockTypes: BlockType[];
}