import * as vscode from 'vscode';
import { getNonce } from './util';

export function addLink(
    sourceId: string,
    sourcePort: number,
    targetId: string,
    targetPort: number,
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    intermediateNodes: { id: string; x: number; y: number }[] = [],
    json: any
): any {
    const links = Array.isArray(json.links) ? json.links : [];

    const newLink = {
        id: getNonce(),
        sourceId: sourceId,
        sourcePort: sourcePort,
        targetId: targetId,
        targetPort: targetPort, 
        sourceX: sourceX,
        sourceY: sourceY,
        targetX: targetX,
        targetY: targetY,
        intermediateNodes: intermediateNodes 
    };
    links.push(newLink);
    json.links = links;

    console.log(`Added link between ${sourceId}:${sourcePort} and ${targetId}:${targetPort}`);
    return json;
}

export function moveLinkBatch(updates: { type: string;
    id: string;
    sourceId: string;
    sourcePort: number;
    targetId: string;
    targetPort: number;
    nodeIndex: number;
    nodeId: string;
    x: number;
    y: number;
    }[],
    json: any): any {

    // Iterate over each update and apply the changes
    updates.forEach(update => {
        
        const link = json.links.find((link: any) =>
            link.id === update.id
        );
        if (link) {
            if (update.nodeIndex === -1) { // sourceNode
                link.sourceId = update.sourceId;
                link.sourcePort = update.sourcePort;
                link.sourceX = update.x;
                link.sourceY = update.y;
            } else if (update.nodeIndex === -2) { // targetNode
                link.targetId = update.targetId;
                link.targetPort = update.targetPort;
                link.targetX = update.x;
                link.targetY = update.y;
            } else {
                if (Array.isArray(link.intermediateNodes)) {
                    const existingNodeIndex = link.intermediateNodes.findIndex((node: { id: string; x: number; y: number }) => node.id === update.nodeId);
                
                    if (existingNodeIndex === -1) {
                        // Node with unknown ID: Append it at the specified index
                        link.intermediateNodes.splice(update.nodeIndex, 0, { id: update.nodeId, x: update.x, y: update.y });
                        console.log(`Added new intermediate node with ID ${update.nodeId} at index ${update.nodeIndex}`);
                    } else {
                        // Node exists: Update its position and move it to the correct index if necessary
                        const node = link.intermediateNodes[existingNodeIndex];
                        node.x = update.x;
                        node.y = update.y;
                
                        if (existingNodeIndex !== update.nodeIndex) {
                            // Move the node to the correct index
                            link.intermediateNodes.splice(existingNodeIndex, 1); // Remove from current position
                            link.intermediateNodes.splice(update.nodeIndex, 0, node); // Insert at the correct position
                            console.log(`Moved intermediate node with ID ${update.nodeId} from index ${existingNodeIndex} to ${update.nodeIndex}`);
                        } else {
                            console.log(`Updated intermediate node with ID ${update.nodeId} at index ${update.nodeIndex}`);
                        }
                    }
                } else {
                    console.warn(`Intermediate nodes array is not valid for link ID ${link.id}`);
                }
            }
        }
    });

    // Save the updated JSON back to the document
    return json;
}

