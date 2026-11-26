'use strict';

// One code for all the sprites of a "Colliding sprite" block (the user, 2026-11-25: "do indexed code for colliding sprite blocks too").
//
// In a When ... collide block whose blocks inside are made once (see collisionWhenSharedCode), a "Colliding sprite" block has its code for each sprite, and a
// choice of them by the pending bits (collidingDispatch in colliding-sprite.js). When those codes differ only in the bytes they name (player0x in one,
// player1x in the other), one code does for all: each of those bytes is reached as VSYNC[temp] (VSYNC is address 0: "sta VSYNC,x" writes the zero page
// byte at X), the temp holding the address of the sprite's byte, picked by the pending bits in a few instructions ("ldx #player0x"). Every byte of the
// 6502 RAM is in the zero page (and so are the TIA's registers), so an address fits in a byte; a const, a Superchip byte or one past var47 is not
// taken, nor a byte read by bits or as an array, nor a code with assembly in it.
//
// Whether a name is such a byte is only known in the finished program (its dim and const lines), so the generator leaves the choices in it between
// marks, with the codes of the sprites, and resolveCollidingMarks (run on each pass's code, see generateOnce in bbasic.js) puts in the one with the
// fewer bytes (by an estimate of the 6502 code, see estimateBytes). It also picks, for each When ... collide block of more than one sprite, between the
// blocks inside made once and made for each sprite (collision_when in collision.js), as the first can be bigger: blocks that are all "Colliding sprite"
// and cannot be made one code have their code for each sprite either way.

const NL = String.fromCharCode(10);
export const RUN_MARK = 'rem colliding-run ';
export const CHOICE_MARK = 'rem collwhen-choice ';
export const CHOICE_OR_MARK = 'rem collwhen-or ';
export const CHOICE_END_MARK = 'rem collwhen-choice-end ';

// The data of a mark: JSON, in base 64 so that no name in it is seen by the passes that look for names in the code.
export const encodeMark = (data) => btoa(unescape(encodeURIComponent(JSON.stringify(data))));
const decodeMark = (text) => JSON.parse(decodeURIComponent(escape(atob(text.trim()))));

// The line of a run of "Colliding sprite" blocks that follow each other: data {pend, blocks, value}, blocks[b][k] the code of the b-th block for the k-th
// sprite (null when it has none for it), value: one value block (see collidingDispatch).
export const markRun = (data) => `${RUN_MARK}${encodeMark(data)}`;

// The choice of the code for the sprite being run (codes[k] for the k-th sprite, null when there is none for it): the pending bits are looked at lowest
// first; the last sprite needs no look (one of them is pending while the blocks inside run), nor does one after the last that has code (nothing to do
// for it). A value is left in temp1 (0 for a sprite without code). label: the start of its labels.
const choiceLines = (pend, codes, value, label) => {
  const last = value ? codes.length - 1 : codes.reduce((found, code, k) => (code !== null ? k : found), -1);
  if (last < 0) return [];
  const end = `${label}_end`;
  const lines = [];
  for (let k = 0; k <= last; k++) {
    const final = k === codes.length - 1;
    const code = codes[k];
    if (code === null) {
      if (value) lines.push(final ? 'temp1 = 0' : `if ${pend[k]} then temp1 = 0 : goto ${end}`);
      else lines.push(`if ${pend[k]} then goto ${end}`);
      continue;
    }
    const next = k === last ? end : `${label}_${k}`;
    if (!final) lines.push(`if !${pend[k]} then goto ${next}`);
    lines.push(code);
    if (k !== last) lines.push(`goto ${end}`, `@ ${next}`);
  }
  lines.push(`@ ${end}`);
  return lines;
};
// The codes of blocks that follow each other, for each sprite: theirs one after the other.
const joined = (blocks, sprites) => Array.from({length: sprites}, (_, k) => {
  const parts = blocks.map((codes) => codes[k]).filter((code) => code !== null && code !== '');
  return parts.length ? parts.join(NL) : null;
});

