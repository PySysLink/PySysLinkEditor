import { get } from "http";
import { IdType, JsonData, BlockData, LinkData, Rotation, IntermediateSegment } from "./JsonTypes";
import { updateLinksAfterBlockMove, updateLinksAfterBlockUpdate, updateLinksAfterMerge, updateLinksAfterNodesConsolidation, updateLinksAfterNodesUpdated } from "./LInkOrganization";
import { getNonce } from "./util";

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

  // Collect all descendant link IDs to delete (iteratively)
  const toDelete = new Set<IdType>();
  const queue: IdType[] = [linkId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    toDelete.add(currentId);
    json.links.forEach(link => {
      if (link.masterLinkId === currentId && !toDelete.has(link.id)) {
        queue.push(link.id);
      }
    });
  }

  // Filter out the link itself and all its descendants
  const filtered = json.links.filter(l => !toDelete.has(l.id));
  json = { ...json, links: filtered };
  json = tidyMasterSlaveLinks(json);
  return json;
}

export function tidyMasterSlaveLinks(json: JsonData): JsonData {
    if (!json.links) { return json; }

    let links = [...json.links];
    let changed = false;

    for (const master of json.links) {
        const children = json.links.filter(l => l.masterLinkId === master.id);
        if (children.length === 1) {
            const child = children[0];

            let masterSegments = master.intermediateSegments || [];
            let childSegments = child.intermediateSegments || [];

            // Remove duplicate if orientations match
            if (
                masterSegments.length > 0 &&
                childSegments.length > 0 &&
                masterSegments[masterSegments.length - 1].orientation === childSegments[0].orientation
            ) {
                // Only keep master's last segment, skip child's first
                childSegments = childSegments.slice(1);
            }

            const mergedSegments = [...masterSegments, ...childSegments];

            const mergedLink: LinkData = {
                ...child,
                sourceId: master.sourceId,
                sourcePort: master.sourcePort,
                sourceX: master.sourceX,
                sourceY: master.sourceY,
                intermediateSegments: mergedSegments,
                masterLinkId: undefined,
            };

            links = links.filter(l => l.id !== master.id && l.id !== child.id);
            links.push(mergedLink);
            changed = true;
        }
    }

    if (changed) {
        return { ...json, links };
    }
    return json;
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

export function changeIdToLinkInJson(json: JsonData, oldId: IdType, newId: IdType, updateChildren: boolean = false): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.id === oldId) {
                link.id = newId;
            }
            if (updateChildren) {
                if (link.masterLinkId === oldId) {
                    link.masterLinkId = newId;
                }
            }
            return link;
        })
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

export function rotateLinkSegmentClockwise(json: JsonData, segmentId: IdType, centerX: number, centerY: number, updateLinks: boolean = true): JsonData {
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.intermediateSegments) {
                const segmentIndex = link.intermediateSegments.findIndex(segment => segment.id === segmentId);
                if (segmentIndex !== -1) {
                    const segment = link.intermediateSegments[segmentIndex];
                    const newSegment: IntermediateSegment = {
                        ...segment,
                        orientation: segment.orientation === "Horizontal" ? "Vertical" : "Horizontal",
                        xOrY: segment.orientation === "Horizontal" ? (centerY - segment.xOrY) + centerX : (segment.xOrY - centerX) + centerY 
                    };
                    link.intermediateSegments[segmentIndex] = newSegment;
                }
            }
            return link;
        })
    };
    
    return updatedJson;
}

export function rotateLinkSegmentCounterClockwise(json: JsonData, segmentId: IdType, centerX: number, centerY: number, updateLinks: boolean = true): JsonData {
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.intermediateSegments) {
                const segmentIndex = link.intermediateSegments.findIndex(segment => segment.id === segmentId);
                if (segmentIndex !== -1) {
                    const segment = link.intermediateSegments[segmentIndex];
                    const newSegment: IntermediateSegment = {
                        ...segment,
                        orientation: segment.orientation === "Horizontal" ? "Vertical" : "Horizontal",
                        xOrY: segment.orientation === "Horizontal" ? (segment.xOrY - centerY) - centerX : (segment.xOrY - centerX) + centerY 
                    };
                    link.intermediateSegments[segmentIndex] = newSegment;
                }
            }
            return link;
        })
    };
    
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

