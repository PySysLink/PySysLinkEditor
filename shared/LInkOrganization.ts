import { getPortPosition, updateLinkInJson } from "./JsonManager";
import { IdType, JsonData, LinkData } from "./JsonTypes";

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


function updateLinksDogLeg(json: JsonData): JsonData {
  return {
    ...json,
    links: json.links?.map(link => {
      // 1) recompute source & target port centers
      const srcPos = getPortPosition(json, link.sourceId, "output", link.sourcePort);
      const tgtPos = getPortPosition(json, link.targetId,   "input",  link.targetPort);
      if (!srcPos || !tgtPos) {return link;}  // leave it alone if port not found

      const sourceX = srcPos.x, sourceY = srcPos.y;
      const targetX = tgtPos.x, targetY = tgtPos.y;

      // 2) compute a mid‑X for the dog‑leg
      const midX = (sourceX + targetX) / 2;

      // 3) build exactly two intermediate “junction” nodes
      const intermediateNodes = [
        { id: `${link.id}_n1`, x: midX, y: sourceY },
        { id: `${link.id}_n2`, x: midX, y: targetY }
      ];

      // 4) return the updated link
      return {
        ...link,
        sourceX,
        sourceY,
        targetX,
        targetY,
        intermediateNodes
      };
    })
  };
  
}