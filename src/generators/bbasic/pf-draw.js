'use strict';

import {pfMaxColumn} from '../../utils/playfield-coords';
import {buildCircleArmCall, ensureArmProgram} from './offset-arm';

// The Draw blocks of Playfield > Utility (a pixel, a straight line, a line, an area, a circle and the fill) share one drawing engine: a block puts
// its work in a queue, and at the end of each frame's code (the end of commongamelogic, the last code before drawscreen waits for the timer) the
// engine draws a pixel at a time for as long as the frame has time to spare, so a big shape is spread over frames instead of making the frame too
// long (the screen would roll). The work runs in the order the blocks gave it; a block that finds the queue full has the work before it finished
// at once and is drawn at once itself, so nothing is lost and the order is kept.
//
// The bytes (as few as it takes, shared by every kind of work):
//   the state: bits 7-5 the kind of the work being drawn (0: none), bits 4-3 what is done to the pixels (0 set, 1 clear, 2 flip; the fill: 0 fill,
//     1 erase), bits 2-0 a few flags of the kind's (the line's direction, the circle's row and side, the fill's steps);
//   the work bytes: what the kind being drawn keeps (as many as the kind that needs the most of the ones the project uses);
//   the queue: records of a header (the kind and the operation, as the state has them) and the numbers of the block, as many as the kind with the
//     most of them takes; a free record has a header of 0. A block writes its record straight into the last record (it is free: see _pfd_room),
//     and _pfd_submit moves it down to the first free one. A record that starts is read into temp1 (the header) to temp6 (the numbers). On DPC+ the
//     records are in the display RAM (page $0F from RECORD_OFFSET, read with data fetcher 0 and written with 1), elsewhere in separate bytes;
//   the fill's seeds (a place on a row the fill still has to look at, two bytes): on DPC+ in the display RAM (page $0F from SEED_OFFSET), elsewhere
//     in the work bytes past the three the fill keeps (the line and the circle need seven, so they come at no cost when the project has those). A
//     seed that finds no room is dropped (a very winding area can then be left partly unfilled).
// On DPC+ the coprocessor draws a circle in one call (no work bytes): its record waits in the queue for its turn and is drawn as it starts. Page $0F
// of the display RAM is past the end of the stack, free in every build; its first bytes are the Run once flags (see utils/dpc-ram-flags.js).
// (The bytes are reserved with reserveDevVarRW: with Superchip they go to its RAM, where the write and the read have different names.)

export const PF_DRAW_BLOCK_TYPES = ['background_change_pixel', 'background_change_hv_line', 'background_fill_area', 'background_draw_line',
  'background_fill_circle', 'background_flood_fill'];
export const pfDrawKindOf = (block) => {
  switch (block.type) {
    case 'background_change_pixel': return 'pixel';
    case 'background_change_hv_line': return block.getFieldValue('DIRECTION') === 'pfvline' ? 'vline' : 'hline';
    case 'background_fill_area': return block.getFieldValue('MODE') === 'CENTER' ? 'carea' : 'area';
    case 'background_draw_line': return 'line';
    case 'background_fill_circle': return 'circle';
    case 'background_flood_fill': return 'fill';
    default: return null;
  }
};
const KIND_NUMBER = {pixel: 1, hline: 2, vline: 3, area: 4, carea: 4, line: 5, circle: 6, fill: 7};
const KINDS_BY_NUMBER = ['none', 'pixel', 'hline', 'vline', 'area', 'line', 'circle', 'fill'];
const OPERATION_NUMBER = {on: 0, off: 1, flip: 2};
// The numbers a kind's record holds and the work bytes it keeps while it is drawn (at most five numbers: the record is read into temp1 to temp6).
const RECORD_NUMBERS = {pixel: 2, hline: 3, vline: 3, area: 4, carea: 4, line: 4, circle: 5, fill: 2};
const WORK_BYTES = {pixel: 0, hline: 3, vline: 3, area: 5, carea: 5, line: 7, circle: 7, fill: 3};
// The records of the queue and the seeds of the fill. The standard kernel without Superchip has the least RAM: one record waiting and two seeds.
const queueRecordsFor = (config, superchip, displayRam) => (displayRam ? 4 : superchip ? 3 : config.pxe ? 2 : 1);
const seedSlotsFor = (config, superchip) => (superchip || config.pxe ? 4 : 2);
const FILL_KEEPS = 3;
const DISPLAY_RAM_PAGE = '$0F';
const RECORD_OFFSET = 64;
const SEEDS_DPC_PLUS = 64;
const SEED_OFFSET = 128;
// What a step of drawing can take at the most, by the kind being drawn (none: a record starting), in the timer's counts of 64 cycles, on top of the
// 128 the timer holds while the frame has time left (see drawscreen's wait in the kernels): a step starts only when the frame has that much left, so a
// frame is never made longer; a busy game draws less a frame. From the most a step of each took in the emulator (tests/emulator/stepcost.cjs, the
// draw_ test projects) with the 40 cycles of the test of the time: standard kernel, a record starting 224 cycles (a pixel is drawn as it starts), a
// pixel 139, a straight line 167, an area 174, a line 221, a circle 370, the fill 555; DPC+ (the records in the display RAM) a record starting 461
// (the coprocessor's circle), a straight line 178, an area 181, a line 219, the fill 662. The first number is a record starting: what the kinds the
// project uses take to start.
const STEP_TIMER_COUNTS = {standard: [5, 4, 4, 4, 4, 5, 7, 10], dpcplus: [7, 4, 4, 4, 4, 5, 5, 11]};
const startCounts = (config, kinds) => {
  if (config.kernel === 'dpcplus') return kinds.has('circle') ? 9 : STEP_TIMER_COUNTS.dpcplus[0];
  return [...kinds].every((kind) => kind === 'pixel') ? 4 : STEP_TIMER_COUNTS.standard[0];
};
// PXE: the steps of a frame (see _pfd_step). Not measured on a real PXE cartridge: the emulator does not model the coprocessor's speed.
const PXE_STEPS_A_FRAME = 24;
export const PF_DRAW_SUBROUTINE = '_pfdraw';

