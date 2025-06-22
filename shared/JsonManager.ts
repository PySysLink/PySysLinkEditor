import { IdType, JsonData, BlockData, LinkData } from "./JsonTypes";
import { updateLinksAfterBlockMove, updateLinksAfterBlockUpdate, updateLinksAfterMerge, updateLinksAfterNodesConsolidation, updateLinksAfterNodesUpdated } from "./LInkOrganization";

export function MergeJsons(
    jsonBase: JsonData,
    jsonChildPriority: JsonData,
    jsonChild2: JsonData
): JsonData {
    let mergedJson: JsonData = {
        version: Math.max(jsonBase.version, jsonChildPriority.version, jsonChild2.version),
        simulation_configuration: "",
        blocks: [],
        links: [],
    };

    // Helper function to merge individual objects (blocks or links) property by property
    function mergeObject<T extends { id: IdType }>(
        base: T | undefined,
        priority: T | undefined,
        secondary: T | undefined
    ): T {
        const merged: T = { ...base } as T;

        // Merge properties from the secondary JSON
        if (secondary) {
            for (const key in secondary) {
                if (secondary[key] !== undefined) {
                    merged[key] = secondary[key];
                }
            }
        }

        // Merge properties from the priority JSON (overwrites secondary)
        if (priority) {
            for (const key in priority) {
                if (priority[key] !== undefined) {
                    merged[key] = priority[key];
                }
            }
        }

        return merged;
    }

    // Helper function to merge arrays of blocks or links
    function mergeArray<T extends { id: IdType }>(
        baseArray: T[] | undefined,
        priorityArray: T[] | undefined,
        secondaryArray: T[] | undefined
    ): T[] {
        const result: T[] = [];
        const seenIds = new Set<IdType>();

        // Add or merge items from the base array
        baseArray?.forEach(baseItem => {
            const priorityItem = priorityArray?.find(item => item.id === baseItem.id);
            const secondaryItem = secondaryArray?.find(item => item.id === baseItem.id);
            if (priorityItem || secondaryItem) {
                result.push(mergeObject(baseItem, priorityItem, secondaryItem));
                seenIds.add(baseItem.id);
            }
        });

        // Add or merge items from the priority array that are not in the base array
        priorityArray?.forEach(priorityItem => {
            if (!seenIds.has(priorityItem.id)) {
                const secondaryItem = secondaryArray?.find(item => item.id === priorityItem.id);
                result.push(mergeObject(undefined, priorityItem, secondaryItem));
                seenIds.add(priorityItem.id);
            }
        });

        // Add items from the secondary array that are not in the base or priority arrays
        secondaryArray?.forEach(secondaryItem => {
            if (!seenIds.has(secondaryItem.id)) {
                result.push(mergeObject(undefined, undefined, secondaryItem));
                seenIds.add(secondaryItem.id);
            }
        });

        return result;
    }

    // Merge blocks
    mergedJson.blocks = mergeArray(
        jsonBase.blocks,
        jsonChildPriority.blocks,
        jsonChild2.blocks
    );

    // Merge links
    mergedJson.links = mergeArray(
        jsonBase.links,
        jsonChildPriority.links,
        jsonChild2.links
    );

    mergedJson = updateLinksSourceTargetPosition(mergedJson);

    mergedJson = updateLinksAfterMerge(mergedJson);


    return mergedJson;
}

export function deleteBlockFromJson(json: JsonData, blockId: IdType): JsonData {
    let updatedLinks = json.links;
    if (updatedLinks) {
        updatedLinks.forEach(link => {
            if (link.sourceId === blockId) {
                link.sourceId = "undefined";
                link.sourcePort = -1;
            }
            if (link.targetId === blockId) {
                link.targetId = "undefined";
                link.targetPort = -1;
            }
        });
    }
    const updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.filter(block => block.id !== blockId),
        links: updatedLinks
    };
    console.log(`Removed block: ${blockId}`);
    console.log(json);
    console.log(updatedJson);
    return updatedJson;
}

