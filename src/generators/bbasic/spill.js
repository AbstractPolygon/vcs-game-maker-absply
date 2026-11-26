'use strict';

// Variables kept in the DPC+ display memory instead of the program's RAM (see displayRamVars in init() in generators/bbasic.js).
// The generated batari Basic names a variable in plain places only (a line that sets one or a bit of one, an if that tests them and
// jumps or does one simple statement), so a variable that is only ever used there can live in the display memory: a read is done into a
// scratch byte just before its line, a write goes through the same data fetcher just after. A variable used any other way (inside asm,
// in an array form, in a line of several statements, ...) is left where it is.

const TABLES = ['PF1L', 'PF2L', 'PF1R', 'PF2R', 'PFCOLS', 'BKCOLS'];
// The DPC+ stack's 256 bytes (STACKbegin to USERSTACK in DPCplusbB.h, after the tables) are a place too: area STACK_AREA, byte 0 the top of the stack.
// They are given from the top down, as the pushes of the stack work up from its bottom (see displayRamSpillLayout in generators/bbasic.js).
export const STACK_AREA = 6;
// The address of a place (an area and a byte): the upper half of a table, or a byte of the stack.
export const displayRamSlotAddress = ({area, byte}) => (area === STACK_AREA ? `STACKbegin+${byte}` : `${TABLES[area]}+${128 + byte}`);
// The two bytes a read leaves its value in. The lines between the read and the line that uses it are only that line, so nothing else is
// using them then.
const SCRATCH = ['temp5', 'temp6'];
// The byte a write takes its value from (a bit set goes through it as well).
const WRITE_SCRATCH = 'temp6';

const escapeName = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A name as a whole word (a bit of it, name{3}, counts as a use of it; an array form, name[2], is another thing).
// (The ones to test with are made once per name: the code has thousands of lines and tens of names.)
const testers = new Map();
const wordRegex = (name, flags = 'g') => {
  if (flags !== '') return new RegExp(`(?<![\\w{])${escapeName(name)}(?![\\w\\[])`, flags);
  if (!testers.has(name)) testers.set(name, new RegExp(`(?<![\\w{])${escapeName(name)}(?![\\w\\[])`));
  return testers.get(name);
};
const arrayTesters = new Map();
const arrayRegex = (name) => {
  if (!arrayTesters.has(name)) arrayTesters.set(name, new RegExp(`(?<![\\w])${escapeName(name)}\\[`));
  return arrayTesters.get(name);
};
const WORD = /[A-Za-z_]\w*/g;

const ASSIGNMENT = /^([A-Za-z_]\w*)\s*=\s*(.*)$/;
// A bit set or cleared by a constant: the byte is read, the bit changed in the copy, and the byte written back.
const BIT_ASSIGNMENT = /^([A-Za-z_]\w*)\{(\d)\}\s*=\s*([01])$/;
const JUMP = /^(goto|gosub)\s+[A-Za-z_]\w*(\s+bank\d+)?$/;

// What each line of the code is: inside an asm, data or function block (left alone), a comment or definition (ignored), or a statement.
const classifyLines = (code) => {
  let inBlock = false;
  let blockId = 0;
  let blockIsAsm = false;
  // (The templates the code comes from may have Windows line ends.)
  return code.split(/\r?\n/).map((line) => {
    const text = line.trim();
    if (inBlock) {
      if (text === 'end') inBlock = false;
      // (The lines of a coprocessor Fire call that name the bytes it reads where they are: filled in once the places are known, see resolveFireBatch in
      // generators/bbasic/offset-arm.js, so they are not a use.)
      if (text.startsWith(';FIRE')) return {line, kind: 'ignored'};
      return {line, kind: 'block', asm: blockIsAsm, block: blockId};
    }
    if (text === '' || /^rem\b/.test(text) || /^dim\s/.test(text) || text.startsWith(';')) return {line, kind: 'ignored'};
    if (/^(asm|data\s|function\s)/.test(text) || /^[A-Za-z_]\w*\s+asm$/.test(text) || (/:$/.test(text) && !/^if\b/.test(text))) {
      inBlock = true;
      blockId++;
      // (A label with the asm after it on the same line, as the animation code of a sprite starts, is a block too.)
      blockIsAsm = /^asm\b/.test(text) || /^[A-Za-z_]\w*\s+asm$/.test(text);
      return {line, kind: 'block', asm: blockIsAsm, block: blockId};
    }
    return {line, kind: 'statement'};
  });
};

// The lines of the code, what each is, its statement, and the words in it: kept for the last code looked at, since the choice of the
// variables to spill asks about the same code again and again.
let parsedCode = null;
let parsedEntries = null;
const entriesOf = (code) => {
  if (parsedCode === code) return parsedEntries;
  parsedEntries = classifyLines(code).map(({line, kind, asm, block}) => ({line, kind, asm, block, shape: kind === 'statement' ? shapeOf(line) : null,
    words: new Set(line.match(WORD) || [])}));
  parsedCode = code;
  return parsedEntries;
};

// One plain statement: a jump, a bit set by a constant, or an assignment.
const parseSimple = (text) => {
  const body = text.trim();
  if (JUMP.test(body)) return {type: 'jump', text: body};
  const bit = BIT_ASSIGNMENT.exec(body);
  if (bit) return {type: 'setbit', target: bit[1], bit: bit[2], value: bit[3]};
  const assignment = ASSIGNMENT.exec(body);
  if (assignment && !/\bthen\b/.test(body)) return {type: 'set', target: assignment[1], rhs: assignment[2]};
  return null;
};

// A line of the code as a statement, or null when it is not in a shape that can be rewritten: the plain statements, and an if that
// jumps or does one plain statement (and another after else).
const shapeOf = (line) => {
  // (Statements after an else, or after the then of an if, are part of it: a colon is allowed there only.)
  const thenAt = line.search(/\s+then\s+/);
  // (After an else, or after the then of an if: the statements that go with it.)
  if (line.includes(' : ') && !(/^\s*if\s/.test(line) && thenAt !== -1 && line.indexOf(' : ') > thenAt)) return null;
  const indent = /^\s*/.exec(line)[0];
  const body = line.trim();
  const conditional = /^if\s+(.+?)\s+then\s+(.+)$/.exec(body);
  if (conditional) {
    const [, cond, rest] = conditional;
    if (/\bthen\b/.test(cond)) return null;
    const split = rest.search(/\s+else\s+/);
    const thenText = split === -1 ? rest : rest.slice(0, split);
    const elseText = split === -1 ? null : rest.slice(split).replace(/^\s+else\s+/, '');
    const trueParts = thenText.split(' : ').map(parseSimple);
    const whenTrue = trueParts[0];
    const thenMore = trueParts.slice(1);
    const whenFalse = elseText === null ? null : elseText.split(' : ').map(parseSimple);
    if (!whenTrue || thenMore.some((simple) => !simple) || (whenFalse && whenFalse.some((simple) => !simple))) return null;
    if (whenTrue.type === 'jump' && !whenFalse && !thenMore.length) return {type: 'if', indent, cond, jump: whenTrue.text};
    // (A jump is the last statement: the ones after it would not run.)
    if ((whenTrue.type === 'jump' && thenMore.length) || thenMore.slice(0, -1).some((simple) => simple.type === 'jump')) return null;
    return {type: 'ifthen', indent, cond, whenTrue, thenMore, whenFalse};
  }
  if (/\bthen\b/.test(body)) return null;
  const simple = parseSimple(body);
  return simple ? {...simple, indent} : null;
};

// The texts of a statement a name is read in (each is evaluated by itself, so the names read in each are counted separately), and
// the names it writes.
const readTexts = (shape) => {
  if (shape.type === 'if') return [shape.cond];
  if (shape.type === 'ifthen') {
    return [shape.cond, ...[shape.whenTrue, ...(shape.thenMore || []), ...(shape.whenFalse || [])].map((simple) => (simple.type === 'set' ? simple.rhs : ''))];
  }
  return shape.type === 'set' ? [shape.rhs] : [];
};
const writtenNames = (shape) => {
  const simples = shape.type === 'ifthen' ? [shape.whenTrue, ...(shape.thenMore || []), ...(shape.whenFalse || [])] : [shape];
  return simples.filter((simple) => simple && (simple.type === 'set' || simple.type === 'setbit')).map((simple) => simple.target);
};

