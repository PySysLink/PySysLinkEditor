"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addBlock = addBlock;
exports.deleteBlock = deleteBlock;
exports.moveBlock = moveBlock;
exports.editBlockLabel = editBlockLabel;
const vscode = __importStar(require("vscode"));
const util_1 = require("./util");
const BlockMetadata_1 = require("./BlockMetadata");
function addBlock(json) {
    const blocks = Array.isArray(json.blocks) ? json.blocks : [];
    // Define the new block
    const newBlock = {
        id: (0, util_1.getNonce)(),
        label: 'New Block',
        x: 50,
        y: 50,
        blockType: 'defaultType',
        blockClass: 'defaultClass',
        inputPorts: 0,
        outputPorts: 0,
        properties: {}
    };
    // Initialize ports and properties based on blockType and blockClass
    (0, BlockMetadata_1.initializeBlockMetadata)(newBlock);
    blocks.push(newBlock);
    json.blocks = blocks;
    return json;
}
function deleteBlock(json, id) {
    const blocks = Array.isArray(json.blocks) ? json.blocks : [];
    const links = Array.isArray(json.links) ? json.links : [];
    let block = blocks.find((block) => block.id === id);
    const index = blocks.indexOf(block, 0);
    if (index > -1) {
        blocks.splice(index, 1);
    }
    json.blocks = blocks;
    json.links = links;
    return json;
}
function moveBlock(id, x, y, json) {
    const block = (json.blocks || []).find((b) => b.id === id);
    if (block) {
        block.x = x;
        block.y = y;
        console.log(`Block ${block.label} updated to position x: ${block.x}, y: ${block.y}`);
    }
    return json;
}
async function editBlockLabel(document, id, getDocumentAsJson, updateTextDocument) {
    const json = getDocumentAsJson(document);
    const block = (json.blocks || []).find((b) => b.id === id);
    if (!block) {
        return;
    }
    const newLabel = await vscode.window.showInputBox({
        prompt: 'New label for block',
        value: block.label
    });
    if (newLabel === undefined) {
        return;
    } // user cancelled
    block.label = newLabel;
    updateTextDocument(document, json);
}
//# sourceMappingURL=BlockManager.js.map