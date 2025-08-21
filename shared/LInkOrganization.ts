import { link } from "fs";
import { getNeighboringSegmentsToNode, getPortPosition, updateLinkInJson, updateSegmentsOnLink } from "./JsonManager";
import { IdType, IntermediateSegment, JsonData, LinkData } from "./JsonTypes";
import { getNonce } from "./util";


export function updateLinksAfterBlockMove(json: JsonData, blockId: IdType): JsonData {
    console.log("updateLinksAfterBlockMove called");
    return updateLinksDogLeg(json, blockId, false);
    // return json;
}

export function updateLinksAfterBlockUpdate(json: JsonData, blockId: IdType): JsonData {
    console.log("updateLinksAfterBlockUpdate called");
    return updateLinksDogLeg(json, blockId, false);
    // return json;
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

    if (segmentIndex === 0) {
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

        segmentIndex++;
    }

    if (segmentIndex === segments.length - 1) {
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
        

    json = updateSegmentsOnLink(json, linkId, segments);
    // json = updateChildLinksSourcePosition(json);
    return updateLinksDogLeg(json, undefined, false);
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

function updateLinksDogLeg(json: JsonData, movedBlockId: IdType | undefined = undefined, removeColinear: boolean = true): JsonData {

    // json = updateChildLinksSourcePosition(json);

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
            allAligned = true;
        }

        
        console.log(`Link ${link.id} intermediate segments before: ${JSON.stringify(link.intermediateSegments)}`);
        console.log(`Link ${link.id} intermediate segments after: ${JSON.stringify(segments)}`);
        link.intermediateSegments = structuredClone(segments);
    }
    return json;
}


