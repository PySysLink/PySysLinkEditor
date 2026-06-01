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
import { BlockPalette } from './BlockPalette';
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
    

    // Initialize event bus and factory
    
    let lastWebViewUpdateTime = Date.now();
    const minUpdateInterval = 10; 
    let timerRunning = false;


    communicationManager.registerLocalJsonChangedCallback(updateWebView);

    
    window.addEventListener('message', (e: MessageEvent) => {
        if (e.data.type === 'update') {
            communicationManager.newJsonFromServer(e.data.json);
        }else if (e.data.type === 'colorThemeKindChanged') {
            applyThemeClass(e.data.kind);
        } else if (e.data.type === 'setBlockLibraries') {
            communicationManager.setBlockLibraries(e.data.model as Library[]);
        }
    });


    function applyThemeClass(kind: string) {
        if (kind === "light") {
            document.body.classList.add('pysyslink-light');
            document.body.classList.remove('pysyslink-dark');
            document.body.classList.remove('pysyslink-high-contrast');
        } else if (kind === "dark") {
            document.body.classList.remove('pysyslink-light');
            document.body.classList.add('pysyslink-dark');
            document.body.classList.remove('pysyslink-high-contrast');
        } else {
            document.body.classList.remove('pysyslink-light');
            document.body.classList.remove('pysyslink-dark');
            document.body.classList.add('pysyslink-high-contrast');
        }
        
    }

    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        communicationManager.print(`Restoring state: ${state.text}`);
        communicationManager.newJsonFromServer(JSON.parse(state.text));
    }
})();