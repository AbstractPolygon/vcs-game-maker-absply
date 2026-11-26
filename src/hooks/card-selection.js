import {ref} from '@vue/composition-api';
import {REMOVED} from '../utils/card-refs';

// Selecting several cards of a tab's list at once: Shift+click selects the cards from the anchor (the card clicked last
// without Shift) to the one clicked; Ctrl/Cmd+click adds a card to the selection or takes it out. selectedCardId (the
// tab's ref for the card its toolbar acts on) stays the card clicked last.
//
// getIds returns the ids of the cards in the order they are listed. Deleting one of several selected cards deletes
// them all (see idsToDelete), and dragging one of them moves them all (see getSelectedIndices, which
// hooks/drag-reorder.js takes).
export const useCardSelection = (getIds, selectedCardId) => {
  const selectedCardIds = ref([]);
  let anchorCardId = null;

  const selectCard = (id, event = {}) => {
    // A click on a frame inside the card (Ctrl or Shift selects frames there, see hooks/frame-selection.js) is a plain click for the card:
    // with its keys it added the card to the selected cards or took it out, or selected a run of cards.
    if (event.frameClick) event = {};
    const ids = getIds();
    if (event.shiftKey && ids.includes(anchorCardId)) {
      const from = ids.indexOf(anchorCardId);
      const to = ids.indexOf(id);
      selectedCardIds.value = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
      selectedCardId.value = id;
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedCardIds.value.includes(id)) {
        selectedCardIds.value = selectedCardIds.value.filter((other) => other !== id);
        selectedCardId.value = selectedCardIds.value.length ?
          selectedCardIds.value[selectedCardIds.value.length - 1] : null;
      } else {
        selectedCardIds.value = [...selectedCardIds.value, id];
        selectedCardId.value = id;
      }
      anchorCardId = id;
    } else {
      // (A click on a card already selected alone, as every click inside it is, leaves the list as it is: a new list re-rendered the
      // whole tab, every card and canvas, on each click.)
      if (selectedCardIds.value.length !== 1 || selectedCardIds.value[0] !== id) selectedCardIds.value = [id];
      selectedCardId.value = id;
      anchorCardId = id;
    }
  };

  const deselectCard = () => {
    selectedCardId.value = null;
    if (selectedCardIds.value.length) selectedCardIds.value = [];
    anchorCardId = null;
  };

  const isSelected = (id) => selectedCardIds.value.includes(id);

  // The indices (in list order) of the selected cards.
  const getSelectedIndices = () => getIds().map((id, index) => (selectedCardIds.value.includes(id) ? index : -1))
      .filter((index) => index >= 0);

  // The ids deleted when the delete button of the card with this id is confirmed: all the selected cards if it is one of
  // two or more, otherwise just it. A tab that keeps at least one card keeps the first of them when they are all of them.
  const idsToDelete = (id, keepAtLeast = 0) => {
    if (selectedCardIds.value.length < 2 || !selectedCardIds.value.includes(id)) return [id];
    const chosen = getIds().filter((other) => selectedCardIds.value.includes(other));
    return keepAtLeast && chosen.length >= getIds().length ? chosen.slice(keepAtLeast) : chosen;
  };

  // The question of the delete confirmation.
  const deleteQuestion = (id, noun, keepAtLeast = 0) => {
    const count = idsToDelete(id, keepAtLeast).length;
    return count > 1 ? `Delete these ${count} ${noun}s?` : `Delete this ${noun}?`;
  };

  // Whether the Delete key opens this card's confirmation: only the card clicked last does.
  const isDeleteTarget = (id, selectedId) => selectedId === id && selectedCardIds.value.includes(id);

  // The cards were numbered again (see utils/card-refs.js's renumberCards): idMap says old id -> new id, REMOVED for a card that is gone.
  const remapIds = (idMap) => {
    const next = (id) => (idMap.has(id) ? idMap.get(id) : id);
    selectedCardIds.value = selectedCardIds.value.map(next).filter((id) => id !== REMOVED);
    if (selectedCardId.value !== null && selectedCardId.value !== undefined) {
      const id = next(selectedCardId.value);
      selectedCardId.value = id === REMOVED ? null : id;
    }
    if (anchorCardId !== null) anchorCardId = next(anchorCardId) === REMOVED ? null : next(anchorCardId);
  };

  return {selectedCardIds, selectCard, deselectCard, isSelected, getSelectedIndices, idsToDelete, deleteQuestion,
    isDeleteTarget, remapIds};
};
