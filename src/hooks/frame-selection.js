import {ref} from '@vue/composition-api';

// Selecting several frames of one animation (a sprite animation of the Sprites tab, a graphic of the Title tab) at once, to delete them together:
// Ctrl/Cmd+click a frame adds it to the selection or takes it out, Shift+click selects the frames from the anchor (the frame clicked last without
// Shift) to it, a plain click selects the frame alone. Clicks with Ctrl/Cmd or Shift on the drawing itself are left to the drawing (they are not
// selections): the frame is clicked outside its pixels. A selection belongs to one list of frames (owner: a key of the animation or graphic); a
// click in another list starts a new one.
export const useFrameSelection = () => {
  const selection = ref({owner: null, ids: []});
  let anchor = null;

  const selectFrame = (owner, frames, frame, event = {}) => {
    // (For the card around the frame, which gets the click next: see hooks/card-selection.js.)
    event.frameClick = true;
    const modified = event.shiftKey || event.ctrlKey || event.metaKey;
    if (modified && event.target && event.target.closest && event.target.closest('canvas')) return;
    const ids = frames.map(({id}) => id);
    const same = selection.value.owner === owner;
    if (event.shiftKey && same && ids.includes(anchor)) {
      const from = ids.indexOf(anchor);
      const to = ids.indexOf(frame.id);
      selection.value = {owner, ids: ids.slice(Math.min(from, to), Math.max(from, to) + 1)};
      return;
    }
    if ((event.ctrlKey || event.metaKey) && same) {
      const has = selection.value.ids.includes(frame.id);
      selection.value = {owner, ids: has ? selection.value.ids.filter((id) => id !== frame.id) : [...selection.value.ids, frame.id]};
      anchor = frame.id;
      return;
    }
    selection.value = {owner, ids: [frame.id]};
    anchor = frame.id;
  };

  // Shown as selected: a frame of a selection of two or more (one frame alone is the frame the toolbar acts on, which is outlined already).
  const isFrameSelected = (owner, frame) => selection.value.owner === owner && selection.value.ids.length > 1 && selection.value.ids.includes(frame.id);

  // The frames the delete button of this frame deletes: the selected ones when it is one of two or more, else it alone. One frame is always kept:
  // with every frame selected, the first stays.
  const framesToDelete = (owner, frames, frame) => {
    if (!isFrameSelected(owner, frame)) return [frame.id];
    const chosen = frames.map(({id}) => id).filter((id) => selection.value.ids.includes(id));
    return chosen.length >= frames.length ? chosen.slice(1) : chosen;
  };

  const deleteFrameQuestion = (owner, frames, frame) => {
    const count = framesToDelete(owner, frames, frame).length;
    return count > 1 ? `Delete these ${count} frames?` : 'Delete this frame?';
  };

  // After a delete: the frames that are gone leave the selection.
  const forgetFrames = (ids) => {
    selection.value = {owner: selection.value.owner, ids: selection.value.ids.filter((id) => !ids.includes(id))};
    if (ids.includes(anchor)) anchor = null;
  };

  return {selectFrame, isFrameSelected, framesToDelete, deleteFrameQuestion, forgetFrames};
};
