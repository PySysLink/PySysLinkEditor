import { MergeJsons } from "../shared/JsonManager";
import { JsonData } from "../shared/JsonTypes";


export class CommunicationManager {

    vscode: any;
    freezed: boolean = false;

    private localJson: JsonData | undefined;
    private serverJsonBeforeFreeze: JsonData | undefined;
    private serverJson: JsonData | undefined;

    private localJsonChangedCallbacks: ((json: JsonData) => void)[] = [];

    constructor(vscode: any) {
        this.vscode = vscode;
    }

    public registerLocalJsonChangedCallback(callback: (json: JsonData) => void) {
        this.localJsonChangedCallbacks.push(callback);
    }

    public freeze() {
        this.freezed = true;
        this.serverJsonBeforeFreeze = this.localJson;
    }

    public unfreeze() {
        this.freezed = false;
        if (this.serverJson && this.serverJsonBeforeFreeze && this.localJson) {
            let mergedJson = MergeJsons(this.serverJsonBeforeFreeze, this.localJson, this.serverJson);
            this.setLocalJson(mergedJson);
            this.serverJson = undefined;
            this.serverJsonBeforeFreeze = undefined;
        }
    }

    public setLocalJson(json: JsonData, sendToServer: boolean = true) {
        this.localJson = json;
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
            command: 'updateJson',
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
}