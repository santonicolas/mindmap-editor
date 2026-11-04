import { newTree, loadFromStorage, render, fitToScreen } from './tree.js';
import { setupToolbar, setupContextMenu, setupMouse, setupKeyboard, setupPrint } from './handlers.js';

setupToolbar();
setupContextMenu();
setupMouse();
setupKeyboard();
setupPrint();

if (!loadFromStorage()) newTree();
render();
fitToScreen();
