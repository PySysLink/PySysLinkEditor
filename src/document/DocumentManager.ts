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


    public getJson(subsystemIds: IdType[]): JsonData {
        const root = this.getDocumentAsJson(this.document);
        return this.getSubsystemJson(root, subsystemIds);
    }

    private getSubsystemJson(
        root: JsonData,
        subsystemIds: IdType[]
    ): JsonData {

        let current = root;

        for (const id of subsystemIds) {

            const subsystem =
                current.subsystems?.find(s => s.id === id);

            if (!subsystem) {
                throw new Error(
                    `Subsystem '${id}' not found.`
                );
            }

            current = subsystem.jsonData;
        }

        return current;
    }

    private replaceSubsystemJson(
        root: JsonData,
        subsystemIds: IdType[],
        newJson: JsonData
    ): JsonData {

        if (subsystemIds.length === 0) {
            return newJson;
        }

        let current = root;

        for (let i = 0; i < subsystemIds.length - 1; i++) {

            const subsystem =
                current.subsystems?.find(
                    s => s.id === subsystemIds[i]
                );

            if (!subsystem) {
                throw new Error(
                    `Subsystem '${subsystemIds[i]}' not found.`
                );
            }

            current = subsystem.jsonData;
        }

        const target =
            current.subsystems?.find(
                s => s.id === subsystemIds[subsystemIds.length - 1]
            );

        if (!target) {
            throw new Error(
                `Subsystem '${subsystemIds[subsystemIds.length - 1]}' not found.`
            );
        }

        target.jsonData = newJson;

        return root;
    }

    public async updateBlockParameters(block: BlockData, subsystemIds: IdType[]): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getJson(subsystemIds);
            const updated = updateBlockParameters(json, block);
            const rendered = await this.updateBlockRenderInformation(updated);
            await this.updateTextDocument(this.document, rendered, subsystemIds);
        });
    }

    public async writeJson(json: JsonData, subsystemIds: IdType[]): Promise<void> {
        console.log("Writing JSON to document for subsystem path: " + subsystemIds.join(" > "));
        await this.withDocumentLock(async () => {
            const rendered = await this.updateBlockRenderInformation(json);
            await this.updateTextDocument(this.document, rendered, subsystemIds);
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
                subsystems: [],
                simulation_configuration: '',
                initialization_python_script_path: '',
                toolkit_configuration_path: ''
            };
        }

        try {
            const json = JSON.parse(text);
            this.lastVersion += 1;
            json.blocks = Array.isArray(json.blocks) ? json.blocks : [];
            json.links = Array.isArray(json.links) ? json.links : [];
            json.simulation_configuration = json.simulation_configuration ?? '';
            json.initialization_python_script_path = json.initialization_python_script_path ?? '';
            json.toolkit_configuration_path = json.toolkit_configuration_path ?? '';
            json.subsystems = Array.isArray(json.subsystems) ? json.subsystems : [];

            this.updateJsonVersions(json, this.lastVersion);

            return json;
        } catch (error) {
            console.error('Error parsing document JSON:', error);
            throw new Error('Could not get document as json. Content is not valid json');
        }
    };

    private updateJsonVersions(json: JsonData, version: number): void {
        json.version = version;

        for (const subsystem of json.subsystems ?? []) {
            this.updateJsonVersions(subsystem.jsonData, version);
        }
    }

    private updateTextDocument = async (document: vscode.TextDocument, json: JsonData, subsystemIds: IdType[]) => {

        console.log(
            "Updating text document with new JSON data on subsystem path: " + subsystemIds.join(" > ")
        );

        const root = this.getDocumentAsJson(document);

        const updatedRoot =
            this.replaceSubsystemJson(
                root,
                subsystemIds,
                json
            );

        const edit = new vscode.WorkspaceEdit();

        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(updatedRoot, null, 2)
        );

        return vscode.workspace.applyEdit(edit);
    };

    public getSimulationOptionsPath(): string | undefined {
        const json = this.getJson([]);
        return json.simulation_configuration;
    }

    public getInitializationScriptPath(): string | undefined {
        const json = this.getJson([]);
        return json.initialization_python_script_path;
    }

    public getToolkitConfigurationPath(): string | undefined {
        const json = this.getJson([]);
        return json.toolkit_configuration_path;
    }

    public async changeSimulationsOptionsFile(newPath: string): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getJson([]);
            json.simulation_configuration = newPath;
            await this.updateTextDocument(this.document, json, []);
        });

        this.simulationManager.setCurrentSimulationOptionsPath(newPath);
    }

    public async changeInitializationScriptFile(newPath: string): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getJson([]);
            json.initialization_python_script_path = newPath;
            const rendered = await this.updateBlockRenderInformation(json);
            await this.updateTextDocument(this.document, rendered, []);
        });

        this.simulationManager.setCurrentInitializationScriptPath(newPath);
    }

    public async changeToolkitConfigurationFile(newPath: string): Promise<void> {
        await this.withDocumentLock(async () => {
            const json = this.getJson([]);
            json.toolkit_configuration_path = newPath;
            const rendered = await this.updateBlockRenderInformation(json);
            await this.updateTextDocument(this.document, rendered, []);
        });

        this.simulationManager.setCurrentToolkitConfigurationFilePath(newPath);
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