export function addBlockToJson(json: JsonData, block: BlockData): JsonData {
    const updatedJson: JsonData = {
        ...json,
        blocks: [...(json.blocks || []), block]
    };
    return updatedJson;
}

export function addLinkToJson(json: JsonData, link: LinkData): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: [...(json.links || []), link]
    };
    return updatedJson;
}

export function deleteLinkFromJson(json: JsonData, linkId: IdType): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.filter(link => link.id !== linkId)
    };
    return updatedJson;
}

export function deleteIntermediateNodeFromJson(json: JsonData, intermediateNodeId: IdType): JsonData {
    const updatedLinks = json.links?.map(link => {
        // Remove the intermediate node from this link's intermediateNodes array
        return {
            ...link,
            intermediateNodes: link.intermediateNodes
                ? link.intermediateNodes.filter(node => node.id !== intermediateNodeId)
                : []
        };
    });

    return {
        ...json,
        links: updatedLinks
    };
}

export function updateBlockFromJson(json: JsonData, updatedBlock: BlockData): JsonData {
    let updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block => (block.id === updatedBlock.id ? updatedBlock : block))
    };
    updatedJson = updateLinksSourceTargetPosition(updatedJson);
    updatedJson = updateLinksAfterBlockUpdate(updatedJson, updatedBlock.id);
    return updatedJson;
}

export function updateLinkInJson(json: JsonData, updatedLink: LinkData): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => (link.id === updatedLink.id ? updatedLink : link))
    };
    return updatedJson;
}


export function moveBlockInJson(json: JsonData, blockId: IdType, x: number, y: number): JsonData {
    let updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block => {
            if (block.id === blockId) {
                return {
                    ...block,
                    x: x,  
                    y: y
                };
            }
            return block;
        })
    };

    updatedJson = updateLinksSourceTargetPosition(updatedJson);

    updatedJson = updateLinksAfterBlockMove(updatedJson, blockId);
    return updatedJson;
}

export function attachLinkToPort(json: JsonData, linkId: IdType, blockId: IdType, portType: "input" | "output", portIndex: number): JsonData {
    let link = json.links?.find(l => l.id === linkId);
    if (link) {
        if (portType === "input") {
            link.targetId = blockId;
            link.targetPort = portIndex;
            link.targetX = getPortPosition(json, blockId, portType, portIndex)?.x || 0;
            link.targetY = getPortPosition(json, blockId, portType, portIndex)?.y || 0;
        } else {
            link.sourceId = blockId;
            link.sourcePort = portIndex;
            link.sourceX = getPortPosition(json, blockId, portType, portIndex)?.x || 0;
            link.sourceY = getPortPosition(json, blockId, portType, portIndex)?.y || 0;
        }
        let newJson = updateLinkInJson(json, link);
        return newJson;
    }
    return json;
}

export function getPortPosition(json: JsonData, blockId: IdType, portType: "input" | "output", portIndex: number): { x: number, y: number } | undefined {
        const portSpacing = 20; // Spacing between ports
        const blockWidth = 120;
        const portOffset = portIndex * portSpacing;
        
        if (json) {
            let block = json.blocks?.find(b => b.id === blockId);
            if (block) {
                if (portType === "input") {
                    return { x: block.x, y: block.y + portOffset + 20 };
                } else {
                    return { x: block.x + blockWidth, y: block.y + portOffset + 20 };
                }
            }
        }
        return undefined;
    };

export function updateLinksSourceTargetPosition(json: JsonData): JsonData {
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            const sourcePosition = getPortPosition(json, link.sourceId, "output", link.sourcePort);
            if (sourcePosition) {
                link.sourceX = sourcePosition.x;
                link.sourceY = sourcePosition.y;
            }
            const targetPosition = getPortPosition(json, link.targetId, "input", link.targetPort);
            if (targetPosition) {
                link.targetX = targetPosition.x;
                link.targetY = targetPosition.y;
            }
            return link;
        })
    };
    return updatedJson;
}