// The kinds the project's enabled blocks use (null when none).
export const pfDrawKindsUsed = (blocks) => {
  const kinds = new Set(blocks.map(pfDrawKindOf).filter(Boolean));
  return kinds.size ? kinds : null;
};
const isDpcPlus = (config) => config.kernel === 'dpcplus' && !config.pxe;

// Reserves the bytes (from init in generators/bbasic.js) and keeps their names on Blockly.BBasic.pfDraw.
export const reservePfDrawVars = (Blockly, reserveDevVarRW, config, superchip, kinds, blocks) => {
  if (!kinds) {
    Blockly.BBasic.pfDraw = null;
    return;
  }
  const displayRam = isDpcPlus(config);
  const armCircle = displayRam;
  const seeds = kinds.has('fill') && !displayRam ? seedSlotsFor(config, superchip) : 0;
  const workBytes = Math.max(kinds.has('fill') ? FILL_KEEPS + 2 * seeds : 0, ...[...kinds].map((kind) => (kind === 'circle' && armCircle ? 0 : WORK_BYTES[kind])));
  const recordBytes = 1 + Math.max(...[...kinds].map((kind) => RECORD_NUMBERS[kind]));
  const records = queueRecordsFor(config, superchip, displayRam);
  const state = reserveDevVarRW('pfdState', 'playfield drawing: the kind of work being drawn, its operation and its steps');
  const work = Array.from({length: workBytes}, (_, i) => reserveDevVarRW(`pfdWork${i}`, 'playfield drawing: what the work being drawn keeps'));
  const queue = displayRam ? null : Array.from({length: records}, (_, r) => Array.from({length: recordBytes}, (_, i) =>
    reserveDevVarRW(`pfdQueue${r}_${i}`, 'playfield drawing: a waiting Draw block\'s record')));
  const seedBytes = Array.from({length: seeds}, (_, s) => [work[FILL_KEEPS + 2 * s], work[FILL_KEEPS + 2 * s + 1]]);
  Blockly.BBasic.pfDraw = {kinds, state, work, queue, records, recordBytes, seeds: seedBytes, displayRam, armCircle, config, superchip};
  // (The operations the blocks use: the plotting routine and the circle's calls have only those.)
  const drawBlocks = blocks.filter((block) => pfDrawKindOf(block));
  Blockly.BBasic.pfDrawOperations = new Set(drawBlocks.map((block) => block.getFieldValue('OPERATION') || 'on'));
  Blockly.BBasic.pfDrawCircleOperations = new Set(drawBlocks.filter((block) => block.type === 'background_fill_circle').map((block) => block.getFieldValue('OPERATION')));
  Blockly.BBasic.pfDrawFillControls = blocks.some((block) => block.type === 'background_flood_fill_stop' || block.type === 'background_flood_fill_done');
};

// Where the records are: the lines that read and write them (byte i of record r), for separate bytes or the display RAM.
const recordStore = (pfDraw) => {
  const {queue: Q, records, recordBytes: size, displayRam} = pfDraw;
  const last = records - 1;
  if (!displayRam) {
    return {
      // byte i of record r into a temp
      read: (r, i, temp) => [`${temp} = ${Q[r][i].read}`],
      // the record r into temp1 to temp(size)
      load: (r) => Q[r].map((byte, i) => `temp${i + 1} = ${byte.read}`),
      // record `from` copied to `to`
      copy: (from, to) => Q[to].map((byte, i) => `${byte.write} = ${Q[from][i].read}`),
      // the records after r moved down by one, the last one freed
      remove: (r) => [...Array.from({length: last - r}, (_, k) => Q[r + k].map((byte, i) => `${byte.write} = ${Q[r + k + 1][i].read}`)).flat(),
        `${Q[last][0].write} = 0`],
      free: (r) => [`${Q[r][0].write} = 0`],
      // a block's number into byte i of the last record
      write: (i, code) => [`${Q[last][i].write} = ${code}`],
    };
  }
  const offset = (r, i) => RECORD_OFFSET + r * size + i;
  // (The constants of the pointers are loaded with ldx, which DPC+'s fast fetch never changes.)
  const aim = (fetcher, place) => [`ldx #${place}`, `stx DF${fetcher}LOW`, `ldx #${DISPLAY_RAM_PAGE}`, `stx DF${fetcher}HI`];
  const asm = (lines) => ['asm', ...lines, '@end'].join('\n');
  return {
    read: (r, i, temp) => [asm([...aim(0, offset(r, i)), 'lda DF0DATA', `sta ${temp}`])],
    load: (r) => [asm([...aim(0, offset(r, 0)), ...Array.from({length: size}, (_, i) => ['lda DF0DATA', `sta temp${i + 1}`]).flat()])],
    copy: (from, to) => [asm([...aim(0, offset(from, 0)), ...aim(1, offset(to, 0)), ...Array.from({length: size}, () => ['lda DF0DATA', 'sta DF1WRITE']).flat()])],
    remove: (r) => [asm([...(r < last ? [...aim(0, offset(r + 1, 0)), ...aim(1, offset(r, 0)),
      ...Array.from({length: (last - r) * size}, () => ['lda DF0DATA', 'sta DF1WRITE']).flat()] : []),
    ...aim(1, offset(last, 0)), 'ldx #0', 'stx DF1WRITE'])],
    free: (r) => [asm([...aim(1, offset(r, 0)), 'ldx #0', 'stx DF1WRITE'])],
    write: (i, code) => [...(code === 'temp6' ? [] : [`temp6 = ${code}`]), asm([...aim(1, offset(last, i)), 'lda temp6', 'sta DF1WRITE'])],
  };
};

