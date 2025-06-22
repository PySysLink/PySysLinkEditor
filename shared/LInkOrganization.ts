import { getPortPosition, updateLinkInJson } from "./JsonManager";
import { IdType, JsonData, LinkData } from "./JsonTypes";
import { getNonce } from "./util";

const distanceToJoin = 1.1;

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

export function updateLinksAfterNodesConsolidation(json: JsonData): JsonData {
    console.log("updateLinksAfterNodesConsolidation called");
    return updateLinksDogLeg(json, undefined, true);
}

export function updateLinksAfterBatchMove(json: JsonData): JsonData {
    console.log("updateLinksAfterBatchMove called");
    return updateLinksDogLeg(json, undefined, true);
}


export function moveLinkSegment(
    json: JsonData,
    link: LinkData,
    sourceIntermediateNodeId: IdType,
    targetIntermediateNodeId: IdType,
    targetPositionX: number,
    targetPositionY: number
): JsonData {
    let nodes = link.intermediateNodes ?? [];

    if (sourceIntermediateNodeId === "SourceNode") {
        if (nodes.length === 0) {
            nodes.push({
                id: getNonce(),
                x: link.sourceX,
                y: link.sourceY
            });
            console.log(`Added source node at (${link.sourceX}, ${link.sourceY})`);
        } else if (nodes[0].id === targetIntermediateNodeId) {
            nodes.splice(0, 0, {
                id: getNonce(),
                x: link.sourceX,
                y: link.sourceY
            });
            console.log(`Added source node at (${link.sourceX}, ${link.sourceY})`);
        }
        sourceIntermediateNodeId = nodes[0].id;
    }

    if (targetIntermediateNodeId === "TargetNode") {
        if (nodes.length === 0) {
            nodes.push({
                id: getNonce(),
                x: link.targetX,
                y: link.targetY
            });
            console.log(`Added target node at (${link.targetX}, ${link.targetY})`);
        } else if (nodes[nodes.length - 1].id === sourceIntermediateNodeId) {
            nodes.push({
                id: getNonce(),
                x: link.targetX,
                y: link.targetY
            });
            console.log(`Added target node at (${link.targetX}, ${link.targetY})`);
        }
        targetIntermediateNodeId = nodes[nodes.length - 1].id;
    }

    const i1 = nodes.findIndex(n => n.id === sourceIntermediateNodeId);
    let i2 = nodes.findIndex(n => n.id === targetIntermediateNodeId);

    console.log(`Moving link nodes: ${JSON.stringify(nodes)}, indexes: ${i1}, ${i2}`);

    if (i1 === -1 || i2 === -1) {
        throw new Error(`Intermediate node(s) not found in link ${link.id}`);
    }
    if (i2 - i1 !== 1) {
        throw new Error(`Intermediate nodes must be adjacent in link ${link.id}`);
    }


    // Check alignment
    const isHorizontal = Math.abs(nodes[i1].y - nodes[i2].y) < distanceToJoin;
    const isVertical = Math.abs(nodes[i1].x - nodes[i2].x) < distanceToJoin;

    if (!isHorizontal && !isVertical) {
        throw new Error(`Segment is not aligned horizontally or vertically`);
    }

    // Get neighboring points (can be source or target)
    const prevPoint = i1 === 0
        ? { x: link.sourceX, y: link.sourceY }
        : nodes[i1 - 1];
    const nextPoint = i2 === nodes.length - 1
        ? { x: link.targetX, y: link.targetY }
        : nodes[i2 + 1];

    // Fix corner before segment
    const bendInBefore = (isHorizontal && Math.abs(prevPoint.x - nodes[i1].x) >= distanceToJoin) ||
                         (isVertical && Math.abs(prevPoint.y - nodes[i1].y) >= distanceToJoin);

    let beforeBend: { id: IdType; x: number; y: number } | undefined = undefined;
    if (bendInBefore) {
        beforeBend = {
            id: `${link.id}_auto_pre_${Date.now()}`,
            x: isHorizontal ? nodes[i1].x : prevPoint.x,
            y: isVertical ? nodes[i1].y : prevPoint.y
        };
    }

    // Fix corner after segment
    const bendInAfter = (isHorizontal && Math.abs(nextPoint.x - nodes[i2].x) >= distanceToJoin) ||
                        (isVertical && Math.abs(nextPoint.y - nodes[i2].y) >= distanceToJoin);

    let afterBend: { id: IdType; x: number; y: number } | undefined = undefined;
    if (bendInAfter) {
        afterBend = {
            id: `${link.id}_auto_post_${Date.now()}`,
            x: isHorizontal ? nodes[i2].x : nextPoint.x,
            y: isVertical ? nodes[i2].y : nextPoint.y
        };
    }

    console.log(`Intermediate nodes before move:`, JSON.stringify(nodes));
    console.log(`Moving segment nodes ${i1} and ${i2} of link ${link.id} to position (${targetPositionX}, ${targetPositionY})`);
    nodes[i1].x = isHorizontal ? nodes[i1].x : targetPositionX;
    nodes[i1].y = isVertical ? nodes[i1].y : targetPositionY;
    nodes[i2].x = isHorizontal ? nodes[i2].x : targetPositionX;
    nodes[i2].y = isVertical ? nodes[i2].y : targetPositionY;

    console.log(`Intermediate nodes after move:`, JSON.stringify(nodes));

    // if (beforeBend) {
    //     nodes.splice(i1, 0, beforeBend);
    //     // Adjust indices since we added a node before i1
    //     i2 += 1;
    // }
    // if (afterBend) {
    //     nodes.splice(i2 + 1, 0, afterBend);
    // }

    console.log(`Before bend: ${beforeBend}, after: ${afterBend}`);

    console.log(`Final intermediate nodes after move:`, JSON.stringify(nodes));
    
    link.intermediateNodes = nodes;

    return updateLinkInJson(json, link);
}

