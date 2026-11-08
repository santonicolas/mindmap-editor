import { newTree, loadFromStorage, render, fitToScreen } from './tree.js';
import { setupToolbar, setupContextMenu, setupMouse, setupPrint } from './handlers.js';

setupToolbar();
setupContextMenu();
setupMouse();
setupPrint();

if (!loadFromStorage()) newTree();
render();
fitToScreen();
