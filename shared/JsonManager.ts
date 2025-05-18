import { IdType, JsonData, BlockData, LinkData } from "./JsonTypes";

export function MergeJsons(
    jsonBase: JsonData,
    jsonChildPriority: JsonData,
    jsonChild2: JsonData
): JsonData {
    const mergedJson: JsonData = {
        version: Math.max(jsonBase.version, jsonChildPriority.version, jsonChild2.version),
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
            result.push(mergeObject(baseItem, priorityItem, secondaryItem));
            seenIds.add(baseItem.id);
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

    return mergedJson;
}

export function deleteBlockFromJson(json: JsonData, blockId: IdType): JsonData {
    let updatedLinks = json.links;
    if (updatedLinks) {
        updatedLinks.forEach(link => {
            if (link.sourceId === blockId) {
                link.sourceId = undefined;
                link.sourcePort = -1;
            }
            if (link.targetId === blockId) {
                link.targetId = undefined;
                link.targetPort = -1;
            }
        });
    }
    const updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.filter(block => block.id !== blockId),
        links: updatedLinks
    };
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
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.filter(link => link.id !== linkId)
    };
    return updatedJson;
}

export function updateBlockFromJson(json: JsonData, updatedBlock: BlockData): JsonData {
    const updatedJson: JsonData = {
        ...json,
        blocks: json.blocks?.map(block => (block.id === updatedBlock.id ? updatedBlock : block))
    };
    return updatedJson;
}

export function updateLinkFromJson(json: JsonData, updatedLink: LinkData): JsonData {
    const updatedJson: JsonData = {
        ...json,
        links: json.links?.map(link => (link.id === updatedLink.id ? updatedLink : link))
    };
    return updatedJson;
}