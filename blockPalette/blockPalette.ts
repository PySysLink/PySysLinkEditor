// blockPalette.ts


declare const acquireVsCodeApi: any;

// Acquire VS Code API
const vscode = acquireVsCodeApi();

// Keep track of the current libraries data
interface BlockType {
  name: string;
}

interface Library {
  name: string;
  blockTypes: BlockType[];
}

let libraries: Library[] = [];

/**
 * Renders the block libraries into the webview.
 */
function renderPalette() {
  const root = document.getElementById('app');
  if (!root) {
    return;
  }

  // Clear any existing content
  root.innerHTML = '';

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
    vscode.postMessage({ type: 'updatePalette' });
  });

  header.appendChild(titleEl);
  header.appendChild(refreshBtn);
  root.appendChild(header);

  // If there are no libraries, show a placeholder
  if (libraries.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.textContent = 'No libraries available.';
    emptyEl.style.fontStyle = 'italic';
    root.appendChild(emptyEl);
    return;
  }

  // Render each library as a card
  libraries.forEach((lib) => {
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
      blockBtn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'insertBlock',
          library: lib.name,
          blockType: block.name
        });
      });
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
    root.appendChild(card);
  });
}

/**
 * Handle messages from the extension backend.
 */
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'setBlockLibraries':
      // msg.model is an array of Library objects
      libraries = msg.model as Library[];
      renderPalette();
      break;

    default:
      console.warn('[BlockPalette] Unknown message type:', msg.type);
  }
});

// On first load, inform the extension that the webview is ready
window.addEventListener('load', () => {
  vscode.postMessage({ type: 'ready' });
});