export function updateChildLinksSourcePosition(json: JsonData, slide: boolean=false): JsonData {
    if (!json.links) {return json;}

    let linksToMove: { linkId: IdType, sourceX: number, sourceY: number }[] = [];

    json.links.forEach(link => {
        if (link.masterLinkId) {
            console.log(`Link ${link.id} has masterLinkId ${link.masterLinkId}, updating source position to match reference branch segment.`);
            const referenceLink = json.links?.find(l => l.id === link.masterLinkId);
            if (!referenceLink) {
                console.warn(`Master link ${link.masterLinkId} not found for link ${link.id}, skipping dog leg update.`);
            } else {
                linksToMove.push({ linkId: link.id, sourceX: referenceLink.targetX, sourceY: referenceLink.targetY });
            }
        }
    });

    for (const item of linksToMove) {
        json = moveSourceNode(json, item.linkId, item.sourceX, item.sourceY, [], false, slide);
    }

    return json;
}

export function removeOverlappingSegmentsBetweenMasterAndChild(json: JsonData): JsonData {
    if (!json.links) {return json;}

    for (let master of json.links) {
        const children = json.links?.filter(l => l.masterLinkId === master.id);
        if (!children) {continue;}

        const startingMasterTarget = { x: master.targetX, y: master.targetY };

        for (const child of children) {
            if (!child.masterLinkId) {continue;}
            const master = json.links?.find(l => l.id === child.masterLinkId);
            if (!master) {continue;}

            const masterSegments = master.intermediateSegments || [];
            const childSegments = child.intermediateSegments || [];

            let newMasterTarget = { x: master.targetX, y: master.targetY };

            if (
                masterSegments.length > 0 &&
                childSegments.length > 0 &&
                masterSegments[masterSegments.length - 1].orientation === childSegments[0].orientation
            ) {
                const orientation = masterSegments[masterSegments.length - 1].orientation;
                const masterLast = masterSegments[masterSegments.length - 1];
                const childFirst = childSegments[0];

                if (orientation === "Horizontal") {
                    // Both are horizontal, check for overlap in Y
                    if (Math.abs(masterLast.xOrY - childFirst.xOrY) < 2) {
                        // Get X ranges
                        const masterStartX = masterSegments.length > 1
                            ? (masterSegments[masterSegments.length - 2].orientation === "Vertical"
                                ? masterSegments[masterSegments.length - 2].xOrY
                                : master.sourceX)
                            : master.sourceX;
                        const masterEndX = master.targetX;
                        const childStartX = masterEndX;
                        const childEndX = childSegments.length > 1
                            ? (childSegments[1].orientation === "Vertical"
                                ? childSegments[1].xOrY
                                : child.targetX)
                            : child.targetX;

                        // Check for overlap (child goes back over master)
                        if (
                            (masterStartX < masterEndX && childEndX < childStartX) || // master left->right, child right->left
                            (masterStartX > masterEndX && childEndX > childStartX)    // master right->left, child left->right
                        ) {
                            // Move master's targetX to childEndX (end of overlap)
                            newMasterTarget = { x: childEndX, y: master.targetY };
                        }
                    }
                } else if (orientation === "Vertical") {
                    // Both are vertical, check for overlap in X
                    if (Math.abs(masterLast.xOrY - childFirst.xOrY) < 2) {
                        const masterStartY = masterSegments.length > 1
                            ? (masterSegments[masterSegments.length - 2].orientation === "Horizontal"
                                ? masterSegments[masterSegments.length - 2].xOrY
                                : master.sourceY)
                            : master.sourceY;
                        const masterEndY = master.targetY;
                        const childStartY = masterEndY;
                        const childEndY = childSegments.length > 1
                            ? (childSegments[1].orientation === "Horizontal"
                                ? childSegments[1].xOrY
                                : child.targetY)
                            : child.targetY;

                        if (
                            (masterStartY < masterEndY && childEndY < childStartY) || // master up->down, child down->up
                            (masterStartY > masterEndY && childEndY > childStartY)    // master down->up, child up->down
                        ) {
                            newMasterTarget = { x: master.targetX, y: childEndY };
                        }
                    }
                }
            }
            if (newMasterTarget.x !== master.targetX || newMasterTarget.y !== master.targetY) {
                if (master.targetX === startingMasterTarget.x && master.targetY === startingMasterTarget.y) {
                    json = moveTargetNode(json, master.id, newMasterTarget.x, newMasterTarget.y, [], false);
                } else {
                    let previousMovementOrientation = startingMasterTarget.x !== master.targetX ? "Horizontal" : "Vertical";
                    let previousMovementSign = previousMovementOrientation === "Horizontal" ? 
                                                Math.sign(master.targetX - startingMasterTarget.x) 
                                                : Math.sign(master.targetY - startingMasterTarget.y);

                    let currentMovementOrientation = startingMasterTarget.x !== newMasterTarget.x ? "Horizontal" : "Vertical";
                    let currentMovementSign = currentMovementOrientation === "Horizontal" ? 
                                                Math.sign(newMasterTarget.x - startingMasterTarget.x) 
                                                : Math.sign(newMasterTarget.y - startingMasterTarget.y);
                    
                    if (previousMovementOrientation !== currentMovementOrientation) {
                        console.warn(`Trying to move master on two different orientations at once, skipping for now...`);
                    } else if (previousMovementSign !== currentMovementSign) {
                        console.log(`Trying to move master back over itself, to previous knee`);
                        if (master.intermediateSegments[master.intermediateSegments.length - 1].orientation === "Horizontal") {
                            let y = master.targetY;
                            let x = master.intermediateSegments.length > 1 ? 
                                        master.intermediateSegments[master.intermediateSegments.length - 2].xOrY 
                                        : master.sourceX;
                            json = moveTargetNode(json, master.id, x, y, [], false);
                        } else {
                            let x = master.targetX;
                            let y = master.intermediateSegments.length > 1 ? 
                                        master.intermediateSegments[master.intermediateSegments.length - 2].xOrY 
                                        : master.sourceY;
                            json = moveTargetNode(json, master.id, x, y, [], false);
                        }
                    } else {
                        json = moveTargetNode(json, master.id, newMasterTarget.x, newMasterTarget.y, [], false);
                    }
                }
            }
        }
    }

    json = updateChildLinksSourcePosition(json, true);

    return json;
}

