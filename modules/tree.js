import {
    GAP_X, GAP_Y, byId, generateId, findNode, childrenOf,
    nodes, setNodes, selectedId, editingId, setSelectedId, setEditingId, camera, setCamera
} from './state.js';

export function layout() {
    const els = {};
    byId('nodes').querySelectorAll('.node').forEach(el => {
        const node = findNode(el.dataset.id);
        if (node) {
            node.w = el.offsetWidth;
            node.h = el.offsetHeight;
            els[node.id] = el;
        }
    });

    const size = {};
    const measure = node => {
        const kids = childrenOf(node.id);
        const kidsH = kids.reduce((sum, kid) => sum + measure(kid), 0) + GAP_Y * Math.max(0, kids.length - 1);
        size[node.id] = { kidsH, block: Math.max(node.h, kidsH) };
        return size[node.id].block;
    };

    const place = (node, x, top) => {
        const { kidsH, block } = size[node.id];
        node.x = x;
        node.y = top + (block - node.h) / 2;
        let y = top + (block - kidsH) / 2;
        childrenOf(node.id).forEach(kid => {
            place(kid, x + node.w + GAP_X, y);
            y += size[kid.id].block + GAP_Y;
        });
    };

    let top = 0;
    nodes.filter(n => !n.parentId).forEach(root => {
        measure(root);
        place(root, 0, top);
        top += size[root.id].block + GAP_Y * 2;
    });

    nodes.forEach(n => {
        if (els[n.id]) {
            els[n.id].style.left = n.x + 'px';
            els[n.id].style.top = n.y + 'px';
        }
    });
    renderEdges();
}

export const getTreeSize = () => ({
    width: Math.max(...nodes.map(n => n.x + (n.w || 0))),
    height: Math.max(...nodes.map(n => n.y + (n.h || 0))),
});

export function renderEdges() {
    const { width, height } = getTreeSize();
    const svg = byId('edges');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    svg.innerHTML = nodes.filter(n => n.parentId).map(child => {
        const parent = findNode(child.parentId);
        if (!parent) return '';
        const x1 = parent.x + parent.w, y1 = parent.y + parent.h / 2;
        const x2 = child.x, y2 = child.y + child.h / 2;
        const mid = (x2 - x1) / 2;
        return `<path d="M${x1} ${y1} C${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}" />`;
    }).join('');
}

function createNodeEl(node) {
    const el = document.createElement('div');
    el.className = 'node';
    el.classList.toggle('root', !node.parentId);
    el.classList.toggle('sel', node.id === selectedId);
    el.classList.toggle('ed', node.id === editingId);
    el.contentEditable = node.id === editingId;
    el.dataset.id = node.id;
    el.textContent = node.text;
    return el;
}

export function render() {
    byId('nodes').replaceChildren(...nodes.map(createNodeEl));
    layout();
    saveToStorage();
    if (editingId) focusEditingNode();
}

export function focusEditingNode() {
    const el = byId('nodes').querySelector('.ed');
    if (el) {
        el.focus();
        getSelection().selectAllChildren(el);
    }
}

export function updateCamera() {
    byId('stage').style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
}

export function fitToScreen() {
    const { width, height } = getTreeSize();
    const view = byId('view');
    const zoom = Math.min((view.clientWidth - 60) / width, (view.clientHeight - 60) / height, 1.2);
    setCamera({
        zoom,
        x: (view.clientWidth - width * zoom) / 2,
        y: (view.clientHeight - height * zoom) / 2,
    });
    updateCamera();
}

export function select(id) {
    setSelectedId(id);
    byId('nodes').querySelectorAll('.node').forEach(el =>
        el.classList.toggle('sel', el.dataset.id === id));
}

export function commitEdit() {
    if (!editingId) return;
    const el = document.querySelector('.node.ed');
    const node = findNode(editingId);
    if (el && node) node.text = el.innerText.replace(/\n+/g, ' ').trim();
    setEditingId(null);
    render();
}

export function startEdit(id) {
    commitEdit();
    setSelectedId(id);
    setEditingId(id);
    render();
}

export function addNode(parentId) {
    commitEdit();
    const node = { id: generateId(), parentId, text: '' };
    nodes.push(node);
    setSelectedId(node.id);
    setEditingId(node.id);
    render();
}

export const addChild = () => selectedId && addNode(selectedId);
export const addSibling = () => findNode(selectedId) && addNode(findNode(selectedId).parentId);

export const collectSubtreeIds = id => [id, ...childrenOf(id).flatMap(kid => collectSubtreeIds(kid.id))];

export function deleteSelected() {
    const selected = findNode(selectedId);
    if (!selected) return;

    if (nodes.length === 1) {
        selected.text = '';
    } else {
        const removed = collectSubtreeIds(selected.id);
        setNodes(nodes.filter(n => !removed.includes(n.id)));
        setSelectedId(selected.parentId || nodes[0].id);
        setEditingId(null);
    }
    render();
}

export function newTree() {
    setNodes([{ id: generateId(), parentId: null, text: 'Tema central' }]);
    setSelectedId(nodes[0].id);
    setEditingId(null);
}

export function toCanvasJson() {
    return JSON.stringify({
        nodes: nodes.map(n => ({
            id: n.id, type: 'text', text: n.text,
            x: n.x, y: n.y, width: n.w, height: n.h,
        })),
        edges: nodes.filter(n => n.parentId).map(n => ({
            id: 'e' + n.id, fromNode: n.parentId, toNode: n.id, fromSide: 'right', toSide: 'left',
        })),
    }, null, 2);
}

export function fromCanvasJson(text) {
    const data = JSON.parse(text);
    if (!data.nodes?.length) throw new Error('O arquivo não tem nós.');

    const list = data.nodes
        .map(n => ({ id: String(n.id), parentId: null, text: n.text || n.label || n.file || n.url || '', y: n.y || 0 }))
        .sort((a, b) => a.y - b.y);
    const map = Object.fromEntries(list.map(n => [n.id, n]));

    const isAncestor = (a, b) => {
        for (let n = b; n; n = map[n.parentId]) if (n === a) return true;
        return false;
    };

    (data.edges || []).forEach(({ fromNode, toNode }) => {
        const parent = map[fromNode], child = map[toNode];
        if (parent && child && !child.parentId && !isAncestor(child, parent)) child.parentId = parent.id;
    });

    setNodes(list.map(({ id, parentId, text }) => ({ id, parentId, text })));
    setSelectedId(nodes[0].id);
    setEditingId(null);
}

const STORAGE_KEY = 'arvore-estudo';

export function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, toCanvasJson()); } catch { /* o app continua funcionando */ }
}

export function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        fromCanvasJson(saved.canvas ?? raw);
        return true;
    } catch {
        return false;
    }
}
