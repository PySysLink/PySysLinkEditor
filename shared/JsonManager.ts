import { IdType, JsonData, BlockData, LinkData, Rotation } from "./JsonTypes";
import { updateLinksAfterBlockMove, updateLinksAfterBlockUpdate, updateLinksAfterMerge, updateLinksAfterNodesConsolidation, updateLinksAfterNodesUpdated } from "./LInkOrganization";

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

    if (updateLinks) {
        mergedJson = updateLinksAfterMerge(mergedJson);
    }

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
  if (!json.links) {
    return json;
  }

  // Find the link the user wants to delete
  const target = json.links.find(l => l.id === linkId);
  if (!target) {
    return json; // nothing to delete
  }

  // Determine the “master” link whose entire branch we should remove
  // If the target is a slave, its master is target.masterLinkId
  // Otherwise the target is itself the master
  const masterId = target.masterLinkId ?? target.id;

  // Keep only links that are neither the master nor one of its slaves
  const filtered = json.links.filter(l =>
    l.id !== masterId && l.masterLinkId !== masterId
  );

  return { ...json, links: filtered };
}

export function deleteIntermediateNodeFromJson(json: JsonData, intermediateNodeId: IdType): JsonData {
    if (!json.links) {
        return json;
    }

    // 1. Find the link that contains this intermediate node
    const parentLink = json.links.find(link =>
        link.intermediateNodes.some(node => node.id === intermediateNodeId)
    );
    if (!parentLink) {
        // nothing to delete
        return json;
    }

    const nodes = parentLink.intermediateNodes;
    const idx = nodes.findIndex(node => node.id === intermediateNodeId);
    const len = nodes.length;

    // 2. Determine replacement branch node:
    //    previous if available, else next, else cancel
    let replacementNodeId: IdType | undefined;
    if (idx > 0) {
        replacementNodeId = nodes[idx - 1].id;
    } else if (idx + 1 < len) {
        replacementNodeId = nodes[idx + 1].id;
    } else {
        // this was the only intermediate node — undefined for future abortion
        replacementNodeId = undefined;
    }

    for (const link of json.links) {
        if (link.branchNodeId !== undefined && link.branchNodeId === intermediateNodeId) {
            // 3. Update branch node ID to replacement node ID
            if (replacementNodeId === undefined) {
                // If no replacement node, cancel the deletion
                return json;
            } else {
                link.branchNodeId = replacementNodeId;
            }
        }
    }

    // 4. Remove the intermediate node from the parent link
    const updatedJson: JsonData = {
        ...json,
        links: json.links.map(link => {
            if (link.id === parentLink.id) {
                return {
                    ...link,
                    intermediateNodes: link.intermediateNodes.filter(node => node.id !== intermediateNodeId)
                };
            }
            return link;
        })
    };
    return updatedJson;
}

export function setPositionForLinkNode(json: JsonData, linkId: IdType, nodeId: IdType, x: number, y: number): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.id === linkId) {
                const nodeIndex = link.intermediateNodes.findIndex(node => node.id === nodeId);
                if (nodeIndex !== -1) {
                    link.intermediateNodes[nodeIndex] = { id: nodeId, x: x, y: y };
                }
            }
            return link;
        })
    };
    return updatedJson;
}

export function updateBlockFromJson(json: JsonData, updatedBlock: BlockData, updateLinks: boolean = true): JsonData {
    let updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block => (block.id === updatedBlock.id ? updatedBlock : block))
    };
    updatedJson = updateLinksSourceTargetPosition(updatedJson);
    if (updateLinks) {
        updatedJson = updateLinksAfterBlockUpdate(updatedJson, updatedBlock.id);
    }
    return updatedJson;
}

export function updateLinkInJson(json: JsonData, updatedLink: LinkData): JsonData {
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
    if (updateLinks) {
        updatedJson = updateLinksAfterBlockMove(updatedJson, blockId);
    }
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

    if (updateLinks) {
        updatedJson = updateLinksAfterBlockMove(updatedJson, blockId);
    }
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

export function updateChildLinksSourcePosition(json: JsonData): JsonData {
    if (!json.links) {return json;}

    json.links.forEach(link => {
        if (link.masterLinkId) {
            if (!link.branchNodeId) {
                console.warn(`Link ${link.id} has masterLinkId but no branchNodeId, skipping dog leg update.`);
            } else {
                console.warn(`Link ${link.id} has masterLinkId ${link.masterLinkId} and branchNodeId ${link.branchNodeId}, updating source position to match reference branch node.`);
                const referenceLink = json.links?.find(l => l.id === link.masterLinkId);
                if (!referenceLink) {
                    console.warn(`Master link ${link.masterLinkId} not found for link ${link.id}, skipping dog leg update.`);
                } else {
                    const referenceBranchNode = referenceLink.intermediateNodes?.find(n => n.id === link.branchNodeId);
                    if (!referenceBranchNode) {
                        console.warn(`Branch node ${link.branchNodeId} not found in master link ${link.masterLinkId}, skipping dog leg update for link ${link.id}.`);
                    } else {
                        // Use the reference branch node position for the source node
                        link.sourceX = referenceBranchNode.x;
                        link.sourceY = referenceBranchNode.y;
                        console.log(`Link ${link.id} source position updated to reference branch node: (${link.sourceX}, ${link.sourceY})`);
                    }
                }
            }
        }
    });

    return json;
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