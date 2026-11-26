'use strict';

import {pfMaxColumn, pfRowDivisorFor} from '../../utils/playfield-coords';
import {CLOCK_ASPECT} from '../../utils/pixel-aspect';
import {buildCircleArmCall, buildGravityArmCall, buildGravityStepCall, buildTerrainArmCall, ensureArmProgram} from './offset-arm';
import {flagPoolVar, flagPoolBit} from './flag-pool';

// Terrain done: one bit of the flag pool for each side (0 bottom, 1 top, 2 left, 3 right) and one (4) for every terrain finished; the bit 5 is for the
// playfield gravity (When playfield gravity is done). Set when the work is finished, cleared at the end of the frame after.
export const PFD_TERRAIN_DONE_FAMILY = 'pfdTerrainDone';
export const PFD_TERRAIN_DONE_BITS = [0, 1, 2, 3, 4, 5];
// The Set playfield draw speed block: the steps a frame, 1 to 15 (0: as many as the time left allows), four bits of the flag pool (a frame never has time for
// many more steps than 15 anyway, see STEP_TIMER_COUNTS).
export const PFD_SPEED_FAMILY = 'pfdSpeed';
export const PFD_SPEED_BITS = [0, 1, 2, 3];
export const PFD_SPEED_MAX = 15;
const speedName = (Blockly) => Blockly.BBasic.nameDB_.getName(flagPoolVar(PFD_SPEED_FAMILY), Blockly.Names.DEVELOPER_VARIABLE_TYPE);
const speedBase = () => flagPoolBit(PFD_SPEED_FAMILY, 0);
// The asm that leaves the speed in A (0 to 15), the zero flag set when it is 0.
const speedLoad = (Blockly) => [`lda ${speedName(Blockly)}`, ...Array(speedBase()).fill('lsr'), `and #${PFD_SPEED_MAX}`];
const terrainDoneName = (Blockly) => Blockly.BBasic.nameDB_.getName(flagPoolVar(PFD_TERRAIN_DONE_FAMILY), Blockly.Names.DEVELOPER_VARIABLE_TYPE);
// The bits the blocks read (see pfDrawTerrainDoneBits): only those are in the flag pool, a bit no block reads is 0 (nothing is set).
export const TERRAIN_DONE_WHICH = {ALL: 4, BOTTOM: 0, TOP: 1, LEFT: 2, RIGHT: 3};
export const pfDrawTerrainDoneBits = (blocks) => [...new Set(blocks.flatMap((block) => {
  if (block.type === 'background_when_gravity_done') return [5];
  if (block.type === 'background_generate_terrain_done' || block.type === 'background_when_terrain_done') return [TERRAIN_DONE_WHICH[block.getFieldValue('WHICH')] ?? 4];
  return [];
}))].sort((a, b) => a - b);
let terrainDoneBits = PFD_TERRAIN_DONE_BITS;
const terrainDoneMask = (index) => (terrainDoneBits.includes(index) ? 1 << flagPoolBit(PFD_TERRAIN_DONE_FAMILY, index) : 0);
const terrainDoneAllMask = () => PFD_TERRAIN_DONE_BITS.reduce((mask, index) => mask | terrainDoneMask(index), 0);

// The Draw blocks of Playfield > Utility (a pixel, a straight line, a line, an area, a circle and the fill) share one drawing engine: a block puts
// its work in a queue, and at the end of each frame's code (the end of commongamelogic, the last code before drawscreen waits for the timer) the
// engine draws a pixel at a time for as long as the frame has time to spare, so a big shape is spread over frames instead of making the frame too
// long (the screen would roll). The work runs in the order the blocks gave it; a block that finds the queue full has the work before it finished
// at once and is drawn at once itself, so nothing is lost and the order is kept.
//
// The engine only sets, clears and flips playfield pixels (and reads them, for the fill): it never writes a color register, a color table or a color
// variable, so no Draw block, the terrain one included, changes the playfield's colors. (Checked on the generated code of all three kernels.)
//
// The bytes (as few as it takes, shared by every kind of work):
//   the state: bits 7-5 the kind of the work being drawn (0: none), bits 4-3 what is done to the pixels (0 set, 1 clear, 2 flip; the fill: 0 fill,
//     1 erase), bits 2-0 a few flags of the kind's (the line's direction, the circle's row and side, the fill's steps);
//   the work bytes: what the kind being drawn keeps (as many as the kind that needs the most of the ones the project uses);
//   the queue: records of a header (the kind and the operation, as the state has them) and the numbers of the block, as many as the kind with the
//     most of them takes; a free record has a header of 0. A block writes its record straight into the last record (it is free: see _pfd_room; on DPC+ into one more past the queue),
//     and _pfd_submit moves it down to the first free one. A record that starts is read into temp1 (the header) to temp6 (the numbers). On DPC+ the
//     records are in the display RAM (page $0F from RECORD_OFFSET, read with data fetcher 0 and written with 1), elsewhere in separate bytes;
//   the fill's seeds (a place on a row the fill still has to look at, two bytes): on DPC+ in the display RAM (page $0F from SEED_OFFSET), elsewhere
//     in the work bytes past the three the fill keeps (the line and the circle need seven, so they come at no cost when the project has those). A
//     seed that finds no room is dropped (a very winding area can then be left partly unfilled).
// On DPC+ the coprocessor draws a circle in one call (no work bytes): its record waits in the queue for its turn and is drawn as it starts. Page $0F
// of the display RAM is past the end of the stack, free in every build; its first bytes are the Run once flags (see utils/dpc-ram-flags.js).
// (The bytes are reserved with reserveDevVarRW: with Superchip they go to its RAM, where the write and the read have different names.)

export const PF_DRAW_BLOCK_TYPES = ['background_change_pixel', 'background_change_hv_line', 'background_fill_area', 'background_draw_line',
  'background_fill_circle', 'background_flood_fill', 'background_generate_terrain', 'background_gravity'];
// The blocks that ask about or steer the drawing (not a drawing themselves): a block of these reads or writes the engine's bytes.
export const PF_DRAW_CONTROL_TYPES = ['background_generate_terrain_done', 'background_when_terrain_done', 'background_when_gravity_done',
  'background_gravity_done', 'background_draw_speed', 'background_flood_fill_stop', 'background_flood_fill_done'];
