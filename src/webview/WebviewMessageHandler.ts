

class WebviewMessageHandler {
    async e => {
                switch (e.type) {
                    case 'updateJson':
                        console.log(`update json called`);
                        this.documentLock = this.withDocumentLock(async () => {
                            if (this.document) {
                                let json = this.getDocumentAsJson(this.document);
                                json.version = json.version + 1;
                                json.blocks = e.json.blocks;
                                json.links = e.json.links;
                                json = await this.updateBlockRenderInformation(json);
                                await this.updateTextDocument(this.document, json);
                            }
                        });
                        return;
                    case 'print':
                        console.log(e.text);
                        return;
                    case 'blockSelected':
                        console.log(`Block selected: ${e.blockId}`);
                        this.selectedBlockId = e.blockId;
                        this.notifySelectedBlock();
                        return;
                    case 'updateBlockPalette':
                        this.loadBlockLibraries();
                        return;
                    case 'doubleClickOnBlock':
                        if (this.pythonServer.isRunning()) {
                            this.displayBlockHTML(e.blockId);
                        }
                        return;
                    case 'heartbeat':
                        console.log(`[Heartbeat] [${e.text}] [${new Date().toISOString()}]`);
                        return;
                    default:
                        console.log(`Type of message not recognized: ${e.type}`);
                        return;
                }
            });
}