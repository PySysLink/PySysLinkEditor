export interface Block {
    id: string;
    label: string;
    x: number;
    y: number;
    blockType: string;
    blockClass: string;
    inputPorts: number;
    outputPorts: number;
    properties: { [key: string]: any };
}

// Define metadata for block types and classes
const blockMetadata: {
    [blockType: string]: {
        [blockClass: string]: {
            inputPorts: number;
            outputPorts: number;
            properties: { [key: string]: any };
        };
    };
} = {
    defaultType: {
        defaultClass: {
            inputPorts: 1,
            outputPorts: 1,
            properties: {
                value: 0,
                gain: 1
            }
        }
    },
    advancedType: {
        mathClass: {
            inputPorts: 2,
            outputPorts: 1,
            properties: {
                operation: 'add',
                precision: 2
            }
        }
    }
};

// Initialize block metadata based on its type and class
export function initializeBlockMetadata(block: Block): void {
    const typeMetadata = blockMetadata[block.blockType];
    if (!typeMetadata) {
        console.warn(`Unknown block type: ${block.blockType}`);
        return;
    }

    const classMetadata = typeMetadata[block.blockClass];
    if (!classMetadata) {
        console.warn(`Unknown block class: ${block.blockClass}`);
        return;
    }

    block.inputPorts = classMetadata.inputPorts;
    block.outputPorts = classMetadata.outputPorts;
    block.properties = { ...classMetadata.properties };
}