export const pfDrawKindOf = (block) => {
  switch (block.type) {
    case 'background_change_pixel': return 'pixel';
    case 'background_change_hv_line': return block.getFieldValue('DIRECTION') === 'pfvline' ? 'vline' : 'hline';
    case 'background_fill_area': return block.getFieldValue('MODE') === 'CENTER' ? 'carea' : 'area';
    case 'background_draw_line': return 'line';
    case 'background_generate_terrain': return 'terrain';
    case 'background_fill_circle': return 'circle';
    case 'background_flood_fill': return 'fill';
    case 'background_gravity': return 'gravity';
    default: return null;
  }
};
// (A horizontal and a vertical straight line are one kind: bit 2 of the header says vertical.)
const KIND_NUMBER = {pixel: 1, hline: 2, vline: 2, terrain: 3, area: 4, carea: 4, line: 5, circle: 6, fill: 7, gravity: 7};
const KINDS_BY_NUMBER = ['none', 'pixel', 'sline', 'terrain', 'area', 'line', 'circle', 'fill'];
// (The playfield gravity shares the fill's kind number, 7, with the operation 2, flip: its steps flip the pixels they move.)
const OPERATION_NUMBER = {on: 0, off: 1, flip: 2};
// The numbers a kind's record holds and the work bytes it keeps while it is drawn (at most five numbers: the record is read into temp1 to temp6).
const RECORD_NUMBERS = {pixel: 2, hline: 3, vline: 3, terrain: 5, area: 4, carea: 4, line: 4, circle: 6, fill: 2, gravity: 5};
const WORK_BYTES = {pixel: 0, hline: 3, vline: 3, terrain: 5, area: 5, carea: 5, line: 7, circle: 8, fill: 3, gravity: 6};
// The records of the queue and the seeds of the fill. The standard kernel without Superchip has the least RAM: one record waiting and two seeds.
const queueRecordsFor = (config, superchip, displayRam) => (displayRam ? 4 : superchip ? 3 : config.pxe ? 2 : 1);
const seedSlotsFor = (config, superchip) => (superchip || config.pxe ? 4 : 2);
const FILL_KEEPS = 3;
// "Keep it round on short rows" (the circle block): a playfield pixel is 4 color clocks wide (4 * CLOCK_ASPECT scanlines on the screen) and a row only a few scanlines tall,
// so a circle of radius r is r pixels either way and looks flat. The circle gets the rows it needs: a row of distance d from the center is as wide as the circle's row of
// distance d * S / 256 (S: the scanlines of a row over the width of a pixel, in 256ths). 0 when the rows are not short (no change). A circle record has bit 7 of its radius set
// when its block asks for it. The distance of a row is at most 127 (S is at least 35, the rows of a circle of 15 going to 117).
export const circleStretchScale = (config) => {
  const scale = Math.round(256 * 2 * pfRowDivisorFor(config) / (4 * CLOCK_ASPECT));
  return scale >= 255 ? 0 : Math.max(35, scale);
};
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
const STEP_TIMER_COUNTS = {standard: [5, 4, 4, 8, 4, 5, 7, 10], dpcplus: [7, 4, 4, 8, 4, 5, 5, 11]};
const startCounts = (config, kinds) => {
  // (A record of the coprocessor's circle: about 460 cycles at the most in Bricks of Olympus 0-0-27 (2026-11-24: the read 88, the call 111, the queue moved up
  // with three waiting 260), 8 counts. It was 24 (about 1130 cycles measured before the queue moved up only the records waiting): Bricks' frames have about 8
  // counts left at the steps, so a circle was drawn only when the queue overflowed, four brick hits late, and the bricks went where an older hit was. At 9
  // a frame once drew five queued circles and was 313 lines: one circle a frame at the most, see _pfd_stc.)
  if (config.kernel === 'dpcplus') return kinds.has('circle') ? 8 : STEP_TIMER_COUNTS.dpcplus[0];
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
    // (Not left from the build before.)
    Blockly.BBasic.pfDrawTerrainDone = false;
    Blockly.BBasic.pfDrawTerrainDoneBits = terrainDoneBits = [];
    return;
  }
  const displayRam = isDpcPlus(config);
  const armCircle = displayRam;
  // The Generate terrain block is drawn by the coprocessor on DPC+ too, in one call (function 113 of armprog.c) as the block runs: no work bytes, no steps, and it
  // does not wait for the time left at the end of the frame (the call takes less than a step of the circle's).
  const armTerrain = displayRam;
  // The Playfield gravity block too (function 114 of armprog.c, in the set with the terrain): the pixels fall in one call, no work bytes and no steps.
  const armGravity = displayRam;
  // A circle block with "over several frames" ticked on DPC+ is drawn by the steps, row by row from the center, as on the other kernels (flag bit 0 of its header).
  const circleSpread = armCircle && blocks.some((block) => block.type === 'background_fill_circle' && block.getFieldValue('SPREAD') === 'TRUE');
  const circleStretch = blocks.some((block) => block.type === 'background_fill_circle' && block.getFieldValue('STRETCH') === 'TRUE') ? circleStretchScale(config) : 0;
  const seeds = kinds.has('fill') && !displayRam ? seedSlotsFor(config, superchip) : 0;
  // The playfield gravity falls over time (a block with a number of frames above 0, see background_gravity): it keeps the area, the frames between its steps and a byte counting the frames.
  const gravityAnim = kinds.has('gravity') && blocks.some((block) => {
    const target = block.type === 'background_gravity' && block.getInput('DELAY') && block.getInput('DELAY').connection.targetBlock();
    return !!target && !(target.type === 'math_number' && Number(target.getFieldValue('NUM')) === 0);
  });
  const workOf = (kind) => {
    if ((kind === 'circle' && armCircle && !circleSpread) || (kind === 'terrain' && armTerrain)) return 0;
    // (Over time, the frames left before its next step are its last work byte: see gravityTick below.)
    if (kind === 'gravity') return armGravity ? (gravityAnim ? 6 : 0) : (gravityAnim ? 7 : 6);
    // (The circle that is kept round also keeps the distance of its row, bit 7 set: it is.)
    if (kind === 'circle' && circleStretch) return WORK_BYTES.circle + 1;
    return WORK_BYTES[kind];
  };
  const workBytes = Math.max(kinds.has('fill') ? FILL_KEEPS + 2 * seeds : 0, ...[...kinds].map(workOf));
  const recordBytes = 1 + Math.max(...[...kinds].map((kind) => RECORD_NUMBERS[kind]));
  const records = queueRecordsFor(config, superchip, displayRam);
  const state = reserveDevVarRW('pfdState', 'playfield drawing: the kind of work being drawn, its operation and its steps');
  // The Set playfield draw speed block: the steps a frame (see PFD_SPEED_FAMILY; the byte is reserved with the flag pool). The steps the frame has left are
  // counted on the stack (see _pfd_step).
  const speed = blocks.some((block) => block.type === 'background_draw_speed');
  // 1 for the one frame after terrain was finished (see Playfield terrain done).
  const terrainDone = blocks.some((block) => ['background_generate_terrain_done', 'background_when_terrain_done', 'background_when_gravity_done'].includes(block.type)) ?
    {family: PFD_TERRAIN_DONE_FAMILY} : null;
  const work = Array.from({length: workBytes}, (_, i) => reserveDevVarRW(`pfdWork${i}`, 'playfield drawing: what the work being drawn keeps'));
  // The playfield gravity over time: the frames left before its next step, a work byte (after the ones of its area), counted down once a frame only while the
  // gravity is the work being drawn (see generatePfDrawStep).
  const gravityTick = gravityAnim ? work[armGravity ? 5 : 6] : null;
  const queue = displayRam ? null : Array.from({length: records}, (_, r) => Array.from({length: recordBytes}, (_, i) =>
    reserveDevVarRW(`pfdQueue${r}_${i}`, 'playfield drawing: a waiting Draw block\'s record')));
  const seedBytes = Array.from({length: seeds}, (_, s) => [work[FILL_KEEPS + 2 * s], work[FILL_KEEPS + 2 * s + 1]]);
  Blockly.BBasic.pfDraw = {kinds, state, terrainDone, work, queue, records, recordBytes, seeds: seedBytes, displayRam, armCircle, armTerrain, armGravity, gravityAnim, gravityTick, circleSpread, circleStretch, speed, config, superchip};
  // (The operations the blocks use: the plotting routine and the circle's calls have only those.)
  const drawBlocks = blocks.filter((block) => pfDrawKindOf(block));
  Blockly.BBasic.pfDrawOperations = new Set(drawBlocks.map((block) => block.getFieldValue('OPERATION') || 'on'));
  Blockly.BBasic.pfDrawGravityDone = blocks.some((block) => block.type === 'background_gravity_done');
  Blockly.BBasic.pfDrawCircleOperations = new Set(drawBlocks.filter((block) => block.type === 'background_fill_circle').map((block) => block.getFieldValue('OPERATION')));
  Blockly.BBasic.pfDrawFillControls = blocks.some((block) => block.type === 'background_flood_fill_stop' || block.type === 'background_flood_fill_done');
  Blockly.BBasic.pfDrawTerrainDone = blocks.some((block) => ['background_generate_terrain_done', 'background_when_terrain_done', 'background_when_gravity_done'].includes(block.type));
  Blockly.BBasic.pfDrawTerrainDoneBits = terrainDoneBits = pfDrawTerrainDoneBits(blocks);
};