// A name that is only loaded (lda, ldx or ldy NAME) or stored (sta, stx or sty NAME) in an assembly block can be spilled too: a load sets the pointer of the
// data fetcher with the register it loads (the others are not touched) and reads it, a store writes it there with the accumulator and the flags kept. Not in a block that is timed (it writes the TIA, or waits for a line), that uses the same data
// fetcher itself, or where a branch could be pushed out of its reach by the lines added (a branch reaches 127 bytes, a spilled access is about 28).
// A test of one byte against a number or another byte, and the test that holds when it does not.
const INVERTIBLE = /^\s*([A-Za-z_]\w*)\s*(<>|<=|>=|=|<|>)\s*(\$?[A-Za-z0-9_]+)\s*$/;
const INVERSE = {'=': '<>', '<>': '=', '<': '>=', '>=': '<', '>': '<=', '<=': '>'};
const ASM_ACCESS =/^\s*(lda|ldx|ldy|sta|stx|sty|bit|cmp|cpx|cpy|adc|sbc|and|ora|eor)\s+([A-Za-z_]\w*)\s*(;.*)?$/;
// The ones that only read the byte for a calculation or a test (the instruction reads it from the data fetcher itself, with the accumulator kept on the
// stack while the pointer is set: the carry and the overflow flag are not touched before the instruction).
const ASM_READ_OPS = new Set(['bit', 'cmp', 'cpx', 'cpy', 'adc', 'sbc', 'and', 'ora', 'eor']);
// A line of an asm block that uses the X register (an instruction naming it, or an indexed address).
const X_REGISTER = /\b(ldx|stx|inx|dex|tax|txa|tsx|txs|cpx)\b|,\s*x\b/i;
const ASM_TIMED =/\b(WSYNC|RESP[01MB]|RESM[01]|RESBL|HMOVE|HMCLR|HMP[01]|HMM[01]|HMBL|VSYNC|VBLANK|TIM64T|TIM8T|INTIM|DF6\w*)\b/;
const ASM_IMPLIED = new Set(['rts', 'rti', 'pha', 'pla', 'php', 'plp', 'tax', 'txa', 'tay', 'tya', 'tsx', 'txs', 'inx', 'iny', 'dex', 'dey', 'asl', 'lsr', 'rol',
  'ror', 'clc', 'sec', 'cli', 'sei', 'cld', 'sed', 'clv', 'nop', 'brk', 'end']);
const ASM_BRANCH = /^(bcc|bcs|beq|bne|bmi|bpl|bvc|bvs)\s+([.@]?[A-Za-z_]\w*)/i;
// About how many bytes the lines that replace an access take (a load: the pointer and the read; a store: the flags and the accumulator kept, the pointer and the
// write; a read for a test or a calculation: the accumulator kept, the pointer and the instruction), with a margin.
const spillBytesOf = (op) => {
  const word = op.toLowerCase();
  if (word === 'lda' || word === 'ldx' || word === 'ldy') return 14;
  if (ASM_READ_OPS.has(word)) return 16;
  return 18;
};
// A load or store of one of the names that may be spilled (only those get the lines added).
const accessOf = (text, names) => {
  const access = ASM_ACCESS.exec(text);
  return access && names.includes(access[2]) ? access : null;
};
const asmLabelOf = (text) => {
  const m = /^[.@]?([A-Za-z_]\w*):?$/.exec(text);
  return m && !ASM_IMPLIED.has(m[1].toLowerCase()) ? m[1] : null;
};
const asmBytesOf = (text) => {
  if (!text || text.startsWith(';')) return 0;
  const word = text.split(/\s+/)[0].toLowerCase();
  if (asmLabelOf(text)) return 0;
  if (ASM_IMPLIED.has(word)) return 1;
  if (ASM_BRANCH.test(text)) return 2;
  if (word === '.byte') return text.split(',').length;
  if (word === 'jmp' || word === 'jsr') return 3;
  return /^\S+\s+#/.test(text) ? 2 : 3;
};
// For each asm block: whether it can be rewritten, and which of its lines are out of the reach of a branch with the lines a spill adds.
const asmBlocks = (entries, names) => {
  const blocks = new Map();
  entries.forEach((entry, i) => {
    if (entry.kind !== 'block' || !entry.asm) return;
    if (!blocks.has(entry.block)) blocks.set(entry.block, {lines: [], timed: false, tight: new Set()});
    const block = blocks.get(entry.block);
    block.lines.push(i);
    if (ASM_TIMED.test(entry.line.replace(/;.*$/, ''))) block.timed = true;
  });
  blocks.forEach((block) => {
    const texts = block.lines.map((i) => entries[i].line.replace(/;.*$/, '').trim());
    const labelAt = new Map();
    texts.forEach((text, k) => {
      const label = asmLabelOf(text);
      if (label) labelAt.set(label, k);
    });
    texts.forEach((text, k) => {
      const branch = ASM_BRANCH.exec(text);
      if (!branch || !labelAt.has(branch[2].replace(/^[.@]/, ''))) return;
      const target = labelAt.get(branch[2].replace(/^[.@]/, ''));
      const [from, to] = k < target ? [k, target] : [target, k];
      let bytes = 0;
      for (let j = from; j <= to; j++) {
        const access = accessOf(texts[j], names);
        bytes += asmBytesOf(texts[j]) + (access ? spillBytesOf(access[1]) : 0);
      }
      if (bytes > 110) for (let j = from; j <= to; j++) block.tight.add(block.lines[j]);
    });
  });
  return blocks;
};

// A plain "tempN = expression" (N of a scratch byte) whose expression does not read the other scratch byte or itself: a name in the expression can be
// read into that byte, since the statement overwrites it.
const selfScratch = (shape) => !!shape && shape.type === 'set' && SCRATCH.includes(shape.target) &&
  !SCRATCH.some((scratch) => wordRegex(scratch, '').test(shape.rhs));

