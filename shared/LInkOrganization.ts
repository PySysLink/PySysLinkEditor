import { link } from "fs";
import { getNeighboringSegmentsToNode, getPortPosition, removeOverlappingSegmentsBetweenChildren, removeOverlappingSegmentsBetweenMasterAndChild, updateChildLinksSourcePosition, updateLinkInJson, updateSegmentsOnLink } from "./JsonManager";
import { IdType, IntermediateSegment, JsonData, LinkData } from "./JsonTypes";
import { getNonce } from "./util";


export function updateLinksAfterBlockMove(json: JsonData, blockId: IdType): JsonData {
    console.log("updateLinksAfterBlockMove called");
    return updateLinksDogLeg(json, blockId, false);
}

export function updateLinksAfterBlockUpdate(json: JsonData, blockId: IdType): JsonData {
    console.log("updateLinksAfterBlockUpdate called");
    return updateLinksDogLeg(json, blockId, false);
}

export function updateLinksAfterMerge(json: JsonData): JsonData {
    console.log("updateLinksAfterMerge called");
    return updateLinksDogLeg(json);
}

export function updateLinksAfterNodesUpdated(json: JsonData): JsonData {
    console.log("updateLinksAfterNodesUpdated called");
    return updateLinksDogLeg(json, undefined, false);
}

export function updateLinksAfterNodesConsolidation(json: JsonData, removeColinear: boolean = true): JsonData {
    console.log("updateLinksAfterNodesConsolidation called");
    return updateLinksDogLeg(json, undefined, removeColinear);
}

export function updateLinksAfterBatchMove(json: JsonData): JsonData {
    console.log("updateLinksAfterBatchMove called");
    return updateLinksDogLeg(json, undefined, false);
}


export function moveLinkNode(
    json: JsonData,
    nodeId: IdType,
    targetPositionX: number,
    targetPositionY: number,
    selectedSelectableIds: IdType[]
): JsonData {
    let beforeAndAfterSegments = getNeighboringSegmentsToNode(json, nodeId);
    if (beforeAndAfterSegments) {
        if (selectedSelectableIds.indexOf(beforeAndAfterSegments.after.id) === -1) {
            json = moveLinkSegment(json, beforeAndAfterSegments.after.id, targetPositionX, targetPositionY, selectedSelectableIds);
        }
        if (selectedSelectableIds.indexOf(beforeAndAfterSegments.before.id) === -1) {
            json = moveLinkSegment(json, beforeAndAfterSegments.before.id, targetPositionX, targetPositionY, selectedSelectableIds);
        }
    }
    return json;
}

export function moveLinkSegment(
    json: JsonData,
    segmentId: IdType,
    targetPositionX: number,
    targetPositionY: number,
    selectedSelectableIds: IdType[]
): JsonData {
    let segments: IntermediateSegment[] = json.links?.find(link => link.intermediateSegments.map(segment => segment.id).indexOf(segmentId) > -1)?.intermediateSegments ?? [];
    const linkId: IdType = json.links?.find(link => link.intermediateSegments.map(segment => segment.id).indexOf(segmentId) > -1)?.id ?? "undefinedLink";

    if (!segments || segments.length === 0) {
        throw new Error(`No segments found for segmentId ${segmentId} in link ${linkId}`);
    }
    if (linkId === "undefinedLink") {
        throw new Error(`Link with segmentId ${segmentId} not found`);
    }

    let segmentIndex = segments.findIndex(segment => segment.id === segmentId);

    if (segmentIndex === -1) {
        throw new Error(`Segment with id ${segmentId} not found in any link.`);
    }

    if (segments[segmentIndex].orientation === "Horizontal") {
            segments[segmentIndex].xOrY = targetPositionY;
    } else {
        segments[segmentIndex].xOrY = targetPositionX;
    }

    if (segmentIndex === 0 && !json.links?.find(link => link.id === linkId)?.masterLinkId) {
        const connectedBlockId = json.links?.find(link => link.id === linkId)?.sourceId ?? undefined;
        let isSourceSelected = false;
        if (connectedBlockId) {
            if (selectedSelectableIds.includes(connectedBlockId)) {
                isSourceSelected = true;
            }
        }
        if (!isSourceSelected) {
            if (segments[segmentIndex].orientation === "Horizontal") {
                segments.splice(segmentIndex, 0, {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: targetPositionX
                });
            } else {
                segments.splice(segmentIndex, 0, {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: targetPositionY
                });
            }
        }

        segmentIndex++;
    }

    if (segmentIndex === segments.length - 1) {
        const connectedBlockId = json.links?.find(link => link.id === linkId)?.targetId ?? undefined;
        let isTargetSelected = false;
        if (connectedBlockId) {
            if (selectedSelectableIds.includes(connectedBlockId)) {
                isTargetSelected = true;
            }
        }
        if (!isTargetSelected) {
            if (segments[segmentIndex].orientation === "Horizontal") {
                segments.splice(segmentIndex + 1, 0, {
                    id: getNonce(),
                    orientation: "Vertical",
                    xOrY: targetPositionX
                });
            } else {
                segments.splice(segmentIndex + 1, 0, {
                    id: getNonce(),
                    orientation: "Horizontal",
                    xOrY: targetPositionY
                });
            }
        }
    }
        

    json = updateSegmentsOnLink(json, linkId, segments);
    json = updateChildLinksSourcePosition(json);
    return json;
}

