'use strict';

// The comparison of the boxes of two sprites, for the blocks that ask whether two objects collide where the hardware flags cannot
// say (a virtual sprite of the DPC+ kernel, or a 16 pixel wide player that is two sprites). The answer of each pair is a byte,
// set once a frame after everything that moves sprites has run, so a block reads the result of the last frame like it does the
// hardware flags.
//
// A player's box: 8 pixels wide, 16 and 32 at double and quad width, twice that for a 16 pixel wide player while the sprite that
// shows its right half is there. A player with copies (NUSIZ 1 to 4 and 6) has the box of each copy as well, 16, 32 or 64
// pixels to the right, round the edge of the screen when that is past it. A player off the screen to the right (x of 177
// or more) has no copies. The missiles and the ball have one box, 2 pixels wide. None of it is kept in bytes: it is read from the size byte.

import {flagPoolVar, flagPoolBit} from './flag-pool';

const RIGHT_EDGE_X = 177;

export const isPlayerName = (name) => /^player([0-9]|1[0-6])$/.test(name);
export const pairKey = (first, second) => [first, second].sort().join('|');
// The answers of the pairs are bits of shared bytes (eight pairs to a byte, see flag-pool.js): the pairs in the order of boxPairOrder.
const BOX_HIT_BITS_PER_BYTE = 8;
export const boxHitFamily = (index) => `boxHitFlags${Math.floor(index / BOX_HIT_BITS_PER_BYTE)}`;
// The families the plan needs for the pairs: [{family, bits}].
export const boxHitFamilies = (pairOrder) => (pairOrder || []).reduce((families, key, index) => {
  const family = boxHitFamily(index);
  let entry = families.find((candidate) => candidate.family === family);
  if (!entry) families.push(entry = {family, bits: []});
  entry.bits.push(index % BOX_HIT_BITS_PER_BYTE);
  return families;
}, []);
// A pair's bit, as batari Basic writes it: "variable{bit}".
export const boxHitRef = (Blockly, key) => {
  const index = (Blockly.BBasic.boxPairOrder || []).indexOf(key);
  const family = boxHitFamily(index);
  return `${Blockly.BBasic.nameDB_.getName(flagPoolVar(family), Blockly.Names.DEVELOPER_VARIABLE_TYPE)}` +
    `{${flagPoolBit(family, index % BOX_HIT_BITS_PER_BYTE)}}`;
};

// The hit bits of the pairs (the boxes themselves have no bytes: everything is read from the size byte where they are compared).
export const reserveBoxDevVars = (reserveDevVar, pairOrder = []) => {
  boxHitFamilies(pairOrder).forEach(({family}) => {
    reserveDevVar(flagPoolVar(family), undefined, 'a bit for each pair of sprites a "Collided" block compares by their boxes: they overlap (1) or not (0), as of the end of the last frame');
  });
};

// An object's box: its x, y and height, and its kind (see boxKinds in init, generators/bbasic.js): a number, a single box that wide (the missiles and
// the ball 2); 'size', a single box with the width the size byte has; 'full', the width and the copies the size byte has, the width twice as much while
// the right half of a wide player is shown.
const boxesOf = (Blockly, name) => ({
  x: `${name}x`, y: `${name}y`, height: `${name}height`, size: `${name}size`,
  kind: isPlayerName(name) ? ((Blockly.BBasic.boxKinds && Blockly.BBasic.boxKinds.get(name)) || 'full') : 2,
});

// The tables the comparisons read with the size's low 3 bits: the width (the codes the animations and the width blocks write: 0 one, 5 double, 7 quad;
// the copy codes have one), and for each code 4 bytes: where each box is from x (0, then the copies, 16, 32 or 64 to the right), 255 after the last.
export const BOX_SIZE_WIDTHS = '_boxsizewidths';
const BOX_COPY_OFFSETS = '_boxcopyoffsets';
const COPY_OFFSETS = [[0], [0, 16], [0, 32], [0, 16, 32], [0, 64], [0], [0, 32, 64], [0]];
const boxTables = (copies) => [' asm', `  jmp ${BOX_SIZE_WIDTHS}_end`, BOX_SIZE_WIDTHS, '  .byte 8,8,8,8,8,16,8,32',
  ...(copies ? [BOX_COPY_OFFSETS, ...COPY_OFFSETS.map((offsets) => `  .byte ${[0, 1, 2, 3].map((i) => (i < offsets.length ? offsets[i] : 255)).join(',')}`)] : []),
  `${BOX_SIZE_WIDTHS}_end`, 'end'];

