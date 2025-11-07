import { get } from "http";
import { IdType, JsonData, BlockData, Rotation } from "./JsonTypes";
// import { updateLinksAfterBlockMove, updateLinksAfterBlockUpdate, updateLinksAfterMerge, updateLinksAfterNodesConsolidation, updateLinksAfterNodesUpdated } from "./LInkOrganization";
import { getNonce } from "./util";
import { Link, LinkJson, SegmentNode, TargetNodeInfo } from "./Link";
import { link } from "fs";

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

    // mergedJson = updateLinksSourceTargetPosition(mergedJson);

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

export function updateLinkInJson(json: JsonData, updatedLink: LinkJson): JsonData {
    console.log(`Updating link in JSON: ${JSON.stringify(updatedLink)}`);
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => (link.id === updatedLink.id ? updatedLink : link))
    };
    console.log(`Updated JSON links: ${JSON.stringify(updatedJson.links)}`);
    return updatedJson;
}


export function moveBlockInJson(json: JsonData, blockId: IdType, x: number, y: number, updateLinks: boolean = true): JsonData {
    const previousX = json.blocks?.find(b => b.id === blockId)?.x;
    const previousY = json.blocks?.find(b => b.id === blockId)?.y;

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

    if (previousX && previousY && (previousX !== x || previousY !== y)) {
        console.log(`Calling updateLinksSourceTargetPosition after moving block ${blockId}`);
        console.log(`Previous position: (${previousX}, ${previousY}), New position: (${x}, ${y})`);
        updatedJson = updateLinksSourceTargetPosition(updatedJson);
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

    console.log(`Calling updateLinksSourceTargetPosition after rotating block ${blockId}`);
    updatedJson = updateLinksSourceTargetPosition(updatedJson);

    return updatedJson;
}


export function updatePortAttachment(json: JsonData): JsonData {
    console.log("Attaching all links to ports...");
    let updatedJson = json;
    for (let link of json.links || []) {
        console.log(`Processing link source: ${link.id}, x: ${link.sourceX}, y: ${link.sourceY}`);
        const sourcePosition = getPortPosition(updatedJson, link.sourceId, "output", link.sourcePort);
        if (sourcePosition) {
            if (!isWithinDistance(sourcePosition, link.sourceX, link.sourceY, 10)) {
                console.log(`Source position differs from link source position. Moving source node.`);
                updatedJson = moveSourceNode(updatedJson, link.id, link.sourceX, link.sourceY, [], true);
            }
            else {
                updatedJson = moveSourceNode(updatedJson, link.id, sourcePosition.x, sourcePosition.y, [], true);
            }
        }
        else {
            console.log(`No source position found for link source: ${link.id}`);
            let port = checkIfPortInPosition(json, link.sourceX, link.sourceY, 10);

            if (port && port.portType === "output") {
                let portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
                if (portPosition) {
                    updatedJson = moveSourceNode(updatedJson, link.id, portPosition.x, portPosition.y, [], true);
                }
            }

            let linkPositionData = checkIfLinkInPosition(json, link.id, link.sourceX, link.sourceY, 10);
            if (linkPositionData && linkPositionData.linkId !== link.id) {
                console.log(`Link position data found for link source: ${link.id}, segmentId: ${linkPositionData.segmentId}. Moving source node to segment.`);
                updatedJson = moveSourceNode(updatedJson, link.id, link.sourceX, link.sourceY, [], true);
            }
        }
        for (const segmentId in link.targetNodes) {
            let targetInfo = link.targetNodes[segmentId];
            console.log(`Processing link target: ${link.id}, segmentId: ${segmentId}, x: ${targetInfo.x}, y: ${targetInfo.y}`);
            const targetPosition = getPortPosition(updatedJson, targetInfo.targetId, "input", targetInfo.port);
            if (targetPosition) {
                if (!isWithinDistance(targetPosition, link.targetNodes[segmentId].x, link.targetNodes[segmentId].y, 10)) {
                    console.log(`Target position differs from link target position. Moving target node.`);
                    updatedJson = moveTargetNode(updatedJson, link.id, segmentId, link.targetNodes[segmentId].x, link.targetNodes[segmentId].y, [], true);
                }
                else {
                    updatedJson = moveTargetNode(updatedJson, link.id, segmentId, targetPosition.x, targetPosition.y, [], true);
                }
            }
            else {
                console.log(`No target position found for link target: ${link.id}, segmentId: ${segmentId}`);
                let port = checkIfPortInPosition(json, link.targetNodes[segmentId].x, link.targetNodes[segmentId].y, 10);

                if (port && port.portType === "input") {
                    let portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
                    if (portPosition) {
                        updatedJson = moveTargetNode(updatedJson, link.id, segmentId, portPosition.x, portPosition.y, [], true);
                    }
                }
            }
        }
    }
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

export function getLimitsOfSegment(json: JsonData, linkId: IdType, segmentId: IdType): {before: {x: number, y: number}, after: {x: number, y: number}} | undefined {
    let linkJson = json.links?.find(l => l.id === linkId);
    if (linkJson) {
        let link = new Link(linkJson);
        return link.getLimitsOfSegment(segmentId);
    }
    return undefined;
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

export function updateLinksSourceTargetPosition(json: JsonData, selectedSelectableIds: IdType[] = []): JsonData {
    let updatedJson = json;
    for (let link of json.links || []) {
        const sourcePosition = getPortPosition(updatedJson, link.sourceId, "output", link.sourcePort);
        if (sourcePosition) {
            updatedJson = moveSourceNode(updatedJson, link.id, sourcePosition.x, sourcePosition.y, selectedSelectableIds);
        }
        for (const segmentId in link.targetNodes) {
            let targetInfo = link.targetNodes[segmentId];
            const targetPosition = getPortPosition(updatedJson, targetInfo.targetId, "input", targetInfo.port);
            if (targetPosition) {
                updatedJson = moveTargetNode(updatedJson, link.id, segmentId, targetPosition.x, targetPosition.y, selectedSelectableIds);
            }
        }
    }
    return updatedJson;
}


export function moveLinkSegment(json: JsonData, linkId: IdType, segmentId: IdType,
                                targetPositionX: number,
                                targetPositionY: number,
                                selectedSelectableIds: IdType[]): JsonData {
    let linkJson = json.links?.find(l => l.id === linkId);
    if (linkJson) {
        let link = new Link(linkJson);      
        link.moveLinkSegment(segmentId, targetPositionX, targetPositionY, selectedSelectableIds); 
        linkJson = link.toJson();
        let newJson = updateLinkInJson(json, linkJson);
        return newJson;
    }                  
    return json;
}

export function moveLinkNode(json: JsonData, linkId: IdType, beforeId: IdType, afterId: IdType,
                             targetPositionX: number,
                             targetPositionY: number,
                             selectedSelectableIds: IdType[]): JsonData {
    let linkJson = json.links?.find(l => l.id === linkId);
    if (linkJson) {
        let link = new Link(linkJson);      
        link.moveLinkNode(beforeId, afterId, targetPositionX, targetPositionY, selectedSelectableIds); 
        linkJson = link.toJson();
        let newJson = updateLinkInJson(json, linkJson);
        return newJson;
    }                  
    return json;
}

function moveFullSegmentNode(node: SegmentNode, deltaX: number, deltaY: number): SegmentNode {
    return {
        ...node,
        xOrY: node.orientation === "Horizontal"
            ? node.xOrY + deltaY
            : node.xOrY + deltaX,
        children: node.children.map(child => moveFullSegmentNode(child, deltaX, deltaY))
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
                segmentNode: moveFullSegmentNode(link.segmentNode, deltaX, deltaY)
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

export function checkIfLinkInPosition(json: JsonData, excludeLinkId: IdType, x: number, y: number, maxDistance: number): { linkId: IdType, segmentId: IdType } | undefined {
    if (!json.links) { return undefined; }

    console.log(`Checking for link segments near position (${x}, ${y}) with max distance ${maxDistance}`);

    function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
        const vx = bx - ax;
        const vy = by - ay;
        const wx = px - ax;
        const wy = py - ay;
        const vlen2 = vx * vx + vy * vy;
        if (vlen2 === 0) {
            // a and b are the same point
            const dx = px - ax;
            const dy = py - ay;
            return Math.sqrt(dx * dx + dy * dy);
        }
        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vlen2));
        const projx = ax + t * vx;
        const projy = ay + t * vy;
        const dx = px - projx;
        const dy = py - projy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    let best: { linkId: IdType, segmentId: IdType, dist: number } | undefined;

    for (const link of json.links) {
        if (link.id === excludeLinkId) { continue; }
        if (!link.segmentNode) { continue; }

        // traverse tree of segments (use the raw JSON segmentNode structure)
        const stack: SegmentNode[] = [link.segmentNode];
        while (stack.length > 0) {
            const node = stack.pop()!;
            // compute limits for this node using the existing helper
            const limits = getLimitsOfSegment(json, link.id, node.id);
            if (limits) {
                const d = pointToSegmentDistance(x, y, limits.before.x, limits.before.y, limits.after.x, limits.after.y);
                if (d <= maxDistance) {
                    if (!best || d < best.dist) {
                        best = { linkId: link.id, segmentId: node.id, dist: d };
                    }
                }
            }
            for (const child of node.children || []) {
                stack.push(child);
            }
        }
    }

    console.log(`Best link segment found: ${best ? JSON.stringify(best) : 'none'}`);

    if (!best) { return undefined; }
    return { linkId: best.linkId, segmentId: best.segmentId };
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
    let finalLinkPositionData: { linkId: string; segmentId: string; } | undefined = undefined;

    console.log (`Link position data attachLinkToPort: ${attachLinkToPort}`);
    if (attachLinkToPort) {
        let port = checkIfPortInPosition(json, x, y, 10);
        console.log(`Port found when moving source node: ${JSON.stringify(port)}`);
        if (port && port.portType === "output") {
            let portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
            if (portPosition) {
                finalX = portPosition.x;
                finalY = portPosition.y;
                finalId = port.blockId;
                finalPort = port.portIndex;
            }
        }

        if (!port) {
            console.log(`No port found when moving source node, checking for link position data...`);
            let linkPositionData = checkIfLinkInPosition(json, linkId, x, y, 10);
            console.log(`Link position data when moving source node: ${JSON.stringify(linkPositionData)}`);
            if (linkPositionData && linkPositionData.linkId !== linkId) {
                finalLinkPositionData = linkPositionData;
            }
        }
    }

    const linkData = json.links?.find(l => l.id === linkId);
    if (!linkData) {
        return json;
    }

    console.log(`Link json before moving source node: ${JSON.stringify(linkData)}`);

    let link = new Link(linkData);
    link.moveSourceNode(finalX, finalY);

    let linkJson = link.toJson();

    console.log(`Resulting link json after moving source node: ${JSON.stringify(linkJson)}`);

    console.log(`MoveSourceNode - attachLinkToPort: ${attachLinkToPort}, finalId: ${finalId}, finalPort: ${finalPort}, x: ${finalX}, y: ${finalY}`);

    if (attachLinkToPort) {
        if (finalLinkPositionData) {
            let mergedLink = new Link(linkJson);
            let receivingLinkData = json.links?.find(l => l.id === finalLinkPositionData.linkId);
            if (!receivingLinkData) {
                return json;
            }
            let receivingLink = new Link(receivingLinkData);
            let mergeX = receivingLink.segmentNode.orientation === "Horizontal"
                ? x
                : receivingLink.segmentNode.xOrY;
            let mergeY = receivingLink.segmentNode.orientation === "Horizontal"
                ? receivingLink.segmentNode.xOrY
                : y;
            receivingLink.insertLinkBranch(mergedLink, finalLinkPositionData.segmentId, mergeX, mergeY);

            json = deleteLinkFromJson(json, mergedLink.id);

            linkJson = receivingLink.toJson();
        }
        else {
            linkJson.sourceId = finalId;
            linkJson.sourcePort = finalPort;
        }
    }

    let updatedJson = updateLinkInJson(json, linkJson);
    return updatedJson;
}

export function moveTargetNode(
    json: JsonData,
    linkId: IdType,
    segmentIdOfNode: IdType,
    x: number,
    y: number,
    selectedSelectableIds: IdType[],
    attachLinkToPort: boolean = false
): JsonData {
    // --- 1. Get link and attached target block ---
    const linkData = json.links?.find(link => link.id === linkId);
    if (!linkData) {return json;}

    const attachedBlock = linkData.targetNodes?.[segmentIdOfNode]?.targetId;
    if (attachedBlock && selectedSelectableIds.includes(attachedBlock)) {
        return json; // Do not move if the target block is selected
    }

    let finalX = x;
    let finalY = y;
    let finalId: IdType = "undefined";
    let finalPort = -1;

    if (attachLinkToPort) {
        const port = checkIfPortInPosition(json, x, y, 10);
        if (port && port.portType === "input") {
            const portPosition = getPortPosition(json, port.blockId, port.portType, port.portIndex);
            if (portPosition) {
                finalX = portPosition.x;
                finalY = portPosition.y;
                finalId = port.blockId;
                finalPort = port.portIndex;
            }
        }
    }

    console.log(`Link json before moving target node: ${JSON.stringify(linkData)}`);

    let link = new Link(linkData);
    link.moveTargetNode(segmentIdOfNode, finalX, finalY);

    let linkJson = link.toJson();

    console.log(`Resulting link json after moving target node: ${JSON.stringify(linkJson)}`);

    console.log(`MoveTargetNode - attachLinkToPort: ${attachLinkToPort}, finalId: ${finalId}, finalPort: ${finalPort}, x: ${finalX}, y: ${finalY}`);
    if (attachLinkToPort) {
        linkJson.targetNodes[segmentIdOfNode].targetId = finalId;
        linkJson.targetNodes[segmentIdOfNode].port = finalPort;
    }
    
    let updatedJson = updateLinkInJson(json, linkJson);
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

export function rotateLinkSegmentClockwise(json: JsonData, linkId: IdType, segmentId: IdType, centerX: number, centerY: number, updateLinks: boolean = true): JsonData {
    return json;
}

export function rotateLinkSegmentCounterClockwise(json: JsonData, linkId: IdType, segmentId: IdType, centerX: number, centerY: number, updateLinks: boolean = true): JsonData {
    return json;
}