// The engine, one subroutine with its entries (see the comment at the top).
const buildEngine = (Blockly) => {
  const pfDraw = Blockly.BBasic.pfDraw;
  const {kinds, state: S, work: W, records, seeds: P, displayRam, armCircle, config} = pfDraw;
  const store = recordStore(pfDraw);
  const maxRow = Blockly.BBasic.maxRowText(config);
  const maxColumn = pfMaxColumn(config);
  const last = records - 1;
  const has = (kind) => kinds.has(kind);
  const used = (n) => [...kinds].some((kind) => KIND_NUMBER[kind] === n);
  const set = (v, value) => `${v.write} = ${value}`;
  const lines = [];
  const add = (...more) => lines.push(...more);
  const label = (name) => `@ _pfd_${name}`;
  // (Whether record r is free: its header in temp1, 0 when it is.)
  const header = (r) => store.read(r, 0, 'temp1');

  // The steps of the frame: as many as the time left allows. PXE runs the program on the coprocessor's software 6502, whose INTIM is not the
  // console's timer (the game's reads of it never reach the console), so there it is a fixed number of steps a frame, counted on the stack (the
  // coprocessor runs the program much faster than a 6502 would).
  if (config.pxe) {
    add(label('step'),
        ['asm', `lda #${PXE_STEPS_A_FRAME}`, 'pha', '@end'].join('\n'),
        label('stl'),
        `if ${S.read} >= 32 then goto _pfd_stu`,
        ...header(0),
        'if temp1 = 0 then goto _pfd_stx',
        label('stu'),
        'gosub _pfd_unit',
        ['asm', 'pla', 'sec', 'sbc #1', 'pha', 'bne ._pfd_stl', '@end'].join('\n'),
        label('stx'),
        ['asm', 'pla', '@end'].join('\n'),
        'return');
  } else {
    const need = [startCounts(config, kinds), ...STEP_TIMER_COUNTS[config.kernel === 'dpcplus' ? 'dpcplus' : 'standard'].slice(1)];
    add(label('step'),
        ['asm', `lda ${S.read}`, 'lsr', 'lsr', 'lsr', 'lsr', 'lsr', 'tax', 'lda INTIM', 'cmp _pfd_need,x', 'bcs ._pfd_stgo', '@end'].join('\n'),
        'return',
        label('stgo'),
        `if ${S.read} >= 32 then goto _pfd_stu`,
        ...header(0),
        'if temp1 = 0 then goto _pfd_stz',
        label('stu'),
        'gosub _pfd_unit',
        'goto _pfd_step',
        label('stz'),
        set(S, 0),
        'return',
        ['asm', '@_pfd_need', `.byte ${need.map((counts) => 128 + counts).join(',')}`, '@end'].join('\n'));
  }
  // Every step until nothing is left.
  add(label('flush'),
      'gosub _pfd_unit',
      `if ${S.read} >= 32 then goto _pfd_flush`,
      ...header(0),
      'if temp1 <> 0 then goto _pfd_flush',
      'return');
  // Called by a block before it writes its record: the last record has to be free. When it is not, everything waiting is drawn now, and the state's
  // 1 has the block drawn at once too (see _pfd_submit).
  add(label('room'),
      ...header(last),
      'if temp1 = 0 then return',
      'gosub _pfd_flush',
      set(S, 1),
      'return');
  // The record the block wrote in the last record goes down to the first free one. With nothing being drawn the first one waiting starts (a circle
  // on DPC+, which is drawn as it starts, waits for the steps at the end of the frame).
  add(label('submit'),
      ...header(last),
      'if temp1 = 0 then return');
  for (let r = 0; r < last; r++) {
    add(...header(r),
        `if temp1 <> 0 then goto _pfd_sub${r + 1}`,
        ...store.copy(last, r),
        ...store.free(last),
        'goto _pfd_subd',
        label(`sub${r + 1}`));
  }
  add(label('subd'),
      `if ${S.read} >= 32 then return`,
      `if ${S.read} = 1 then goto _pfd_flush`,
      ...(armCircle && has('circle') ? [...header(0), 'temp1 = temp1 / 32', `if temp1 <> ${KIND_NUMBER.circle} then goto _pfd_deq`, set(S, 2), 'return'] : []),
      'goto _pfd_deq');
  // A step of the work being drawn; with none, the first record waiting starts.
  const unitTargets = KINDS_BY_NUMBER.map((kind, n) => (n && used(n) && kind !== 'pixel' && !(kind === 'circle' && armCircle) ? `_pfd_u${n}` : '_pfd_unone'));
  add(label('unit'),
      `if ${S.read} < 32 then goto _pfd_deq`,
      `temp1 = ${S.read} / 32`,
      `on temp1 goto ${unitTargets.join(' ')}`,
      label('unone'),
      set(S, 0),
      ...header(0),
      `if temp1 <> 0 then ${S.write} = 2`,
      'return thisbank');
  // The first record starts: read into temp1 to temp6, its numbers become the work bytes (a shape with nothing to draw sets the state back to 0),
  // then the records move up.
  const actTargets = KINDS_BY_NUMBER.map((kind, n) => (n && used(n) ? `_pfd_a${n}` : '_pfd_anone'));
  add(label('deq'),
      ...store.load(0),
      'if temp1 = 0 then goto _pfd_anone',
      `${S.write} = temp1 & 248`,
      'temp1 = temp1 / 32',
      `on temp1 goto ${actTargets.join(' ')}`,
      label('anone'),
      set(S, 0),
      label('shift'),
      ...store.remove(0),
      `if ${S.read} <> 0 then return`,
      ...header(0),
      `if temp1 <> 0 then ${S.write} = 2`,
      'return');

  // Plotting a pixel (temp1, temp2) with the state's operation.
  const operations = Blockly.BBasic.pfDrawOperations;
  const ownPlayfield = config.kernel !== 'dpcplus';
  const writeBase = Blockly.BBasic.pfDraw.superchip ? 'playfield-128' : 'playfield';
  // (Y: the byte of the pixel, X: its column, for the bit of the table.)
  const place = ['lda temp2', 'asl', 'asl', 'sta temp3', 'lda temp1', 'lsr', 'lsr', 'lsr', 'clc', 'adc temp3', 'tay', 'ldx temp1'];
  if (ownPlayfield) {
    const write = [`sta ${writeBase},y`, 'rts'];
    add(label('plot'),
        ['asm', ...place,
          ...(operations.has('flip') ? [`lda ${S.read}`, 'and #16', 'beq _pfd_pnf', 'lda playfield,y', 'eor _pfd_bit,x', ...write, '@_pfd_pnf'] : []),
          ...(operations.has('off') ? [`lda ${S.read}`, 'and #8', 'beq _pfd_pno', 'lda _pfd_bit,x', 'eor #255', 'and playfield,y', ...write, '@_pfd_pno'] : []),
          'lda playfield,y', 'ora _pfd_bit,x', ...write,
          '@_pfd_bit', '.byte $80,$40,$20,$10,$08,$04,$02,$01,$01,$02,$04,$08,$10,$20,$40,$80',
          '.byte $80,$40,$20,$10,$08,$04,$02,$01,$01,$02,$04,$08,$10,$20,$40,$80', '@end'].join('\n'));
  } else {
    add(label('plot'),
        ...(operations.has('flip') ? [`if ${S.read}{4} then goto _pfd_plotf`] : []),
        ...(operations.has('off') ? [`if ${S.read}{3} then goto _pfd_ploto`] : []),
        'pfpixel temp1 temp2 on',
        'return thisbank',
        ...(operations.has('off') ? [label('ploto'), 'pfpixel temp1 temp2 off', 'return thisbank'] : []),
        ...(operations.has('flip') ? [label('plotf'), 'pfpixel temp1 temp2 flip', 'return thisbank'] : []));
  }
  const fromRecord = (count) => Array.from({length: count}, (_, i) => set(W[i], `temp${i + 2}`));

  // A pixel is drawn as it starts.
  if (has('pixel')) add(label('a1'), 'temp1 = temp2', 'temp2 = temp3', 'gosub _pfd_plot', 'goto _pfd_anone');
  // A straight line: x, y and the pixels left (0 draws nothing).
  [['hline', 2, 0], ['vline', 3, 1]].forEach(([kind, n, axis]) => {
    if (!has(kind)) return;
    add(label(`a${n}`), ...fromRecord(3), 'if temp4 = 0 then goto _pfd_anone', 'goto _pfd_shift',
        label(`u${n}`), `temp1 = ${W[0].read}`, `temp2 = ${W[1].read}`, 'gosub _pfd_plot',
        set(W[2], `${W[2].read} - 1`), `if ${W[2].read} = 0 then goto _pfd_unone`,
        set(W[axis], `${W[axis].read} + 1`), 'return thisbank');
  });
  // An area: the first column, the row, the last column, the last row, and the column being drawn. The corners in order and held to the playfield.
  if (has('area') || has('carea')) {
    add(label('a4'), ...fromRecord(4),
        `if ${W[0].read} <= ${W[2].read} then goto _pfd_a4x`, `temp1 = ${W[0].read}`, set(W[0], W[2].read), set(W[2], 'temp1'),
        label('a4x'),
        `if ${W[1].read} <= ${W[3].read} then goto _pfd_a4y`, `temp1 = ${W[1].read}`, set(W[1], W[3].read), set(W[3], 'temp1'),
        label('a4y'),
        `if ${W[2].read} > ${maxColumn} then ${W[2].write} = ${maxColumn}`,
        `if ${W[3].read} > ${maxRow} then ${W[3].write} = ${maxRow}`,
        `if ${W[0].read} > ${W[2].read} then goto _pfd_anone`,
        `if ${W[1].read} > ${W[3].read} then goto _pfd_anone`,
        set(W[4], W[0].read), 'goto _pfd_shift',
        label('u4'), `temp1 = ${W[4].read}`, `temp2 = ${W[1].read}`, 'gosub _pfd_plot',
        `if ${W[4].read} >= ${W[2].read} then goto _pfd_u4r`, set(W[4], `${W[4].read} + 1`), 'return thisbank',
        label('u4r'), `if ${W[1].read} >= ${W[3].read} then goto _pfd_unone`, set(W[1], `${W[1].read} + 1`), set(W[4], W[0].read), 'return thisbank');
  }
  // A line (Bresenham's, as the line block always drew it): the point, the end, the distances and the error (128 is 0); state bit 2: the steps go
  // along y.
  if (has('line')) {
    const [x1, y1, x2, y2, dx, dy, err] = W;
    add(label('a5'), ...fromRecord(4),
        `if ${x2.read} >= ${x1.read} then ${dx.write} = ${x2.read} - ${x1.read} else ${dx.write} = ${x1.read} - ${x2.read}`,
        `if ${y2.read} >= ${y1.read} then ${dy.write} = ${y2.read} - ${y1.read} else ${dy.write} = ${y1.read} - ${y2.read}`,
        `if ${dx.read} < ${dy.read} then goto _pfd_a5h`,
        set(err, `128 + ${dy.read} + ${dy.read} - ${dx.read}`), 'goto _pfd_shift',
        label('a5h'), set(err, `128 + ${dx.read} + ${dx.read} - ${dy.read}`), set(S, `${S.read} | 4`), 'goto _pfd_shift',
        label('u5'), `temp1 = ${x1.read}`, `temp2 = ${y1.read}`, 'gosub _pfd_plot',
        `if ${S.read}{2} then goto _pfd_u5h`,
        `if ${x1.read} = ${x2.read} then goto _pfd_unone`,
        `if ${err.read} <= 128 then goto _pfd_u5l`,
        `if ${y1.read} < ${y2.read} then ${y1.write} = ${y1.read} + 1 else ${y1.write} = ${y1.read} - 1`,
        set(err, `${err.read} - ${dx.read} - ${dx.read}`),
        label('u5l'),
        set(err, `${err.read} + ${dy.read} + ${dy.read}`),
        `if ${x1.read} < ${x2.read} then ${x1.write} = ${x1.read} + 1 else ${x1.write} = ${x1.read} - 1`,
        'return thisbank',
        label('u5h'),
        `if ${y1.read} = ${y2.read} then goto _pfd_unone`,
        `if ${err.read} <= 128 then goto _pfd_u5k`,
        `if ${x1.read} < ${x2.read} then ${x1.write} = ${x1.read} + 1 else ${x1.write} = ${x1.read} - 1`,
        set(err, `${err.read} - ${dy.read} - ${dy.read}`),
        label('u5k'),
        set(err, `${err.read} + ${dx.read} + ${dx.read}`),
        `if ${y1.read} < ${y2.read} then ${y1.write} = ${y1.read} + 1 else ${y1.write} = ${y1.read} - 1`,
        'return thisbank');
  }
  // A circle. On DPC+ the coprocessor draws it as it starts (the center, the radius and the padding of the record: left and right, top and bottom,
  // packed in the low and high nibbles of two bytes), one call for each operation the circle blocks use.
  if (has('circle') && armCircle) {
    const groupRows = !!Blockly.BBasic.dpcPlusGroupFracVars;
    ensureArmProgram(Blockly, groupRows ? {inc: 0, maxRow: 0, clamp: true, groups: true} : undefined, 'c');
    Blockly.BBasic.pfBoxArm = true;
    // (Set has neither bit of the operation: its call is the last one, which the others' tests fall through to.)
    const circleOperations = ['flip', 'off', 'on'].filter((operation) => Blockly.BBasic.pfDrawCircleOperations.has(operation));
    const call = (operation) => buildCircleArmCall({operation, cx: 'temp2', cy: 'temp3', radius: 'temp4',
      padLeft: 'temp5\nand #15', padRight: 'temp5\nlsr\nlsr\nlsr\nlsr', padTop: 'temp6\nand #15', padBottom: 'temp6\nlsr\nlsr\nlsr\nlsr',
      last: `#${groupRows ? '191' : maxRow}`});
    add(label('a6'));
    circleOperations.slice(0, -1).forEach((operation) => add(
        `if !${S.read}{${operation === 'flip' ? 4 : 3}} then goto _pfd_a6${operation}`, call(operation), 'goto _pfd_anone', label(`a6${operation}`)));
    add(call(circleOperations[circleOperations.length - 1]), 'goto _pfd_anone');
  } else if (has('circle')) {
    // Elsewhere (as the circle block always drew it, row by row from the center row outwards, the row below and then the row above): the center,
    // the radius (low nibble) and the distance of the row from the center (high nibble), the padding (as the record has it), the column being
    // drawn and the last column of the row. State bit 2: a row is being drawn; bit 1: the row above.
    const [cx, cy, rd, padLR, padTB, column, end] = W;
    const squares = Array.from({length: 16}, (_, i) => i * i).join(',');
    add(label('a6'), ...fromRecord(5),
        `if ${rd.read} > 15 then ${rd.write} = 15`, 'goto _pfd_shift',
        label('u6'),
        `if ${S.read}{2} then goto _pfd_u6p`,
        `temp1 = ${rd.read} / 16`,
        `if ${S.read}{1} then goto _pfd_u6u`,
        `temp5 = ${cy.read} + temp1`,
        'goto _pfd_u6r',
        label('u6u'),
        'if temp1 = 0 then goto _pfd_u6n',
        `if ${cy.read} < temp1 then goto _pfd_u6n`,
        `temp5 = ${cy.read} - temp1`,
        label('u6r'),
        `temp1 = ${rd.read} / 16`,
        `temp2 = ${rd.read} & 15`,
        ['asm', 'ldx temp1', 'lda _pfd_sq,x', 'sta temp1', 'ldx temp2', 'lda _pfd_sq,x', 'sec', 'sbc temp1',
          'sta temp1', 'ldx temp2', '@_pfd_find', 'lda _pfd_sq,x', 'cmp temp1',
          'beq _pfd_found', 'bcc _pfd_found', 'dex', 'bne _pfd_find', '@_pfd_found', 'stx temp3', '@end'].join('\n'),
        `temp1 = ${padTB.read} & 15`,
        'if temp5 < temp1 then goto _pfd_u6n',
        `temp1 = ${padTB.read} / 16`,
        `if temp1 > ${maxRow} then goto _pfd_u6n`,
        `temp1 = ${maxRow} - temp1`,
        'if temp5 > temp1 then goto _pfd_u6n',
        'temp4 = 0',
        `if ${cx.read} >= temp3 then temp4 = ${cx.read} - temp3`,
        `temp6 = ${cx.read} + temp3`,
        `temp1 = ${padLR.read} & 15`,
        'if temp4 < temp1 then temp4 = temp1',
        `temp1 = ${padLR.read} / 16`,
        `if temp1 > ${maxColumn} then goto _pfd_u6n`,
        `temp1 = ${maxColumn} - temp1`,
        'if temp6 > temp1 then temp6 = temp1',
        'if temp4 > temp6 then goto _pfd_u6n',
        set(column, 'temp4'), set(end, 'temp6'), set(S, `${S.read} | 4`),
        'return thisbank',
        label('u6p'),
        `temp1 = ${rd.read} / 16`,
        `if ${S.read}{1} then temp2 = ${cy.read} - temp1 else temp2 = ${cy.read} + temp1`,
        `temp1 = ${column.read}`,
        'gosub _pfd_plot',
        `if ${column.read} >= ${end.read} then goto _pfd_u6e`,
        set(column, `${column.read} + 1`),
        'return thisbank',
        label('u6e'),
        set(S, `${S.read} & 251`),
        label('u6n'),
        `if ${S.read}{1} then goto _pfd_u6d`,
        set(S, `${S.read} | 2`),
        'return thisbank',
        label('u6d'),
        set(S, `${S.read} & 253`),
        `temp1 = ${rd.read} / 16`,
        `temp2 = ${rd.read} & 15`,
        'if temp1 >= temp2 then goto _pfd_unone',
        set(rd, `${rd.read} + 16`),
        'return thisbank',
        ['asm', '@_pfd_sq', `.byte ${squares}`, '@end'].join('\n'));
  }
  // The fill (the bucket of the graphic editors: every pixel joined to the start up, down, left or right that is off, or on to erase): x, y and the
  // number of seeds. A seed is taken, the row is followed to the left as far as the fill goes, then to the right a pixel a step, the pixel drawn
  // and the pixels above and below it looked at: where a run of them the fill takes begins, a seed. State bits 2-0: 000 a seed is to be taken,
  // 010 going left, 1ab going right (a: the pixel above the last one was taken, b: the one below). Testing a pixel (temp1, temp2): temp4 is 0 when
  // it is one the fill takes (off to fill, on to erase).
  if (has('fill')) {
    const [fx, fy, count] = W;
    add(label('a7'), set(count, 0), 'temp1 = temp2', 'temp2 = temp3', 'gosub _pfd_push', 'goto _pfd_shift',
        label('test'),
        ...(ownPlayfield ? [['asm', ...place, 'lda playfield,y', 'and _pfd_bit,x', 'beq _pfd_toff', 'lda #8', '@_pfd_toff', `eor ${S.read}`, 'and #8',
          'sta temp4', 'rts', '@end'].join('\n')] : [
            'temp4 = 0',
            'if pfread(temp1, temp2) then temp4 = 8',
            `temp4 = temp4 ^ ${S.read}`,
            'temp4 = temp4 & 8',
            'return thisbank']),
        label('u7'),
        `if ${S.read}{2} then goto _pfd_u7b`,
        `if ${S.read}{1} then goto _pfd_u7a`,
        `if ${count.read} = 0 then goto _pfd_unone`,
        'gosub _pfd_pop',
        `temp1 = ${fx.read}`, `temp2 = ${fy.read}`, 'gosub _pfd_test',
        `if temp4 = 0 then ${S.write} = ${S.read} | 2`,
        'return thisbank',
        label('u7a'),
        `if ${fx.read} = 0 then goto _pfd_u7s`,
        `temp1 = ${fx.read} - 1`, `temp2 = ${fy.read}`, 'gosub _pfd_test',
        'if temp4 <> 0 then goto _pfd_u7s',
        set(fx, `${fx.read} - 1`),
        'return thisbank',
        label('u7s'),
        set(S, `${S.read} & 248`), set(S, `${S.read} | 4`),
        'return thisbank',
        label('u7b'),
        `if ${fx.read} > ${maxColumn} then goto _pfd_u7e`,
        `temp1 = ${fx.read}`, `temp2 = ${fy.read}`, 'gosub _pfd_test',
        'if temp4 <> 0 then goto _pfd_u7e',
        `temp1 = ${fx.read}`, `temp2 = ${fy.read}`, 'gosub _pfd_plot',
        `if ${fy.read} = 0 then goto _pfd_u7na`,
        `temp1 = ${fx.read}`, `temp2 = ${fy.read} - 1`, 'gosub _pfd_test',
        'if temp4 <> 0 then goto _pfd_u7na',
        `if ${S.read}{1} then goto _pfd_u7bl`,
        set(S, `${S.read} | 2`),
        `temp1 = ${fx.read}`, `temp2 = ${fy.read} - 1`, 'gosub _pfd_push',
        'goto _pfd_u7bl',
        label('u7na'),
        set(S, `${S.read} & 253`),
        label('u7bl'),
        `if ${fy.read} >= ${maxRow} then goto _pfd_u7nb`,
        `temp1 = ${fx.read}`, `temp2 = ${fy.read} + 1`, 'gosub _pfd_test',
        'if temp4 <> 0 then goto _pfd_u7nb',
        `if ${S.read}{0} then goto _pfd_u7n`,
        set(S, `${S.read} | 1`),
        `temp1 = ${fx.read}`, `temp2 = ${fy.read} + 1`, 'gosub _pfd_push',
        'goto _pfd_u7n',
        label('u7nb'),
        set(S, `${S.read} & 254`),
        label('u7n'),
        set(fx, `${fx.read} + 1`),
        'return thisbank',
        label('u7e'),
        set(S, `${S.read} & 248`),
        'return thisbank');
    if (displayRam) {
      // (The data fetcher 0 reads and writes them; the constants are loaded with ldx, which DPC+'s fast fetch never changes.)
      add(label('push'),
          `temp3 = ${count.read}`,
          ['asm', 'lda temp3', `cmp #${SEEDS_DPC_PLUS}`, 'bcs _pfd_pushx', 'asl', `ora #${SEED_OFFSET}`, 'sta DF0LOW', `ldx #${DISPLAY_RAM_PAGE}`, 'stx DF0HI',
            'lda temp1', 'sta DF0WRITE', 'lda temp2', 'sta DF0WRITE', 'inc temp3', '@_pfd_pushx', '@end'].join('\n'),
          set(count, 'temp3'),
          'return thisbank',
          label('pop'),
          `temp3 = ${count.read} - 1`,
          ['asm', 'lda temp3', 'asl', `ora #${SEED_OFFSET}`, 'sta DF0LOW', `ldx #${DISPLAY_RAM_PAGE}`, 'stx DF0HI', 'lda DF0DATA', 'sta temp1', 'lda DF0DATA',
            'sta temp2', '@end'].join('\n'),
          set(count, 'temp3'), set(fx, 'temp1'), set(fy, 'temp2'),
          'return thisbank');
    } else {
      add(label('push'));
      P.forEach(([px, py], s) => add(`if ${count.read} <> ${s} then goto _pfd_push${s + 1}`, set(px, 'temp1'), set(py, 'temp2'),
          set(count, `${count.read} + 1`), 'return thisbank', label(`push${s + 1}`)));
      add('return thisbank',
          label('pop'),
          set(count, `${count.read} - 1`));
      P.forEach(([px, py], s) => add(`if ${count.read} <> ${s} then goto _pfd_pop${s + 1}`, set(fx, px.read), set(fy, py.read), 'return thisbank',
          label(`pop${s + 1}`)));
      add('return thisbank');
    }
  }
  // Stop fill: the fill being drawn ends and the fills waiting are taken out of the queue. Fill done (temp6 1): no fill drawn or waiting.
  if (Blockly.BBasic.pfDrawFillControls) {
    add(label('stopfill'),
        `temp1 = ${S.read} / 32`,
        `if temp1 = ${KIND_NUMBER.fill} then ${S.write} = 0`,
        label('stopq'));
    for (let r = 0; r < records; r++) {
      add(...header(r), 'temp1 = temp1 / 32', `if temp1 <> ${KIND_NUMBER.fill} then goto _pfd_stopk${r}`, ...store.remove(r), 'goto _pfd_stopq',
          label(`stopk${r}`));
    }
    add(`if ${S.read} >= 32 then return`,
        set(S, 0),
        ...header(0),
        `if temp1 <> 0 then ${S.write} = 2`,
        'return',
        label('filldone'),
        'temp6 = 1',
        `temp1 = ${S.read} / 32`,
        `if temp1 = ${KIND_NUMBER.fill} then temp6 = 0`);
    for (let r = 0; r < records; r++) add(...header(r), 'temp1 = temp1 / 32', `if temp1 = ${KIND_NUMBER.fill} then temp6 = 0`);
    add('return');
  }
  // One side of a centered area (the columns or the rows): the center in temp3, the width or height in temp4, the padding of the low and the high
  // side in temp5 and temp6, the last column or row in temp2; the first and the last of the side come back in temp3 and temp4 (temp3 more than
  // temp4 when nothing is left), worked out as the area block always did.
  if (has('carea')) {
    add(label('axis'),
        'if temp4 = 0 then goto _pfd_axe',
        'temp1 = temp4 / 2',
        'temp4 = temp4 - 1',
        'temp4 = temp4 - temp1',
        'temp4 = temp3 + temp4',
        'if temp4 < temp3 then temp4 = 255',
        'if temp3 < temp1 then temp3 = 0 else temp3 = temp3 - temp1',
        'if temp3 < temp5 then temp3 = temp5',
        'if temp6 > temp2 then goto _pfd_axe',
        'temp2 = temp2 - temp6',
        'if temp4 > temp2 then temp4 = temp2',
        'return',
        label('axe'),
        'temp3 = 255',
        'temp4 = 0',
        'return');
  }
  return lines.join('\n');
};