function realignPoints(
    preA: Point | undefined,
    a: FullPoint,
    b: FullPoint,
    postB: Point | undefined,
    preferenceToMove: "A" | "B" = "A"
): FullPoint[] {
    let isALinkHorizontal: boolean | undefined = undefined;
    let isALinkVertical: boolean | undefined = undefined;
    console.log(`Realigning points: ${a}, ${b}, preA: ${preA}, postB: ${postB}`);
    if (preA) {
        isALinkHorizontal = Math.abs(a.y - preA.y) < distanceToJoin;
        isALinkVertical = Math.abs(a.x - preA.x) < distanceToJoin;
        if (!isALinkHorizontal && !isALinkVertical) {
            throw new Error(`Points A and preA are not aligned horizontally or vertically: ${JSON.stringify(a)}, ${JSON.stringify(preA)}`);
        }
    } 
    let isBLinkHorizontal: boolean | undefined = undefined;
    let isBLinkVertical: boolean | undefined = undefined;
    if (postB) {
        isBLinkHorizontal = Math.abs(b.y - postB.y) < distanceToJoin;
        isBLinkVertical = Math.abs(b.x - postB.x) < distanceToJoin;

        if (!isBLinkHorizontal && !isBLinkVertical) {
            // B is between two non aligned segments
            if (isALinkHorizontal === undefined) {
                // A is source, B is between two non-aligned segments
                console.log(`B is between two non-aligned segments, A is source: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
                return [a,
                        { id: getNonce(), x: b.x, y: a.y },
                        b];
            } else if (isALinkHorizontal) {
                // B is between two non-aligned segments, A is horizontal
                console.log(`B is between two non-aligned segments, A is horizontal: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
                a.x = b.x;
                return [a, b];
            } else {
                // B is between two non-aligned segments, A is vertical
                console.log(`B is between two non-aligned segments, A is vertical: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
                a.y = b.y;
                return [a, b];
            }
        }
    }

    if (isALinkHorizontal === undefined) {
        if (isBLinkHorizontal === undefined) {
            // Both points are source and target
            console.log(`Both points are source and target: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
            return [a,
                    { id: getNonce(), y: a.y, x: (a.x + b.x)/2 },
                    { id: getNonce(), y: b.y, x: (a.x + b.x)/2 },
                    b];
        } else if (isBLinkVertical) { // If B is both vertical and horizontal, do not create new nodes
            // A is source, B is vertical
            console.log(`A is source, B is vertical: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
            b.y = a.y;
            return [a, b];
        } else {
            // A is source, B is horizontal
            console.log(`A is source, B is horizontal: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
            return [a,
                    { id: getNonce(), x: b.x, y: a.y },
                    b];
        }
    }

    if (isBLinkHorizontal === undefined) {
        if (isALinkVertical) { // If A is both vertical and horizontal, do not create new nodes
            // A is vertical, B is target
            console.log(`A is vertical, B is target: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
            a.y = b.y;
            return [a, b];
        } else {
            // A is horizontal, B is target
            console.log(`A is horizontal, B is target: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
            return [a,
                    { id: getNonce(), x: a.x, y: b.y },
                    b];
        }
    }

    if (isALinkHorizontal && isBLinkHorizontal) {
        // Both points are horizontal
        console.log(`Both points are horizontal: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
        a.x = b.x;
        return [a, b];
    } else if (isALinkHorizontal && !isBLinkHorizontal) {
        // A is horizontal, B is vertical
        console.log(`A is horizontal, B is vertical: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
        a.x = b.x;
        return [a, b];
    } else if (!isALinkHorizontal && isBLinkHorizontal) {
        // A is vertical, B is horizontal
        console.log(`A is vertical, B is horizontal: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
        a.y = b.y;
        return [a, b];
    } else {
        // Both points are vertical
        console.log(`Both points are vertical: ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
        a.y = b.y;  
        return [a, b];
    }
}

type Point = {
    id: IdType;
    x: number;
    y: number;
} | {
    x: number;
    y: number;
}

type FullPoint = {
    id: IdType;
    x: number;
    y: number;
};

// Main function to update links' intermediate nodes
function updateLinksDogLeg(json: JsonData, movedBlockId: IdType | undefined = undefined, removeColinear: boolean = true): JsonData {
    if (!json.links) {return json;}

    for (const link of json.links) {
        // Build the full list of points: source, ...intermediate, target
        let points: Point[] = [
            { x: link.sourceX, y: link.sourceY },
            ...(structuredClone(link.intermediateNodes) || []),
            { x: link.targetX, y: link.targetY }
        ];

        console.log(`Link ${link.id} points before dog leg: ${JSON.stringify(points)}`);


        let preferenceToMove: "A" | "B" = "A";
        if (movedBlockId && link.sourceId === movedBlockId) {
            preferenceToMove = "A";
        } else if (movedBlockId && link.targetId === movedBlockId) {
            preferenceToMove = "B";
        }

        for (let i = 0; i < points.length - 1; ++i) {
            const a = points[i];
            const b = points[i + 1];
            
            if (Math.abs(a.x - b.x) < distanceToJoin || Math.abs(a.y - b.y) < distanceToJoin) {
                ;
            } else {
                // Generate dog leg points
                let preA: Point | undefined = undefined;
                if (i >= 1) {
                    preA = points[i - 1];
                }
                let postB: Point | undefined = undefined;
                if (i + 2 < points.length) {
                    postB = points[i + 2];
                }

                const dogLegs = realignPoints(
                    preA,
                    { id: 'id' in a ? a.id : 'Source', x: a.x, y: a.y },
                    { id: 'id' in b ? b.id : 'Target', x: b.x, y: b.y },
                    postB,
                    preferenceToMove
                );

                console.log(`Dog legs: ${JSON.stringify(dogLegs)}`);
                
                points[i].x = dogLegs[0].x;
                points[i].y = dogLegs[0].y;
                points[i + 1].x = dogLegs[dogLegs.length - 1].x;
                points[i + 1].y = dogLegs[dogLegs.length - 1].y;
                
                // Add nodes on dogLegs excluding the last
                for (let j = 1; j < dogLegs.length - 1; ++j) {
                    const point = dogLegs[j];
                    console.log(`Node: ${JSON.stringify(point)} evaluated`);
                    console.log(`Adding intermediate node: ${JSON.stringify(point)}`);
                    points.splice(i + 1, 0, point);
                    i++;
                }
            }
        }

        if (removeColinear) {
            for (let i = 0; i < points.length-2; ++i) {
                const a = points[i];
                const b = points[i + 1];
                const c = points[i + 2];

                // If three points are collinear, remove the middle one
                if ((Math.abs(a.x - b.x) < distanceToJoin && Math.abs(b.x - c.x) < distanceToJoin)) {
                    console.log(`Removing collinear intermediate node: ${JSON.stringify(b)}, between ${JSON.stringify(a)} and ${JSON.stringify(c)}`);
                    points.splice(i + 1, 1);
                    points[i + 1].x = a.x;
                    i--; // Adjust index after removal
                } else if ((Math.abs(a.y - b.y) < distanceToJoin && Math.abs(b.y - c.y) < distanceToJoin)) {
                    console.log(`Removing collinear intermediate node: ${JSON.stringify(b)}, between ${JSON.stringify(a)} and ${JSON.stringify(c)}`);
                    points.splice(i + 1, 1);
                    points[i + 1].y = a.y;
                    i--; // Adjust index after removal
                }
            }
        }
        

        // Remove last point and convert to FullPoint
        points.pop();
        points.shift();
        let pointsFull = points as FullPoint[];

        console.log(`Link ${link.id} intermediate nodes before: ${JSON.stringify(link.intermediateNodes)}`);
        console.log(`Link ${link.id} intermediate nodes after: ${JSON.stringify(pointsFull)}`);
        link.intermediateNodes = structuredClone(pointsFull);
    }
    return json;
}