export function removeOverlappingSegmentsBetweenChildren(json: JsonData): JsonData {
    if (!json.links) {return json;}

    function doesChildrenOverlap(childA: LinkData, childB: LinkData): { overlap: boolean, lastPoint: {x: number, y: number} } {
        const falseReturn = { overlap: false, lastPoint: {x: -1, y: -1}};
        if (!childA.intermediateSegments?.length || !childB.intermediateSegments?.length) {return falseReturn;}

        const segA = childA.intermediateSegments[0];
        const segB = childB.intermediateSegments[0];

        if (segA.orientation === segB.orientation) {
            console.log(`They can overlap, both are ${segA.orientation}, their positions are ${segA.xOrY} and ${segB.xOrY}`);
        }
        // Must be same orientation and same xOrY (colinear)
        if (segA.orientation !== segB.orientation || segA.xOrY !== segB.xOrY) {return falseReturn;}

        console.log(`Children ${childA.id} and ${childB.id} are colinear on a ${segA.orientation} segment at ${segA.xOrY}, could overlap.`);

        // Both start at master's target node
        const startA = segA.orientation === "Horizontal" ? childA.sourceX : childA.sourceY;
        const startB = startA;

        // Endpoints of the first segment
        const endA = childA.intermediateSegments.length > 1
                        ? childA.intermediateSegments[1].xOrY
                        : segA.orientation === "Horizontal" ? childA.targetX : childA.targetY;

        const endB = childB.intermediateSegments.length > 1
                        ? childB.intermediateSegments[1].xOrY
                        : segB.orientation === "Horizontal" ? childB.targetX : childB.targetY;

        if (Math.abs(startA - endA) < 1 || Math.abs(startB - endB) < 1) {
            return falseReturn; // One of the segments is too short to overlap
        }
        
        if (Math.sign(endA - startA) === Math.sign(endB - startB)) {
            let x = -1;
            let y = -1;
            if (endA > startA) {
                x = segA.orientation === "Horizontal" ? Math.min(endA, endB) : childA.sourceX;
                y = segA.orientation === "Vertical" ? Math.min(endA, endB) : childA.sourceY;
            } else {
                x = segA.orientation === "Horizontal" ? Math.max(endA, endB) : childA.sourceX;
                y = segA.orientation === "Vertical" ? Math.max(endA, endB) : childA.sourceY;
            }
            return {overlap: true, lastPoint: {x: x, y: y}};
        } else {return falseReturn;}
    }

    const overlapActions: {
        masterLink: LinkData,
        childA: LinkData,
        childB: LinkData,
        lastPoint: {x: number, y: number}
    }[] = [];

    for (let masterLink of json.links) {
        const children = json.links?.filter(l => l.masterLinkId === masterLink.id);
        if (!children || children.length < 2) {continue;}

        for (let i = 0; i < children.length; i++) {
            for (let j = 0; j < children.length; j++) {
                if (i === j) {continue;}
                let childA = children[i];
                let childB = children[j];

                const result = doesChildrenOverlap(childA, childB);
                if (result.overlap) {
                    console.log(`Children ${childA.id} and ${childB.id} of master ${masterLink.id} overlap, creating new link at (${result.lastPoint.x}, ${result.lastPoint.y})`);
                    overlapActions.push({ masterLink, childA, childB, lastPoint: result.lastPoint });
                }
            }
        }
    }

    for (const action of overlapActions) {
        const childrenOfMaster = json.links?.filter(l => l.masterLinkId === action.masterLink.id) ?? [];
        const isOnlyTheseTwo = (
            childrenOfMaster.length === 2 &&
            childrenOfMaster.some(l => l.id === action.childA.id) &&
            childrenOfMaster.some(l => l.id === action.childB.id)
        );

        if (isOnlyTheseTwo) {
            // Just move master's target node to lastPoint
            json = moveTargetNode(json, action.masterLink.id, action.lastPoint.x, action.lastPoint.y, [], false);
        } else {
            const newLinkId = getNonce();
            const newLink: LinkData = {
                id: newLinkId,
                sourceId: "undefined",
                sourcePort: -1,
                sourceX: action.masterLink.targetX,
                sourceY: action.masterLink.targetY,
                targetId: "undefined",
                targetPort: -1,
                targetX: action.lastPoint.x,
                targetY: action.lastPoint.y,
                intermediateSegments: [],
                masterLinkId: action.masterLink.id,
            };
            json = addLinkToJson(json, newLink);

            // Change overlapping children to be child of new link
            json.links?.forEach(link => {
                if (link.id === action.childA.id || link.id === action.childB.id) {
                    link.masterLinkId = newLinkId;
                }
            });

            // Move source nodes of children to end of new link
            json = moveSourceNode(json, action.childA.id, action.lastPoint.x, action.lastPoint.y, [], false, true);
            json = moveSourceNode(json, action.childB.id, action.lastPoint.x, action.lastPoint.y, [], false, true);
        }
    }

    return json;
}