function findPrevNextX(
    segments: IntermediateSegment[],
    firstIndex: number,
    link: { sourceX: number; targetX: number }
): { prevX: number; nextX: number } {
    // Find previous vertical segment to the left
    let prevX = link.sourceX;
    for (let i = firstIndex - 1; i >= 0; --i) {
        if (segments[i].orientation === "Vertical") {
            prevX = segments[i].xOrY;
            break;
        }
    }

    // Find next vertical segment to the right
    let nextX = link.targetX;
    for (let i = firstIndex + 1; i < segments.length; ++i) {
        if (segments[i].orientation === "Vertical") {
            nextX = segments[i].xOrY;
            break;
        }
    }

    return { prevX, nextX };
}

function findPrevNextY(
    segments: IntermediateSegment[],
    firstIndex: number,
    link: { sourceY: number; targetY: number }
): { prevY: number; nextY: number } {
    // Find previous horizontal segment above
    let prevY = link.sourceY;
    for (let i = firstIndex - 1; i >= 0; --i) {
        if (segments[i].orientation === "Horizontal") {
            prevY = segments[i].xOrY;
            break;
        }
    }

    // Find next horizontal segment below
    let nextY = link.targetY;
    for (let i = firstIndex + 1; i < segments.length; ++i) {
        if (segments[i].orientation === "Horizontal") {
            nextY = segments[i].xOrY;
            break;
        }
    }

    return { prevY, nextY };
}