export function consolidateLinkNodes(json: JsonData): JsonData {
    json = updateLinksAfterNodesConsolidation(json);
    return json;
}

export function moveLinkDelta(json: JsonData, linkId: IdType, deltaX: number, deltaY: number): JsonData {
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.id === linkId) {
                link.sourceX += deltaX;
                link.sourceY += deltaY;
                link.targetX += deltaX;
                link.targetY += deltaY;
                link.intermediateNodes = link.intermediateNodes.map(node => {
                    node.x += deltaX;
                    node.y += deltaY;
                    return node;
                });
            }
            return link;
        })
    };
    return updatedJson;
}

export function checkIfPortInPosition(json: JsonData, x: number, y: number, maxDistance: number): { blockId: IdType, portType: 'input' | 'output', portIndex: number } | undefined {
    if (!json.blocks) {
        return undefined; // No blocks to check
    }

    for (const block of json.blocks) {
        // Check input ports
        for (let i = 0; i < block.inputPorts; i++) {
            const portPosition = getPortPosition(json, block.id, 'input', i);
            if (portPosition && isWithinDistance(portPosition, x, y, maxDistance)) {
                return { blockId: block.id, portType: 'input', portIndex: i };
            }
        }

        // Check output ports
        for (let i = 0; i < block.outputPorts; i++) {
            const portPosition = getPortPosition(json, block.id, 'output', i);
            if (portPosition && isWithinDistance(portPosition, x, y, maxDistance)) {
                return { blockId: block.id, portType: 'output', portIndex: i };
            }
        }
    }

    return undefined; // No port found within the specified distance
}

function isWithinDistance(
    portPosition: { x: number, y: number },
    x: number,
    y: number,
    maxDistance: number
): boolean {
    const dx = portPosition.x - x;
    const dy = portPosition.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= maxDistance;
}

export function moveSourceNode(json: JsonData, linkId: IdType, x: number, y: number, attachLinkToPort: boolean=false): JsonData {
    let finalX = x;
    let finalY = y;
    let finalId = "undefined";
    let finalPort = -1;
    if (attachLinkToPort) {
        let port = checkIfPortInPosition(json, x, y, 10);

        if (port && port.portType === "output") {
            let portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
            if (portPosition) {
                finalX = portPosition.x;
                finalY = portPosition.y;
                finalId = port.blockId;
                finalPort = port.portIndex;
            }
        }
    }
        
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.id === linkId) {
                link.sourceId = finalId;
                link.sourcePort = finalPort;
                link.sourceX = finalX;
                link.sourceY = finalY;
            }
            return link;
        })
    };
    return updatedJson;
}
export function moveTargetNode(json: JsonData, linkId: IdType, x: number, y: number, attachLinkToPort: boolean=false): JsonData {
    let finalX = x;
    let finalY = y;
    let finalId = "undefined";
    let finalPort = -1;

    if (attachLinkToPort) {
        let port = checkIfPortInPosition(json, x, y, 10);

        if (port && port.portType === "input") {
            let portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
            if (portPosition) {
                finalX = portPosition.x;
                finalY = portPosition.y;
                finalId = port.blockId;
                finalPort = port.portIndex;
            }
        }
    }
    
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.id === linkId) {
                link.targetId = finalId;
                link.targetPort = finalPort;
                link.targetX = finalX;
                link.targetY = finalY;
            }
            return link;
        })
    };
    return updatedJson;
}

export function updateBlockParameters(json: JsonData, updatedBlock: BlockData): JsonData {
    const updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block =>
            block.id === updatedBlock.id
                ? { ...block, ...updatedBlock }
                : block
        )
    };
    return updatedJson;
}

export function getBlockData(json: JsonData, blockId: IdType): BlockData | undefined {
    return json.blocks?.find(block => block.id === blockId);
}