export function createNewChildLinkFromNode(json: JsonData, previousSegmentId: IdType, nextSegmentId: IdType): [ JsonData, LinkData ] | undefined {
    let masterLink = json.links?.find(link => link.intermediateSegments.some(segment => segment.id === previousSegmentId));
    const newIdForMasterLink = getNonce();

    if (masterLink) {
        
        const previousSegment = masterLink.intermediateSegments.find(segment => segment.id === previousSegmentId);
        const nextSegment = masterLink.intermediateSegments.find(segment => segment.id === nextSegmentId);

        if (previousSegment && nextSegment) {
            let x = previousSegment.orientation === "Horizontal" ? nextSegment.xOrY : previousSegment.xOrY;
            let y = previousSegment.orientation === "Horizontal" ? previousSegment.xOrY : nextSegment.xOrY;

            const newLink: LinkData = {
                id: getNonce(),
                sourceId: "undefined",
                sourcePort: -1,
                sourceX: x,
                sourceY: y,
                targetId: "undefined",
                targetPort: -1,
                targetX: x,
                targetY: y,
                intermediateSegments: [],
                masterLinkId: newIdForMasterLink,
            };
            json = addLinkToJson(json, newLink);

            const clickedIndex = masterLink.intermediateSegments.findIndex(segment => segment.id === nextSegmentId);
            let preservedSegments: IntermediateSegment[] = [];
            if (clickedIndex !== -1) {
                preservedSegments = masterLink.intermediateSegments.slice(clickedIndex);
            } else { 
                console.warn(`Segment with id ${nextSegmentId} not found in master link ${masterLink.id}. Continuing for now...`);
            }

            preservedSegments = preservedSegments.map(segment => ({
                ...segment,
                id: getNonce()
            }));

            const splittedPartOfLink: LinkData = {
                id: masterLink.id,
                sourceId: "undefined",
                sourcePort: -1,
                sourceX: x,
                sourceY: y,
                targetId: masterLink.targetId,
                targetPort: masterLink.targetPort,
                targetX: masterLink.targetX,
                targetY: masterLink.targetY,
                intermediateSegments: preservedSegments,
                masterLinkId: newIdForMasterLink,
            };

            json = moveTargetNode(json, masterLink.id, x, y, [], false);
            json = changeIdToLinkInJson(json, masterLink.id, newIdForMasterLink);
            json = addLinkToJson(json, splittedPartOfLink);
            
            return [json, newLink];
        } else {
            console.warn(`Previous or next segment not found in master link ${masterLink.id}.`);
        }
    } else {
        console.warn(`Master link not found for segment ${previousSegmentId}.`);
    }
    return undefined;
}

