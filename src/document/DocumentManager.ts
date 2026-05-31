import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { BlockData, BlockRenderInformation, IdType, JsonData } from '../../shared/JsonTypes';
import { updateBlockParameters } from '../../shared/JsonManager';
import { PythonServerManager } from '../simulation/PythonServerManager';
import { SimulationManager } from '../SimulationManager';

export class DocumentManager {
    private documentLock: Promise<void> = Promise.resolve();
    private document: vscode.TextDocument;
    public get documentUri(): vscode.Uri {
        return this.document.uri;
    }

    private lastVersion: number = 0;
    private renderInfoCache: Map<string, BlockRenderInformation> = new Map();

    constructor(document: vscode.TextDocument, private readonly simulationManager: SimulationManager, private readonly pythonServer: PythonServerManager) {
        this.document = document;
    }

    public getJson(): JsonData {
        return this.getDocumentAsJson(this.document);
    }

    public async updateBlockParameters(block: BlockData): Promise<void> {
        if (!this.isBlockInDocument(block.id)) {
            console.warn(`Block with id ${block.id} is not in the current document.`);
            return;
        }

        await this.withDocumentLock(async () => {
            const json = this.getDocumentAsJson(this.document);
            const updated = updateBlockParameters(json, block);
            const rendered = await this.updateBlockRenderInformation(updated);
            await this.updateTextDocument(this.document, rendered);
        });
    }

    public isBlockInDocument(blockId: IdType): boolean {
        const json = this.getDocumentAsJson(this.document);
        return Array.isArray(json.blocks) && json.blocks.some(block => block.id === blockId);
    }

    public async writeJson(json: JsonData): Promise<void> {
        await this.withDocumentLock(async () => {
            const rendered = await this.updateBlockRenderInformation(json);
            await this.updateTextDocument(this.document, rendered);
        });
    }

    private async withDocumentLock<T>(callback: () => Promise<T>): Promise<T> {
        console.log('Acquiring lock...');

        const releaseLock = this.documentLock.then(() => callback());
        this.documentLock = releaseLock.then(() => undefined).catch(() => {});
        console.log('Lock released.');

        return releaseLock;
    }

    private getDocumentAsJson = (document: vscode.TextDocument): JsonData => {
        const text = document.getText();
        if (text.trim().length === 0) {
            this.lastVersion += 1;
            return {
                version: this.lastVersion,
                blocks: [],
                links: [],
                simulation_configuration: '',
                initialization_python_script_path: '',
                toolkit_configuration_path: ''
            };
        }

        try {
            const json = JSON.parse(text);
            this.lastVersion += 1;
            json.version = this.lastVersion;
            json.blocks = Array.isArray(json.blocks) ? json.blocks : [];
            json.links = Array.isArray(json.links) ? json.links : [];
            json.simulation_configuration = json.simulation_configuration ?? '';
            json.initialization_python_script_path = json.initialization_python_script_path ?? '';
            json.toolkit_configuration_path = json.toolkit_configuration_path ?? '';
            return json;
        } catch (error) {
            console.error('Error parsing document JSON:', error);
            throw new Error('Could not get document as json. Content is not valid json');
        }
    };

    private updateTextDocument = async (document: vscode.TextDocument, json: JsonData) => {
        console.log('Updating text document with new JSON data...');

        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(json, null, 2)
        );

        return vscode.workspace.applyEdit(edit);
    };

    public getSimulationOptionsPath(): string | undefined {
        const json = this.getDocumentAsJson(this.document);
        return json.simulation_configuration;
    }

    public getInitializationScriptPath(): string | undefined {
        const json = this.getDocumentAsJson(this.document);
        return json.initialization_python_script_path;
    }

    public getToolkitConfigurationPath(): string | undefined {
        const json = this.getDocumentAsJson(this.document);
        return json.toolkit_configuration_path;
    }

    public async changeSimulationsOptionsFile(newPath: string): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getDocumentAsJson(this.document);
            json.simulation_configuration = newPath;
            await this.updateTextDocument(this.document, json);
        });

        this.simulationManager.setCurrentSimulationOptionsPath(newPath);
    }

    public async changeInitializationScriptFile(newPath: string): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getDocumentAsJson(this.document);
            json.initialization_python_script_path = newPath;
            const rendered = await this.updateBlockRenderInformation(json);
            await this.updateTextDocument(this.document, rendered);
        });

        this.simulationManager.setCurrentInitializationScriptPath(newPath);
    }

    public async changeToolkitConfigurationFile(newPath: string): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getDocumentAsJson(this.document);
            json.toolkit_configuration_path = newPath;
            const rendered = await this.updateBlockRenderInformation(json);
            await this.updateTextDocument(this.document, rendered);
        });

        this.simulationManager.setCurrentToolkitConfigurationFilePath(newPath);
    }

    public async updateJsonContent(json: JsonData): Promise<void> {
        await this.writeJson(json);
    }

    private async updateBlockRenderInformation(json: JsonData): Promise<JsonData> {
        if (!this.pythonServer.isRunning()) {
            console.warn('Python server is not running, skipping block render information update.');
            return json;
        }

        const blocks = json.blocks ?? [];
        const blockPromises = blocks.map(async block => {
            try {
                const renderInfo = await this.getBlockRenderInformation(block, this.document.uri.fsPath);
                if (renderInfo) {
                    block.blockRenderInformation = renderInfo;
                    block.inputPorts = renderInfo.input_ports;
                    block.outputPorts = renderInfo.output_ports;
                    block.inputPortTypes = renderInfo.input_port_types;
                    block.outputPortTypes = renderInfo.output_port_types;
                }
            } catch (err) {
                console.error(`Error getting block render information for block ${block.id}:`, err);
            }
        });

        await Promise.all(blockPromises);
        return json;
    }

    private async getBlockRenderInformation(block: BlockData, pslkPath: string): Promise<BlockRenderInformation | undefined> {
        const cacheKey = this.hashBlockKey(block);
        const cached = this.renderInfoCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const result = await this.pythonServer.sendRequestAsync({
                method: 'getBlockRenderInformation',
                params: {
                    block,
                    pslkPath
                }
            }, 10000);

            const renderInfo = typeof result === 'string' ? JSON.parse(result) : result;
            if (renderInfo) {
                this.renderInfoCache.set(cacheKey, renderInfo);
            }
            return renderInfo;
        } catch (error) {
            console.error(`Error on python server while getting block render information: ${error}`);
            vscode.window.showErrorMessage(
                `Error on python server while getting block render information: ${error}`
            );
        }
    }

    private hashBlockKey(block: BlockData): string {
        const relevant = {
            blockLibrary: block.blockLibrary,
            blockType: block.blockType,
            label: block.label,
            inputPorts: block.inputPorts,
            outputPorts: block.outputPorts,
            properties: block.properties
        };

        return crypto.createHash('sha256').update(JSON.stringify(relevant)).digest('hex');
    }
}
