'use strict';

// DPC+ and PXE draw a sprite's row on every scanline: the build writes each row of an animation twice (2 lines a row, the look of the standard
// kernel) unless the animation is single height (the Player editor's 1 line toggle), which keeps each row once: twice the rows in the same height.
// The standard kernel draws a row on 2 lines and has no single height.
export const isSingleHeight = (animation, config) => !!(animation && animation.singleHeight) && (config || {}).kernel === 'dpcplus';

// The lines a row of the animation takes on screen under DPC+ and PXE.
export const linesPerRow = (animation, config) => (isSingleHeight(animation, config) ? 1 : 2);

// The lines of the animation's tallest picture under DPC+ and PXE.
export const animationLines = (animation, config) => linesPerRow(animation, config) *
  Math.max(0, ...((animation && animation.frames) || []).map((frame) => (Array.isArray(frame.pixels) ? frame.pixels.length : 0)));