// Where the records are: the lines that read and write them (byte i of record r), for separate bytes or the display RAM.
// (The records waiting are always the first ones, one after the other: a record is written into the first free one and the queue moves up when one
// leaves. So the moving up stops at the first free record (its header 0, written into the one before it): one waiting record most of the time, not all
// of the queue's bytes, about 170 cycles less on DPC+ when Bricks takes a record.)
let removeLabels = 0;
const recordStore = (pfDraw) => {
  const {queue: Q, records, recordBytes: size, displayRam} = pfDraw;
  const last = records - 1;
  if (!displayRam) {
    return {
      // byte i of record r into a temp
      read: (r, i, temp) => [`${temp} = ${Q[r][i].read}`],
      // the record r into temp1 to temp(size)
      load: (r) => Q[r].slice(0, 6).map((byte, i) => `temp${i + 1} = ${byte.read}`),
      // record `from` copied to `to`
      copy: (from, to) => Q[to].map((byte, i) => `${byte.write} = ${Q[from][i].read}`),
      // the records after r moved down by one, the last one freed
      remove: (r) => {
        if (r >= last) return [`${Q[last][0].write} = 0`];
        const done = `_pfd_rm${removeLabels++}`;
        return [...Array.from({length: last - r}, (_, k) => Q[r + k].map((byte, i) => [`${byte.write} = ${Q[r + k + 1][i].read}`,
          ...(i ? [] : [`if ${Q[r + k + 1][0].read} = 0 then goto ${done}`])]).flat()).flat(), `${Q[last][0].write} = 0`, `@ ${done}`];
      },
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
    load: (r) => [asm([...aim(0, offset(r, 0)), ...Array.from({length: Math.min(size, 6)}, (_, i) => ['lda DF0DATA', `sta temp${i + 1}`]).flat()])],
    copy: (from, to) => [asm([...aim(0, offset(from, 0)), ...aim(1, offset(to, 0)), ...Array.from({length: size}, () => ['lda DF0DATA', 'sta DF1WRITE']).flat()])],
    // (The write fetcher is at the last record's header after the records moved up. A branch to the end that would be too far is a jmp past a bne.)
    remove: (r) => {
      if (r >= last) return [asm([...aim(1, offset(last, 0)), 'ldx #0', 'stx DF1WRITE'])];
      const done = `_pfd_rm${removeLabels++}`;
      const lines = [];
      for (let k = r; k < last; k++) {
        const after = (size - 1) * 6 + (last - k - 1) * (6 + 5 + (size - 1) * 6) + 5;
        lines.push('lda DF0DATA', 'sta DF1WRITE', ...(after <= 127 ? [`beq ${done}`] : ['bne *+5', `jmp ${done}`]),
            ...Array.from({length: size - 1}, () => ['lda DF0DATA', 'sta DF1WRITE']).flat());
      }
      return [asm([...aim(0, offset(r + 1, 0)), ...aim(1, offset(r, 0)), ...lines, 'ldx #0', 'stx DF1WRITE', `@${done}`])];
    },
    free: (r) => [asm([...aim(1, offset(r, 0)), 'ldx #0', 'stx DF1WRITE'])],
    // (Into the record past the queue: see _pfd_submit.)
    write: (i, code) => [...(code === 'temp6' ? [] : [`temp6 = ${code}`]), asm([...aim(1, offset(records, i)), 'lda temp6', 'sta DF1WRITE'])],
  };
};

// The jump on a shape's number (in temp1, the lines that work it out before it in `number`) to its targets, the shapes without one going on to
// `fallThrough`: nothing when no shape has one, an if for one shape (the table of an on ... goto is 2 bytes a shape and about 15 cycles more).
const shapeJump = (targets, fallThrough, number) => {
  const jumps = targets.map((target, n) => [target, n]).filter(([target]) => target !== fallThrough);
  if (!jumps.length) return [];
  if (jumps.length === 1) return [...number, `if temp1 = ${jumps[0][1]} then goto ${jumps[0][0]}`];
  return [...number, `on temp1 goto ${targets.join(' ')}`];
};

// The engine, one subroutine with its entries (see the comment at the top).
const buildEngine = (Blockly) => {
  const pfDraw = Blockly.BBasic.pfDraw;
  const {kinds, state: S, work: W, records, seeds: P, displayRam, armCircle, armTerrain, armGravity, circleSpread, circleStretch, speed, config} = pfDraw;
  // (The same labels in every build.)
  removeLabels = 0;
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
        // (With a speed set, that many steps.)
        ['asm', ...(speed ? [...speedLoad(Blockly), 'bne _pfd_stspd'] : []), `lda #${PXE_STEPS_A_FRAME}`, ...(speed ? ['@_pfd_stspd'] : []), 'pha', '@end'].join('\n'),
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
    if (circleSpread) need[6] = STEP_TIMER_COUNTS.standard[6];
    // (A row of a circle that is kept round takes a multiplication more.)
    if (circleStretch && (circleSpread || !armCircle)) need[6] = STEP_TIMER_COUNTS.standard[6] + 2;
    const timeLeft = (enough) => ['asm', `lda ${S.read}`, 'lsr', 'lsr', 'lsr', 'lsr', 'lsr', 'tax', 'lda INTIM', 'cmp _pfd_need,x', enough, '@end'].join('\n');
    // (DPC+: a circle a block left past the queue goes in when the frame has 8 counts left for the copy, see deferredSubmit; while it waits the state is kept
    // at 2 so that the steps are called.)
    const stagedLines = armCircle && has('circle') ? [...store.read(records, 0, 'temp1'), 'if temp1 = 0 then goto _pfd_nost', 'if INTIM >= 136 then gosub _pfd_submit',
      label('nost')] : [];
    const stagedKeep = armCircle && has('circle') ? [...store.read(records, 0, 'temp1'), `if temp1 then ${S.write} = 2`] : [];
    add(label('step'),
        ...stagedLines,
        // (A jmp to the steps of a speed: the step in between is longer than a branch reaches with the DPC+ circle, Blammo_0-0-1.)
        ...(speed ? [['asm', `lda ${speedName(Blockly)}`, `and #${PFD_SPEED_MAX << speedBase()}`, 'beq _pfd_nsp', 'jmp ._pfd_sps', '@_pfd_nsp', '@end'].join('\n')] : []),
        timeLeft('bcs ._pfd_stgo'),
        'return',
        label('stgo'),
        `if ${S.read} >= 32 then goto _pfd_stu`,
        ...header(0),
        'if temp1 = 0 then goto _pfd_stz',
        // (The coprocessor's circle: one a frame, then the steps are done.)
        ...(armCircle && has('circle') ? [`temp1 = temp1 / 32`, `if temp1 = ${KIND_NUMBER.circle} then goto _pfd_stc`] : []),
        label('stu'),
        'gosub _pfd_unit',
        'goto _pfd_step',
        ...(armCircle && has('circle') ? [label('stc'), 'gosub _pfd_unit', 'return'] : []),
        label('stz'),
        set(S, 0),
        ...stagedKeep,
        'return',
        // With a speed set: the same, the steps left counted down on the stack (no byte for it); the frame is done at 0 or when its time is.
        ...(speed ? [label('sps'), ['asm', ...speedLoad(Blockly), 'pha', '@end'].join('\n'),
          label('spl'), timeLeft('bcc ._pfd_spx'),
          `if ${S.read} >= 32 then goto _pfd_spu`, ...header(0), 'if temp1 = 0 then goto _pfd_spz',
          label('spu'), 'gosub _pfd_unit',
          ['asm', 'pla', 'sec', 'sbc #1', 'pha', 'bne ._pfd_spl', '@end'].join('\n'),
          label('spx'), ['asm', 'pla', '@end'].join('\n'), 'return',
          label('spz'), set(S, 0), ['asm', 'pla', '@end'].join('\n'), 'return'] : []),
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
  // 1 has the block drawn at once too (see _pfd_submit). (Not on DPC+: there the block writes its record into one more record past the queue, and
  // _pfd_submit makes the room, so a Draw block is one call of the engine, in another bank as often as not.)
  if (!displayRam) {
    add(label('room'),
        ...header(last),
        'if temp1 = 0 then return',
        'gosub _pfd_flush',
        set(S, 1),
        'return');
  }
  // The record the block wrote in the last record (DPC+: the one past the queue) goes down to the first free one. With nothing being drawn the first
  // one waiting starts (a circle on DPC+, which is drawn as it starts, waits for the steps at the end of the frame).
  const from = displayRam ? records : last;
  add(label('submit'),
      ...store.read(from, 0, 'temp1'),
      'if temp1 = 0 then return',
      // (DPC+, the queue full: the work being drawn is finished and the first record waiting is started, which frees one record, and the new one waits
      // its turn. Drawing everything waiting at once made a frame of Bricks 313 lines: five queued circles in one frame.)
      ...(displayRam ? [...header(last), 'if temp1 = 0 then goto _pfd_subr', label('one'), `if ${S.read} >= 32 then gosub _pfd_unit`,
        `if ${S.read} >= 32 then goto _pfd_one`, 'gosub _pfd_unit', label('subr')] : []));
  for (let r = 0; r < from; r++) {
    add(...header(r),
        `if temp1 <> 0 then goto _pfd_sub${r + 1}`,
        ...store.copy(from, r),
        ...store.free(from),
        'goto _pfd_subd',
        label(`sub${r + 1}`));
  }
  // (A circle or a terrain on DPC+, which the coprocessor draws as it starts, waits for the steps at the end of the frame (a terrain started at once by a block in Title screen start was not on the screen).)
  const deferCircle = armCircle && has('circle');
  const deferTerrain = armTerrain && has('terrain');
  add(label('subd'),
      `if ${S.read} >= 32 then return`,
      `if ${S.read} = 1 then goto _pfd_flush`,
      ...(deferCircle || deferTerrain ? [...header(0), ...(deferCircle && circleSpread ? ['temp2 = temp1'] : []), 'temp1 = temp1 / 32',
        ...(deferCircle && deferTerrain ? [`if temp1 = ${KIND_NUMBER.terrain} then goto _pfd_subw`] : []),
        `if temp1 <> ${deferCircle ? KIND_NUMBER.circle : KIND_NUMBER.terrain} then goto _pfd_deq`,
        ...(deferCircle && circleSpread ? ['if temp2{0} then goto _pfd_deq'] : []), label('subw'), set(S, 2), 'return'] : []),
      'goto _pfd_deq');
  // A step of the work being drawn; with none, the first record waiting starts.
  const unitTargets = KINDS_BY_NUMBER.map((kind, n) => (n && used(n) && kind !== 'pixel' && !(kind === 'circle' && armCircle && !circleSpread) ? `_pfd_u${n}` : '_pfd_unone'));
  add(label('unit'),
      `if ${S.read} < 32 then goto _pfd_deq`,
      ...shapeJump(unitTargets, '_pfd_unone', [`temp1 = ${S.read} / 32`]),
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
      `${S.write} = temp1`,
      ...shapeJump(actTargets, '_pfd_anone', ['temp1 = temp1 / 32']),
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
  if (has('hline') || has('vline')) {
    add(label('a2'), ...fromRecord(3), 'if temp4 = 0 then goto _pfd_anone', 'goto _pfd_shift',
        label('u2'), `temp1 = ${W[0].read}`, `temp2 = ${W[1].read}`, 'gosub _pfd_plot',
        set(W[2], `${W[2].read} - 1`), `if ${W[2].read} = 0 then goto _pfd_unone`,
        ...(has('vline') && has('hline') ? [`if ${S.read}{2} then goto _pfd_u2v`, set(W[0], `${W[0].read} + 1`), 'return thisbank', label('u2v'),
          set(W[1], `${W[1].read} + 1`)] : [set(W[has('vline') ? 1 : 0], `${W[has('vline') ? 1 : 0].read} + 1`)]),
        'return thisbank');
  }
  // Terrain (the Generate terrain block): the ground along an edge, one pixel a step. The record: the least and the most height, the roughness (0 to 8) and
  // the overhangs (0 to 4). The side is in bits 1-0 of the state (0 bottom, 1 top, 2 left, 3 right), the direction the ground is heading in bit 2 (0 shallower,
  // 1 deeper). Kept while it is drawn: the position along the edge, the height there, the range, the pixel of the line being drawn, the terrain's
  // random numbers (see below), the roughness and the overhangs together (roughness * 8 + overhangs) and the overhang being made: the pixels of the line it
  // leaves out (a nibble, a quarter of the height, up to 15) and the positions it still goes on for (a nibble).
  // The height starts in the middle of the range and keeps heading the way it went, so the hills flow: from a random 0 to 7, 0 turns it round, 1 up to twice
  // the roughness move it a pixel and the others leave it where it is (roughness 0 is flat); at the limit of the range it turns round. A run of 2 to 5 positions is an overhang or a cave. An overhang
  // starts where the ground is getting shallower and keeps the height it started at as a ledge (1 pixel thick, and 1 more for every 16 of its height) over the
  // ground when that falls away, so the top of a hill leans out over a void; a cave has a gap in the middle of the line (a quarter of the height, up to 15
  // pixels), under the surface. A run starts at a position with a chance of 3 times the overhangs (or 4 times the caves) in 16, where the ground is more than 3 high (8
  // or more for a cave). The overhangs and the caves are packed in the fifth number of the record: overhangs + caves * 16. The record stays in the queue while the terrain is drawn (see the a3 entry).
  // The part of a finished terrain that makes Terrain done true (the side that finished sets its bit, and bit 16 is for every terrain finished, when no other terrain waits).
  const terrainDoneLines = () => [label('tzdone'),
    // The side that finished sets its bit (1 bottom, 2 top, 4 left, 8 right); bit 16 is for every terrain finished.
    // (Only the bits a block reads: a side no block asks about sets nothing.)
    ...([0, 1, 2, 3].some((side) => terrainDoneMask(side)) ? [`temp1 = ${S.read} & 3`, `temp2 = ${terrainDoneMask(0)}`,
      ...[1, 2, 3].filter((side) => terrainDoneMask(side) !== terrainDoneMask(0)).map((side) => `if temp1 = ${side} then temp2 = ${terrainDoneMask(side)}`),
      `${terrainDoneName(Blockly)} = ${terrainDoneName(Blockly)} | temp2`] : []),
    ...(terrainDoneMask(4) ? [...Array.from({length: pfDraw.records}, (_, i) => [...header(i), 'temp1 = temp1 / 32', `if temp1 = ${KIND_NUMBER.terrain} then return thisbank`]).flat(),
      `${terrainDoneName(Blockly)} = ${terrainDoneName(Blockly)} | ${terrainDoneMask(4)}`] : []), 'return thisbank'];
  // Terrain on DPC+: the coprocessor draws it all in one call as the record starts (the side is the state's low bits, the numbers of the record are in temp2 to temp6),
  // then the record leaves the queue and the state stays the terrain's: the next step (at the start of the next frame, as it is for the other kinds) tells Terrain done and the
  // next record waiting starts, so that Terrain done is true in the frame after the terrain, not at once while the frame's blocks may have gone by (the pulse is cleared at the start of the frame after).
  if (has('terrain') && armTerrain) {
    ensureArmProgram(Blockly, undefined, 'k');
    Blockly.BBasic.pfBoxArm = true;
    add(label('a3'),
        buildTerrainArmCall({side: `${S.read}
and #3`, least: 'temp2', most: 'temp3', rough: 'temp4', packed: 'temp5', seed: 'temp6', lastRow: maxRow, lastColumn: maxColumn}),
        ...store.remove(0),
        'return',
        label('u3'),
        ...(pfDraw.terrainDone ? ['gosub _pfd_tzdone'] : []),
        set(S, 0),
        ...header(0),
        `if temp1 <> 0 then ${S.write} = 2`,
        'return',
        ...(pfDraw.terrainDone ? terrainDoneLines() : []));
  }
  if (has('terrain') && !armTerrain) {
    // (The terrain keeps its record in the queue while it is drawn: the least and the most height, the roughness and overhangs (params), the packed
    // fifth number (caves) and the random number are the record's bytes 1 to 5, set to what the terrain keeps as it starts; the work bytes are the
    // position, the height there, the pixel of the line, the overhang being made and the ledge. The record leaves the queue when the terrain is done.)
    const [pos, depth, pixel, over, ledge] = W;
    const [, least, most, params, caves, seed] = pfDraw.queue[0];
    add(label('a3'), set(pos, 0), set(pixel, 0), set(least, 'temp2'), set(most, 'temp3'), set(over, 0), set(ledge, 0),
        // The fifth number of the record is the overhangs, the caves and tile packed: overhangs + caves * 16 + 128 for tile. The caves byte keeps the caves in bits 0-2,
        // tile in bit 3 and the slope of the ground (see _pfd_u3sl) in bits 4-7.
        'temp1 = temp5 & 127',
        'temp1 = temp1 / 16',
        'if temp1 > 4 then temp1 = 4',
        'if temp5 > 127 then temp1 = temp1 + 8',
        set(caves, 'temp1'),
        'temp5 = temp5 & 15',
        'if temp4 > 8 then temp4 = 8',
        'if temp5 > 4 then temp5 = 4',
        'temp1 = temp4 * 8',
        set(params, 'temp1 + temp5'),
        `if ${least.read} <= ${most.read} then goto _pfd_a3o`,
        'temp1 = temp2', set(least, 'temp3'), set(most, 'temp1'),
        label('a3o'),
        `if ${S.read}{1} then goto _pfd_a3h`,
        'temp5 = ' + maxRow + ' + 1',
        `if ${most.read} > temp5 then ${most.write} = temp5`,
        'goto _pfd_a3m',
        label('a3h'),
        `if ${most.read} > ${maxColumn + 1} then ${most.write} = ${maxColumn + 1}`,
        label('a3m'),
        `if ${least.read} > ${most.read} then ${least.write} = ${most.read}`,
        `if ${most.read} = 0 then goto _pfd_a3z`,
        set(depth, `(${least.read} + ${most.read}) / 2`),
        // The terrain's random numbers: a separate sequence (8 bit xorshift, shifts 1, 1 and 2: it goes through all 255 values), started from the project's
        // random number (the one Set random seed sets, which every block that uses random numbers shares) as it was when the block ran (the fifth number of the
        // record), so the same seed makes the same terrain whatever else uses random numbers, and whenever it starts.
        set(seed, 'temp6'),
        `if ${seed.read} = 0 then ${seed.write} = 1`,
        `if ${seed.read}{0} then ${S.write} = ${S.read} | 4`,
        'gosub _pfd_u3sl',
        // (Not shifted out: the record stays, see above.)
        'return',
        // A finished terrain makes Terrain done true for a frame only when no other terrain is waiting (the one being drawn left the queue when it started).
        label('u3z'),
        ...store.remove(0),
        ...(pfDraw.terrainDone ? ['gosub _pfd_tzdone'] : []),
        'goto _pfd_unone',
        label('a3z'),
        ...(pfDraw.terrainDone ? ['gosub _pfd_tzdone'] : []),
        'goto _pfd_anone',
        ...(pfDraw.terrainDone ? terrainDoneLines() : []),
        // The slope of the ground until the next turn, in the high bits of the caves byte: an eighth of the range, half of it a quarter of the time, double it
        // another quarter (the hills are not all the same), 1 at the least and 15 at the most.
        label('u3sl'),
        `temp1 = (${most.read} - ${least.read}) / 8`,
        'temp2 = ' + seed.read + ' / 8',
        'temp2 = temp2 & 3',
        'if temp2 = 0 then temp1 = temp1 / 2',
        'if temp2 = 3 then temp1 = temp1 + temp1',
        'if temp1 = 0 then temp1 = 1',
        'if temp1 > 15 then temp1 = 15',
        'temp1 = temp1 * 16',
        set(caves, `(${caves.read} & 15) + temp1`),
        'return thisbank',
        label('u3'),
        `if ${pixel.read} >= ${depth.read} then goto _pfd_u3x`,
        label('u3m'),
        `if ${S.read}{1} then goto _pfd_u3h`,
        `temp1 = ${pos.read}`,
        `if ${S.read}{0} then temp2 = ${pixel.read} else temp2 = ${maxRow} - ${pixel.read}`,
        'goto _pfd_u3p',
        label('u3h'),
        `temp2 = ${pos.read}`,
        `if ${S.read}{0} then temp1 = ${maxColumn} - ${pixel.read} else temp1 = ${pixel.read}`,
        label('u3p'),
        'gosub _pfd_plot',
        set(pixel, `${pixel.read} + 1`),
        // A cave (bit 6 of the roughness and overhangs): at half the height the pixels of the gap are jumped over.
        `if ${params.read}{7} then goto _pfd_u3c`,
        'return thisbank',
        label('u3c'),
        // (The gap of this position, in the high bits of over, is centered on the one of the whole cave, in the ledge byte: the ends of a cave are rounded.)
        `temp1 = ${over.read} / 16`,
        `temp2 = ${ledge.read} - temp1`,
        'temp2 = temp2 / 2',
        `temp3 = ${depth.read} / 2`,
        'temp3 = temp3 + temp2',
        `if ${pixel.read} <> temp3 then return thisbank`,
        set(pixel, `${pixel.read} + temp1`),
        'return thisbank',
        // The line is drawn to the ground. An overhang (a ledge that is not 0) goes on over the void, if the ground fell since it started, with the ledge: the pixels
        // below the top it started at (1 and 1 more for every 16 of its height, and 1 more for each position the overhang still goes on for).
        label('u3x'),
        `if ${params.read}{7} then goto _pfd_u3n`,
        `temp1 = ${ledge.read}`,
        'if temp1 = 0 then goto _pfd_u3n',
        `temp2 = ${ledge.read} / 16`,
        'temp2 = temp2 + 1',
        // (The ledge is thicker where it leaves the hill and thinner toward its tip: the positions the overhang goes on for are added to it.)
        `temp3 = ${over.read} & 15`,
        // (An overhang to the left, the high bits of over 2 or more (its length less 1): thicker toward the hill, at its end.)
        `temp4 = ${over.read} / 16`,
        'if temp4 >= 2 then temp3 = temp4 - temp3',
        'temp2 = temp2 + temp3',
        // The top of the ledge is not flat: it sinks toward the tip, half a pixel for each position from the tip under 6 (temp3), a pixel more half the time, where the
        // ledge stays more than a pixel over the ground under it with its thickness (as the coprocessor's terrain does on DPC+, armprog.c).
        'if temp3 > 6 then goto _pfd_u3xt',
        'temp5 = 6 - temp3',
        'temp5 = temp5 / 2',
        `if ${seed.read}{5} then temp5 = temp5 + 1`,
        'if temp5 >= temp1 then goto _pfd_u3xt',
        `temp6 = ${depth.read} + temp2`,
        'temp3 = temp1 - temp5',
        'if temp3 > temp6 then temp1 = temp3',
        label('u3xt'),
        `if ${pixel.read} >= temp1 then goto _pfd_u3n`,
        'temp2 = temp1 - temp2',
        'if temp2 > temp1 then temp2 = 0',
        `if ${pixel.read} < temp2 then ${pixel.write} = temp2`,
        'goto _pfd_u3m',
        // The next position.
        label('u3n'),
        set(pos, `${pos.read} + 1`),
        `if ${S.read}{1} then goto _pfd_u3e`,
        `if ${pos.read} > ${maxColumn} then goto _pfd_u3z`,
        'goto _pfd_u3s',
        label('u3e'),
        `if ${pos.read} > ${maxRow} then goto _pfd_u3z`,
        label('u3s'),
        'temp5 = ' + seed.read + ' * 2',
        set(seed, `${seed.read} ^ temp5`),
        'temp5 = ' + seed.read + ' / 2',
        set(seed, `${seed.read} ^ temp5`),
        'temp5 = ' + seed.read + ' * 4',
        set(seed, `${seed.read} ^ temp5`),
        // Tile: the ground moves as it likes while it can still get back to the height it started at (the middle of the range) by the last position, going at most a
        // power of two of rows near its slope in each position; when it is further from it than that it moves back by what is missing: the edge ends where it began and
        // is repeated without a step, and without a long flat stretch or a straight run (the walk is only held at its limit).
        `if !${caves.read}{3} then goto _pfd_u3nt`,
        `if ${S.read}{1} then temp3 = ${maxRow} else temp3 = ${maxColumn}`,
        `temp1 = temp3 - ${pos.read}`,
        `temp3 = ${caves.read} / 16`,
        'if temp3 >= 2 then temp1 = temp1 + temp1',
        'if temp3 >= 4 then temp1 = temp1 + temp1',
        'if temp3 >= 8 then temp1 = temp1 + temp1',
        `temp4 = ${least.read} + ${most.read}`,
        'temp4 = temp4 / 2',
        `if ${depth.read} > temp4 then temp5 = ${depth.read} - temp4 else temp5 = temp4 - ${depth.read}`,
        'if temp5 <= temp1 then goto _pfd_u3nt',
        'temp5 = temp5 - temp1',
        `if ${depth.read} > temp4 then goto _pfd_u3tu`,
        set(depth, `${depth.read} + temp5`),
        set(S, `${S.read} | 4`),
        'goto _pfd_u3k',
        label('u3tu'),
        set(depth, `${depth.read} - temp5`),
        set(S, `${S.read} & 251`),
        'goto _pfd_u3k',
        label('u3nt'),
        'temp5 = ' + seed.read + ' / 32',
        'temp6 = ' + params.read + ' & 127',
        'temp6 = temp6 / 8',
        'temp6 = temp6 * 2',
        // Turns: a random 0 of the 8 turns the ground round (and a new slope), and from roughness 3 on a random 0 to 7 below the roughness less 2 does too.
        'if temp5 = 0 then goto _pfd_u3f',
        'if temp6 < 6 then goto _pfd_u3q2',
        'temp1 = ' + seed.read + ' & 7',
        'temp2 = temp6 / 2',
        'temp2 = temp2 - 2',
        'if temp1 < temp2 then goto _pfd_u3f',
        label('u3q2'),
        'if temp5 > temp6 then goto _pfd_u3k',
        label('u3mv'),
        // A move is the slope of the hill (see _pfd_u3sl), a row a quarter of the time and half of it a quarter of the time (so the edge is not always in big steps), held inside the range.
        `temp1 = ${caves.read} / 16`,
        'if temp1 = 0 then temp1 = 1',
        'temp2 = ' + seed.read + ' / 4',
        'temp2 = temp2 & 3',
        'if temp2 = 1 then temp1 = temp1 / 2',
        'if temp2 = 0 then temp1 = 1',
        'if temp1 = 0 then temp1 = 1',
        `if ${S.read}{2} then goto _pfd_u3d`,
        `if ${depth.read} <= ${least.read} then goto _pfd_u3t`,
        `temp2 = ${depth.read} - ${least.read}`,
        'if temp2 < temp1 then temp1 = temp2',
        set(depth, `${depth.read} - temp1`),
        'goto _pfd_u3k',
        // (At the limit of the range the ground turns and moves away from it in the same position: no flat stretch along the limit. A range of one height has nowhere to go.)
        label('u3t'),
        `if ${least.read} >= ${most.read} then goto _pfd_u3k`,
        set(S, `${S.read} | 4`),
        'gosub _pfd_u3sl',
        'goto _pfd_u3mv',
        label('u3d'),
        `if ${depth.read} >= ${most.read} then goto _pfd_u3b`,
        `temp2 = ${most.read} - ${depth.read}`,
        'if temp2 < temp1 then temp1 = temp2',
        set(depth, `${depth.read} + temp1`),
        'goto _pfd_u3k',
        label('u3b'),
        `if ${least.read} >= ${most.read} then goto _pfd_u3k`,
        set(S, `${S.read} & 251`),
        'gosub _pfd_u3sl',
        'goto _pfd_u3mv',
        // A turn that would head back to the limit the ground has just come from is left out (until it is two slopes away), so the ground does not stay along the limit
        // as a flat stretch: it rounds off at the top and the bottom.
        label('u3f'),
        `temp1 = ${caves.read} / 16`,
        'temp1 = temp1 + temp1',
        `if ${S.read}{2} then goto _pfd_u3fb`,
        `temp2 = ${most.read} - ${depth.read}`,
        'if temp2 < temp1 then goto _pfd_u3fs',
        'goto _pfd_u3fl',
        label('u3fb'),
        `temp2 = ${depth.read} - ${least.read}`,
        'if temp2 < temp1 then goto _pfd_u3fs',
        'goto _pfd_u3fl',
        // (A turn that is left out: from the random 0 of the 8 the ground stays as it is, from the extra turns of a high roughness it goes on with its move.)
        label('u3fs'),
        'if temp5 = 0 then goto _pfd_u3k',
        'goto _pfd_u3q2',
        label('u3fl'),
        set(S, `${S.read} ^ 4`),
        'gosub _pfd_u3sl',
        // The line of this position starts at pixel 0 (a run of an overhang or a cave jumps over its gap while the line is drawn).
        label('u3k'),
        set(pixel, 0),
        `if ${over.read} <> 0 then goto _pfd_u3r`,
        'temp1 = ' + params.read + ' & 7',
        'if temp1 = 0 then goto _pfd_u3v',
        `if ${depth.read} <= 3 then return thisbank`,
        // (The chance of a start is 3 times the overhangs in 16: 19%, 37%, 56% and 75% for 1 to 4.)
        'temp1 = temp1 + temp1 + temp1',
        'temp2 = ' + seed.read + ' & 15',
        'if temp2 >= temp1 then goto _pfd_u3v',
        // An overhang starts where the ground is getting shallower, at the height it has: the ledge over what the ground drops to (to the right); where it is
        // getting higher, one to the left (see _pfd_u3lo).
        'temp4 = ' + seed.read + ' / 4',
        'temp4 = temp4 & 3',
        'temp4 = temp4 + 3',
        `if ${S.read}{2} then goto _pfd_u3lo`,
        // The ground drops under the ledge by more than the ledge is thick (its thickness at the start, plus a quarter of the height less a little, held inside the range), so a
        // void shows under it; where the range has no room for that there is no overhang.
        `if ${depth.read} <= ${least.read} then goto _pfd_u3v`,
        `temp1 = ${depth.read} / 16`,
        'temp1 = temp1 + temp4',
        `temp2 = ${depth.read} / 8`,
        'temp2 = temp2 + temp1',
        'temp2 = temp2 + 2',
        `temp3 = ${depth.read} - ${least.read}`,
        'if temp2 > temp3 then temp2 = temp3',
        'if temp2 <= temp1 then goto _pfd_u3v',
        set(ledge, depth.read),
        set(depth, `${depth.read} - temp2`),
        set(over, 'temp4 + 16'),
        'goto _pfd_u3r',
        // To the left: the ground stays low for the length of the overhang, under a ledge at the height it goes up to (thin at its tip, thicker toward the hill), and goes
        // up there at the end (see _pfd_u3r). The high bits of over are the length less 1 (2 or more: to the left).
        label('u3lo'),
        `if ${depth.read} >= ${most.read} then goto _pfd_u3v`,
        `temp1 = ${depth.read} / 16`,
        'temp1 = temp1 + temp4',
        `temp2 = ${depth.read} / 8`,
        'temp2 = temp2 + temp1',
        'temp2 = temp2 + 2',
        `temp3 = ${most.read} - ${depth.read}`,
        'if temp2 > temp3 then temp2 = temp3',
        'if temp2 <= temp1 then goto _pfd_u3v',
        set(ledge, `${depth.read} + temp2`),
        'temp1 = temp4 - 1',
        'temp1 = temp1 * 16',
        set(over, 'temp4 + temp1'),
        'goto _pfd_u3r',
        // A cave starts instead, with the same chance from the caves value, where the ground is 8 or more high: the gap is in the middle of the line.
        label('u3v'),
        `temp1 = ${caves.read} & 7`,
        'if temp1 = 0 then return thisbank',
        `if ${depth.read} < 8 then return thisbank`,
        'temp1 = temp1 * 4',
        'temp2 = ' + seed.read + ' / 16',
        'if temp2 >= temp1 then return thisbank',
        set(params, `${params.read} | 128`),
        // A cave: a quarter of the height (plus 1 half the time, at most 15) pixels left out, for 2 to 5 positions.
        'temp3 = ' + depth.read + ' / 4',
        'temp1 = ' + seed.read + ' / 16',
        'temp1 = temp1 & 1',
        'temp3 = temp3 + temp1',
        'if temp3 > 15 then temp3 = 15',
        'if temp3 = 0 then temp3 = 1',
        set(ledge, 'temp3'),
        'temp4 = ' + seed.read + ' / 4',
        'temp4 = temp4 & 3',
        'temp4 = temp4 + 2',
        set(over, 'temp4'),
        label('u3r'),
        `if (${over.read} & 15) <> 0 then goto _pfd_u3q`,
        // (The end of an overhang to the left: the ground goes up to the ledge.)
        `if ${params.read}{7} then goto _pfd_u3re`,
        `temp1 = ${over.read} / 16`,
        `if temp1 >= 2 then ${depth.write} = ${ledge.read}`,
        label('u3re'),
        set(over, 0),
        set(ledge, 0),
        set(params, `${params.read} & 127`),
        'return thisbank',
        label('u3q'),
        set(over, `${over.read} - 1`),
        `if !${params.read}{7} then return thisbank`,
        // A cave: the gap of the first and the last position is half of the gap of the cave (the high bits of over are 0 until the first one is set).
        `temp1 = ${over.read} & 15`,
        `temp2 = ${ledge.read}`,
        `temp3 = ${over.read} / 16`,
        'if temp3 = 0 then goto _pfd_u3q3',
        'if temp1 <> 0 then goto _pfd_u3q4',
        label('u3q3'),
        'temp2 = temp2 / 2',
        'if temp2 = 0 then temp2 = 1',
        label('u3q4'),
        'temp2 = temp2 * 16',
        set(over, 'temp1 + temp2'),
        'return thisbank');
  }
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
      padLeft: 'temp5\nand #15', padRight: 'temp5\nlsr\nlsr\nlsr\nlsr', padTop: 'temp6', padBottom: 'temp1',
      last: `#${groupRows ? '191' : maxRow}`, stretch: circleStretch});
    // (The record's 7th byte, the padding of the bottom, is read into temp1: the header there is done with.)
    add(label('a6'), ...(circleSpread ? [`if ${S.read}{0} then goto _pfd_a6s`] : []), ...store.read(0, 6, 'temp1'));
    circleOperations.slice(0, -1).forEach((operation) => add(
        `if !${S.read}{${operation === 'flip' ? 4 : 3}} then goto _pfd_a6${operation}`, call(operation), 'goto _pfd_anone', label(`a6${operation}`)));
    add(call(circleOperations[circleOperations.length - 1]), 'goto _pfd_anone');
  }
  if (has('circle') && (!armCircle || circleSpread)) {
    // Elsewhere (as the circle block always drew it, row by row from the center row outwards, the row below and then the row above): the center,
    // the radius (low nibble) and the distance of the row from the center (high nibble), the padding (as the record has it), the column being
    // drawn and the last column of the row. State bit 2: a row is being drawn; bit 1: the row above.
    const [cx, cy, rd, padLR, padT, column, end, padB, dist] = W;
    const squares = Array.from({length: 16}, (_, i) => i * i).join(',');
    add(label(armCircle ? 'a6s' : 'a6'), ...fromRecord(5), ...store.read(0, 6, 'temp2'), set(padB, 'temp2'),
        ...(circleStretch ? [`if ${rd.read} >= 128 then goto _pfd_a6x`, set(dist, 0)] : []),
        `if ${rd.read} > 15 then ${rd.write} = 15`, 'goto _pfd_shift',
        ...(circleStretch ? [label('a6x'), set(rd, `${rd.read} & 127`), `if ${rd.read} > 15 then ${rd.write} = 15`, set(dist, 128), 'goto _pfd_shift'] : []),
        label('u6'),
        `if ${S.read}{2} then goto _pfd_u6p`,
        ...(circleStretch ? [`if ${dist.read}{7} then goto _pfd_u6x`] : []),
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
        label('u6h'),
        ['asm', 'ldx temp1', 'lda _pfd_sq,x', 'sta temp1', 'ldx temp2', 'lda _pfd_sq,x', 'sec', 'sbc temp1',
          'sta temp1', 'ldx temp2', '@_pfd_find', 'lda _pfd_sq,x', 'cmp temp1',
          'beq _pfd_found', 'bcc _pfd_found', 'dex', 'bne _pfd_find', '@_pfd_found', 'stx temp3', '@end'].join('\n'),
        `temp1 = ${padT.read}`,
        'if temp5 < temp1 then goto _pfd_u6n',
        `temp1 = ${padB.read}`,
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
        ...(circleStretch ? [`if ${dist.read}{7} then goto _pfd_u6pq`] : []),
        `temp1 = ${rd.read} / 16`,
        `if ${S.read}{1} then temp2 = ${cy.read} - temp1 else temp2 = ${cy.read} + temp1`,
        label('u6pc'),
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
        ...(circleStretch ? [`if ${dist.read}{7} then goto _pfd_u6dx`] : []),
        `temp1 = ${rd.read} / 16`,
        `temp2 = ${rd.read} & 15`,
        'if temp1 >= temp2 then goto _pfd_unone',
        set(rd, `${rd.read} + 16`),
        'return thisbank',
        ...(circleStretch ? [
          // The row of the distance in dist (bits 6-0): the circle's row of distance (d * S / 256), below the center and then above. The circle is done at the first distance past its radius.
          label('u6dx'), set(dist, `${dist.read} + 1`), 'return thisbank',
          label('u6pq'), `temp1 = ${dist.read} & 127`, `if ${S.read}{1} then temp2 = ${cy.read} - temp1 else temp2 = ${cy.read} + temp1`, 'goto _pfd_u6pc',
          label('u6x'),
          ['asm', `lda ${dist.read}`, 'and #127', 'sta temp4', 'sta temp2', 'lda #0', 'ldx #8', 'lsr temp2', '@_pfd_xm', 'bcc _pfd_xn', 'clc', `adc #${circleStretch}`,
            '@_pfd_xn', 'ror', 'ror temp2', 'dex', 'bne _pfd_xm', 'sta temp3', '@end'].join('\n'),
          `temp2 = ${rd.read} & 15`,
          'if temp3 > temp2 then goto _pfd_unone',
          `if ${S.read}{1} then goto _pfd_u6xu`,
          `if ${cy.read} > ${maxRow} then goto _pfd_u6n`,
          `temp1 = ${maxRow} - ${cy.read}`,
          'if temp4 > temp1 then goto _pfd_u6n',
          `temp5 = ${cy.read} + temp4`,
          'temp1 = temp3',
          'goto _pfd_u6h',
          label('u6xu'),
          'if temp4 = 0 then goto _pfd_u6n',
          `if ${cy.read} < temp4 then goto _pfd_u6n`,
          `temp5 = ${cy.read} - temp4`,
          'temp1 = temp3',
          'goto _pfd_u6h'] : []),
        ['asm', '@_pfd_sq', `.byte ${squares}`, '@end'].join('\n'));
  }
  // The fill (the bucket of the graphic editors: every pixel joined to the start up, down, left or right that is off, or on to erase): x, y and the
  // number of seeds. A seed is taken, the row is followed to the left as far as the fill goes, then to the right a pixel a step, the pixel drawn
  // and the pixels above and below it looked at: where a run of them the fill takes begins, a seed. State bits 2-0: 000 a seed is to be taken,
  // 010 going left, 1ab going right (a: the pixel above the last one was taken, b: the one below). Testing a pixel (temp1, temp2): temp4 is 0 when
  // it is one the fill takes (off to fill, on to erase).
  // The test of a pixel (temp4 is 0 when it is one the fill takes: for the gravity, state 2 in bits 4-3, it is not 0 when the pixel is on).
  if (has('fill') || has('gravity')) {
    add(
        label('test'),
        ...(ownPlayfield ? [['asm', ...place, 'lda playfield,y', 'and _pfd_bit,x', 'beq _pfd_toff', 'lda #8', '@_pfd_toff', `eor ${S.read}`, 'and #8',
          'sta temp4', 'rts', '@end'].join('\n')] : [
            'temp4 = 0',
            'if pfread(temp1, temp2) then temp4 = 8',
            `temp4 = temp4 ^ ${S.read}`,
            'temp4 = temp4 & 8',
            'return thisbank']));
  }
  if (has('fill')) {
    const [fx, fy, count] = W;
    add(label('a7'), ...(has('gravity') ? [`if ${S.read}{4} then goto _pfd_a7g`] : []), set(count, 0), 'temp1 = temp2', 'temp2 = temp3', 'gosub _pfd_push', 'goto _pfd_shift',
        label('u7'),
        ...(has('gravity') ? [`if ${S.read}{4} then goto _pfd_u7g`] : []),
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
  // The playfield gravity (the pixels of an area fall): x1, y1, x2 and y2 (a corner to the other, the first the top left, the last two cut to the playfield) and the
  // frames between steps (0: all at once). The state is the fill's kind with the operation 2 (see the test above).
  // All at once: the columns go one after the other, each from its lowest row up: a pixel that is on moves down to the lowest row not taken (it and that row are
  // flipped), and the row after is the one above. A pixel a step. Kept: the column, the row, the row the next pixel lands on, the last column, the first row and
  // the last row. On DPC+ the coprocessor does it all in one call as the record starts (function 114 of armprog.c).
  // Over time (state bit 0): every row from the one above the last up to the first, a row a step (the standard kernel a byte of 8 columns at a time, PXE a
  // pixel at a time through the coprocessor's functions): a pixel that is on with a pixel that is off under it moves down one row. After a whole pass the wait is
  // the number of frames (the byte counted down once a frame, see generatePfDrawStep), and the passes go on until one moves nothing (state bit 1 is set when a
  // pixel moves). Kept: the frames (in the column's byte), the row (the upper one of the two), the first column, the last column, the first row and the last
  // row; on DPC+ (the coprocessor's function 115 does a whole pass) the four of the area and the frames.
  const anim = pfDraw.gravityAnim;
  const tick = pfDraw.gravityTick;
  const gz = pfDraw.terrainDone ? '_pfd_a7gz' : '_pfd_anone';
  const gdoneCall = pfDraw.terrainDone ? ['gosub _pfd_gdone'] : [];
  // The part of a finished gravity that makes the bit 5 of Terrain done true (when no other gravity waits), and the empty area that has nothing to make fall.
  const gravityDoneLines = () => (pfDraw.terrainDone ? [label('a7gz'), 'gosub _pfd_gdone', 'goto _pfd_anone', label('gdone'),
    ...(terrainDoneMask(5) ? [...Array.from({length: pfDraw.records}, (_, i) => [...header(i), 'temp1 = temp1 / 8', 'if temp1 = 30 then return thisbank']).flat(),
      `${terrainDoneName(Blockly)} = ${terrainDoneName(Blockly)} | ${terrainDoneMask(5)}`] : []), 'return thisbank'] : []);
  const gravityClamp = [`if temp4 > ${maxColumn} then temp4 = ${maxColumn}`, `if temp5 > ${maxRow} then temp5 = ${maxRow}`,
    `if temp2 > temp4 then goto ${gz}`, `if temp3 > temp5 then goto ${gz}`];
  if (has('gravity') && armGravity) {
    ensureArmProgram(Blockly, undefined, 'k');
    Blockly.BBasic.pfBoxArm = true;
    const [ax1, ay1, ax2, ay2, adl] = anim ? W : [];
    // (The record leaves the queue and the state stays the gravity's until the next step, which sets it to 0 and starts the record waiting, so that Playfield gravity
    // done is true from the frame after.)
    add(...(has('fill') ? [] : [label('a7')]), label('a7g'),
        ...gravityClamp,
        ...(anim ? ['if temp6 > 0 then goto _pfd_a7ga'] : []),
        buildGravityArmCall({x1: 'temp2', y1: 'temp3', x2: 'temp4', y2: 'temp5'}),
        ...store.remove(0),
        'return',
        ...(anim ? [label('a7ga'), 'if temp3 >= temp5 then goto ' + gz, set(ax1, 'temp2'), set(ay1, 'temp3'), set(ax2, 'temp4'), set(ay2, 'temp5'), set(adl, 'temp6'), set(tick, 0),
          set(S, `${S.read} | 1`), 'goto _pfd_shift'] : []),
        ...(has('fill') ? [] : [label('u7')]), label('u7g'),
        ...(anim ? [`if ${S.read}{0} then goto _pfd_u7ga`] : []),
        label('u7gf'),
        ...gdoneCall,
        set(S, 0),
        ...header(0),
        `if temp1 <> 0 then ${S.write} = 2`,
        'return',
        ...(anim ? [label('u7ga'), `if ${tick.read} > 0 then return`,
          buildGravityStepCall({x1: ax1.read, y1: ay1.read, x2: ax2.read, y2: ay2.read}),
          'if temp1 = 0 then goto _pfd_u7gf', set(tick, adl.read), 'return'] : []),
        ...gravityDoneLines());
  } else if (has('gravity')) {
    // (Over time the column byte keeps the frames between passes: a step does a whole row.)
    const [gc, gr, gl, gx, gt, gb] = W;
    const gd = gc;
    // A pixel is cleared and another set (not flipped: the pixel's place is the same code for each).
    add(label('gclr'),
        ...(ownPlayfield ? [['asm', ...place, 'lda _pfd_bit,x', 'eor #255', 'and playfield,y', `sta ${writeBase},y`, 'rts', '@end'].join('\n')] : ['pfpixel temp1 temp2 off', 'return thisbank']),
        label('gset'),
        ...(ownPlayfield ? [['asm', ...place, 'lda playfield,y', 'ora _pfd_bit,x', `sta ${writeBase},y`, 'rts', '@end'].join('\n')] : ['pfpixel temp1 temp2 on', 'return thisbank']));
    add(...(has('fill') ? [] : [label('a7')]), label('a7g'),
        ...gravityClamp,
        ...(anim ? ['if temp6 > 0 then goto _pfd_a7ga'] : []),
        set(gc, 'temp2'), set(gr, 'temp5'), set(gl, 'temp5'), set(gx, 'temp4'), set(gt, 'temp3'), set(gb, 'temp5'),
        'goto _pfd_shift',
        ...(anim ? [label('a7ga'), 'if temp3 >= temp5 then goto ' + gz, set(gr, 'temp5 - 1'), set(gl, 'temp2'), set(gx, 'temp4'), set(gt, 'temp3'), set(gb, 'temp5'),
          set(gd, 'temp6'), set(tick, 0), set(S, `${S.read} | 1`), 'goto _pfd_shift'] : []),
        ...(has('fill') ? [] : [label('u7')]), label('u7g'),
        ...(anim ? [`if ${S.read}{0} then goto _pfd_u7ga`] : []),
        `temp1 = ${gc.read}`, `temp2 = ${gr.read}`, 'gosub _pfd_test',
        'if temp4 = 0 then goto _pfd_u7gn',
        `if ${gr.read} = ${gl.read} then goto _pfd_u7gl`,
        `temp1 = ${gc.read}`, `temp2 = ${gr.read}`, 'gosub _pfd_gclr',
        `temp1 = ${gc.read}`, `temp2 = ${gl.read}`, 'gosub _pfd_gset',
        label('u7gl'),
        set(gl, `${gl.read} - 1`),
        label('u7gn'),
        `if ${gr.read} = ${gt.read} then goto _pfd_u7gc`,
        set(gr, `${gr.read} - 1`),
        'return thisbank',
        label('u7gc'),
        set(gc, `${gc.read} + 1`),
        `if ${gc.read} > ${gx.read} then goto ${pfDraw.terrainDone ? '_pfd_u7gz' : '_pfd_unone'}`,
        set(gr, gb.read), set(gl, gb.read),
        'return thisbank',
        ...(pfDraw.terrainDone ? [label('u7gz'), 'gosub _pfd_gdone', 'goto _pfd_unone'] : []),
        // Over time: the row (the upper one of the two) with the one under it, the whole row in a step.
        ...(anim ? [label('u7ga'),
          `if ${tick.read} > 0 then return thisbank`,
          ...(ownPlayfield ? [
            // The standard kernel: a byte (8 columns) at a time, the pixels that fall the ones on above off: m = upper & ~lower & the area's columns;
            // lower | m, upper & ~m. The columns of byte k (k * 8 to k * 8 + 7) in the area give the mask from two tables (the bytes 1 and 3 go the other
            // way round: the second half of each table). temp3: k * 8; temp4: the first column of the area in the byte; temp5: the mask; temp6: the half.
            ['asm', `lda ${gr.read}`, 'asl', 'asl', 'tay', 'lda #0', 'sta temp3',
              '@_pfd_grk', `lda ${gl.read}`, 'sec', 'sbc temp3', 'bcs _pfd_gra', 'lda #0', '@_pfd_gra', 'cmp #8', 'bcs _pfd_grn', 'sta temp4',
              'lda temp3', 'and #8', 'sta temp6',
              `lda ${gx.read}`, 'sec', 'sbc temp3', 'bcc _pfd_grn', 'cmp #8', 'bcc _pfd_grb', 'lda #7', '@_pfd_grb',
              'ora temp6', 'tax', 'lda _pfd_gR,x', 'sta temp5', 'lda temp4', 'ora temp6', 'tax', 'lda _pfd_gL,x', 'and temp5', 'sta temp5',
              'lda playfield+4,y', 'eor #255', 'and playfield,y', 'and temp5', 'beq _pfd_grn',
              'sta temp5', 'ora playfield+4,y', `sta ${writeBase}+4,y`, 'lda temp5', 'eor #255', 'and playfield,y', `sta ${writeBase},y`,
              `lda ${S.read}`, 'ora #2', `sta ${S.write}`,
              '@_pfd_grn', 'iny', 'lda temp3', 'clc', 'adc #8', 'sta temp3', 'cmp #32', 'bcc _pfd_grk',
              'jmp ._pfd_u7ar',
              // (From the first column of the byte on, and up to its last: bytes 0 and 2 have column 0 in bit 7, bytes 1 and 3 in bit 0.)
              '@_pfd_gL', '.byte $FF,$7F,$3F,$1F,$0F,$07,$03,$01,$FF,$FE,$FC,$F8,$F0,$E0,$C0,$80',
              '@_pfd_gR', '.byte $80,$C0,$E0,$F0,$F8,$FC,$FE,$FF,$01,$03,$07,$0F,$1F,$3F,$7F,$FF', '@end'].join('\n')] : [
                // PXE: a pixel at a time through the coprocessor's functions, the column in temp6 (the test, the clear and the set leave it alone).
                `temp6 = ${gl.read}`,
                label('u7ac'),
                'temp1 = temp6', `temp2 = ${gr.read}`, 'gosub _pfd_test',
                'if temp4 = 0 then goto _pfd_u7an',
                'temp1 = temp6', `temp2 = ${gr.read} + 1`, 'gosub _pfd_test',
                'if temp4 <> 0 then goto _pfd_u7an',
                'temp1 = temp6', `temp2 = ${gr.read}`, 'gosub _pfd_gclr',
                'temp1 = temp6', `temp2 = ${gr.read} + 1`, 'gosub _pfd_gset',
                set(S, `${S.read} | 2`),
                label('u7an'),
                `if temp6 >= ${gx.read} then goto _pfd_u7ar`,
                'temp6 = temp6 + 1',
                'goto _pfd_u7ac']),
          label('u7ar'),
          `if ${gr.read} = ${gt.read} then goto _pfd_u7ap`,
          set(gr, `${gr.read} - 1`),
          'return thisbank',
          label('u7ap'),
          `if ${S.read}{1} then goto _pfd_u7am`,
          ...gdoneCall,
          'goto _pfd_unone',
          label('u7am'),
          set(S, `${S.read} & 253`),
          set(gr, `${gb.read} - 1`),
          set(tick, gd.read),
          'return thisbank'] : []),
        ...gravityDoneLines());
  }
  // Stop fill: the fill being drawn ends and the fills waiting are taken out of the queue. Fill done (temp6 1): no fill drawn or waiting.
  // (A fill is the kind 7 with the operation 0 or 1; the gravity is the kind 7 with 2: with both in the project the header is read in eighths, 28 and 29 are fills.)
  const isFill = (skip) => (has('gravity') ? ['temp1 = temp1 / 8', `if temp1 < 28 then goto ${skip}`, `if temp1 > 29 then goto ${skip}`] : ['temp1 = temp1 / 32', `if temp1 <> ${KIND_NUMBER.fill} then goto ${skip}`]);
  if (Blockly.BBasic.pfDrawFillControls) {
    add(label('stopfill'),
        `temp1 = ${S.read}`, ...isFill('_pfd_stops'), set(S, 0),
        label('stops'),
        label('stopq'));
    for (let r = 0; r < records; r++) {
      add(...header(r), ...isFill(`_pfd_stopk${r}`), ...store.remove(r), 'goto _pfd_stopq',
          label(`stopk${r}`));
    }
    add(`if ${S.read} >= 32 then return`,
        set(S, 0),
        ...header(0),
        `if temp1 <> 0 then ${S.write} = 2`,
        'return',
        label('filldone'),
        'temp6 = 1',
        `temp1 = ${S.read}`, ...isFill('_pfd_fds'), 'temp6 = 0', label('fds'));
    for (let r = 0; r < records; r++) add(...header(r), ...isFill(`_pfd_fd${r}`), 'temp6 = 0', label(`fd${r}`));
    add('return');
  }
  // Gravity done (temp6 1): no playfield gravity is drawn or waiting.
  if (Blockly.BBasic.pfDrawGravityDone) {
    add(label('gravdone'), 'temp6 = 1', `temp1 = ${S.read} / 8`, 'if temp1 = 30 then temp6 = 0');
    for (let r = 0; r < records; r++) add(...header(r), 'temp1 = temp1 / 8', 'if temp1 = 30 then temp6 = 0');
    add('return');
  }
  // Terrain done (temp6 1): no terrain is drawn or waiting.
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
// The call before a block writes its record. DPC+: none, but a record still waiting in the record past the queue (a circle the block left there, see
// deferredSubmit) goes into the queue first.
const roomCall = (Blockly) => (Blockly.BBasic.pfDraw.displayRam ? [...recordStore(Blockly.BBasic.pfDraw).read(Blockly.BBasic.pfDraw.records, 0, 'temp1'),
  `if temp1 then ${callEngine(Blockly, 'submit')}`] : [callEngine(Blockly, 'room')]);
// DPC+: a circle the coprocessor draws (it waits for the steps at the end of the frame anyway) is left in the record past the queue, and the steps put it in the
// queue when the frame has time for it (see generatePfDrawStep): the copy down the queue (about 370 cycles) was made in the frame of the block, a hit frame of Bricks.
const deferredSubmit = (Blockly, spread) => Blockly.BBasic.pfDraw.displayRam && Blockly.BBasic.pfDraw.armCircle && !spread;

// At power-on: the state and every queue record free. Superchip RAM (where the bytes go when it is on) is not cleared by the startup as the
// RAM of the console is: a record left over there looked like Draw blocks waiting (a terrain drawn over the whole playfield). Not on DPC+ (the
// display memory the records are in is set up by the kernel's startup) nor when no Draw block is used.
export const pfDrawStartupLines = (Blockly) => {
  const pfDraw = Blockly.BBasic.pfDraw;
  if (!pfDraw || pfDraw.displayRam) return [];
  return [`${pfDraw.state.write} = 0`, ...pfDraw.queue.map((record) => `${record[0].write} = 0`)];
};

// The line for the end of commongamelogic: the steps of the frame.
export const generatePfDrawStep = (Blockly) => {
  if (!ensurePfDraw(Blockly)) return '';
  const done = Blockly.BBasic.pfDraw.terrainDone;
  // (The pulse of Playfield terrain done is cleared here, at the end of the frame that saw it, before the steps that may set it again.)
  const tick = Blockly.BBasic.pfDraw.gravityTick;
  return [...(done ? [` ${terrainDoneName(Blockly)} = ${terrainDoneName(Blockly)} & ${255 ^ terrainDoneAllMask()}`] : []), ...(tick ? [` temp1 = ${Blockly.BBasic.pfDraw.state.read} / 8`, ` if temp1 = 30 && ${tick.read} > 0 then ${tick.write} = ${tick.read} - 1`] : []), ` if ${Blockly.BBasic.pfDraw.state.read} = 0 then goto _pfd_idle`,
    ` gosub _pfd_step${Blockly.BBasic.bankJumpSuffix(Blockly.BBasic.primaryBank ? Blockly.BBasic.primaryBank() : 1,
        Blockly.BBasic.getSubroutineBank(PF_DRAW_SUBROUTINE))}`, '_pfd_idle'].join('\n');
};

const headerOf = (kind, operation, flags = 0) => KIND_NUMBER[kind] * 32 + OPERATION_NUMBER[operation] * 8 + flags;
// A Draw block's code: room in the queue, its record written into the last record (a number at a time, each worked out straight into its byte, or
// on DPC+ into temp6 and from there into the display RAM: working one out uses temp1 and temp2 at the most), then the submit. kind: see
// pfDrawKindOf; operation: on, off or flip (the fill: on fills, off erases); numbers: the code of each number, in the order of the kind's record.
export const pfDrawBlockCode = (Blockly, kind, operation, numbers, flags = 0) => {
  if (!ensurePfDraw(Blockly)) return '';
  const store = recordStore(Blockly.BBasic.pfDraw);
  return [...roomCall(Blockly), ...numbers.flatMap((code, i) => store.write(i + 1, code)), ...store.write(0, headerOf(kind, operation, flags)),
    callEngine(Blockly, 'submit')].join('\n') + '\n';
};

// The circle: the center and the radius as numbers, the padding packed two to a byte (left and right, top and bottom, 15 at the most each).
export const pfDrawCircleCode = (Blockly, operation, cx, cy, radius, padLeft, padRight, padTop, padBottom, spread = false, stretch = false) => {
  if (!ensurePfDraw(Blockly)) return '';
  const store = recordStore(Blockly.BBasic.pfDraw);
  // (Numbers in the blocks are worked out here, not by the game: 15 at the most.)
  const number = (code) => (/^\s*\d+\s*$/.test(String(code)) ? Math.min(Number(code), 15) : null);
  // (Kept round: the radius, 15 at the most, with bit 7 set.)
  const radiusCode = stretch && Blockly.BBasic.pfDraw.circleStretch ? (number(radius) !== null ? store.write(3, String(number(radius) | 128)) :
    [`temp3 = ${radius}`, 'if temp3 > 15 then temp3 = 15', 'temp3 = temp3 | 128', ...store.write(3, 'temp3')]) : store.write(3, radius);
  const pack = (low, high, i) => (number(low) !== null && number(high) !== null ? store.write(i, String(number(low) | (number(high) * 16))) :
    [`temp3 = ${low}`, `temp4 = ${high}`, 'if temp3 > 15 then temp3 = 15', 'if temp4 > 15 then temp4 = 15', 'temp4 = temp4 * 16', ...store.write(i, 'temp3 | temp4')]);
  // (The top and the bottom: a row each, a byte, as many rows as a high pfres has.)
  const row = (code, i) => store.write(i, code);
  return [...roomCall(Blockly), ...store.write(1, cx), ...store.write(2, cy), ...radiusCode,
    ...pack(padLeft, padRight, 4), ...row(padTop, 5), ...row(padBottom, 6), ...store.write(0, headerOf('circle', operation, spread ? 1 : 0)),
    ...(deferredSubmit(Blockly, spread) ? [`if ${Blockly.BBasic.pfDraw.state.read} = 0 then ${Blockly.BBasic.pfDraw.state.write} = 2`] :
      [callEngine(Blockly, 'submit')])].join('\n') + '\n';
};

// The centered area: each side worked out by _pfd_axis into the corners of an area record (nothing is submitted when a side has nothing left).
export const pfDrawCenteredAreaCode = (Blockly, operation, cx, cy, width, height, padLeft, padRight, padTop, padBottom) => {
  if (!ensurePfDraw(Blockly)) return '';
  const store = recordStore(Blockly.BBasic.pfDraw);
  const config = Blockly.BBasic.pfDraw.config;
  const skip = `_pfd_rect${Blockly.BBasic.blockNumbers.next('pfdrect')}`;
  const side = (center, size, low, high, max, first, lastIndex) => [`temp3 = ${center}`, `temp4 = ${size}`, `temp5 = ${low}`, `temp6 = ${high}`,
    `temp2 = ${max}`, callEngine(Blockly, 'axis'), `if temp3 > temp4 then goto ${skip}`, ...store.write(first, 'temp3'), ...store.write(lastIndex, 'temp4')];
  return [...roomCall(Blockly),
    ...side(cx, width, padLeft, padRight, pfMaxColumn(config), 1, 3),
    ...side(cy, height, padTop, padBottom, Blockly.BBasic.maxRowText(config), 2, 4),
    ...store.write(0, headerOf('area', operation)), callEngine(Blockly, 'submit'), `@ ${skip}`].join('\n') + '\n';
};

// The Set playfield draw speed block: the steps of drawing a frame may take (0: as many as the time left allows).
export const pfDrawSpeedCode = (Blockly, steps) => {
  if (!ensurePfDraw(Blockly) || !Blockly.BBasic.pfDraw.speed) return '';
  // (Held to 15; the other bits of the byte are kept.)
  const name = speedName(Blockly);
  const base = speedBase();
  const keep = 255 ^ (PFD_SPEED_MAX << base);
  const number = /^\d+$/.test(String(steps).trim()) ? Math.min(PFD_SPEED_MAX, Number(steps)) : null;
  if (number !== null) return [`${name} = ${name} & ${keep}`, ...(number ? [`${name} = ${name} | ${number << base}`] : [])].join('\n') + '\n';
  return [`temp1 = ${steps}`, `if temp1 > ${PFD_SPEED_MAX} then temp1 = ${PFD_SPEED_MAX}`, ...(base ? [`temp1 = temp1 * ${1 << base}`] : []),
    `${name} = ${name} & ${keep}`, `${name} = ${name} | temp1`].join('\n') + '\n';
};

export const pfDrawStopFillCode = (Blockly) => (ensurePfDraw(Blockly) ? callEngine(Blockly, 'stopfill') + '\n' : '');
// (index: the bit, 0 to 3 a side and 4 for every terrain.)
export const pfDrawTerrainDoneCode = (Blockly, index = 4) => (ensurePfDraw(Blockly) && Blockly.BBasic.pfDraw.terrainDone ?
  `(${terrainDoneName(Blockly)} & ${terrainDoneMask(index)})` : '0');
// (The bit 5 of the Terrain done flags: true for the frame after a playfield gravity finished.)
export const pfDrawGravityPulseCode = (Blockly) => (ensurePfDraw(Blockly) && Blockly.BBasic.pfDraw.terrainDone && Blockly.BBasic.pfDraw.kinds.has('gravity') ?
  `(${terrainDoneName(Blockly)} & ${terrainDoneMask(5)})` : '0');
export const pfDrawGravityDoneCode = (Blockly) => (ensurePfDraw(Blockly) ? `${callEngine(Blockly, 'gravdone')}
temp6` : '1');
export const pfDrawFillDoneCode = (Blockly) => (ensurePfDraw(Blockly) ? `${callEngine(Blockly, 'filldone')}\ntemp6` : '1');
