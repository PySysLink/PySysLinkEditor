// blockPalette.ts

import { Library } from "../../shared/BlockPalette";
import { CommunicationManager } from "./CommunicationManager";



// Keep track of the current libraries data

export class BlockPalette {
  public libraries: Library[] = [];
  private communicationManager: CommunicationManager;
  private lastContainer: HTMLElement | undefined = undefined;

  constructor(communicationManager: CommunicationManager) {
        this.communicationManager = communicationManager;
    }

  public updateLibraries = (libraries: Library[]): void => {
    this.libraries = libraries;
    if (this.lastContainer) {
      this.renderPalette(this.lastContainer);
    }
  };

  /**
   * Renders the block libraries into the webview.
   */
  public renderPalette(paletteContainer: HTMLElement) : void {
    this.lastContainer = paletteContainer;
    // Clear any existing content
    paletteContainer.innerHTML = '';

    paletteContainer.style.display = 'flex';
    paletteContainer.style.flexDirection = 'column';
    paletteContainer.style.height = '100%';
    paletteContainer.style.overflow = 'hidden';

    // Create a header with a Refresh button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '1rem';

    const titleEl = document.createElement('h2');
    titleEl.textContent = 'Block Palette';
    titleEl.style.margin = '0';

    const refreshBtn = document.createElement('vscode-button');
    refreshBtn.setAttribute('appearance', 'secondary');
    refreshBtn.textContent = 'Refresh Palette';
    refreshBtn.addEventListener('click', () => {
      this.communicationManager.requestUpdatePalette();
    });

    header.appendChild(titleEl);
    header.appendChild(refreshBtn);
    paletteContainer.appendChild(header);

    const scrollContainer = document.createElement('div');
    scrollContainer.style.flex = '1';
    scrollContainer.style.overflowY = 'auto';
    scrollContainer.style.overflowX = 'hidden';
    scrollContainer.style.paddingRight = '4px';

    paletteContainer.appendChild(scrollContainer);

    // If there are no libraries, show a placeholder
    if (this.libraries.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.textContent = 'No libraries available.';
      emptyEl.style.fontStyle = 'italic';
      scrollContainer.appendChild(emptyEl);
      return;
    }

    // Render each library as a collapsible section
    this.libraries.forEach((lib) => {
        const details = document.createElement('details');
        details.open = true;
        details.style.marginBottom = '0.75rem';
        details.style.border = '1px solid var(--vscode-panel-border)';
        details.style.borderRadius = '4px';
        details.style.padding = '0.25rem 0';

        // Header
        const summary = document.createElement('summary');
        summary.style.cursor = 'pointer';
        summary.style.fontWeight = 'bold';
        summary.style.padding = '0.5rem 0.75rem';
        summary.style.userSelect = 'none';

        summary.textContent = `${lib.name} (${lib.blockTypes.length})`;

        details.appendChild(summary);

        // Container for the blocks
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexWrap = 'wrap';
        content.style.gap = '0.5rem';
        content.style.padding = '0.75rem';

        lib.blockTypes.forEach((block) => {

            const blockBtn = document.createElement('vscode-button');
            blockBtn.setAttribute('appearance', 'outline');
            blockBtn.textContent = block.name;

            blockBtn.setAttribute('draggable', 'true');

            blockBtn.addEventListener('dragstart', (e: DragEvent) => {

                console.log(`Dragging block: ${block.name} from library: ${lib.name}`);

                const payload = JSON.stringify({
                    library: lib.name,
                    blockType: block.name,
                    pluginType: lib.pluginType
                });

                e.dataTransfer?.setData(
                    'application/vnd.codeblock',
                    payload
                );
            });

            content.appendChild(blockBtn);
        });

        details.appendChild(content);

        scrollContainer.appendChild(details);
    });
  }
}

