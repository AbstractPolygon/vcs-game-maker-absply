'use strict';

// Copy and paste of pixel selections (Ctrl+C, X, V, see GraphicEditorToolbar.vue) across every pixel canvas: the copied pixels, kept
// for any canvas to paste ({x, y: where the box round them was, cells: [{dx, dy, on}] from the box's top left}), and the canvases that
// are on the page, so a paste goes into the one under the mouse even when another card is the selected one.

let clipboard = null;
const editors = new Set();

export const getPixelClipboard = () => clipboard;

export const setPixelClipboard = (value) => {
  clipboard = value;
};

export const registerPixelEditor = (editor) => {
  editors.add(editor);
};

export const unregisterPixelEditor = (editor) => {
  editors.delete(editor);
};

// The canvas the mouse is over (its hoverCell is set while the pointer is on its grid), or null.
export const hoveredPixelEditor = () => [...editors].find((editor) => editor.hoverCell && editor.$el && editor.$el.isConnected) || null;