export function createNewChildLinkFromSegment(json: JsonData, segmentId: IdType, clickX: number, clickY: number): [ JsonData, LinkData ] | undefined {
    let masterLink = json.links?.find(link => link.intermediateSegments.some(segment => segment.id === segmentId));
    const newIdForMasterLink = getNonce();
    if (masterLink) {
        const segment = masterLink.intermediateSegments.find(segment => segment.id === segmentId);
        
        if (segment) {
            const newLink: LinkData = {
                id: getNonce(),
                sourceId: "undefined",
                sourcePort: -1,
                sourceX: clickX,
                sourceY: clickY,
                targetId: "undefined",
                targetPort: -1,
                targetX: clickX,
                targetY: clickY,
                intermediateSegments: [],
                masterLinkId: newIdForMasterLink,
            };
            json = addLinkToJson(json, newLink);

            const clickedIndex = masterLink.intermediateSegments.findIndex(segment => segment.id === segmentId);
            let preservedSegments: IntermediateSegment[] = [];
            if (clickedIndex !== -1) {
                preservedSegments = masterLink.intermediateSegments.slice(clickedIndex);
            } else { 
                console.warn(`Segment with id ${segmentId} not found in master link ${masterLink.id}. Continuing for now...`);
            }

            preservedSegments = preservedSegments.map(segment => ({
                ...segment,
                id: getNonce()
            }));

            const splittedPartOfLink: LinkData = {
                id: masterLink.id,
                sourceId: "undefined",
                sourcePort: -1,
                sourceX: clickX,
                sourceY: clickY,
                targetId: masterLink.targetId,
                targetPort: masterLink.targetPort,
                targetX: masterLink.targetX,
                targetY: masterLink.targetY,
                intermediateSegments: preservedSegments,
                masterLinkId: newIdForMasterLink,
            };

            json = moveTargetNode(json, masterLink.id, clickX, clickY, [], false);
            json = changeIdToLinkInJson(json, masterLink.id, newIdForMasterLink);
            json = addLinkToJson(json, splittedPartOfLink);

            return [json, newLink];
        } else {
            console.warn(`Previous or next segment not found in master link ${masterLink.id}.`);
        }
    } else {
        console.warn(`Master link not found for segment ${segmentId}.`);
    }
    return undefined;
}

