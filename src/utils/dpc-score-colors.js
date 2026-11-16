'use strict';

// DPC+ draws the 8 lines of the score digits in the colors of a table of 8 bytes in the display memory at scoredata (the kernel's
// score loop reads one a line, top first, through DF6; see DPCplus_kernel.asm), not in scorecolor. Whatever changes scorecolor
// writes the table again with these lines (the color in A, the table's address already in DF0LOW/DF0HI).
//
// Score fade shading (the Score tab's checkbox, config.enableScoreFade, bB's "const scorefade = 1"): the standard kernel's score loop
// starts each frame from scorecolor and takes 1 off it every line (std_kernel.asm, stack2), so the digits get darker toward the
// bottom; the DPC+ kernel has no such code, so here the table is written that way: the top line scorecolor, each line under it one
// less.
export const dpcPlusScoreFillAsm = (config) => (config && config.enableScoreFade ?
  // (sta DF0WRITE is 3 bytes, sec 1, sbc #1 2, dex 1: back 7 to the store.)
  ['ldx #8', 'sta DF0WRITE', 'sec', 'sbc #1', 'dex', 'bne *-7'] :
  // The 8 bytes written with one color: a loop of 8 bytes of code where eight stores take 24.
  ['ldx #8', 'sta DF0WRITE', 'dex', 'bne *-4']);

// The table the project starts with for a score of one color (byte): the same on every line, or shaded as above.
export const dpcPlusScoreStartColors = (config, byte) => Array.from({length: 8},
    (unused, line) => (config && config.enableScoreFade ? (byte - line + 256) & 255 : byte));

// Whether the Score tab gave the lines different colors (they win over scorecolor: only the "Score line colors hue" block recolors
// them). Each is rounded the way the table is (bit 0 dropped), so two bytes that come out the same are not different.
export const dpcPlusScoreLinesDiffer = (config) => !!config && !config.dpcPlusScoreLineColorsOff && Array.isArray(config.dpcPlusScoreColors) &&
  config.dpcPlusScoreColors.length === 8 &&
  new Set(config.dpcPlusScoreColors.map((byte) => (Number.isFinite(Number(byte)) ? Math.min(254, Math.max(0, Math.round(Number(byte)) & 254)) : 0x08))).size > 1;
