import { byId, selectedId, editingId, camera, setCamera } from './state.js';
import {
    layout, fitToScreen, render, select, commitEdit,
    startEdit, addChild, addSibling, deleteSelected,
    newTree, toCanvasJson, fromCanvasJson, getTreeSize, updateCamera
} from './tree.js';

export function setupToolbar() {
    byId('bFit').onclick = () => { commitEdit(); fitToScreen(); };
    byId('bPdf').onclick = () => { commitEdit(); window.print(); };

    byId('bNew').onclick = () => {
        newTree();
        render();
        fitToScreen();
    };

    byId('bJson').onclick = () => {
        commitEdit();
        byId('ta').value = toCanvasJson();
        byId('msg').textContent = '';
        byId('dlg').showModal();
    };
    byId('bClose').onclick = () => byId('dlg').close();

    byId('bCopy').onclick = async () => {
        const textarea = byId('ta');
        try {
            await navigator.clipboard.writeText(textarea.value);
        } catch {
            textarea.select();
            document.execCommand('copy');
        }
        byId('msg').textContent = 'Copiado.';
    };

    byId('bLoad').onclick = () => {
        try {
            fromCanvasJson(byId('ta').value);
            render();
            fitToScreen();
            byId('dlg').close();
        } catch (error) {
            byId('msg').textContent = 'Não foi possível ler o JSON: ' + error.message;
        }
    };
}

export function setupContextMenu() {
    const menu = byId('menu');
    const actions = { child: addChild, sibling: addSibling, delete: deleteSelected };
    const hide = () => { menu.hidden = true; };

    byId('view').addEventListener('contextmenu', event => {
        const nodeEl = event.target.closest('.node');
        if (!nodeEl) return;
        event.preventDefault();
        commitEdit();
        select(nodeEl.dataset.id);
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.hidden = false;
    });

    menu.addEventListener('click', event => {
        const action = actions[event.target.dataset.act];
        if (!action) return;
        hide();
        action();
    });

    document.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) hide(); });
    byId('view').addEventListener('wheel', hide, { passive: true });
}

export function setupMouse() {
    const view = byId('view');

    view.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const nodeEl = event.target.closest('.node');

        if (nodeEl) {
            const id = nodeEl.dataset.id;
            if (id === editingId) return;

            event.preventDefault(); // Impede o comportamento padrão de foco prematuro do navegador
            commitEdit();
            select(id);

            // Adia a abertura da edição para o próximo ciclo de renderização do navegador,
            // evitando que o DOM seja destruído no meio do evento de ponteiro.
            setTimeout(() => {
                startEdit(id);

                const activeEl = document.querySelector(`.node[data-id="${id}"]`);
                if (activeEl && document.activeElement !== activeEl) {
                    activeEl.focus();

                    const range = document.caretRangeFromPoint
                        ? document.caretRangeFromPoint(event.clientX, event.clientY)
                        : null;

                    if (range && activeEl.contains(range.startContainer)) {
                        const sel = getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        const fallbackRange = document.createRange();
                        fallbackRange.selectNodeContents(activeEl);
                        fallbackRange.collapse(false);
                        const sel = getSelection();
                        sel.removeAllRanges();
                        sel.addRange(fallbackRange);
                    }
                }
            }, 0);

            return;
        }

        commitEdit();

        let lastX = event.clientX, lastY = event.clientY;
        view.classList.add('pan');
        view.setPointerCapture(event.pointerId);

        const onMove = move => {
            setCamera({
                ...camera,
                x: camera.x + move.clientX - lastX,
                y: camera.y + move.clientY - lastY
            });
            lastX = move.clientX;
            lastY = move.clientY;
            updateCamera();
        };
        const onUp = () => {
            view.classList.remove('pan');
            view.removeEventListener('pointermove', onMove);
            view.removeEventListener('pointerup', onUp);
        };
        view.addEventListener('pointermove', onMove);
        view.addEventListener('pointerup', onUp);
    });

    view.addEventListener('wheel', event => {
        event.preventDefault();
        const box = view.getBoundingClientRect();
        const mouseX = event.clientX - box.left;
        const mouseY = event.clientY - box.top;

        const newZoom = Math.min(3, Math.max(0.15, camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9)));
        const ratio = newZoom / camera.zoom;

        setCamera({
            zoom: newZoom,
            x: mouseX - (mouseX - camera.x) * ratio,
            y: mouseY - (mouseY - camera.y) * ratio
        });
        updateCamera();
    }, { passive: false });

    byId('nodes').addEventListener('input', layout);
}

export function setupPrint() {
    let saved = null;
    const view = byId('view');

    window.addEventListener('beforeprint', () => {
        commitEdit();
        const { width, height } = getTreeSize();
        const landscape = width >= height * 0.9;
        const pageW = landscape ? 1040 : 700;
        const pageH = landscape ? 700 : 1040;
        const zoom = Math.min(pageW / width, pageH / height, 1.4);

        byId('pg').textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`;

        saved = { camera, width: view.style.width, height: view.style.height };
        view.style.width = pageW + 'px';
        view.style.height = pageH + 'px';
        setCamera({ zoom, x: (pageW - width * zoom) / 2, y: (pageH - height * zoom) / 2 });
        updateCamera();
    });

    window.addEventListener('afterprint', () => {
        if (!saved) return;
        view.style.width = saved.width;
        view.style.height = saved.height;
        setCamera(saved.camera);
        saved = null;
        updateCamera();
    });
}


const textarea = document.getElementById('ta');

textarea.addEventListener('pointerdown', function () {
    if (this.hasAttribute('readonly')) {
        this.removeAttribute('readonly');
        this.focus();
    }
});
