import { addBlockToJson, addLinkToJson, attachLinkToPort, deleteBlockFromJson, deleteLinkFromJson, getPortPosition, MergeJsons, moveBlockInJson, moveLinkDelta, moveLinkNode, moveSourceNode, moveTargetNode, updateBlockFromJson, updateLinkFromJson, updateLinksNodesPosition } from "../shared/JsonManager";
import { BlockData, IdType, JsonData, LinkData } from "../shared/JsonTypes";
import { getNonce } from "./util";


export class CommunicationManager {

    vscode: any;
    freezed: boolean = false;
    disableSending: boolean = false;

    private localJson: JsonData | undefined;
    private serverJsonBeforeFreeze: JsonData | undefined;
    private serverJson: JsonData | undefined;

    private localJsonChangedCallbacks: ((json: JsonData) => void)[] = [];

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

    public freeze() {
        this.print("Freeze called");
        if (!this.freezed) {
            this.freezed = true;
            this.serverJsonBeforeFreeze = this.localJson;
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
                console.log("set merged json");
                this.setLocalJson(mergedJson);
                this.serverJson = undefined;
                this.serverJsonBeforeFreeze = undefined;
            }
        }
    }

    public setLocalJson(json: JsonData, sendToServer: boolean = true) {
        this.localJson = json;
        console.log(`New json:`);
        console.log(this.localJson);
        if (!this.freezed && sendToServer) {
            this.sendJsonToServer(json);
        } 
        this.localJsonChangedCallbacks.forEach(callback => {
            if (this.localJson) {
                callback(this.localJson);
            }
        });
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
                this.setLocalJson(json, false);
            } else if (localJson.version < json.version) {
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

    public updateBlock = (block: BlockData) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = updateBlockFromJson(json, block);
            this.setLocalJson(newJson, true);
        }
    };

    public updateLink = (link: LinkData): void => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = updateLinkFromJson(json, link);
            this.setLocalJson(newJson, true);
        }
    };

    public createNewBlock = () => {
        let json = this.getLocalJson();
        if (json) {
            let newBlock: BlockData = {
                id: getNonce(),
                label: "New Block",
                x: 0,
                y: 0,
                inputPorts: 1,
                outputPorts: 1,
                properties: {}
            };
            let newJson = addBlockToJson(json, newBlock);
            this.setLocalJson(newJson, true);
        }
    };

    public createNewLinkFromPort = (blockId: IdType, portType: "input" | "output", portIndex: number) : LinkData | undefined => {
        let json = this.getLocalJson();
        if (json) {
            let newLink: LinkData = {
                id: getNonce(),
                sourceId: blockId,
                targetId: "",
                sourcePort: portType === "input" ? portIndex : -1,
                targetPort: portType === "output" ? portIndex : -1,
                sourceX: this.getPortPosition(blockId, portType, portIndex)?.x || 0,
                sourceY: this.getPortPosition(blockId, portType, portIndex)?.y || 0,
                targetX: this.getPortPosition(blockId, portType, portIndex)?.x || 0,
                targetY: this.getPortPosition(blockId, portType, portIndex)?.y || 0,
                intermediateNodes: []
            };
            let newJson = addLinkToJson(json, newLink);
            this.setLocalJson(newJson, true);
            return newLink;
        }
        return undefined;
    };

    public getPortPosition = (blockId: IdType, portType: "input" | "output", portIndex: number): { x: number, y: number } | undefined => {
        let json = this.getLocalJson();
        if (json) {
            return getPortPosition(json, blockId, portType, portIndex);
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
            let newJson = moveBlockInJson(json, blockId, x, y);
            this.setLocalJson(newJson, true);
        }
    };

    public moveLinkDelta = (linkId: IdType, deltaX: number, deltaY: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveLinkDelta(json, linkId, deltaX, deltaY);
            this.setLocalJson(newJson, true);
        }
    };

    public moveLinkNode = (nodeId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveLinkNode(json, nodeId, x, y);
            this.setLocalJson(newJson, true);
        }
    };

    public moveSourceNode = (linkId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveSourceNode(json, linkId, x, y);
            this.setLocalJson(newJson, true);
        }
    };

    public moveTargetNode = (linkId: IdType, x: number, y: number) => {
        let json = this.getLocalJson();
        if (json) {
            let newJson = moveTargetNode(json, linkId, x, y);
            this.setLocalJson(newJson, true);
        }
    };
}