// The assembly that leaves an object's width in A (the right half of a wide player doubles it; with shared partner bytes, the right half that is not
// drawn as one, bit 6 of its size, does not).
const widthAsm = (Blockly, box, name, label) => {
  if (Number.isInteger(box.kind)) return [`  lda #${box.kind}`];
  const lines = [`  lda ${box.size}`, '  and #7', '  tax', `  lda ${BOX_SIZE_WIDTHS},x`];
  const partner = (Blockly.BBasic.widePartners || {})[name];
  if (box.kind !== 'full' || !partner) return lines;
  const narrow = `${label}_narrow`;
  return [...lines, '  sta temp7', `  lda ${partner}frame`, '  cmp #255', `  beq ${narrow}`,
    ...((Blockly.BBasic.sharedPartnerVars || {})[partner] ? [`  lda ${partner}size`, '  and #64', `  bne ${narrow}`] : []),
    '  asl temp7', narrow, '  lda temp7'];
};

// The same width in batari Basic, into `target` (scratch: a byte it may use): for the scene triggers, which look at the box of the sprite itself.
export const boxWidthLines = (Blockly, name, target, scratch) => {
  const box = boxesOf(Blockly, name);
  if (Number.isInteger(box.kind)) return [` ${target} = ${box.kind}`];
  const lines = [` ${scratch} = ${box.size} & 7`, ` ${target} = 8`, ` if ${scratch} = 5 then ${target} = 16`, ` if ${scratch} = 7 then ${target} = 32`];
  const partner = (Blockly.BBasic.widePartners || {})[name];
  if (box.kind !== 'full' || !partner) return lines;
  return [...lines, (Blockly.BBasic.sharedPartnerVars || {})[partner] ?
    ` if ${partner}frame <> 255 && !${partner}size{6} then ${target} = ${target} + ${target}` :
    ` if ${partner}frame <> 255 then ${target} = ${target} + ${target}`];
};