// ---- The bytes of a line of batari Basic, roughly (the 6502 code it makes): what tells two ways of making a code apart.
const operandCost = (text) => (/\[/.test(text) ? 4 : 2);
const expressionCost = (expression) => {
  const text = expression.trim();
  if (text === '') return 0;
  const operands = text.match(/[A-Za-z_]\w*(\[[^\]]*\])?(\{\d+\})?|\$[0-9A-Fa-f]+|%[01]+|\d+/g) || [];
  const operators = text.match(/[+\-*/&|^]/g) || [];
  return operands.reduce((sum, operand) => sum + operandCost(operand), 0) + operators.length * 3;
};
const statementCost = (statement) => {
  const text = statement.trim();
  if (text === '' || /^rem\b/.test(text) || text.startsWith('@') || /^end$/.test(text)) return 0;
  if (/^goto\b/.test(text)) return 3;
  if (/^gosub\b/.test(text)) return /\bbank\d+/.test(text) ? 12 : 3;
  if (/^return\b/.test(text)) return 1;
  const ifMatch = /^if\s+(.*?)\s+then\s+(.*)$/.exec(text);
  if (ifMatch) {
    const rest = ifMatch[2].trim();
    const condition = ifMatch[1].split(/&&|\|\|/).reduce((sum, part) => sum + expressionCost(part.replace(/[!<>=]+/g, ' ')) + 2, 0);
    if (/^[A-Za-z_]\w*$/.test(rest) || /^goto\b/.test(rest)) return condition;
    return condition + rest.split(':').reduce((sum, part) => sum + statementCost(part), 0);
  }
  if (text.includes(':')) return text.split(':').reduce((sum, part) => sum + statementCost(part), 0);
  const assignment = /^([^=]+?)\s*=\s*(.*)$/.exec(text);
  if (assignment) {
    const target = assignment[1];
    if (/\{\d+\}$/.test(target)) return 6;
    return operandCost(target) + expressionCost(assignment[2]);
  }
  return 3;
};
export const estimateBytes = (code) => {
  let inAsm = false;
  return code.split(NL).reduce((sum, line) => {
    const text = line.trim();
    if (/^asm$/.test(text)) {
      inAsm = true;
      return sum;
    }
    if (inAsm) {
      if (/^@?end$/.test(text)) inAsm = false;
      return sum + (text === '' || text.startsWith('@') || text.startsWith(';') ? 0 : 2);
    }
    return sum + statementCost(text);
  }, 0);
};

// ---- The names of the program: its dim and const lines.
const programNames = (code) => {
  const dims = new Map();
  const consts = new Set();
  code.split(NL).forEach((line) => {
    const dim = /^\s*dim\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*(;.*)?$/.exec(line);
    if (dim) dims.set(dim[1], dim[2]);
    const constant = /^\s*const\s+([A-Za-z_]\w*)\s*=/.exec(line);
    if (constant) consts.add(constant[1]);
  });
  return {dims, consts};
};
// The kernels' bytes of the 6502 RAM (and the TIA's registers) a block may name by sprite: all in the zero page.
const KERNEL_BYTES = /^(player\d{1,2}(x|y|height|frame|animation)|missile[01](x|y|height)|ball(x|y|height)|NUSIZ\d{1,2}|COLUP[01]|COLUM[01]|REFP[01]|temp[1-6])$/;
const zeroPageByte = (name, names, seen = new Set()) => {
  if (seen.has(name) || names.consts.has(name)) return false;
  seen.add(name);
  if (names.dims.has(name)) return zeroPageByte(names.dims.get(name), names, seen);
  if (/^[a-zA-Z]$/.test(name)) return true;
  const variable = /^var(\d+)$/.exec(name);
  if (variable) return Number(variable[1]) < 48;
  return KERNEL_BYTES.test(name);
};

