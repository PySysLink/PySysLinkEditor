(function () {
    const vscode = acquireVsCodeApi();
    const container = document.querySelector('.notes');

    let blocks = [];
    let dragEl = null;
    let offsetX = 0;
    let offsetY = 0;

    function createBlockElement(block) {
        const el = document.createElement('div');
        el.className = 'block';
        el.style.left = block.x + 'px';
        el.style.top  = block.y + 'px';
        el.textContent = block.label;
        el.dataset.id = block.id;

        // Attach the drag handlers
        el.addEventListener('mousedown', onMouseDown);

		// **Double-click handler** → ask extension to edit this block
        el.addEventListener('dblclick', () => {
            vscode.postMessage({
                type: 'edit',
                id: block.id
            });
        });
		
        return el;
    }

    function onMouseDown(e) {
        // Only start drag if clicked on a block
        dragEl = e.currentTarget;
        offsetX = e.clientX - dragEl.offsetLeft;
        offsetY = e.clientY - dragEl.offsetTop;
        dragEl.style.zIndex = '1000';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
    }

    function onMouseMove(e) {
        if (!dragEl) return;
        dragEl.style.left = (e.clientX - offsetX) + 'px';
        dragEl.style.top  = (e.clientY - offsetY) + 'px';
    }

    function onMouseUp() {
        if (!dragEl) return;

        // Send updated position back to extension
        vscode.postMessage({
            type: 'move',
            id: dragEl.dataset.id,
            x: parseInt(dragEl.style.left, 10),
            y: parseInt(dragEl.style.top,  10)
        });

        dragEl.style.zIndex = '';
        dragEl = null;

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);
    }

    function updateBlocks(jsonText) {
        let json;
        try {
            json = JSON.parse(jsonText || '{}');
        } catch {
            container.textContent = 'Invalid JSON';
            return;
        }

        blocks = json.blocks || [];
        container.innerHTML = '';  // clear

        // Render each block
        blocks.forEach(b => {
            container.appendChild(createBlockElement(b));
        });

        // Add button
        const btn = document.createElement('button');
        btn.textContent = 'Add Block';
        btn.addEventListener('click', () => vscode.postMessage({ type: 'add' }));
        container.appendChild(btn);
    }

    // Listen for messages from extension
    window.addEventListener('message', e => {
        if (e.data.type === 'update') {
            updateBlocks(e.data.text);
            vscode.setState({ text: e.data.text });
        }
    });

    // Restore state if reloaded
    const state = vscode.getState();
    if (state) {
        updateBlocks(state.text);
    }
})();
