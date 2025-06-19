import { getPortPosition, updateLinkInJson } from "./JsonManager";
import { IdType, JsonData, LinkData } from "./JsonTypes";
import { getNonce } from "./util";

export function updateLinksAfterBlockMove(json: JsonData): JsonData {
    return updateLinksDogLeg(json);
}

export function updateLinksAfterBlockUpdate(json: JsonData): JsonData {
    return updateLinksDogLeg(json);
}

export function updateLinksAfterMerge(json: JsonData): JsonData {
    return updateLinksDogLeg(json);
}

export function updateLinksAfterNodesUpdated(json: JsonData): JsonData {
    return updateLinksDogLeg(json);
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
        if (nodes[0].id === targetIntermediateNodeId) {
            nodes.splice(0, 0, {
                id: `${link.id}_auto_source_${Date.now()}`,
                x: link.sourceX,
                y: link.sourceY
            });
        }
        sourceIntermediateNodeId = nodes[0].id;
    }

    if (targetIntermediateNodeId === "TargetNode") {
        if (nodes[nodes.length - 1].id === sourceIntermediateNodeId) {
            nodes.push({
                id: `${link.id}_auto_target_${Date.now()}`,
                x: link.targetX,
                y: link.targetY
            });
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
    const isHorizontal = nodes[i1].y === nodes[i2].y;
    const isVertical = nodes[i1].x === nodes[i2].x;

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
    const bendInBefore = (isHorizontal && prevPoint.x !== nodes[i1].x) ||
                         (isVertical && prevPoint.y !== nodes[i1].y);

    let beforeBend: { id: IdType; x: number; y: number } | undefined = undefined;
    if (bendInBefore) {
        beforeBend = {
            id: `${link.id}_auto_pre_${Date.now()}`,
            x: isHorizontal ? nodes[i1].x : prevPoint.x,
            y: isVertical ? nodes[i1].y : prevPoint.y
        };
    }

    // Fix corner after segment
    const bendInAfter = (isHorizontal && nextPoint.x !== nodes[i2].x) ||
                        (isVertical && nextPoint.y !== nodes[i2].y);

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

    if (beforeBend) {
        nodes.splice(i1, 0, beforeBend);
        // Adjust indices since we added a node before i1
        i2 += 1;
    }
    if (afterBend) {
        nodes.splice(i2 + 1, 0, afterBend);
    }

    console.log(`Final intermediate nodes after move:`, JSON.stringify(nodes));
    
    link.intermediateNodes = nodes;

    return updateLinkInJson(json, link);
}

function realignPoints(
    preA: Point | undefined,
    a: FullPoint,
    b: FullPoint,
    postB: Point | undefined
): FullPoint[] {
    let isALinkHorizontal: boolean | undefined = undefined;
    if (preA) {
        isALinkHorizontal = a.y === preA.y;
        if (!isALinkHorizontal && a.x !== preA.x) {
            throw new Error(`Points A and preA are not aligned horizontally or vertically: ${JSON.stringify(a)}, ${JSON.stringify(preA)}`);
        }
    } 
    let isBLinkHorizontal: boolean | undefined = undefined;
    if (postB) {
        isBLinkHorizontal = b.y === postB.y;
        if (!isBLinkHorizontal && b.x !== postB.x) {
            throw new Error(`Points B and postB are not aligned horizontally or vertically: ${JSON.stringify(b)}, ${JSON.stringify(postB)}`);
        }
    }

    if (isALinkHorizontal === undefined) {
        if (isBLinkHorizontal === undefined) {
            // Both points are source and target
            return [a,
                    { id: getNonce(), x: a.x, y: (a.y + b.y)/2 },
                    { id: getNonce(), x: b.x, y: (a.y + b.y)/2 },
                    b];
        } else if (isBLinkHorizontal) {
            // A is source, B is horizontal
            return [a,
                    { id: getNonce(), x: a.x, y: b.y },
                    b];
        } else {
            // A is source, B is vertical
            b.x = a.x;
            return [a, b];
        }
    }

    if (isBLinkHorizontal === undefined) {
        if (isALinkHorizontal) {
            // A is horizontal, B is target
            return [a,
                    { id: "AutoDogLegLeft", x: b.x, y: a.y },
                    b];
        } else {
            // A is vertical, B is target
            a.x = b.x;
            return [a, b];
        }
    }

    if (isALinkHorizontal && isBLinkHorizontal) {
        // Both points are horizontal
        a.x = b.x;
        return [a, b];
    } else if (isALinkHorizontal && !isBLinkHorizontal) {
        // A is horizontal, B is vertical
        a.x = b.x;
        return [a, b];
    } else if (!isALinkHorizontal && isBLinkHorizontal) {
        // A is vertical, B is horizontal
        a.y = b.y;
        return [a, b];
    } else {
        // Both points are vertical
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
function updateLinksDogLeg(json: JsonData): JsonData {
    if (!json.links) {return json;}

    for (const link of json.links) {
        // Build the full list of points: source, ...intermediate, target
        const points: Point[] = [
            { x: link.sourceX, y: link.sourceY },
            ...(link.intermediateNodes || []),
            { x: link.targetX, y: link.targetY }
        ];

        let newIntermediate: { id: string, x: number, y: number }[] = [];

        for (let i = 0; i < points.length - 1; ++i) {
            const a = points[i];
            const b = points[i + 1];
            
            if (a.x === b.x || a.y === b.y) {
                // Check if id field exists on a
                if ('id' in a) {
                    newIntermediate.push(a);
                }
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
                    { id: 'id' in a ? a.id : 'Target', x: b.x, y: b.y },
                    postB
                );
                
                // Add the first point (a) and all dog legs
                if ('id' in a) {
                    newIntermediate.push(a);
                } 
                newIntermediate.push(...dogLegs);
            }
        }

        for (let i = 0; i < newIntermediate.length-2; ++i) {
            const a = newIntermediate[i];
            const b = newIntermediate[i + 1];
            const c = newIntermediate[i + 2];

            // If three points are collinear, remove the middle one
            if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
                newIntermediate.splice(i + 1, 1);
                i--; // Adjust index after removal
            }
        }

        link.intermediateNodes = newIntermediate;
    }
    return json;
}


