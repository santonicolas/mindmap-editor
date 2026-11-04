export const GAP_X = 56;
export const GAP_Y = 20;

export const byId = id => document.getElementById(id);
export const generateId = () => Math.random().toString(36).slice(2, 10);
export const findNode = id => nodes.find(n => n.id === id);
export const childrenOf = id => nodes.filter(n => n.parentId === id);

export let nodes = [];
export let selectedId = null;
export let editingId = null;
export let camera = { x: 40, y: 40, zoom: 1 };

export function setNodes(newNodes) {
    nodes = newNodes;
}

export function setSelectedId(id) {
    selectedId = id;
}

export function setEditingId(id) {
    editingId = id;
}

export function setCamera(newCamera) {
    camera = newCamera;
}
