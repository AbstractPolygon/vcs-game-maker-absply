'use strict';

import {ref} from '@vue/composition-api';
import {getUndoLimit} from './undo-limit';

// Undo and redo for dragging cards (and rows, chips, frames) into a new order, and for edits that
// keep no history in the editor itself (a row's color), shared by every tab that has them. Each
// change is recorded with a way to put the previous state back and a way to redo it; the Undo and
// Redo buttons and shortcuts of the tab being shown try this first (see GraphicEditorToolbar.vue,
// DataEditor.vue, MusicEditor.vue, SoundFXEditor.vue and TextEditor.vue).
//
// A reorder only counts on the tab (route) it was made on, and only while the list still holds
// the order that reorder produced: if cards were added or deleted since, the entry is dropped
// rather than put back an order that no longer fits.
//
// Edits that have an undo of their own are noted with noteEdit(), so a reorder is undone first
// only when it is the most recent thing done on the tab. After one of those edits is undone
// (settleEdits) the reorders made before it are reachable again.

const COALESCE_MS = 700;
const currentRoute = () => window.location.hash.split('?')[0];
// The lists and counters are kept on the window, one set for the page: the development server's hot reload makes this module again when
// it changes, and the components it reloaded then recorded into a new empty list while the toolbars (not reloaded) still undid from the
// old one, so Undo did nothing until the page was reloaded.
const state = window.__vcsgmTabUndo || (window.__vcsgmTabUndo = {
  undoEntries: [], redoEntries: [], counter: 0, lastEdit: 0, version: ref(0), route: ref(currentRoute()), replaying: false, recordedNow: false,
});
if (!state.listening) {
  state.listening = true;
  window.addEventListener('hashchange', () => {
    state.route.value = currentRoute();
  });
}
const version = state.version;
const route = state.route;

const changed = () => {
  version.value++;
};

// While an Undo or Redo of this list is being played back, and for the rest of that turn of the page's work (the watchers of what it
// changed run after it): a canvas that sees its picture change then does not take the change as a new edit of its history (see the
// value watcher of PixelEditor.vue). The same for a change a tab recorded here itself in this turn (a pasted frame, a Set height):
// it is one step, not one more for each canvas it reached.
export const isReplaying = () => state.replaying;
export const recordedJustNow = () => state.recordedNow;
const markReplaying = () => {
  state.replaying = true;
  setTimeout(() => {
    state.replaying = false;
  }, 0);
};
const markRecorded = () => {
  state.recordedNow = true;
  setTimeout(() => {
    state.recordedNow = false;
  }, 0);
};

// The tab shown is read from the address each time; route is there for the buttons' disabled state to follow a change of tab. (The router
// moves between tabs with pushState, which sends no hashchange: route kept the tab the page was loaded on, so the Undo of every other tab
// found nothing to undo. noteRouteChange is called by the router after each change, see router/index.js.)
const available = (entries) => {
  // eslint-disable-next-line no-unused-expressions
  route.value;
  const here = currentRoute();
  return entries.some((entry) => entry.route === here);
};

// Called by the router after it shows another tab (path: the route's path, as in the address after the #).
export const noteRouteChange = (path) => {
  route.value = '#' + path;
};

// A tab remembers at most the app's number of steps back (see hooks/undo-limit.js): the oldest of its entries go first.
const trimTab = (entries, here) => {
  const mine = entries.filter((entry) => entry.route === here);
  const drop = new Set(mine.slice(0, Math.max(0, mine.length - getUndoLimit())));
  return drop.size ? entries.filter((entry) => !drop.has(entry)) : entries;
};

// Whether this tab has a reorder to undo or redo (reactive, for a button's disabled state).
export const canUndoReorder = () => {
  // eslint-disable-next-line no-unused-expressions
  version.value;
  return available(state.undoEntries);
};

export const canRedoReorder = () => {
  // eslint-disable-next-line no-unused-expressions
  version.value;
  return available(state.redoEntries);
};

/**
 * Records a reorder that has just been made.
 * @param {{undo: function(), redo: function(), isCurrent: function(): boolean, key: (*|undefined)}} entry undo puts the
 *     previous order back, redo puts the new one back, and isCurrent says whether the list still
 *     holds the order this reorder produced. Entries with the same key, recorded within a
 *     moment of each other, merge into one step.
 */
export const recordReorder = (entry) => {
  markRecorded();
  const here = currentRoute();
  const now = Date.now();
  // Changes to the same thing that follow each other quickly (painting a run of row colors) are
  // one step: the earlier one keeps its undo and takes the later one's redo.
  const last = state.undoEntries[state.undoEntries.length - 1];
  if (entry.key !== undefined && last && last.route === here && last.key === entry.key &&
      now - last.time < COALESCE_MS) {
    last.redo = entry.redo;
    last.isCurrent = entry.isCurrent;
    last.time = now;
    last.stamp = ++state.counter;
    state.redoEntries = state.redoEntries.filter((other) => other.route !== here);
    changed();
    return;
  }
  state.undoEntries.push({...entry, route: here, stamp: ++state.counter, time: now});
  state.undoEntries = trimTab(state.undoEntries, here);
  state.redoEntries = state.redoEntries.filter((other) => other.route !== here);
  changed();
};

// Called when something with an undo of its own is edited: it is now the most recent thing, and
// whatever could have been redone no longer can be.
export const noteEdit = () => {
  state.lastEdit = ++state.counter;
  const here = currentRoute();
  if (state.redoEntries.some((entry) => entry.route === here)) {
    state.redoEntries = state.redoEntries.filter((entry) => entry.route !== here);
    changed();
  }
};

// Called after an edit with an undo of its own has been undone.
export const settleEdits = () => {
  state.lastEdit = 0;
};

const lastFor = (entries, here) => {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].route === here) return entries[i];
  }
  return null;
};

/**
 * Undoes the most recent reorder on this tab, if it is the most recent thing done.
 * @return {boolean} Whether it undid one.
 */
export const tryUndoReorder = () => {
  const entry = lastFor(state.undoEntries, currentRoute());
  if (!entry || entry.stamp < state.lastEdit) return false;
  state.undoEntries = state.undoEntries.filter((other) => other !== entry);
  if (!entry.isCurrent()) {
    changed();
    return false;
  }
  markReplaying();
  entry.undo();
  state.redoEntries.push(entry);
  state.redoEntries = trimTab(state.redoEntries, entry.route);
  changed();
  return true;
};

/**
 * Redoes the reorder most recently undone on this tab.
 * @return {boolean} Whether it redid one.
 */
export const tryRedoReorder = () => {
  const entry = lastFor(state.redoEntries, currentRoute());
  if (!entry) return false;
  state.redoEntries = state.redoEntries.filter((other) => other !== entry);
  markReplaying();
  entry.redo();
  state.undoEntries.push(entry);
  state.undoEntries = trimTab(state.undoEntries, entry.route);
  changed();
  return true;
};

/**
 * Whether the list holds exactly these items, in this order.
 * @param {!Array<*>} items
 * @param {!Array<*>} expected
 * @return {boolean}
 */
export const sameItems = (items, expected) =>
  Array.isArray(items) && items.length === expected.length && items.every((item, i) => item === expected[i]);