function simpleJsonHash(obj: any): string {
    // Simple hash: not cryptographically secure, but good enough for change detection
    let str = JSON.stringify(obj);
    let hash = 0, i = 0, chr;
    while (i < str.length) {
        chr = str.charCodeAt(i++);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}

let lastDogLegHash: string | undefined = undefined;


function updateLinksDogLeg(json: JsonData, movedBlockId: IdType | undefined = undefined, removeColinear: boolean = true): JsonData {
    const currentHash = simpleJsonHash(json);

    if (lastDogLegHash === currentHash) {
        // Already processed this state, skip
        console.log("updateLinksDogLeg: Skipping, JSON unchanged.");
        return json;
    }
    lastDogLegHash = currentHash;

    json = updateChildLinksSourcePosition(json);
    json = removeOverlappingSegmentsBetweenMasterAndChild(json);
    json = removeOverlappingSegmentsBetweenChildren(json);

    if (!json.links) {return json;}

    for (let link of json.links) {
        let segments: IntermediateSegment[] = link.intermediateSegments;

        console.log(`Link ${link.id} segments before dog leg: ${JSON.stringify(segments)}`);


        let preferenceToMove: "A" | "B" = "A";
        if (movedBlockId && link.sourceId === movedBlockId) {
            preferenceToMove = "A";
        } else if (movedBlockId && link.targetId === movedBlockId) {
            preferenceToMove = "B";
        }

        let allAligned = false;

        while (!allAligned) {
            if (segments.length === 0 || segments.length === 1) {
                if (link.sourceX === link.targetX) {
                    segments = [
                        { id: getNonce(), orientation: "Vertical", xOrY: link.sourceX }
                    ];
                } else if (link.sourceY === link.targetY) {
                    segments = [
                        { id: getNonce(), orientation: "Horizontal", xOrY: link.sourceY }
                    ];
                } else {
                    segments = [
                        { id: getNonce(), orientation: "Horizontal", xOrY: link.sourceY },
                        { id: getNonce(), orientation: "Vertical", xOrY: (link.sourceX + link.targetX)/2 },
                        { id: getNonce(), orientation: "Horizontal", xOrY: link.targetY }
                    ];
                }
                allAligned = true;
                continue;
            } else {
                if (segments[0].orientation === "Horizontal") {
                    if (link.sourceY !== segments[0].xOrY) {
                        console.log(`Link ${link.id} sourceY ${link.sourceY} does not match first segment Y ${segments[0].xOrY}`);
                        segments[0].xOrY = link.sourceY;
                        continue;
                    }
                } else {
                    if (link.sourceX !== segments[0].xOrY) {
                        console.log(`Link ${link.id} sourceX ${link.sourceX} does not match first segment X ${segments[0].xOrY}`);
                        segments[0].xOrY = link.sourceX;
                        continue;
                    }
                }

                if (segments[segments.length - 1].orientation === "Horizontal") {
                    if (link.targetY !== segments[segments.length - 1].xOrY) {
                        console.log(`Link ${link.id} targetY ${link.targetY} does not match last segment Y ${segments[segments.length - 1].xOrY}`);
                        segments[segments.length - 1].xOrY = link.targetY;
                        continue;
                    }
                } else {
                    if (link.targetX !== segments[segments.length - 1].xOrY) {
                        console.log(`Link ${link.id} targetX ${link.targetX} does not match last segment X ${segments[segments.length - 1].xOrY}`);
                        segments[segments.length - 1].xOrY = link.targetX;
                        continue;
                    }
                }
            }

            for (let i = 0; i < segments.length - 1; ++i) {
                const a = segments[i];
                const b = segments[i + 1];

                if (a.orientation === b.orientation) {
                    console.log(`Link ${link.id} segments ${i} and ${i + 1} have the same orientation: ${a.orientation}`);
                    if (a.orientation === "Horizontal") {
                        if (a.xOrY === b.xOrY) {
                            segments.splice(i, 1);
                            continue;
                        } else {
                            let { prevX, nextX } = findPrevNextX(segments, i, link);
                            segments.splice(i + 1, 0, {
                                id: getNonce(),
                                orientation: "Vertical",
                                xOrY: (prevX + nextX)/2
                            });
                            continue;
                        }
                    } else {
                        if (a.xOrY === b.xOrY) {
                            segments.splice(i, 1);
                            continue;
                        } else {
                            let { prevY, nextY } = findPrevNextY(segments, i, link);
                            segments.splice(i + 1, 0, {
                                id: getNonce(),
                                orientation: "Horizontal",
                                xOrY: (prevY + nextY)/2
                            });
                            continue;
                        }
                    }
                }
            }
            
            if (removeColinear) {
                for (let i = 0; i < segments.length - 2; ++i) {
                    const a = segments[i];
                    const b = segments[i + 1];
                    const c = segments[i + 2];

                    const removalThreshold = 2; // Threshold to consider segments collinear

                    if (a.orientation === c.orientation &&
                        Math.abs(a.xOrY - c.xOrY) < removalThreshold) {
                        segments.splice(i + 1, 2);
                        continue;
                    }
                }

                const removalThreshold = 2; // Threshold to consider segments collinear

                if (segments.length > 1) {
                    if (segments[1].orientation === "Horizontal" && Math.abs(segments[1].xOrY - link.sourceY) < removalThreshold) {
                        segments.splice(0, 1);
                    } else if (segments[1].orientation === "Vertical" && Math.abs(segments[1].xOrY - link.sourceX) < removalThreshold) {
                        segments.splice(0, 1);
                    }
                }

                if (segments.length > 1) {
                    const last = segments.length - 1;
                    if (segments[last - 1].orientation === "Horizontal" && Math.abs(segments[last - 1].xOrY - link.targetY) < removalThreshold) {
                        segments.splice(last, 1);
                    } else if (segments[last - 1].orientation === "Vertical" && Math.abs(segments[last - 1].xOrY - link.targetX) < removalThreshold) {
                        segments.splice(last, 1);
                    }
                }
            }

            allAligned = true;
        }

        
        console.log(`Link ${link.id} intermediate segments before: ${JSON.stringify(link.intermediateSegments)}`);
        console.log(`Link ${link.id} intermediate segments after: ${JSON.stringify(segments)}`);
        link.intermediateSegments = structuredClone(segments);
    }
    return json;
}


