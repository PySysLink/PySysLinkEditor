import * as vscode from 'vscode';
import { BlockData, IdType, JsonData } from '../../shared/JsonTypes';
import { updateBlockParameters } from '../../shared/JsonManager';

class DocumentManager {
	private documentLock: Promise<void> = Promise.resolve();

    private document: vscode.TextDocument;
    public get documentUri(): vscode.Uri {
        return this.document.uri;
    }

    private lastVersion: number = 0;


    constructor(document: vscode.TextDocument) {
        this.document = document;
    }
    
    private printJsonDiff(obj1: any, obj2: any, path: string = ''): void {
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
            if (obj1 !== obj2) {
                console.log(`Value mismatch server at ${path}: ${obj1} !== ${obj2}`);
            }
            return;
        }

        const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

        for (const key of keys) {
            const newPath = path ? `${path}.${key}` : key;
            this.printJsonDiff(obj1?.[key], obj2?.[key], newPath);
        }
    }


    public updateBlockParameters = async (block: BlockData): Promise<void> => {
        if (!this.isBlockInDocument(block.id)) {
            console.warn(`Block with id ${block.id} is not in the current document.`);
            return;
        }
        await this.withDocumentLock(async () => {
            if (this.document) {
                let json = this.getDocumentAsJson(this.document);
                json = updateBlockParameters(json, block);
                json = await this.updateBlockRenderInformation(json);
                await this.updateTextDocument(this.document, json);
            }
        });
        this.updateWebview();
    };

    public isBlockInDocument = (blockId: IdType): boolean => {
        if (this.document) {
            const json = this.getDocumentAsJson(this.document);
            let result = json.blocks?.some(block => block.id === blockId);
            if (result === undefined) {
                result = false;
            }
            return result;
        }
        return false;
    };

    

    private async withDocumentLock<T>(callback: () => Promise<T>): Promise<T> {
        console.log('Acquiring lock...');

        // Chain the new operation to the existing lock
        const releaseLock = this.documentLock.then(() => callback());
        this.documentLock = releaseLock.then(() => undefined).catch(() => {}); // Prevent lock from breaking on errors
        console.log('Lock released.');

        return releaseLock;
    }

    private getDocumentAsJson = (document: vscode.TextDocument): JsonData => {
        const text = document.getText();
        if (text.trim().length === 0) {
            this.lastVersion += 1;
            return { version: this.lastVersion, blocks: [], links: [], simulation_configuration: "", initialization_python_script_path: "", toolkit_configuration_path: "" };
        }
    
        try {
            const json = JSON.parse(text);
            this.lastVersion += 1;
            json.version = this.lastVersion;
            json.blocks = Array.isArray(json.blocks) ? json.blocks : [];
            json.links = Array.isArray(json.links) ? json.links : [];
            return json;
        } catch (error) {
            console.error('Error parsing document JSON:', error);
            throw new Error('Could not get document as json. Content is not valid json');
        }
    };


    private updateTextDocument = async (document: vscode.TextDocument, json: JsonData) => {
        console.log('Updating text document with new JSON data...');

        // Replace the entire document
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(json, null, 2)
        );

        return vscode.workspace.applyEdit(edit);
    };


    public getSimulationOptionsPath = (): string | undefined => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			return json.simulation_configuration;
		}
		return undefined;
	};
	
	public getInitializationScriptPath = (): string | undefined => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			return json.initialization_python_script_path;
		}
		return undefined;
	};
	
	public getToolkitConfigurationPath = (): string | undefined => {
		if (this.document) {
			const json = this.getDocumentAsJson(this.document);
			return json.toolkit_configuration_path;
		}
		return undefined;
	};

	public changeSimulationsOptionsFile = (newPath: string): void => {
		if (this.document) {
			
			this.withDocumentLock(async () => {
				const json = this.getDocumentAsJson(this.document);
				json.simulation_configuration = newPath;	
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentSimulationOptionsPath(newPath);
		}
	};
	
	public changeInitializationScriptFile = (newPath: string): void => {
		if (this.document) {
			
			this.withDocumentLock(async () => {
				let json = this.getDocumentAsJson(this.document);
				json.initialization_python_script_path = newPath;
				json = await this.updateBlockRenderInformation(json);	
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentInitializationScriptPath(newPath);
		}
	};
	
	public changeToolkitConfigurationFile = (newPath: string): void => {
		if (this.document) {
			
			this.withDocumentLock(async () => {
				let json = this.getDocumentAsJson(this.document);
				json.toolkit_configuration_path = newPath;	
				json = await this.updateBlockRenderInformation(json);
				await this.updateTextDocument(this.document!, json);
			});

			this.simulationManager.setCurrentToolkitConfigurationFilePath(newPath);
		}
	};
}