// ---- One code for all sprites.
const TOKEN = /[A-Za-z_]\w*|\$[0-9A-Fa-f]+|%[01]+|\d+|\S/g;
const tokensOf = (code) => {
  const labels = new Map();
  code.split(NL).forEach((line) => {
    const match = /^\s*@\s*([A-Za-z_]\w*)\s*$/.exec(line);
    if (match && !labels.has(match[1])) labels.set(match[1], `@L${labels.size}`);
  });
  const tokens = [];
  const regex = new RegExp(TOKEN.source, 'g');
  let match;
  while ((match = regex.exec(code))) tokens.push({text: match[0], at: match.index, norm: labels.get(match[0]) || match[0]});
  return tokens;
};
// A bit of the pending bits as the assembly reads it: [byte, mask], or null.
const bitOf = (ref, names) => {
  const match = /^([A-Za-z_]\w*)\{(\d)\}$/.exec(ref.trim());
  return match && zeroPageByte(match[1], names) ? [match[1], 1 << Number(match[2])] : null;
};
// The one code for a choice {pend, codes, value}, or null when there is none (see the top of the file). label: the start of its labels.
const indexedCode = (data, names, label) => {
  const {pend, codes, value} = data;
  const withCode = codes.map((code, k) => (code !== null ? k : -1)).filter((k) => k >= 0);
  if (withCode.length < 2) return null;
  // (Sprites without code: only before or after the ones with code. A value has a value for each.)
  const first = withCode[0];
  const last = withCode[withCode.length - 1];
  if (withCode.length !== last - first + 1 || (value && withCode.length !== codes.length)) return null;
  if (codes.some((code) => code !== null && /^\s*asm\s*$/m.test(code))) return null;
  const lists = withCode.map((k) => tokensOf(codes[k]));
  const base = lists[0];
  if (lists.some((list) => list.length !== base.length)) return null;
  // The places where the codes name different bytes, grouped by the bytes they name.
  const groups = new Map();
  const places = [];
  for (let i = 0; i < base.length; i++) {
    const texts = lists.map((list) => list[i].norm);
    if (texts.every((text) => text === texts[0])) continue;
    if (!texts.every((text) => /^[A-Za-z_]\w*$/.test(text) && zeroPageByte(text, names))) return null;
    const next = base[i + 1] && base[i + 1].text;
    if (next === '{' || next === '[') return null;
    const key = texts.join(',');
    if (!groups.has(key)) groups.set(key, {bytes: texts, temp: null});
    places.push({i, key});
  }
  if (!places.length) return null;
  // A temp for each group that no line of the code names.
  const used = new Set(base.map((token) => token.text));
  const free = ['temp6', 'temp5', 'temp4', 'temp3', 'temp2'].filter((temp) => !used.has(temp));
  if (free.length < groups.size) return null;
  [...groups.values()].forEach((group, g) => {
    group.temp = free[g];
  });
  const bits = withCode.map((k) => bitOf(pend[k], names));
  const before = pend.slice(0, first).map((ref) => bitOf(ref, names));
  const after = pend.slice(last + 1);
  if (bits.some((bit) => !bit) || before.some((bit) => !bit)) return null;
  // (After the ones with code: nothing for them; the look at the ones with code covers it when they are in one byte.)
  if (after.length && !bits.every(([byte]) => byte === bits[0][0])) return null;
  const end = `${label}_end`;
  const lines = [];
  pend.slice(0, first).forEach((ref) => lines.push(`if ${ref} then goto ${end}`));
  const asm = ['asm'];
  if (after.length) asm.push(`lda ${bits[0][0]}`, `and #${bits.reduce((sum, [, mask]) => sum | mask, 0)}`, `bne ${label}_go`, `jmp .${end}`, `@${label}_go`);
  [...groups.values()].forEach((group, g) => {
    asm.push(`ldx #${group.bytes[group.bytes.length - 1]}`);
    for (let j = group.bytes.length - 2; j >= 0; j--) {
      const [byte, mask] = bits[j];
      const skip = `${label}_${g}_${j}`;
      asm.push(`lda ${byte}`, `and #${mask}`, `beq ${skip}`, `ldx #${group.bytes[j]}`, `@${skip}`);
    }
    asm.push(`stx ${group.temp}`);
  });
  asm.push('@end');
  // The code of the first sprite, its bytes reached through the temps.
  let code = codes[first];
  [...places].sort((a, b) => base[b.i].at - base[a.i].at).forEach(({i, key}) => {
    const token = base[i];
    code = `${code.slice(0, token.at)}VSYNC[${groups.get(key).temp}]${code.slice(token.at + token.text.length)}`;
  });
  return [...lines, ...asm, code, `@ ${end}`];
};

