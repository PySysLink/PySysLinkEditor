// blockPalette.ts

import { Library } from "../shared/BlockPalette";
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

    // If there are no libraries, show a placeholder
    if (this.libraries.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.textContent = 'No libraries available.';
      emptyEl.style.fontStyle = 'italic';
      paletteContainer.appendChild(emptyEl);
      return;
    }

    // Render each library as a card
    this.libraries.forEach((lib) => {
      const card = document.createElement('vscode-card');
      card.style.marginBottom = '1rem';
      card.setAttribute('width', '100%');

      // Card header: library name
      const headerSlot = document.createElement('div');
      headerSlot.slot = 'header';
      headerSlot.style.display = 'flex';
      headerSlot.style.justifyContent = 'space-between';
      headerSlot.style.alignItems = 'center';

      const libName = document.createElement('span');
      libName.textContent = lib.name;
      libName.style.fontWeight = 'bold';
      headerSlot.appendChild(libName);

      card.appendChild(headerSlot);

      // Card content: list of block types
      const contentSlot = document.createElement('div');
      contentSlot.slot = 'content';
      contentSlot.style.display = 'flex';
      contentSlot.style.flexWrap = 'wrap';
      contentSlot.style.gap = '0.5rem';

      lib.blockTypes.forEach((block) => {
        const blockBtn = document.createElement('vscode-button');
        blockBtn.setAttribute('appearance', 'outline');
        blockBtn.textContent = block.name;

        blockBtn.setAttribute('draggable', 'true');
        blockBtn.addEventListener('dragstart', (e: DragEvent) => {
          const payload = JSON.stringify({
            library: lib.name,
            blockType: block.name
          });
          e.dataTransfer?.setData('application/vnd.codeblock', payload);
        });

        // Use a custom MIME type to avoid conflicts
        contentSlot.appendChild(blockBtn);
      });

      card.appendChild(contentSlot);
      paletteContainer.appendChild(card);
    });
  }
}