export const generateBoxChecks = (Blockly) => {
  const pairs = Blockly.BBasic.boxPairs;
  if (!pairs || !pairs.size) return '';
  const lines = [];
  const kinds = [...pairs].flatMap((key) => key.split('|').map((name) => boxesOf(Blockly, name).kind));
  if (kinds.some((kind) => !Number.isInteger(kind))) lines.push(...boxTables(kinds.includes('full')));
  [...pairs].sort().forEach((key) => {
    const [first, second] = key.split('|');
    const hit = boxHitRef(Blockly, key);
    const id = Blockly.BBasic.blockNumbers.next(`boxpair`);
    const done = `_boxpair_${id}_done`;
    const label = (part) => `_boxpair_${id}_${part}`;
    const a = boxesOf(Blockly, first);
    const b = boxesOf(Blockly, second);
    // A sprite a visibility block can hide (frame 255) has no box while it is hidden.
    const hideable = [first, second].filter((name) => (Blockly.BBasic.hideablePlayers || new Set()).has(name));
    const over = (low, high, lowEnd, fail) => [`  lda ${low}`, '  clc', `  adc ${high}`, `  cmp ${lowEnd}`, `  bcc ${fail}`];
    // (fail: where a test that finds no overlap goes; with the copies the end is past a branch's reach, so a jump next to the tests goes on to it.)
    const head = (fail) => [` rem ${first} and ${second} boxes:`, ` ${hit} = 0`, ' asm',
      // (A hidden sprite first: they are the most pairs in a game with a Sprite pool, and the test is a few cycles when the frame is in zero page.)
      ...hideable.flatMap((name) => [`  lda ${name}frame`, '  cmp #255', `  beq ${fail}`]),
      // (a.y + a.height) < b.y: a is above b. b.y + b.height < a.y: a is below b.
      ...over(a.y, a.height, b.y, fail), ...over(b.y, b.height, a.y, fail)];
    if (a.kind !== 'full' && b.kind !== 'full') {
      // One box each: (a.x + a's width) < b.x, a is to the left of b; b.x + b's width < a.x, a is to the right of b. (A width read from the size byte is
      // worked out into temp1, a's, and temp2, b's, first.)
      const operand = (box, scratch) => (Number.isInteger(box.kind) ? `#${box.kind}` : scratch);
      lines.push(...head(`.${done}`),
          ...(Number.isInteger(a.kind) ? [] : [...widthAsm(Blockly, a, first, label('aw')), '  sta temp1']),
          ...(Number.isInteger(b.kind) ? [] : [...widthAsm(Blockly, b, second, label('bw')), '  sta temp2']),
          ...over(a.x, operand(a, 'temp1'), b.x, `.${done}`), ...over(b.x, operand(b, 'temp2'), a.x, `.${done}`),
          'end', ` ${hit} = 1`, done);
      return;
    }
    // With copies: every box of a against every box of b. temp5 and temp6 are where a's and b's boxes start in the table of the copies (one box, the
    // sprite itself, for an object with no copies), temp2 and temp4 their widths, temp1 and temp3 the x of the boxes being compared. A copy is past the
    // right edge of the screen when x is 177 or more (then it has none), and comes round the edge when the x of the copy is.
    const start = (box, target) => (box.kind === 'full' ? [`  lda ${box.size}`, '  and #7', '  asl', '  asl'] : ['  lda #0']).concat([`  sta ${target}`]);
    const boxX = (box, prefix, next) => [
      `  sta ${prefix === 'a' ? 'temp1' : 'temp3'}`, '  cmp #0', `  beq ${label(prefix + 'main')}`,
      `  lda ${box.x}`, `  cmp #${RIGHT_EDGE_X}`, `  bcs ${next}`,
      `  lda ${prefix === 'a' ? 'temp1' : 'temp3'}`, '  clc', `  adc ${box.x}`, `  cmp #${RIGHT_EDGE_X}`, `  bcc ${label(prefix + 'keep')}`, '  sbc #160',
      `  jmp ${label(prefix + 'keep')}`, label(prefix + 'main'), `  lda ${box.x}`, label(prefix + 'keep'), `  sta ${prefix === 'a' ? 'temp1' : 'temp3'}`];
    lines.push(...head(label('no')), `  jmp ${label('go')}`, label('no'), `  jmp .${done}`, label('go'),
        ...start(a, 'temp5'), ...start(b, 'temp6'),
        ...widthAsm(Blockly, a, first, label('aw')), '  sta temp2', ...widthAsm(Blockly, b, second, label('bw')), '  sta temp4',
        label('a'), '  ldx temp5', `  lda ${BOX_COPY_OFFSETS},x`, '  cmp #255', `  bne ${label('ago')}`, `  jmp .${done}`, label('ago'),
        ...boxX(a, 'a', label('none')),
        '  ldx temp6',
        label('b'), `  lda ${BOX_COPY_OFFSETS},x`, '  cmp #255', `  beq ${label('anext')}`,
        ...boxX(b, 'b', label('anext')),
        // (a.x + a's width) >= b.x and (b.x + b's width) >= a.x: they overlap.
        '  lda temp1', '  clc', '  adc temp2', '  cmp temp3', `  bcc ${label('bnext')}`,
        '  lda temp3', '  clc', '  adc temp4', '  cmp temp1', `  bcs ${label('hit')}`,
        label('bnext'), '  inx', `  jmp ${label('b')}`,
        label('anext'), '  inc temp5', `  jmp ${label('a')}`,
        // (Past the edge: a's copies are over.)
        label('none'), `  jmp .${done}`,
        label('hit'),
        'end', ` ${hit} = 1`, done);
  });
  return lines.join('\n') + '\n';
};