// The engine's subroutine, made the first time something asks for it.
export const ensurePfDraw = (Blockly) => {
  if (!Blockly.BBasic.pfDraw) return false;
  if (!Blockly.BBasic.subroutines[PF_DRAW_SUBROUTINE]) Blockly.BBasic.subroutines[PF_DRAW_SUBROUTINE] = buildEngine(Blockly);
  return true;
};
const callEngine = (Blockly, entry) =>
  `gosub _pfd_${entry}${Blockly.BBasic.bankJumpSuffix(Blockly.BBasic.getCurrentBank(), Blockly.BBasic.getSubroutineBank(PF_DRAW_SUBROUTINE))}`;

// The line for the end of commongamelogic: the steps of the frame.
export const generatePfDrawStep = (Blockly) => {
  if (!ensurePfDraw(Blockly)) return '';
  return [` if ${Blockly.BBasic.pfDraw.state.read} = 0 then goto _pfd_idle`,
    ` gosub _pfd_step${Blockly.BBasic.bankJumpSuffix(Blockly.BBasic.primaryBank ? Blockly.BBasic.primaryBank() : 1,
        Blockly.BBasic.getSubroutineBank(PF_DRAW_SUBROUTINE))}`, '_pfd_idle'].join('\n');
};

const headerOf = (kind, operation) => KIND_NUMBER[kind] * 32 + OPERATION_NUMBER[operation] * 8;
// A Draw block's code: room in the queue, its record written into the last record (a number at a time, each worked out straight into its byte, or
// on DPC+ into temp6 and from there into the display RAM: working one out uses temp1 and temp2 at the most), then the submit. kind: see
// pfDrawKindOf; operation: on, off or flip (the fill: on fills, off erases); numbers: the code of each number, in the order of the kind's record.
export const pfDrawBlockCode = (Blockly, kind, operation, numbers) => {
  if (!ensurePfDraw(Blockly)) return '';
  const store = recordStore(Blockly.BBasic.pfDraw);
  return [callEngine(Blockly, 'room'), ...numbers.flatMap((code, i) => store.write(i + 1, code)), ...store.write(0, headerOf(kind, operation)),
    callEngine(Blockly, 'submit')].join('\n') + '\n';
};

