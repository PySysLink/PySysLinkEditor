export interface BlockType {
  name: string;
  configurationValues?: Record<string, any>[];
}

export interface Library {
  name: string;
  blockTypes: BlockType[];
}
