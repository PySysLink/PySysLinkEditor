import { addBlockToJson, addLinkToJson, attachLinkToPort, consolidateLinkNodes, deleteBlockFromJson, deleteIntermediateNodeFromJson, deleteLinkFromJson, getPortPosition, MergeJsons, moveBlockInJson, moveLinkDelta, moveSourceNode, moveTargetNode, rotateBlock, setPositionForLinkNode, updateBlockFromJson, updateLinkInJson } from "../shared/JsonManager";
import { BlockData, IdType, JsonData, LinkData, Rotation } from "../shared/JsonTypes";
import { getNonce } from "./util";
import { Library } from "../shared/BlockPalette";
import { moveLinkSegment, updateLinksAfterBatchMove } from "../shared/LInkOrganization";


export class CommunicationManager {
    vscode: any;
    freezed: boolean = false;
    freezedLocalJsonCallback: boolean = false;
    freezedLinkUpdates: boolean = false;
    disableSending: boolean = false;

    private localJson: JsonData | undefined;
    private serverJsonBeforeFreeze: JsonData | undefined;
    private serverJson: JsonData | undefined;

    private localJsonChangedCallbacks: ((json: JsonData) => void)[] = [];


    libraries: Library[] = [];
    librariesChangedCallbacks: ((json: Library[]) => void)[] = [];

    constructor(vscode: any) {
        this.vscode = vscode;
    }

    print(text: string) {
        this.vscode.postMessage({
            type: 'print',
            text: text
        });
    }

    public registerLocalJsonChangedCallback(callback: (json: JsonData) => void) {
        this.localJsonChangedCallbacks.push(callback);
    }

    public registerLibrariesChangedCallback(callback: (libraries: Library[]) => void) {
        this.librariesChangedCallbacks.push(callback);
    }

    public freeze() {
        this.print("Freeze called");
        if (!this.freezed) {
            this.freezed = true;
            this.serverJsonBeforeFreeze = this.localJson;
        }
    }

    public freezeLocalJsonCallback() {
        this.print("Freeze local json callbacks");
        if (!this.freezedLocalJsonCallback) {
            this.freezedLocalJsonCallback = true;
        }
    }

    public freezeLinkUpdates() {
        this.print("Freeze link updates");
        if (!this.freezedLinkUpdates) {
            this.freezedLinkUpdates = true;
        }
    }

    public unfreeze() {
        this.print("Unfreeze called");
        if (this.freezed) {
            this.freezed = false;
            let mergedJson: JsonData | undefined = undefined;
            if (this.serverJson && this.serverJsonBeforeFreeze && this.localJson) {
                this.print("All ready to send freezed json");
                mergedJson = MergeJsons(this.serverJsonBeforeFreeze, this.localJson, this.serverJson);
            } else if (this.serverJsonBeforeFreeze && this.localJson) {
                mergedJson = MergeJsons(this.serverJsonBeforeFreeze, this.localJson, this.localJson);
            }
            if (mergedJson) {
                this.print("set merged json");
                this.setLocalJson(mergedJson);
                this.serverJson = undefined;
                this.serverJsonBeforeFreeze = undefined;
            }
        }
    }

    public unfreezeLocalJsonCallback() {
        this.print("Unfreeze local json callback called");
        if (this.freezedLocalJsonCallback) {
            this.freezedLocalJsonCallback = false;
            this.localJsonChangedCallbacks.forEach(callback => {
                if (this.localJson) {
                    callback(this.localJson);
                }
            });
        }
    }

    public unfreezeLinkUpdates() {
        this.print("Unfreeze link updates called");
        if (this.freezedLinkUpdates) {
            this.freezedLinkUpdates = false;
            this.consolidateLinks();
        }
    }

    private printJsonDiff(obj1: any, obj2: any, path: string = ''): void {
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
            if (obj1 !== obj2) {
                this.print(`Value mismatch at ${path}: ${obj1} !== ${obj2}`);
            }
            return;
        }

        const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

