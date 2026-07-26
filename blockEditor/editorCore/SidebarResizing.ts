
export function configureSidebarResizing() {
    const sidebar = document.querySelector('.block-palette-sidebar') as HTMLElement;
    const resizer = document.querySelector('.sidebar-resizer') as HTMLElement;

    let dragging = false;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        resizer.classList.add('dragging');
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
        resizer.classList.remove('dragging');
    });

    document.addEventListener('mousemove', (e) => {

        if (!dragging) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const editorLayout = document.querySelector(".editor-layout") as HTMLElement;

        const rect = editorLayout.getBoundingClientRect();

        const newWidth = rect.right - e.clientX;        
        console.log(`Resizing sidebar to ${newWidth}`);

        sidebar.style.width = `${newWidth}px`;
    });
}