// Which of the names can be spilled, and how many lines each is used in.
// How often a line runs, as a weight for the uses of a name in it: the code of the main loop and of what it calls on every pass counts for more than the code
// of the events that run once, because a use of a spilled name costs its cycles on each run. The first label of a section decides (the code has no other marks):
// the labels in the two lists below, the others keep what the section before them had. The exchanges and steps of a sprite pool (and the body
// they call) count as every frame code even when an event that seldom happens calls them: a spawn makes the frame it is in the longest one (measured
// on Bricks of Olympus 0-0-25: with the spawn's animation and color bytes in the display memory, 30 per cent more lines past the frame end, though
// the frames on average had fewer display memory reads).
const HOT_WEIGHT = 100;
const HOT_LABELS = /^(main|commongamelogic|_fire_checks|_seek_checks|_lock_checks|_inertia_checks|_platformer_checks|_sprite_box_checks|_pfbox_|_run_once_edge_reset|_poolanim|_poolswap_|_poolstep_|_bouncestage|_bouncepix|_missilefire|_gravity_checks)/;
const COLD_LABELS = /^(_program_setup|system_start|title_|gameover_|gameplay_start|_dpc_score_font|resetGameVars|_background_load|_background_rainbow_restore|__dpcplus|fullgameloop|_titlestep)/;
// Bytes that hold a value only around a rare event, wherever their code sits: a Function's arguments and result (set at a call, read in its body),
// and where Find playfield pixel found a pixel (a hit). The section weights above take their code in the main loop for code that runs every frame,
// so they kept these in the RAM and sent counters that do run every frame (an every N frames event's, Fire's speed) to the display memory: measured
// on Bricks of Olympus, about 0.1 uses a frame for these against 2 to 4 for those. Their uses count once.
const RARE_NAMES = /^(fnParam\d+|fnCallValue\d+|functionCallResult|collisionPixel(Column|Row)2?)$/;
const rare = (name) => RARE_NAMES.test(name);
const weightOf = (name, weight) => (rare(name) ? 1 : weight);
// The frame counter's tick (the template's first line of commongamelogic) runs on every frame without a test: it counts for four, as a line of
// the main loop that may be skipped stands for one in about four frames. (The checks of the every N frames events read the counter too.)
const EVERY_FRAME_LINE = /^\s*framecounter\s*=\s*framecounter\s*\+\s*1\b/;
// A label that a gosub or goto reaches takes the weight of the lines that reach it (the most of them), not the one of the section the text puts
// before it: the code the bank layout moves (an animation, a subroutine, a check) sits after whatever unit the layout put before it, and took that
// unit's weight, so the same code counted as running on every frame in one build and once in another, and any change of the code's size could
// send a name used on every frame to the display memory. (Repeated for the labels reached from code that a label reached gets its weight from.) A
// jump inside an if counts for a quarter, as the names of a then-only line do; a label the line before can fall into keeps that weight too. The
// lines of a Function count as code here (its labels, its gosubs), the Function takes the weight of the lines that call it, and the jmp and jsr
// of an asm block reach their labels too.
const isCodeLine = (kind, asm) => kind === 'statement' || (kind === 'block' && !asm);
const isSectionLabel = (line, kind, asm) => isCodeLine(kind, asm) && /^[A-Za-z_]\w*$/.test(line) && !/^(end|return|asm|else|endif)$/.test(line);
const REACH = /\b(?:gosub|goto)\s+([A-Za-z_]\w*)/g;
const ASM_REACH = /^\s*(?:jmp|jsr)\s+\.?([A-Za-z_]\w*)/;
const FUNCTION_START = /^\s*function\s+([A-Za-z_]\w*)/;
// An on ... goto (or gosub) list: one of its labels is reached each time the line runs, so each takes a share of the line's weight, and the line
// after an on ... goto is not fallen into. (Before, only the first label of the list was seen as reached: the others kept the weight of the code
// before them, so the copies of a player in a playfield box test, one of which runs, counted as all running.)
const ON_JUMP = /^on\s+.+?\s+(goto|gosub)\s+([A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)*)\s*$/;
// The labels the blocks of the project jump to over their bodies (If, Every N frames, Run once, a scene test). Not the ones of the routines the
// generator writes itself: those mostly jump over the rest when there is nothing to do (the text blink, the platformer checks when the player did not
// move), and the lines after the test are the ones that run on most frames (measured on Bricks of Olympus: quartering them sent textBlink, read
// about 3 times a frame, and collisionOldY0, 2.5, to the display memory).
const SKIP_LABELS = /^_(if_\d+_(end|else)|frame_every_n_\d+_end|run_once_\d+_end|scene_if_\d+_done)$/;
const lineWeights = (lines) => {
  const functionNames = new Set(lines.map(({line}) => FUNCTION_START.exec(line)).filter(Boolean).map((match) => match[1]));
  const callsOf = (line) => [...line.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((match) => match[1]).filter((name) => functionNames.has(name));
  const labelAt = new Map();
  lines.forEach(({line, kind, asm}, i) => {
    if (isSectionLabel(line, kind, asm) && !labelAt.has(line)) labelAt.set(line, i);
  });
  let reached = new Map();
  // (The labels only an on list reaches: one inside a routine of the list above takes its share, not the routine's weight.)
  let listedOnly = new Set();
  let weights = [];
  for (let round = 0; round < 6; round++) {
    let weight = 1;
    let fallsIn = true;
    // The ifs that jump forward over the lines after them (the body of an If block, of an every N frames event, of a collision event: the test is
    // made the other way round, to jump over it) still to reach their label: the lines in between run on some of the passes only, a quarter as the
    // lines a jump in an if reaches, and the label after them takes back the weight the if had. (Before, the body kept the full weight of the code
    // around it, so a Function or a subroutine called from an event that seldom happens counted as running on every frame, and the names it used
    // stayed in the RAM while names read on every frame went to the display memory.)
    let skips = [];
    weights = lines.map(({line, kind, asm}, i) => {
      const functionStart = FUNCTION_START.exec(line);
      if (functionStart && reached.has(functionStart[1])) {
        weight = reached.get(functionStart[1]);
        skips = [];
      } else if (isSectionLabel(line, kind, asm)) {
        const hot = HOT_LABELS.test(line) && !listedOnly.has(line);
        const cold = !hot && COLD_LABELS.test(line);
        if (hot) weight = HOT_WEIGHT;
        else if (cold) weight = 1;
        else if (reached.has(line)) weight = Math.max(fallsIn ? weight : 0, reached.get(line));
        if (hot || cold) skips = [];
        else {
          skips.filter((skip) => skip.at === i).forEach((skip) => {
            weight = Math.max(weight, skip.weight);
          });
          skips = skips.filter((skip) => skip.at > i);
        }
      }
      const here = kind === 'statement' && EVERY_FRAME_LINE.test(line) ? 4 * HOT_WEIGHT : weight;
      if (isCodeLine(kind, asm)) {
        // (The end label the generator puts after a subroutine's return is not a way in: the next subroutine's label, after it, took the weight
        // of the one before through it, so a Function called from a seldom event counted as often as the pool step routine the layout put before it.)
        if (!(fallsIn === false && /__end$/.test(line.trim()))) fallsIn = !/^(goto|return)\b/.test(line.trim());
        const on = ON_JUMP.exec(line.trim());
        if (on && on[1] === 'goto') fallsIn = false;
        const skip = /^if\b.*\bthen\s+goto\s+([A-Za-z_]\w*)\s*$/.exec(line.trim());
        if (skip && SKIP_LABELS.test(skip[1]) && labelAt.get(skip[1]) > i) {
          skips.push({at: labelAt.get(skip[1]), weight});
          weight = Math.max(1, Math.round(weight / 4));
        }
      } else if (kind === 'block') fallsIn = true;
      return here;
    });
    const next = new Map();
    const listed = new Set();
    const jumped = new Set();
    const reach = (label, share, fromList = false) => {
      next.set(label, Math.max(next.get(label) || 0, share));
      (fromList ? listed : jumped).add(label);
    };
    lines.forEach(({line, kind, asm}, i) => {
      if (kind === 'block' && asm) {
        const match = ASM_REACH.exec(line);
        if (match) reach(match[1], weights[i]);
        return;
      }
      if (!isCodeLine(kind, asm)) return;
      const share = /^if\b/.test(line.trim()) ? Math.max(1, Math.round(weights[i] / 4)) : weights[i];
      const on = ON_JUMP.exec(line.trim());
      if (on) {
        const targets = on[2].split(/\s+/);
        targets.forEach((label) => reach(label, Math.max(1, Math.round(share / targets.length)), true));
      } else {
        for (const match of line.matchAll(REACH)) reach(match[1], share);
      }
      callsOf(line).forEach((name) => reach(name, share));
    });
    const nextListedOnly = new Set([...listed].filter((label) => !jumped.has(label)));
    if (next.size === reached.size && [...next].every(([label, value]) => reached.get(label) === value) &&
        nextListedOnly.size === listedOnly.size && [...nextListedOnly].every((label) => listedOnly.has(label))) break;
    reached = next;
    listedOnly = nextListedOnly;
  }
  return weights;
};

const analyze = (code, names) => {
  const lines = entriesOf(code);
  const weights = lineWeights(lines);
  const usage = new Map(names.map((name) => [name, {uses: 0, ok: true, why: []}]));
  const lines5 = new Set();
  const lines6 = new Set();
  lines.forEach(({kind, words}, i) => {
    if (kind !== 'statement') return;
    if (words.has('temp5')) lines5.add(i);
    if (words.has('temp6')) lines6.add(i);
  });
  const near = (list, i, includeSame) => [i - 1, i + 1, ...(includeSame ? [i] : [])].some((j) => list.has(j));
  const blocks = asmBlocks(lines, names);
  lines.forEach(({line, kind, shape, words, asm, block}, i) => {
    if (kind === 'ignored') return;
    names.filter((name) => words.has(name)).forEach((name) => {
      if (!wordRegex(name, '').test(line) && !arrayRegex(name).test(line)) return;
      const entry = usage.get(name);
      const fail = (why) => {
        entry.ok = false;
        if (entry.why.length < 3) entry.why.push(`${why}: ${line.trim().slice(0, 60)}`);
      };
      if (kind === 'block' && asm && !arrayRegex(name).test(line)) {
        const access = ASM_ACCESS.exec(line);
        const info = blocks.get(block);
        if (!access || access[2] !== name) return fail('block');
        if (info.timed) return fail('timed block');
        if (info.tight.has(i)) return fail('branch range');
        entry.uses += weightOf(name, weights[i]);
        return;
      }
      if (kind === 'block' || arrayRegex(name).test(line)) return fail(kind);
      // (A name used only after the then of an if, not in its test, is used when the test holds: a quarter of the passes the line runs on.)
      const onlyWhenTrue = shape && shape.type === 'ifthen' && !wordRegex(name, '').test(shape.cond);
      entry.uses += onlyWhenTrue ? Math.max(1, Math.round(weightOf(name, weights[i]) / 4)) : weightOf(name, weights[i]);
      if (!shape) return fail('shape');
      const writes = writtenNames(shape).includes(name);
      const reads = readTexts(shape).some((text) => wordRegex(name, '').test(text));
      // Next to a line that keeps something in the bytes the rewritten line leaves its values in. (Not a plain statement that sets one of those
      // bytes itself from the name and no other scratch byte: the name is read into that byte, which the statement sets anyway.)
      if (reads && !selfScratch(shape) && (near(lines5, i, true) || near(lines6, i, true))) fail('scratch');
      else if (writes && near(lines6, i, false)) fail('scratch');
    });
  });
  return usage;
};

// How many of the chosen names each statement reads: at most the scratch bytes there are.
const readsOk = (code, chosen) => entriesOf(code).every(({kind, shape, words}) => {
  if (kind !== 'statement' || !shape) return true;
  const here = chosen.filter((name) => words.has(name));
  if (selfScratch(shape) && here.filter((name) => wordRegex(name, '').test(shape.rhs)).length > 1) return false;
  if (here.length <= SCRATCH.length) return true;
  return readTexts(shape).every((text) => here.filter((name) => wordRegex(name, '').test(text)).length <= SCRATCH.length);
});

// Picks `count` of the names to spill: the ones used in the fewest places, among the ones that can be. Null when there are not enough
// (with `partial`, as many as there are, up to `count`). Every use of a spilled name costs about a dozen bytes of code and as many
// cycles, so beyond the first `required` names only the ones that keep the total of their uses within `useBudget` are taken (counting
// only the `budgeted` names, when given).
export const chooseSpill = (code, names, count, partial = false, useBudget = Infinity, required = count, budgeted = null) => {
  if (count <= 0) return new Set();
  const usage = analyze(code, names);
  const candidates = names.filter((name) => usage.get(name).ok && usage.get(name).uses > 0)
      .sort((a, b) => usage.get(a).uses - usage.get(b).uses);
  const chosen = [];
  let uses = 0;
  for (const name of candidates) {
    if (chosen.length >= count) break;
    const counted = !budgeted || budgeted.has(name);
    if (counted && chosen.length >= required && uses + usage.get(name).uses > useBudget) continue;
    if (readsOk(code, [...chosen, name])) {
      chosen.push(name);
      if (counted) uses += usage.get(name).uses;
    }
  }
  return (partial || chosen.length >= count) ? new Set(chosen) : null;
};

// The names that can go in the display memory, however few uses they have (chooseSpill leaves out the unused ones, as they free nothing): the bytes the
// coprocessor reads there itself (see fireStatePlan in generators/bbasic.js). In order, each as long as the statements still read no more of them than there
// are scratch bytes.
export const chooseAllSpillable = (code, names) => {
  const usage = analyze(code, names);
  const chosen = [];
  names.filter((name) => usage.get(name).ok).forEach((name) => {
    if (readsOk(code, [...chosen, name])) chosen.push(name);
  });
  return new Set(chosen);
};

// A number written out in the code (decimal, $hex or %binary): it can be loaded straight into the accumulator.
const LITERAL = /^(\d+|\$[0-9A-Fa-f]+|%[01]+)$/;
// A value that is a name, or a name and a number with one of these (see the direct copy in applySpill), and the instructions after the load
// (one that ends in a space takes the number).
const DIRECT_COPY = /^([A-Za-z_]\w*)(?:\s*([&|^+-])\s*(\d+|\$[0-9A-Fa-f]+|%[01]+))?$/;
const DIRECT_OPS = {'&': ['and '], '|': ['ora '], '^': ['eor '], '+': ['clc', 'adc '], '-': ['sec', 'sbc ']};
// Setting the pointer again after a read or a write moved it on by one byte: only the low byte changes, unless the byte was the last
// of the page (the carry went into the high byte).
const resetLines = (indent, slot) => {
  const address = displayRamSlotAddress(slot);
  return [`${indent}ldx #<(${address})`, `${indent}stx DF6LOW`,
    ...(slot.byte === 127 ? [`${indent}ldy #(>(${address})) & $0F`, `${indent}sty DF6HI`] : [])];
};

const pointerLines = (indent, {area, byte}) => {
  const address = displayRamSlotAddress({area, byte});
  return [`${indent}lda #<(${address})`, `${indent}sta DF6LOW`, `${indent}lda #(>(${address})) & $0F`, `${indent}sta DF6HI`];
};

// The lines that set two data fetchers (a read one and a write one, so that reading does not move the one that writes) to the byte of a spilled name: the
// exchange of two bytes (see exchangeRunLines) reads through the first and writes through the second.
const fetcherPointerLines = (indent, {area, byte}, readFetcher, writeFetcher) => {
  const address = displayRamSlotAddress({area, byte});
  return [`${indent}lda #<(${address})`, `${indent}sta DF${readFetcher}LOW`, `${indent}sta DF${writeFetcher}LOW`,
    `${indent}lda #(>(${address})) & $0F`, `${indent}sta DF${readFetcher}HI`, `${indent}sta DF${writeFetcher}HI`];
};

// A run of exchanges one after the other (each lda A, ldx B, sta B, stx A, the exchanges the pools make: {a, b, original: its four lines}), when one byte or both
// of some of them are spilled: the display memory is read and written through the data fetchers 0 and 1 (the first side: one reads, one writes, so reading does
// not move the one that writes) and 2 and 3 (the second side), not through the generic rewrite of each access (a load and a store of a spilled name take 13 and
// 17 bytes). A and X are the registers the four lines use already, and Y is not touched. The exchanges do not depend on each other, so the ones with a byte in
// the display memory are put in the order of the addresses (of the second side's byte, or the first's when the second is not there), and a side whose byte
// follows the one its fetchers were last at (they move on by one after each read and write) is not pointed again: 16 cycles and 10 bytes less for each side
// that goes on (the exchanges of a Sprite pool's sprites, whose bytes are given in that order: see the spill plan's order in generators/bbasic.js). Null when
// no byte of the run is spilled.
const exchangeRunLines = (indent, run, slots) => {
  if (!run.some(({a, b}) => slots.has(a) || slots.has(b))) return null;
  const lines = [];
  const at = {a: null, b: null};
  const sameByte = (x, y) => !!x && !!y && x.area === y.area && x.byte === y.byte;
  const point = (side, slot) => {
    if (!sameByte(at[side], slot)) lines.push(...fetcherPointerLines(indent, slot, side === 'a' ? 0 : 2, side === 'a' ? 1 : 3));
    at[side] = {area: slot.area, byte: slot.byte + 1};
  };
  const keyOf = ({slotA, slotB}) => slotB || slotA;
  run.filter(({a, b}) => slots.has(a) || slots.has(b)).map((exchange) => ({...exchange, slotA: slots.get(exchange.a), slotB: slots.get(exchange.b)}))
      .sort((x, y) => (keyOf(x).area === keyOf(y).area ? keyOf(x).byte - keyOf(y).byte : (keyOf(x).area < keyOf(y).area ? -1 : 1)))
      .forEach(({a, b, slotA, slotB}) => {
        if (slotA) point('a', slotA);
        if (slotB) point('b', slotB);
        if (slotA && slotB) lines.push(`${indent}lda DF0DATA`, `${indent}ldx DF2DATA`, `${indent}stx DF1WRITE`, `${indent}sta DF3WRITE`);
        else if (slotA) lines.push(`${indent}lda DF0DATA`, `${indent}ldx ${b}`, `${indent}stx DF1WRITE`, `${indent}sta ${b}`);
        else lines.push(`${indent}lda ${a}`, `${indent}ldx DF2DATA`, `${indent}sta DF3WRITE`, `${indent}stx ${a}`);
      });
  run.filter(({a, b}) => !slots.has(a) && !slots.has(b)).forEach(({original}) => lines.push(...original));
  return lines;
};

// A test of one spilled name that jumps with a goto in the same bank (name = number, name <> number, name{bit}, !name{bit}, name, !name), as
// assembly: the pointer, the read into the accumulator, a compare or a mask, a branch past the jump when the test fails, and the jump to the
// label (batari Basic's labels are .label in the assembly). 6 cycles and 4 bytes less than the read into a scratch byte and the statement.
// Null for any other test.
const TEST_COMPARE = /^([A-Za-z_]\w*)\s*(=|<>)\s*(\d+|\$[0-9A-Fa-f]+|%[01]+)$/;
const TEST_BIT = /^(!?)([A-Za-z_]\w*)(?:\{([0-7])\})?$/;
const literalValue = (text) => (text.startsWith('$') ? parseInt(text.slice(1), 16) : text.startsWith('%') ? parseInt(text.slice(1), 2) : Number(text));
const testLines = (shape, slots, id) => {
  const jump = /^goto\s+([A-Za-z_]\w*)$/.exec(shape.jump.trim());
  if (!jump) return null;
  const cond = shape.cond.trim();
  const compare = TEST_COMPARE.exec(cond);
  const bit = compare ? null : TEST_BIT.exec(cond);
  const name = compare ? compare[1] : bit ? bit[2] : null;
  if (!name || !slots.has(name)) return null;
  const skip = `_spltest_${id}`;
  const check = compare ?
    [...(literalValue(compare[3]) === 0 ? [] : [`cmp #${compare[3]}`]), `${compare[2] === '=' ? 'bne' : 'beq'} ${skip}`] :
    [...(bit[3] === undefined ? [] : [`and #${1 << Number(bit[3])}`]), `${bit[1] ? 'bne' : 'beq'} ${skip}`];
  const indent = shape.indent;
  return [`${indent}asm`, ...pointerLines(indent, slots.get(name)), `${indent}lda DF6DATA`, ...check.map((line) => `${indent}${line}`),
    `${indent}jmp .${jump[1]}`, skip, 'end'];
};

// The code with the names in `slots` (name -> {area, byte}) read and written through the display memory.
export const applySpill = (code, slots) => {
  const names = [...slots.keys()];
  const out = [];
  let labelCount = 0;
  // The names a store can set as a byte: not the score (three bytes), a fixed point variable (dim name = a.b) or a def.
  const special = new Set(['score']);
  code.split('\n').forEach((line) => {
    const dim = /^\s*dim\s+([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(line);
    if (dim && /\./.test(dim[2])) special.add(dim[1]);
    const def = /^\s*def\s+([A-Za-z_]\w*)/.exec(line);
    if (def) special.add(def[1]);
  });
  const plainTargets = (name) => !special.has(name) && !SCRATCH.includes(name);
  // The lines that bring the names `text` reads into the scratch bytes, and the text with them put in place of the names.
  const readsIn = (text, indent, preferred = null) => {
    const pre = [];
    let replaced = text;
    // (A statement that sets a scratch byte is read into that one.)
    const order = preferred ? [preferred, ...SCRATCH.filter((scratch) => scratch !== preferred)] : SCRATCH;
    names.filter((name) => wordRegex(name, '').test(text)).forEach((name, index) => {
      pre.push(`${indent}asm`, ...pointerLines(indent, slots.get(name)), `${indent}lda DF6DATA`, `${indent}sta ${order[index]}`, 'end');
      replaced = replaced.replace(wordRegex(name), order[index]);
    });
    return {pre, text: replaced};
  };
  // The lines of one plain statement.
  const simpleLines = (simple, indent) => {
    if (simple.type === 'jump') return [`${indent}${simple.text}`];
    if (simple.type === 'setbit') {
      if (!slots.has(simple.target)) return [`${indent}${simple.target}{${simple.bit}} = ${simple.value}`];
      const mask = 1 << Number(simple.bit);
      return [`${indent}asm`, ...pointerLines(indent, slots.get(simple.target)), `${indent}lda DF6DATA`,
        simple.value === '1' ? `${indent}ora #${mask}` : `${indent}and #${255 - mask}`,
        ...resetLines(indent, slots.get(simple.target)), `${indent}sta DF6WRITE`, 'end'];
    }
    // (Without a comment after the value: the frame counter's tick has one, see SYSTEM_DEFAULT_MARKER in generators/bbasic.js.)
    const value = simple.rhs.replace(/\s*;.*$/, '').trim();
    if (slots.has(simple.target) && LITERAL.test(value)) {
      return [`${indent}asm`, ...pointerLines(indent, slots.get(simple.target)), `${indent}lda #${value}`, `${indent}sta DF6WRITE`, 'end'];
    }
    // name = name + 1 (or - 3, ...): one read and one write, the value kept in the accumulator in between.
    const step = slots.has(simple.target) ?
      new RegExp(`^${escapeName(simple.target)}\\s*([+-])\\s*(\\d+)$`).exec(value) : null;
    if (step) {
      return [`${indent}asm`, ...pointerLines(indent, slots.get(simple.target)), `${indent}lda DF6DATA`,
        `${indent}${step[1] === '+' ? 'clc' : 'sec'}`, `${indent}${step[1] === '+' ? 'adc' : 'sbc'} #${step[2]}`,
        ...resetLines(indent, slots.get(simple.target)), `${indent}sta DF6WRITE`, 'end'];
    }
    // target = name (or name & 15, name + 1, ...), the name spilled and the target a plain byte: read into the accumulator and stored there,
    // not through a scratch byte and the statement (6 cycles and 4 bytes less; the colors commongamelogic writes every frame, for one).
    const direct = !slots.has(simple.target) && plainTargets(simple.target) ? DIRECT_COPY.exec(value) : null;
    if (direct && slots.has(direct[1])) {
      const op = direct[2] ? DIRECT_OPS[direct[2]] : [];
      return [`${indent}asm`, ...pointerLines(indent, slots.get(direct[1])), `${indent}lda DF6DATA`,
        ...op.map((word) => (word.endsWith(' ') ? `${indent}${word}#${direct[3]}` : `${indent}${word}`)), `${indent}sta ${simple.target}`, 'end'];
    }
    const {pre, text} = readsIn(simple.rhs, indent, selfScratch(simple) ? simple.target : null);
    if (!slots.has(simple.target)) return [...pre, `${indent}${simple.target} = ${text}`];
    return [...pre, `${indent}${WRITE_SCRATCH} = ${text}`, `${indent}asm`, ...pointerLines(indent, slots.get(simple.target)),
      `${indent}lda ${WRITE_SCRATCH}`, `${indent}sta DF6WRITE`, 'end'];
  };
  const entries = entriesOf(code);
  // Whether the line before entry `at` is a load of the accumulator with a number or a byte that is not in the display memory, in the same block of
  // assembly, put out as it was (not a data fetcher: the pointer lines move one, and the load is put after them).
  const loadedBefore = (at) => {
    const before = entries[at - 1];
    if (!before || before.kind !== 'block' || !before.asm || before.block !== entries[at].block || out[out.length - 1] !== before.line) return false;
    const load = /^\s*lda\s+(#\S.*?|[A-Za-z_][\w.+]*(?:,[xy])?)\s*(;.*)?$/i.exec(before.line);
    return !!load && !/DF\d|DF[A-Z]/.test(load[1]) && !slots.has(load[1].replace(/,[xy]$/i, ''));
  };
  const spilledIn = (text) => names.filter((name) => wordRegex(name, '').test(text));
  // A label that only the jumps of tests reach, each with the same bytes holding the same names, and that the line before it does not
  // run into (a goto), is entered with those bytes still holding them: the test that follows it need not read them again (the frame checks
  // of an animation, one after another, test the same counter). The words of the code are counted for that, to know every jump to a label.
  const wordCounts = new Map();
  entries.forEach(({line, kind}) => {
    if (kind === 'ignored') return;
    (line.match(WORD) || []).forEach((word) => wordCounts.set(word, (wordCounts.get(word) || 0) + 1));
  });
  const carried = new Map();
  const labelOf = (entry) => (entry.kind === 'statement' && !entry.shape && /^[A-Za-z_]\w*$/.test(entry.line.trim()) ? entry.line.trim() : null);
  let held = null;
  let previous = null;
  // A line that tests variables in the display memory and jumps away (or on) leaves the bytes it read where they are, so the tests that
  // follow it one after another (a long chain of "if x = 3 then goto ...", as the fades make) read each variable once, not for every line.
  const isTest = (entry) => entry.shape && entry.shape.type === 'if' && spilledIn(entry.shape.cond).length > 0;
  for (let at = 0; at < entries.length; at++) {
    const {line, shape, words} = entries[at];
    if (entries[at].kind === 'ignored') {
      out.push(line);
      continue;
    }
    if (entries[at].kind === 'block' && entries[at].asm) {
      const access = ASM_ACCESS.exec(line);
      // An exchange of two bytes with one of them spilled: the four lines together (and the exchanges that follow it one after the other, see exchangeRunLines).
      const exchangeAt = (from) => {
        if (from + 3 >= entries.length) return null;
        const group = [0, 1, 2, 3].map((k) => (entries[from + k].kind === 'block' && entries[from + k].asm && entries[from + k].block === entries[at].block ?
          ASM_ACCESS.exec(entries[from + k].line) : null));
        if (group.every(Boolean) && group[0][1].toLowerCase() === 'lda' && group[1][1].toLowerCase() === 'ldx' && group[2][1].toLowerCase() === 'sta' &&
            group[3][1].toLowerCase() === 'stx' && group[1][2] === group[2][2] && group[0][2] === group[3][2] && group[0][2] !== group[1][2]) {
          return {a: group[0][2], b: group[1][2], original: [0, 1, 2, 3].map((k) => entries[from + k].line)};
        }
        return null;
      };
      if (access && access[1].toLowerCase() === 'lda' && exchangeAt(at)) {
        const run = [];
        for (let group = exchangeAt(at); group; group = exchangeAt(at + 4 * run.length)) run.push(group);
        const lines = exchangeRunLines(/^\s*/.exec(line)[0], run, slots);
        if (lines) {
          out.push(...lines);
          at += 4 * run.length - 1;
          held = null;
          previous = entries[at];
          continue;
        }
      }
      if (access && slots.has(access[2])) {
        const indent = /^\s*/.exec(line)[0];
        // A load: the pointer is put where the name is and the value read (the accumulator is the destination anyway). A store: the
        // accumulator and the flags are kept on the stack while the pointer is set, and the flags come back after the write.
        const op = access[1].toLowerCase();
        const slot = slots.get(access[2]);
        if (op === 'lda') {
          out.push(...pointerLines(indent, slot), `${indent}lda DF6DATA`);
        } else if (op === 'ldx' || op === 'ldy') {
          // (The register that is loaded sets the pointer: A, the other register and the carry are as they were.)
          const r = op.slice(2);
          const address = displayRamSlotAddress(slot);
          const loadLines = [`${indent}ld${r} #<(${address})`, `${indent}st${r} DF6LOW`, `${indent}ld${r} #(>(${address})) & $0F`, `${indent}st${r} DF6HI`];
          out.push(...loadLines, `${indent}ld${r} DF6DATA`);
        } else if (ASM_READ_OPS.has(op)) {
          // The pointer goes through X when the block never uses X (A, the carry and the overflow flag stay as they are, and the pha and pla, 7 cycles,
          // are not needed); else the accumulator is kept on the stack.
          const usesX = entries.some((other) => other.kind === 'block' && other.asm && other.block === entries[at].block && X_REGISTER.test(other.line));
          if (!usesX && op !== 'cpx') {
            const address = displayRamSlotAddress(slot);
            out.push(`${indent}ldx #<(${address})`, `${indent}stx DF6LOW`, `${indent}ldx #(>(${address})) & $0F`, `${indent}stx DF6HI`, `${indent}${op} DF6DATA`);
          } else {
            out.push(`${indent}pha`, ...pointerLines(indent, slot), `${indent}pla`, `${indent}${op} DF6DATA`);
          }
        } else if (op === 'sta' && loadedBefore(at)) {
          // Right after a load of a number or a plain byte: the load is made again after the pointer lines, which leaves the accumulator and the flags as
          // the load did, without keeping them on the stack (14 cycles and 4 bytes less).
          const load = out.pop();
          out.push(...pointerLines(indent, slot), load, `${indent}sta DF6WRITE`);
        } else if (op === 'sta') {
          out.push(`${indent}php`, `${indent}pha`, ...pointerLines(indent, slot), `${indent}pla`, `${indent}sta DF6WRITE`, `${indent}plp`);
        } else {
          // (stx and sty: the register is not touched by the pointer lines, which use A, kept on the stack with the flags.)
          out.push(`${indent}php`, `${indent}pha`, ...pointerLines(indent, slot), `${indent}${op} DF6WRITE`, `${indent}pla`, `${indent}plp`);
        }

        held = null;
        previous = entries[at];
        continue;
      }
    }
    const label = labelOf(entries[at]);
    const reached = held;
    held = null;
    if (label) {
      const mine = carried.get(label);
      const lastJump = previous && previous.shape && previous.shape.type === 'jump' && /^goto\b/.test(previous.shape.text);
      if (mine && mine.where && lastJump && wordCounts.get(label) === mine.count + 1) held = mine.where;
    }
    previous = entries[at];
    if (label || !shape || !names.some((name) => words.has(name) && wordRegex(name, '').test(line))) {
      out.push(line);
      if (!label) held = null;
      continue;
    }
    if (isTest(entries[at])) {
      // The run of tests: lines that are only comments or blank are let through, anything else ends it (a goto leaves the bytes
      // valid for the next test; a gosub does not, so it is the last of a run).
      const run = [at];
      const union = new Set(spilledIn(shape.cond));
      let next = at + 1;
      while (!/^gosub\b/.test(entries[run[run.length - 1]].shape.jump)) {
        while (next < entries.length && entries[next].kind === 'ignored') next++;
        if (next >= entries.length || !isTest(entries[next])) break;
        const more = new Set([...union, ...spilledIn(entries[next].shape.cond)]);
        if (more.size > SCRATCH.length) break;
        more.forEach((name) => union.add(name));
        run.push(next);
        next++;
      }
      // (Arriving from a test that read them already, the bytes hold the names still.)
      const reuse = reached && [...union].every((name) => reached.has(name));
      // A single test, not in a run, that jumps in the same bank: in assembly, the byte read into the accumulator and tested there (see testLines).
      const alone = run.length === 1 && !reuse ? testLines(shape, slots, labelCount) : null;
      if (alone) {
        labelCount++;
        out.push(...alone);
        for (let k = at + 1; k < next; k++) out.push(entries[k].line);
        at = next - 1;
        continue;
      }
      const where = reuse ? new Map(reached) : new Map([...union].map((name, index) => [name, SCRATCH[index]]));
      if (!reuse) {
        [...union].forEach((name) => out.push(`${shape.indent}asm`, ...pointerLines(shape.indent, slots.get(name)),
            `${shape.indent}lda DF6DATA`, `${shape.indent}sta ${where.get(name)}`, 'end'));
      }
      for (let k = at; k < next; k++) {
        const entry = entries[k];
        if (!run.includes(k)) {
          out.push(entry.line);
          continue;
        }
        let cond = entry.shape.cond;
        where.forEach((scratch, name) => {
          cond = cond.replace(wordRegex(name), scratch);
        });
        const jumpTo = /^goto\s+([A-Za-z_]\w*)(\s+bank\d+)?$/.exec(entry.shape.jump);
        if (jumpTo && !jumpTo[2]) {
          const key = JSON.stringify([...where]);
          const mine = carried.get(jumpTo[1]);
          if (!mine) carried.set(jumpTo[1], {where, key, count: 1});
          else if (mine.key === key) mine.count++;
          else mine.where = null;
        }
        out.push(`${entry.shape.indent}if ${cond} then ${entry.shape.jump}`);
      }
      at = next - 1;
      continue;
    }
    if (shape.type === 'if') {
      const {pre, text} = readsIn(shape.cond, shape.indent);
      out.push(...pre, `${shape.indent}if ${text} then ${shape.jump}`);
    } else if (shape.type === 'ifthen') {
      const {pre, text} = readsIn(shape.cond, shape.indent);
      const id = labelCount++;
      const trueOnly = !(shape.whenFalse || []).length ? INVERTIBLE.exec(text) : null;
      if (trueOnly) {
        // Nothing to do when the test fails: the opposite test jumps past the statements (one jump less, 3 bytes).
        out.push(...pre, `${shape.indent}if ${trueOnly[1]} ${INVERSE[trueOnly[2]]} ${trueOnly[3]} then goto _spl_${id}_e`,
            ...simpleLines(shape.whenTrue, shape.indent), ...(shape.thenMore || []).flatMap((simple) => simpleLines(simple, shape.indent)), `_spl_${id}_e`);
        continue;
      }
      out.push(...pre, `${shape.indent}if ${text} then goto _spl_${id}_a`);
      (shape.whenFalse || []).forEach((simple) => out.push(...simpleLines(simple, shape.indent)));
      const trueLines = [...simpleLines(shape.whenTrue, shape.indent), ...(shape.thenMore || []).flatMap((simple) => simpleLines(simple, shape.indent))];
      out.push(`${shape.indent}goto _spl_${id}_e`, `_spl_${id}_a`, ...trueLines, `_spl_${id}_e`);
    } else {
      out.push(...simpleLines(shape, shape.indent));
    }
  }
  return out.join('\n');
};

// For looking at why a name cannot be spilled.
export const describeSpill = (code, names) => [...analyze(code, names)].map(([name, {uses, ok, why}]) => ({name, uses, ok, why}));

// The names that the code still uses, in a line that is not a comment or a definition.
export const remainingUses = (code, names) => {
  const lines = entriesOf(code).filter(({kind}) => kind !== 'ignored');
  return names.filter((name) => lines.some(({line, words}) => words.has(name) && (wordRegex(name, '').test(line) || arrayRegex(name).test(line))));
};

// Two reads of the display memory one after the other, the second of the byte after the first: reading a byte moves the data fetcher on by one, so the pointer
// is where the second read wants it and its four lines that set it are left out (12 cycles and 10 bytes each). Only a read right after a read: a label between
// them (somewhere a jump can come in), a statement, or anything else on the way leaves the pointer to be set. Variables the project reads together are best
// kept in neighbouring bytes (the dev variables of a feature are made one after the other, so they usually are).
const READ_START = /^\s*asm\s*$/;
const READ_ADDRESS = /^\s*lda #<\((\w+)\+(\d+)\)\s*$/;
const READ_BLOCK = [READ_START, READ_ADDRESS, /^\s*sta DF6LOW\s*$/, /^\s*lda #\(>\((\w+)\+(\d+)\)\) & \$0F\s*$/, /^\s*sta DF6HI\s*$/, /^\s*lda DF6DATA\s*$/,
  /^\s*sta \w+\s*$/, /^\s*end\s*$/];
// The table and byte a read block at line `at` reads, or null when it is not one.
const readBlockAt = (lines, at) => {
  if (at + READ_BLOCK.length > lines.length) return null;
  const parts = READ_BLOCK.map((pattern, k) => pattern.exec(lines[at + k]));
  if (parts.some((part) => !part)) return null;
  const [, table, offset] = parts[1];
  if (parts[3][1] !== table || parts[3][2] !== offset) return null;
  return {table, offset: Number(offset)};
};
// Lines next to each other (blank lines between them only) that each set (or each clear) a bit of the same variable, "x{4} = 0" then "x{5} = 0",
// as one statement: "x = x & 207" (one load and one store for the run, 6 cycles and 4 bytes less for each line after the first). A run of a mix
// of sets and clears is split where the value changes. Not across a label or anything else.
const BIT_WRITE = /^(\s+)([A-Za-z_][A-Za-z0-9_]*)\{([0-7])\} = ([01])\s*$/;
export const mergeBitWrites = (code) => {
  const lines = code.split(/\r?\n/);
  const out = [];
  for (let at = 0; at < lines.length; at++) {
    const first = BIT_WRITE.exec(lines[at]);
    if (!first) {
      out.push(lines[at]);
      continue;
    }
    let mask = 1 << Number(first[3]);
    let end = at;
    for (let next = at + 1; next < lines.length; next++) {
      if (lines[next].trim() === '') continue;
      const more = BIT_WRITE.exec(lines[next]);
      if (!more || more[2] !== first[2] || more[4] !== first[4]) break;
      mask |= 1 << Number(more[3]);
      end = next;
    }
    if (end === at) {
      out.push(lines[at]);
      continue;
    }
    const [, indent, name, , value] = first;
    out.push(value === '1' ? `${indent}${name} = ${name} | ${mask}` : `${indent}${name} = ${name} & ${255 & ~mask}`);
    at = end;
  }
  return out.join('\n');
};
// A test right after one of the same byte against the same thing that went elsewhere when it was true ("if a <> b then goto x"), blank lines
// between them only: "if a <> b then ..." is never true there (left out), and "if a = b then ..." always is (its statement alone). The blocks that
// show a hidden sprite test it again inside a test of it (about 9 cycles and 7 bytes each). Not a test with an else, or with a lone word after
// then (a label, or return).
const NOT_EQUAL_GOTO = /^\s*if ([A-Za-z_]\w*) <> (\w+) then goto \w+\s*$/;
const SAME_TEST = /^(\s*)if ([A-Za-z_]\w*) (<>|=) (\w+) then (.+?)\s*$/;
export const dropRepeatedTests = (code) => {
  const out = [];
  let known = null;
  code.split(/\r?\n/).forEach((line) => {
    if (line.trim() === '') {
      out.push(line);
      return;
    }
    const test = known && SAME_TEST.exec(line);
    if (test && test[2] === known[1] && test[4] === known[2] && !/(^|\s)else(\s|$)/.test(test[5]) && !/^\w+$/.test(test[5])) {
      if (test[3] === '<>') return;
      out.push(`${test[1]}${test[5]}`);
      known = null;
      return;
    }
    known = NOT_EQUAL_GOTO.exec(line);
    out.push(line);
  });
  return out.join('\n');
};
// DPC+: an asm block that writes one byte through a data fetcher (ldx #n, stx DFkLOW, ldx #h, stx DFkHI, a load, sta DFkWRITE: the Draw blocks'
// record bytes, see recordStore in generators/bbasic/pf-draw.js) right after one that wrote the byte before it through the same fetcher, with only
// lines between them that cannot move it: the pointer is where the first write left it, and the second does not set it again (12 cycles and 10 bytes
// less a byte). Lines that cannot move it: assignments (not to an upper case name: the console's and the cartridge's registers, CALLFUNCTION
// runs the coprocessor) and ifs of assignments with no call (no name followed by a parenthesis) and no array, and asm
// blocks that do not name that fetcher, jump, call or have a label. Anything else (a label, a gosub, a goto, any other statement) forgets where the
// fetcher is.
const ONE_WRITE = [/^ldx #(\d+)$/, /^stx DF([0-7])LOW$/, /^ldx #(\S+)$/, /^stx DF([0-7])HI$/, /^lda (?!DF)[\w#$<>()+]+$/, /^sta DF([0-7])WRITE$/];
const PLAIN_ASSIGNMENT = /^\s+(if [^:]+ then )?(?![A-Z][A-Z0-9_]*\b)[A-Za-z_]\w*(\{\d\})? = [^:]+$/;
export const chainFetcherWrites = (code) => {
  const lines = code.split(/\r?\n/);
  const out = [];
  let at = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() !== 'asm') {
      const keeps = line.trim() === '' || /^\s+rem\b/.test(line) ||
        (PLAIN_ASSIGNMENT.test(line) && !/[A-Za-z_]\w*\s*\(/.test(line) && !/\[/.test(line) && !/\b(gosub|goto|return|pop)\b/.test(line));
      if (!keeps) at = null;
      out.push(line);
      continue;
    }
    let end = index + 1;
    while (end < lines.length && lines[end].trim() !== 'end') end++;
    const body = lines.slice(index + 1, end);
    const parts = body.length === ONE_WRITE.length ? body.map((text, i) => ONE_WRITE[i].exec(text.trim())) : [];
    const fetcher = parts.length && parts.every(Boolean) && parts[1][1] === parts[3][1] && parts[1][1] === parts[5][1] ? parts[1][1] : null;
    if (fetcher !== null) {
      const place = {fetcher, low: Number(parts[0][1]), high: parts[2][1]};
      const same = at && at.fetcher === place.fetcher && at.low === place.low && at.high === place.high;
      out.push(line, ...(same ? body.slice(4) : body), ...(end < lines.length ? [lines[end]] : []));
      at = {...place, low: place.low + 1};
    } else {
      if (at && body.some((text) => /^\S/.test(text) || new RegExp(`\\bDF${at.fetcher}`).test(text) || /\b(jsr|jmp|rts|rti|brk|BS_\w*)\b/i.test(text) ||
          /^\s*b(eq|ne|cc|cs|pl|mi|vc|vs)\b/i.test(text))) at = null;
      out.push(...lines.slice(index, end + 1));
    }
    index = end;
  }
  return out.join('\n');
};
// A value put in a temp byte only to be written through a data fetcher ("tempN = x", then an asm block that ends with "lda tempN" and
// "sta DFkWRITE": the Draw blocks' record bytes, see recordStore in generators/bbasic/pf-draw.js) is written straight from x (a number with
// ldx, which DPC+'s fast fetch never changes; a variable with lda): 6 cycles and 4 bytes less a byte. Only when x is a number or a variable
// (not a const, which bB loads as a number, nor rand, a call) and the temp byte is written again before anything could read it (a later
// line that names it, a label, a jump, a call or a return keep the line as it is).
const TEMP_VALUE = /^\s+(temp[1-6]) = ((?:\$[0-9A-Fa-f]+|%[01]+|\d+)|[A-Za-z_]\w*)\s*$/;
const isNumber = (text) => /^(\$[0-9A-Fa-f]+|%[01]+|\d+)$/.test(text);
const tempDeadAfter = (lines, from, temp) => {
  const named = new RegExp(`\\b${temp}\\b`);
  const written = new RegExp(`^\\s+${temp} = (.*)$`);
  for (let at = from; at < lines.length; at++) {
    const line = lines[at];
    const trimmed = line.trim();
    if (trimmed === '' || /^\s+rem\b/.test(line)) continue;
    if (trimmed === 'asm') {
      let end = at + 1;
      while (end < lines.length && lines[end].trim() !== 'end') end++;
      const body = lines.slice(at + 1, end);
      if (body.some((text) => named.test(text) || /^\S/.test(text) || /\b(jsr|jmp|rts|rti|brk|BS_\w*)\b/i.test(text) || /^\s*b(eq|ne|cc|cs|pl|mi|vc|vs)\b/i.test(text))) return false;
      at = end;
      continue;
    }
    if (/^\S/.test(line)) return false;
    const write = written.exec(line);
    if (write) return !named.test(write[1]);
    if (named.test(line) || /\b(goto|gosub|return|pop|on|drawscreen)\b/.test(line)) return false;
  }
  return false;
};
export const directFetcherOperands = (code) => {
  const lines = code.split(/\r?\n/);
  const consts = new Set([...code.matchAll(/^\s*const\s+([A-Za-z_]\w*)\s*=/gm)].map((match) => match[1]));
  const out = [];
  for (let index = 0; index < lines.length; index++) {
    const value = TEMP_VALUE.exec(lines[index]);
    if (!value || lines[index + 1] === undefined || lines[index + 1].trim() !== 'asm' || consts.has(value[2]) || value[2] === 'rand' || /^temp\d$/.test(value[2])) {
      out.push(lines[index]);
      continue;
    }
    const [, temp, operand] = value;
    let end = index + 2;
    while (end < lines.length && lines[end].trim() !== 'end') end++;
    const body = lines.slice(index + 2, end);
    const load = body.length >= 2 ? body[body.length - 2].trim() : '';
    const store = body.length >= 2 ? /^sta (DF[0-7]WRITE)$/.exec(body[body.length - 1].trim()) : null;
    const named = new RegExp(`\\b${temp}\\b`);
    if (load !== `lda ${temp}` || !store || body.slice(0, -2).some((text) => named.test(text)) || !tempDeadAfter(lines, end + 1, temp)) {
      out.push(lines[index]);
      continue;
    }
    const indent = /^\s*/.exec(body[body.length - 2])[0];
    const direct = isNumber(operand) ? [`${indent}ldx #${operand}`, `${indent}stx ${store[1]}`] : [`${indent}lda ${operand}`, body[body.length - 1]];
    out.push(lines[index + 1], ...body.slice(0, -2), ...direct, ...(end < lines.length ? [lines[end]] : []));
    index = end;
  }
  return out.join('\n');
};
export const mergeAdjacentReads = (code) => {
  const lines = code.split(/\r?\n/);
  const drop = new Set();
  let previous = null;
  for (let at = 0; at < lines.length; at++) {
    if (lines[at].trim() === '') continue;
    const block = readBlockAt(lines, at);
    if (!block) {
      previous = null;
      continue;
    }
    // (Not over a page: the high byte of the pointer would change, and the last byte of a table is the byte before the next one's.)
    if (previous && previous.table === block.table && block.offset === previous.offset + 1 && previous.offset < 255) {
      [1, 2, 3, 4].forEach((k) => drop.add(at + k));
    }
    previous = block;
    at += READ_BLOCK.length - 1;
  }
  return drop.size ? lines.filter((line, i) => !drop.has(i)).join('\n') : code;
};

// DPC+: data fetcher 7 is the bB stack of push and pull, which nothing else moves (the kernel uses fetcher 7's fractional fetcher, a separate pointer, see
// DPCplus_kernel.asm and DPCstartup.asm). In a program without push, pull and stack it is set once, at the start, on the display memory byte whose
// accesses it makes the most bytes smaller, and stays there (the user, 2026-11-25: put the DPC+ stack to more use): a read with a load is the load
// from DF7DATA (the pointer moves on) and a store of the same register to DF7PUSH (the pointer moves back, the byte written as it was; the flags of the
// load are kept), a read that is changed and written back (the pointer set again between them) the load, the change and a store to DF7PUSH, and a
// write a store to DF7WRITE and the same store to DF7PUSH. The four lines that set the pointer (10 bytes, 12 cycles) and the stack saves of A and the
// flags around them are left out. A read with another instruction (cmp, adc, ...) keeps fetcher 6. An access whose fetcher 6 is used after it without
// being set again (the next byte read through it) is left as it is. Not when the program is too small a gain for the 10 bytes of the setting at the start.
const STACK_WORDS = /^\s*(?:if\b.*\bthen\s+)?(push|pull|stack)\b|:\s*(push|pull|stack)\b|\bDF7(LOW|HI|DATA|WRITE|PUSH)\b/m;
const SETUP_LOW = /^(\s*)ld([axy]) #<\(([\w+]+)\)\s*$/;
const STACK_LOAD = /^(\s*)(ld[axy]) DF6DATA\s*$/;
const STACK_STORE = /^(\s*)(st[axy]) DF6WRITE\s*$/;
const DF6_SET = /\bDF6LOW\b/;
const DF6_USE = /\bDF6(DATA|WRITE)\b/;
export const restStackFetcher = (code) => {
  if (STACK_WORDS.test(code.split(/\r?\n/).filter((line) => !/^\s*rem\b/.test(line)).join('\n'))) return code;
  const lines = code.split(/\r?\n/);
  const t = (at) => (lines[at] === undefined ? '' : lines[at].trim());
  // The pointer lines of fetcher 6 at line `at`: {address, register}, or null.
  const setupAt = (at) => {
    const low = SETUP_LOW.exec(lines[at] || '');
    if (!low) return null;
    const r = low[2];
    if (t(at + 1) !== `st${r} DF6LOW` || t(at + 2) !== `ld${r} #(>(${low[3]})) & $0F` || t(at + 3) !== `st${r} DF6HI`) return null;
    return {address: low[3], register: r};
  };
  // Whether fetcher 6 is set again before it is used, from line `from` on.
  const setBeforeUse = (from) => {
    for (let at = from; at < lines.length; at++) {
      if (DF6_SET.test(lines[at])) return true;
      if (DF6_USE.test(lines[at])) return false;
    }
    return true;
  };
  // The rewrite of the access whose pointer lines are at `at` for the byte at `address`: {from, to, lines, saved} (lines from..to replaced), or null.
  const rewriteAt = (at, address) => {
    let from = at;
    let after = at + 4;
    // (The saves of A, or of the flags and A, around the pointer lines.)
    const pha = t(at - 1) === 'pha';
    const php = pha && t(at - 2) === 'php';
    if (pha) from = php ? at - 2 : at - 1;
    if (pha && t(after) === 'pla') after++;
    const load = STACK_LOAD.exec(lines[after] || '');
    if (load && !(pha && t(at + 4) !== 'pla')) {
      const r = load[2].slice(2);
      // A read, a change and the write back, the pointer set again between (setbit, name = name + 1 and the like, see simpleLines in applySpill).
      for (let k = after + 1; k < lines.length && k < after + 8; k++) {
        const text = t(k);
        const reset = /^ldx #<\(([\w+]+)\)$/.exec(text);
        if (reset && reset[1] === address && t(k + 1) === 'stx DF6LOW') {
          let write = k + 2;
          if (t(write) === `ldy #(>(${address})) & $0F` && t(write + 1) === 'sty DF6HI') write += 2;
          const store = STACK_STORE.exec(lines[write] || '');
          if (!store || store[2] !== `st${r}` || !setBeforeUse(write + 1)) return null;
          return {from, to: write, lines: [`${load[1]}${load[2]} DF7DATA`, ...lines.slice(after + 1, k), `${store[1]}${store[2]} DF7PUSH`]};
        }
        if (/^\S/.test(lines[k]) || DF6_USE.test(text) || /^(jmp|jsr|rts|b(eq|ne|cc|cs|pl|mi|vc|vs)|end)\b/i.test(text) || /^(ldx|stx|tax|inx|dex)\b/.test(text)) break;
      }
      if (!setBeforeUse(after + 1)) return null;
      return {from, to: after, lines: [`${load[1]}${load[2]} DF7DATA`, `${load[1]}st${r} DF7PUSH`]};
    }
    // A write: right after the pointer lines, after one load of a number or a plain byte, or (stx, sty) with A and the flags kept around it.
    let store = STACK_STORE.exec(lines[after] || '');
    let between = [];
    if (!store && !pha && /^ld[axy] (#|(?!DF)[A-Za-z_])/.test(t(after)) && STACK_STORE.exec(lines[after + 1] || '')) {
      between = [lines[after]];
      store = STACK_STORE.exec(lines[after + 1]);
      after++;
    }
    if (!store) return null;
    let to = after;
    if (php && store[2] === 'sta' && t(to + 1) === 'plp') to++;
    else if (php && store[2] !== 'sta' && t(to + 1) === 'pla' && t(to + 2) === 'plp') to += 2;
    else if (pha) return null;
    if (!setBeforeUse(to + 1)) return null;
    return {from, to, lines: [...between, `${store[1]}${store[2]} DF7WRITE`, `${store[1]}${store[2]} DF7PUSH`]};
  };
  // The bytes saved for each address: an access's lines before, less the ones after.
  const plans = new Map();
  for (let at = 0; at < lines.length; at++) {
    const setup = setupAt(at);
    if (!setup) continue;
    const rewrite = rewriteAt(at, setup.address);
    if (!rewrite) continue;
    const plan = plans.get(setup.address) || {saved: 0, rewrites: []};
    plan.saved += (rewrite.to - rewrite.from + 1) * 2 - rewrite.lines.length * 2.5;
    plan.rewrites.push(rewrite);
    plans.set(setup.address, plan);
    at = rewrite.to;
  }
  const best = [...plans.entries()].sort((a, b) => b[1].saved - a[1].saved)[0];
  if (!best || best[1].saved < 20) return code;
  const [address, {rewrites}] = best;
  const out = [];
  let next = 0;
  rewrites.forEach(({from, to, lines: replaced}) => {
    out.push(...lines.slice(next, from), ...replaced);
    next = to + 1;
  });
  out.push(...lines.slice(next));
  // The setting at the start, in front of the first line that runs (after the set, dim, const and def lines). (X: DPC+'s fast fetch never changes an ldx.)
  const first = out.findIndex((line) => line.trim() !== '' && !/^\s*(set|dim|const|def|rem|includesfile|include|inline)\b/.test(line));
  if (first < 0) return code;
  out.splice(first, 0, ' asm', `  ldx #<(${address})`, '  stx DF7LOW', `  ldx #(>(${address})) & $0F`, '  stx DF7HI', 'end');
  return out.join('\n');
};
