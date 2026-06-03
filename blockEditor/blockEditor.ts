import { LinkVisual } from './visualElements/LinkVisual';
import { BlockVisual } from './visualElements/BlockVisual';
import { NoteVisual } from './visualElements/NoteVisual';
import { ImageVisual } from './visualElements/ImageVisual';
import { BlockInteractionManager } from './managers/BlockInteractionManager';
import { LinkInteractionManager } from './managers/LinkInteractionManager';
import { NoteInteractionManager } from './managers/NoteInteractionManager';
import { ImageInteractionManager } from './managers/ImageInteractionManager';
import { Selectable } from './interfaces/Selectable';
import { SelectableManager } from './managers/SelectableManager';
import { BlockPalette } from './editorCore/BlockPalette';
import { JsonData } from '../shared/JsonTypes';
import { CommunicationManager } from './managers/CommunicationManager';
import { Library } from '../shared/BlockPalette';
import { ElementFactory, BlockElementCreator, ElementCreator } from './managers/ElementFactory';
import { ElementEventBus } from './events/ElementEventBus';
import '@vscode-elements/elements/dist/bundled.js';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

setInterval(() => {
    vscode.postMessage({
            type: 'heartbeat',
            text: `Heartbeat from webview at ${new Date().toISOString()}`
        });
}, 1000);

// console.log = () => {};

(function () {
    
    const app = new BlockEditorApp();
    app.start();

})();
    // Initialize event bus and factory
    
    let lastWebViewUpdateTime = Date.now();
    const minUpdateInterval = 10; 
    let timerRunning = false;


    communicationManager.registerLocalJsonChangedCallback(updateWebView);

    
    


    

    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        communicationManager.print(`Restoring state: ${state.text}`);
        communicationManager.newJsonFromServer(JSON.parse(state.text));
    }
})();