        for (const key of keys) {
            const newPath = path ? `${path}.${key}` : key;
            this.printJsonDiff(obj1?.[key], obj2?.[key], newPath);
        }
    }

    public setLocalJson(json: JsonData, sendToServer: boolean = true) {
        this.print(`Setting local JSON`);
        if (JSON.stringify(json) === JSON.stringify(this.localJson)) {
            return;
        } else {
            this.print('JSON changed:');
            this.printJsonDiff(this.localJson, json);
        }

        this.localJson = json;
        
        this.vscode.setState({ text: JSON.stringify(this.localJson) });
        if (!this.freezed && sendToServer) {
            this.localJson = consolidateLinkNodes(this.localJson);
            this.sendJsonToServer(this.localJson);
        } 
        if (!this.freezedLocalJsonCallback) {
            this.localJsonChangedCallbacks.forEach(callback => {
                if (this.localJson) {
                    callback(this.localJson);
                }
            });
        }
    }                                                                                                                                                                                                                                                                    

    private sendJsonToServer(json: JsonData) {
        this.vscode.postMessage({
            type: 'updateJson',
            json: json
        });
    }

    public getLocalJson(): JsonData | undefined {
        return this.localJson;
    }

    public newJsonFromServer(json: JsonData) {
        if (this.freezed) {
            if (this.serverJson === undefined) {
                this.serverJson = json;
            } else if (this.serverJson.version < json.version) {
                this.serverJson = json;
            }
        }
        else {
            let localJson = this.getLocalJson();
            if (localJson === undefined) {
                this.print('No local JSON, setting new JSON from server');
                this.setLocalJson(json, false);
            } else {
                this.print('Setting local JSON with server JSON');
                this.setLocalJson(json, false);
            }
        }
    }

    public notifyBlockSelected = (blockId: IdType, selected: boolean) => {
        if (selected) {
            this.vscode.postMessage({ type: 'blockSelected', blockId: blockId });
        } else {
            this.vscode.postMessage({ type: 'blockUnselected', blockId: blockId });
        }
    };

    public notifyDoubleClickOnBlock(id: string) {
        this.vscode.postMessage({ type: 'doubleClickOnBlock', blockId: id});
    }

    public deleteBlock = (blockId: IdType) => {
        let json = this.getLocalJson();
        if (json) {
            this.print(`Delete block: ${blockId}`);
            let newJson = deleteBlockFromJson(json, blockId);
            this.setLocalJson(newJson, true);
        }
    };

    public addBlock = (block: BlockData) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = addBlockToJson(json, block);
            this.setLocalJson(newJson, true);
        }
    };

    public addLink = (link: LinkData) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = addLinkToJson(json, link);
            this.setLocalJson(newJson, true);
        }
    };

    public deleteLink = (linkId: IdType) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = deleteLinkFromJson(json, linkId);
            this.setLocalJson(newJson, true);
        }
    };

    public deleteIntermediateNode = (nodeId: IdType) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = deleteIntermediateNodeFromJson(json, nodeId);
            this.print(`Delete intermediate node: ${nodeId}`);
            this.setLocalJson(newJson, true);
        }
    };

    public setPositionForLinkNode = (linkId: IdType, nodeId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = setPositionForLinkNode(json, linkId, nodeId, x, y);
            this.print(`Set position for link node: ${nodeId} of link: ${linkId} to (${x}, ${y})`);
            this.setLocalJson(newJson, true);
        }
    };

    public updateBlock = (block: BlockData) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = updateBlockFromJson(json, block, !this.freezedLinkUpdates);
            this.print(`Update block: ${block.id}`);
            this.setLocalJson(newJson, true);
        }
    };

    public updateLink = (link: LinkData): void => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = updateLinkInJson(json, link);
            this.print(`Update link: ${link.id}`);
            this.setLocalJson(newJson, true);
        }
    };

    public consolidateLinks = () => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = consolidateLinkNodes(json);
            this.print(`Consolidate links`);
            this.setLocalJson(newJson, true);
        }
    };

    public createNewLinkFromPort = (blockId: IdType, portType: "input" | "output", portIndex: number) : LinkData | undefined => {
        let json = this.getLocalJson();
        if (json) {
            let newLink: LinkData = {
                id: getNonce(),
                sourceId: portType === "output" ? blockId : "undefined",
                targetId: portType === "input" ? blockId : "undefined",
                sourcePort: portType === "output" ? portIndex : -1,
                targetPort: portType === "input" ? portIndex : -1,
                sourceX: this.getPortPosition(blockId, portType, portIndex)?.x || 0,
                sourceY: this.getPortPosition(blockId, portType, portIndex)?.y || 0,
                targetX: this.getPortPosition(blockId, portType, portIndex)?.x || 0,
                targetY: this.getPortPosition(blockId, portType, portIndex)?.y || 0,
                intermediateNodes: []
            };
            let newJson = addLinkToJson(json, newLink);
            this.print(`Create new link from port: ${JSON.stringify(newLink)}`);
            this.setLocalJson(newJson, true);
            return newLink;
        }
        return undefined;
    };

    public getPortPosition = (blockId: IdType, portType: "input" | "output", portIndex: number, ignoreRotation: boolean = false): { x: number, y: number } | undefined => {
        let json = this.getLocalJson();
        if (json) {
            return getPortPosition(json, blockId, portType, portIndex, ignoreRotation);
        }
        return undefined;
    };

    public attachLinkToPort = (linkId: IdType, blockId: IdType, portType: "input" | "output", portIndex: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = attachLinkToPort(json, linkId, blockId, portType, portIndex);
            this.setLocalJson(newJson, true);
        }
    };

    public moveBlock = (blockId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveBlockInJson(json, blockId, x, y, !this.freezedLinkUpdates);
            this.print(`Move block: ${blockId} to position (${x}, ${y})`);
            this.setLocalJson(newJson, true);
        }
    };

    public rotateBlock = (blockId: IdType, rotation: Rotation) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = rotateBlock(json, blockId, rotation, !this.freezedLinkUpdates);
            this.print(`Rotate block: ${blockId} to rotation ${rotation}`);
            this.setLocalJson(newJson, true);
        }
    };

    public moveLinkDelta = (linkId: IdType, deltaX: number, deltaY: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveLinkDelta(json, linkId, deltaX, deltaY);
            this.print(`Move link: ${linkId} by delta (${deltaX}, ${deltaY})`);
            this.setLocalJson(newJson, true);
        }
    };


    public moveSourceNode = (linkId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveSourceNode(json, linkId, x, y);
            this.print(`Move source node of link: ${linkId} to position (${x}, ${y})`);
            this.setLocalJson(newJson, true);
        }
    };

    public moveTargetNode = (linkId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveTargetNode(json, linkId, x, y);
            this.print(`Move target node of link: ${linkId} to position (${x}, ${y})`);
            this.setLocalJson(newJson, true);
        }
    };

    public requestUpdatePalette() {
        this.vscode.postMessage({ type: 'updateBlockPalette' });
    }

    public setBlockLibraries(libraries: Library[]) {
        this.print(`Libraries are: ${JSON.stringify(libraries)}`);
        this.libraries = libraries;
        this.librariesChangedCallbacks.forEach(callback => callback(this.libraries));
    }

    public createBlockOfType(library: string, blockType: string, x: number, y: number) {
        // Find the block definition from the libraries
        const lib = this.libraries.find(l => l.name === library);
        const blockDef = lib?.blockTypes.find(b => b.name === blockType);

        if (!lib || !blockDef) {
            this.print(`Block type ${blockType} not found in library ${library}`);
            return;
        }

        let properties: Record<string, {type: string, value: any}> = {};
        if (blockDef.configurationValues) {
            for (const key in blockDef.configurationValues) {
                const conf = blockDef.configurationValues[key];
                properties[conf.name] = {type: conf.type, value: conf.defaultValue};
            }
        }

        this.print(`Properties are: ${JSON.stringify(properties)}, from configuration values: ${JSON.stringify(blockDef.configurationValues)}`);

        // Create the BlockData object
        const newBlock: BlockData = {
            id: getNonce(),
            blockLibrary: library,
            blockType: blockType,
            label: blockType,
            x,
            y,
            rotation: 0,
            inputPorts: 0,
            outputPorts: 0, 
            properties: properties
        };

        this.addBlock(newBlock);
    }

    public moveLinkSegment(link: LinkData,
        sourceIntermediateNodeId: IdType,
        targetIntermediateNodeId: IdType,
        targetPositionX: number,
        targetPositionY: number) {
        
        let json = this.getLocalJson();
        if (json) {
            this.print(`Move link segment from ${sourceIntermediateNodeId} to ${targetIntermediateNodeId} at position (${targetPositionX}, ${targetPositionY})`);
            let newJson = moveLinkSegment(json, link, sourceIntermediateNodeId, targetIntermediateNodeId, targetPositionX, targetPositionY);
            this.setLocalJson(newJson, true);
        }
    }

    public updateLinksAfterBatchMove() {
        let json = this.getLocalJson();
        if (json) {
            let newJson = updateLinksAfterBatchMove(json);
            this.setLocalJson(newJson, true);
        }
    }
}