export function consolidateLinkNodes(json: JsonData, removeColinear: boolean = true): JsonData {
    json = updateLinksAfterNodesConsolidation(json, removeColinear);
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
                link.intermediateSegments = link.intermediateSegments.map(segment => {
                    if (segment.orientation === "Horizontal") {
                        segment.xOrY += deltaY;
                    } else {
                        segment.xOrY += deltaX;
                    }
                    return segment;
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

export function moveSourceNode(json: JsonData, linkId: IdType, x: number, y: number, selectedSelectableIds: IdType[], attachLinkToPort: boolean=false, slide: boolean=false): JsonData {
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

    let newSegments = json.links?.find(link => link.id === linkId)?.intermediateSegments || [];

    if (slide) {
        const movementOrientation = Math.abs(finalX - initialX) > Math.abs(finalY - initialY) ? "Horizontal" : "Vertical";
        const firstSegmentOfMovedLink = json.links?.find(link => link.id === linkId)?.intermediateSegments[0];
        if (firstSegmentOfMovedLink && firstSegmentOfMovedLink.orientation !== movementOrientation) {
            if (movementOrientation === "Horizontal") {
                newSegments = [{ id: getNonce(), orientation: "Horizontal", xOrY: initialY }, ...newSegments];
            } else {
                newSegments = [{ id: getNonce(), orientation: "Vertical", xOrY: initialX }, ...newSegments];
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
                link.intermediateSegments = newSegments;
            }
            return link;
        })
    };
    return updatedJson;
}
export function moveTargetNode(json: JsonData, linkId: IdType, x: number, y: number, selectedSelectableIds: IdType[], attachLinkToPort: boolean=false): JsonData {
    let attachedBlock = json.links?.find(link => link.id === linkId)?.targetId;
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

export function getNeighboringSegmentsToNode(json: JsonData, nodeId: IdType): {before: IntermediateSegment, after: IntermediateSegment} | undefined {

    let before: IntermediateSegment | undefined = undefined;
    let after: IntermediateSegment | undefined = undefined;

    json.links?.forEach(link => {
        link.intermediateSegments.forEach(segment => {
            if (nodeId.startsWith(segment.id)) {
                after = segment;
            } else if (nodeId.endsWith(segment.id)) {
                before = segment;
            }
        });
    });

    if (before && after) {
        return {before: before, after: after};
    }
    return undefined;
}

export function getLimitsOfSegment(json: JsonData, segmentId: IdType): {before: {x: number, y: number}, after: {x: number, y: number}} | undefined {
    let link = json.links?.find(link => link.intermediateSegments.some(segment => segment.id === segmentId));
    if (!link) {
        console.warn(`Segment with id ${segmentId} not found in any link.`);
        return undefined;
    }

    let lastPoint = { x: link.sourceX, y: link.sourceY };

    for (let i = 0; i < link.intermediateSegments.length - 1; i++) {
        let currentSegment = link.intermediateSegments[i];
        let nextSegment = link.intermediateSegments[i + 1];

        if (currentSegment.orientation === "Horizontal") {
            lastPoint = { x: lastPoint.x, y: currentSegment.xOrY };
        } else {
            lastPoint = { x: currentSegment.xOrY, y: lastPoint.y };
        }
        if (currentSegment.id === segmentId) {
            return {
                before: lastPoint,
                after: { 
                    x: nextSegment.orientation === "Horizontal" ? lastPoint.x : nextSegment.xOrY, 
                    y: nextSegment.orientation === "Vertical" ? lastPoint.y : nextSegment.xOrY 
                }
            };
        }
    }
    if (link.intermediateSegments[link.intermediateSegments.length - 1].id === segmentId) {
        let currentSegment = link.intermediateSegments[link.intermediateSegments.length - 1];

        if (currentSegment.orientation === "Horizontal") {
            lastPoint = { x: lastPoint.x, y: currentSegment.xOrY };
        } else {
            lastPoint = { x: currentSegment.xOrY, y: lastPoint.y };
        }

        return {
            before: lastPoint,
            after: { 
                x: link.targetX, 
                y: link.targetY
            }
        };
    }
    return undefined; // Segment not found
}

export function updateSegmentsOnLink(json: JsonData, linkId: IdType, segments: IntermediateSegment[]): JsonData {
    let updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => {
            if (link.id === linkId) {
                link.intermediateSegments = segments;
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