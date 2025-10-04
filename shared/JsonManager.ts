import { get } from "http";
import { IdType, JsonData, BlockData, Rotation, IntermediateSegment } from "./JsonTypes";
// import { updateLinksAfterBlockMove, updateLinksAfterBlockUpdate, updateLinksAfterMerge, updateLinksAfterNodesConsolidation, updateLinksAfterNodesUpdated } from "./LInkOrganization";
import { getNonce } from "./util";
import { Link, LinkJson, SegmentNode, TargetNodeInfo } from "./Link";

export function MergeJsons(
    jsonBase: JsonData,
    jsonChildPriority: JsonData,
    jsonChild2: JsonData,
    updateLinks: boolean = true
): JsonData {
    let mergedJson: JsonData = {
        version: Math.max(jsonBase.version, jsonChildPriority.version, jsonChild2.version),
        simulation_configuration: "",
        initialization_python_script_path: "",
        toolkit_configuration_path: "",
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

    function addId(value: any) {
        return {id: "dummy", value: value};
    }
    mergedJson.simulation_configuration = mergeObject(addId(jsonBase.simulation_configuration),
                                                    addId(jsonChildPriority.simulation_configuration),
                                                    addId(jsonChild2.simulation_configuration)).value;
                                                    
    mergedJson.initialization_python_script_path = mergeObject(addId(jsonBase.initialization_python_script_path),
                                                    addId(jsonChildPriority.initialization_python_script_path),
                                                    addId(jsonChild2.initialization_python_script_path)).value;

    mergedJson = updateLinksSourceTargetPosition(mergedJson);

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
            for (const segmentId in link.targetNodes) {
                const targetInfo = link.targetNodes[segmentId];
                if (targetInfo.targetId === blockId) {
                    targetInfo.targetId = "undefined";
                    targetInfo.port = -1;
                }
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

export function addLinkToJson(json: JsonData, link: LinkJson): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: [...(json.links || []), link]
    };
    return updatedJson;
}

export function deleteLinkFromJson(json: JsonData, linkId: IdType): JsonData {
  if (!json.links) {
    return json;
  }

  return {
    ...json,
    links: json.links.filter(link => link.id !== linkId)
  };
}


export function updateBlockFromJson(json: JsonData, updatedBlock: BlockData, updateLinks: boolean = true): JsonData {
    let updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block => (block.id === updatedBlock.id ? updatedBlock : block))
    };
    updatedJson = updateLinksSourceTargetPosition(updatedJson);

    return updatedJson;
}

export function updateLinkInJson(json: JsonData, updatedLink: LinkJson): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => (link.id === updatedLink.id ? updatedLink : link))
    };
    return updatedJson;
}


export function moveBlockInJson(json: JsonData, blockId: IdType, x: number, y: number, updateLinks: boolean = true): JsonData {
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

    return updatedJson;
}

export function rotateBlock(json: JsonData, blockId: IdType, rotation: Rotation, updateLinks: boolean = true): JsonData {
    let updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block => {
            if (block.id === blockId) {
                return {
                    ...block,
                    rotation: rotation
                };
            }
            return block;
        })
    };

    updatedJson = updateLinksSourceTargetPosition(updatedJson);

    return updatedJson;
}