// ---- The marks in a pass's code.
// The lines put in, as normalizeIndents (in bbasic.js) made the others when the program was finished: a label ("@ name", "@end") at column 0 without its
// "@", every other line after the indent.
const normalize = (lines, indent) => lines.flatMap((line) => String(line).split(NL)).map((line) => {
  const text = line.replace(/^[\t ]*/, '');
  return text.startsWith('@') ? text.replace(/^@\s*/, '') : indent + text;
});
// Resolves the innermost marks of one kind at a time: each choice of codes, then each choice of a When ... collide block between its two ways.
export const resolveCollidingMarks = (code, indent = '  ') => {
  if (typeof code !== 'string' || (!code.includes(RUN_MARK.trim()) && !code.includes(CHOICE_MARK.trim()))) return code;
  const names = programNames(code);
  const lines = code.split(NL);
  let counter = 0;
  // Runs of "Colliding sprite" blocks: split into the parts that make the fewest bytes, each the choice of the codes by the pending bits or one code for
  // all sprites (whichever is smaller).
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].indexOf(RUN_MARK);
    if (at < 0 || lines[i].slice(0, at).trim() !== '') continue;
    const {pend, blocks, value} = decodeMark(lines[i].slice(at + RUN_MARK.length));
    const run = counter++;
    // The best way of a part (blocks from..to-1): its lines and their bytes.
    const partOf = (from, to) => {
      const codes = joined(blocks.slice(from, to), pend.length);
      const label = `_collsel_${run}_${from}`;
      const choice = choiceLines(pend, codes, value, label);
      const one = indexedCode({pend, codes, value}, names, `_collidx_${run}_${from}`);
      const choiceBytes = estimateBytes(choice.join(NL));
      const oneBytes = one ? estimateBytes(one.join(NL)) : Infinity;
      return oneBytes < choiceBytes ? {lines: one, bytes: oneBytes} : {lines: choice, bytes: choiceBytes};
    };
    const best = [{bytes: 0, lines: []}];
    for (let to = 1; to <= blocks.length; to++) {
      for (let from = 0; from < to; from++) {
        const part = partOf(from, to);
        const total = best[from].bytes + part.bytes;
        if (!best[to] || total < best[to].bytes) best[to] = {bytes: total, lines: [...best[from].lines, ...part.lines]};
      }
    }
    const replacement = normalize(best[blocks.length].lines, indent);
    lines.splice(i, 1, ...replacement);
    i += replacement.length - 1;
  }
  // The two ways of a When ... collide block, innermost first.
  for (;;) {
    const ends = lines.map((line, j) => (line.trim().startsWith(CHOICE_END_MARK.trim()) ? j : -1)).filter((j) => j >= 0);
    if (!ends.length) break;
    // (An end with no other choice inside: its begin is the nearest one before it.)
    const close = ends[0];
    const id = lines[close].trim().slice(CHOICE_END_MARK.trim().length).trim();
    const open = lines.findIndex((line) => line.trim() === `${CHOICE_MARK.trim()} ${id}`);
    const or = lines.findIndex((line) => line.trim() === `${CHOICE_OR_MARK.trim()} ${id}`);
    if (open < 0 || or < 0) {
      lines.splice(close, 1);
      continue;
    }
    const shared = lines.slice(open + 1, or);
    const each = lines.slice(or + 1, close);
    const kept = estimateBytes(shared.join(NL)) < estimateBytes(each.join(NL)) ? shared : each;
    lines.splice(open, close - open + 1, ...kept);
  }
  return lines.join(NL);
};
