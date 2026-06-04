import { LinkVisual } from './visualElements/LinkVisual';
import { BlockVisual } from './visualElements/BlockVisual';
// import { NoteVisual } from './visualElements/NoteVisual';
// import { ImageVisual } from './visualElements/ImageVisual';
import { BlockInteractionManager } from './managers/BlockInteractionManager';
import { LinkInteractionManager } from './managers/LinkInteractionManager';
// import { NoteInteractionManager } from './managers/NoteInteractionManager';
// import { ImageInteractionManager } from './managers/ImageInteractionManager';
import { Selectable } from './interfaces/Selectable';
import { SelectableManager } from './editorCore/SelectableManager';
import { BlockPalette } from './editorCore/BlockPalette';
import { JsonData } from '../shared/JsonTypes';
import { CommunicationManager } from './editorCore/CommunicationManager';
import { Library } from '../shared/BlockPalette';
import { ElementEventBus } from './events/ElementEventBus';
import '@vscode-elements/elements/dist/bundled.js';
import { BlockEditorApp } from './BlockEditorApp';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

setInterval(() => {
    vscode.postMessage({
            type: 'heartbeat',
            text: `Heartbeat from webview at ${new Date().toISOString()}`
        });
}, 1000);

// console.log = () => {};

(function () {
    
    const app = new BlockEditorApp(vscode);
    // app.start();

})();
    



    