export function attachLinkToPort(json: JsonData, linkId: IdType, segmentId: IdType, blockId: IdType, portType: "input" | "output", portIndex: number): JsonData {
    let link = json.links?.find(l => l.id === linkId);
    if (link) {
        if (portType === "input") {
            link.targetNodes[segmentId].targetId = blockId;
            link.targetNodes[segmentId].port = portIndex;
            link.targetNodes[segmentId].x = getPortPosition(json, blockId, portType, portIndex)?.x || 0;
            link.targetNodes[segmentId].y = getPortPosition(json, blockId, portType, portIndex)?.y || 0;
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

export function createNewChildLinkFromNode(json: JsonData, linkId: IdType, previousSegmentId: IdType, nextSegmentId: IdType): [JsonData, IdType | undefined] {
    let linkJson = json.links?.find(l => l.id === linkId);
    if (linkJson) {
        let link = new Link(linkJson);
        let segmentNode = link.createNewChildLinkFromNode(previousSegmentId, nextSegmentId);
        if (!segmentNode) {return [json, undefined];}
        linkJson = link.toJson();
        let newJson = updateLinkInJson(json, linkJson);
        return [newJson, segmentNode.id];
    }
    return [json, undefined];
}

export function createNewChildLinkFromSegment(json: JsonData, linkId: IdType, segmentId: IdType, clickX: number, clickY: number): [JsonData, IdType | undefined] {
    let linkJson = json.links?.find(l => l.id === linkId);
    if (linkJson) {
        let link = new Link(linkJson);
        let segmentNode = link.createNewChildLinkFromSegment(linkId, segmentId, clickX, clickY);
        if (!segmentNode) {return [json, undefined];}
        linkJson = link.toJson();
        let newJson = updateLinkInJson(json, linkJson);
        return [newJson, segmentNode.id];
    }
    return [json, undefined];
}

export function getPortPosition(
    json: JsonData,
    blockId: IdType,
    portType: "input" | "output",
    portIndex: number,
    ignoreRotation: boolean = false
): { x: number; y: number } | undefined {
    const portSpacing = 20;  // vertical spacing between ports
    const blockWidth = 120;
    const blockHeight = 50;

    if (!json) {return undefined;}

    const block = json.blocks?.find(b => b.id === blockId);
    if (!block) {return undefined;}

    const totalPorts = portType === "input" ? block.inputPorts : block.outputPorts;

    // Calculate center-based y-offset
    const totalSpan = (totalPorts - 1) * portSpacing;
    const yOffset = portIndex * portSpacing - totalSpan / 2;

    // Unrotated position
    const localX = portType === "input" ? 0 : blockWidth;
    const localY = blockHeight / 2 + yOffset;

    let rotation = block.rotation ?? 0;
    if (ignoreRotation) {
        rotation = 0; 
    }

    // Rotate point around the center of the block
    const cx = block.x + blockWidth / 2;
    const cy = block.y + blockHeight / 2;

    let dx = localX - blockWidth / 2;
    let dy = localY - blockHeight / 2;

    let rotatedX: number, rotatedY: number;

    switch (rotation) {
        case 0:
            rotatedX = dx;
            rotatedY = dy;
            break;
        case 90:
            rotatedX = -dy;
            rotatedY = dx;
            break;
        case 180:
            rotatedX = -dx;
            rotatedY = -dy;
            break;
        case 270:
            rotatedX = dy;
            rotatedY = -dx;
            break;
        default:
            rotatedX = dx;
            rotatedY = dy;
    }

    return {
        x: cx + rotatedX,
        y: cy + rotatedY
    };
}

export function updateLinksSourceTargetPosition(json: JsonData): JsonData {
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            const sourcePosition = getPortPosition(json, link.sourceId, "output", link.sourcePort);
            if (sourcePosition) {
                link.sourceX = sourcePosition.x;
                link.sourceY = sourcePosition.y;
            }
            for (const segmentId in link.targetNodes) {
                let targetInfo = link.targetNodes[segmentId];
                const targetPosition = getPortPosition(json, targetInfo.targetId, "input", targetInfo.port);
                if (targetPosition) {
                    targetInfo.x = targetPosition.x;
                    targetInfo.y = targetPosition.y;
                }
            }
            return link;
        })
    };
    return updatedJson;
}


function moveSegmentNode(node: SegmentNode, deltaX: number, deltaY: number): SegmentNode {
    return {
        ...node,
        xOrY: node.orientation === "Horizontal"
            ? node.xOrY + deltaY
            : node.xOrY + deltaX,
        children: node.children.map(child => moveSegmentNode(child, deltaX, deltaY))
    };
}

export function moveLinkDelta(
    json: JsonData,
    linkId: IdType,
    deltaX: number,
    deltaY: number
): JsonData {
    return {
        ...json,
        links: json.links?.map(link => {
            if (link.id !== linkId) {return link;}

            // Move target nodes
            const updatedTargetNodes: { [segmentId: string]: TargetNodeInfo } = {};
            for (const segmentId in link.targetNodes) {
                const targetInfo = link.targetNodes[segmentId];
                updatedTargetNodes[segmentId] = {
                    ...targetInfo,
                    x: targetInfo.x + deltaX,
                    y: targetInfo.y + deltaY
                };
            }

            return {
                ...link,
                sourceX: link.sourceX + deltaX,
                sourceY: link.sourceY + deltaY,
                targetNodes: updatedTargetNodes,
                segmentNode: moveSegmentNode(link.segmentNode, deltaX, deltaY)
            };
        })
    };
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

export function moveSourceNode(json: JsonData, linkId: IdType, x: number, y: number, selectedSelectableIds: IdType[], attachLinkToPort: boolean=false): JsonData {
    let attachedBlock = json.links?.find(link => link.id === linkId)?.sourceId;
    if (attachedBlock) {
        if (selectedSelectableIds.includes(attachedBlock)) {
            return json; // Do not move if the source node is selected
        }
    }

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

    const initialX = json.links?.find(link => link.id === linkId)?.sourceX || 0;
    const initialY = json.links?.find(link => link.id === linkId)?.sourceY || 0;

        
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

// export function moveTargetNode(json: JsonData, linkId: IdType, x: number, y: number, selectedSelectableIds: IdType[], attachLinkToPort: boolean=false): JsonData {
//     let attachedBlock = json.links?.find(link => link.id === linkId)?.targetId;
//     if (attachedBlock) {
//         if (selectedSelectableIds.includes(attachedBlock)) {
//             return json; // Do not move if the source node is selected
//         }
//     }

//     let finalX = x;
//     let finalY = y;
//     let finalId = "undefined";
//     let finalPort = -1;

//     if (attachLinkToPort) {
//         let port = checkIfPortInPosition(json, x, y, 10);

//         if (port && port.portType === "input") {
//             let portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
//             if (portPosition) {
//                 finalX = portPosition.x;
//                 finalY = portPosition.y;
//                 finalId = port.blockId;
//                 finalPort = port.portIndex;
//             }
//         }
//     }
    
//     let updatedJson: JsonData = {
//         ...json,
//         links: json.links?.map(link => {
//             if (link.id === linkId) {
//                 link.targetId = finalId;
//                 link.targetPort = finalPort;
//                 link.targetX = finalX;
//                 link.targetY = finalY;
//             }
//             return link;
//         })
//     };
//     return updatedJson;
// }


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