// The circle: the center and the radius as numbers, the padding packed two to a byte (left and right, top and bottom, 15 at the most each).
export const pfDrawCircleCode = (Blockly, operation, cx, cy, radius, padLeft, padRight, padTop, padBottom) => {
  if (!ensurePfDraw(Blockly)) return '';
  const store = recordStore(Blockly.BBasic.pfDraw);
  const pack = (low, high, i) => [`temp3 = ${low}`, `temp4 = ${high}`, 'if temp3 > 15 then temp3 = 15', 'if temp4 > 15 then temp4 = 15',
    'temp4 = temp4 * 16', ...store.write(i, 'temp3 | temp4')];
  return [callEngine(Blockly, 'room'), ...store.write(1, cx), ...store.write(2, cy), ...store.write(3, radius),
    ...pack(padLeft, padRight, 4), ...pack(padTop, padBottom, 5), ...store.write(0, headerOf('circle', operation)), callEngine(Blockly, 'submit')].join('\n') + '\n';
};

// The centered area: each side worked out by _pfd_axis into the corners of an area record (nothing is submitted when a side has nothing left).
export const pfDrawCenteredAreaCode = (Blockly, operation, cx, cy, width, height, padLeft, padRight, padTop, padBottom) => {
  if (!ensurePfDraw(Blockly)) return '';
  const store = recordStore(Blockly.BBasic.pfDraw);
  const config = Blockly.BBasic.pfDraw.config;
  const skip = `_pfd_rect${Blockly.BBasic.blockNumbers.next('pfdrect')}`;
  const side = (center, size, low, high, max, first, lastIndex) => [`temp3 = ${center}`, `temp4 = ${size}`, `temp5 = ${low}`, `temp6 = ${high}`,
    `temp2 = ${max}`, callEngine(Blockly, 'axis'), `if temp3 > temp4 then goto ${skip}`, ...store.write(first, 'temp3'), ...store.write(lastIndex, 'temp4')];
  return [callEngine(Blockly, 'room'),
    ...side(cx, width, padLeft, padRight, pfMaxColumn(config), 1, 3),
    ...side(cy, height, padTop, padBottom, Blockly.BBasic.maxRowText(config), 2, 4),
    ...store.write(0, headerOf('area', operation)), callEngine(Blockly, 'submit'), `@ ${skip}`].join('\n') + '\n';
};

export const pfDrawStopFillCode = (Blockly) => (ensurePfDraw(Blockly) ? callEngine(Blockly, 'stopfill') + '\n' : '');
export const pfDrawFillDoneCode = (Blockly) => (ensurePfDraw(Blockly) ? `${callEngine(Blockly, 'filldone')}\ntemp6` : '1');
