'use strict';

// batari Basic's "return" works out while the game runs whether the caller is in another bank (it compares the bank of the return address on the stack
// with the bank it is in: 13 bytes, about 16 cycles); "return thisbank" is a plain rts (1 byte), "return otherbank" the bank-switching return (3 bytes). The
// return that ends a subroutine (see generateSubroutineBody in generators/bbasic.js, which marks it with SUBROUTINE_END_MARK) becomes one of those when
// the finished code shows how the subroutine is reached:
// - every call is a "gosub name" without a bank (or a jsr .name in an asm block): thisbank;
// - every call is a "gosub name bankN": otherbank;
// and nothing else names the subroutine or a label inside it (a goto into it, an "on ... gosub" list, a push of its address), and the line before the
// subroutine's label does not run into it. Otherwise, and on PXE (its compiler is another one), the return stays as it is. The returns a subroutine's
// blocks put inside it stay as they are.
export const SUBROUTINE_END_MARK = '; subroutine end';
const KEYWORDS = /^(end|asm|return|rem|else|then|if|goto|gosub|data|function|bank|const|dim|set|inline|include|next|drawscreen)$/;
const escape = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isLabel = (line) => /^[A-Za-z_]\w*\s*$/.test(line) && !KEYWORDS.test(line.trim());

export const narrowSubroutineReturns = (code, enabled) => {
  const lines = code.split('\n');
  const markAt = new Map();
  lines.forEach((line, i) => {
    const m = new RegExp(`^(\\s*)return\\s*${escape(SUBROUTINE_END_MARK)} (\\S+)\\s*$`).exec(line);
    if (m) markAt.set(m[2], markAt.has(m[2]) ? -1 : i);
  });
  let narrowed = 0;
  // Each subroutine's block (its label to its marked return), found first: a "goto name" from inside another subroutine's block (a tail call: the
  // subroutine returns to whoever called that one) counts as a call of the kind that one's return gets.
  const blocks = new Map();
  markAt.forEach((end, name) => {
    if (end < 0) return;
    const indent = /^\s*/.exec(lines[end])[0];
    lines[end] = `${indent}return`;
    if (!enabled) return;
    const starts = [];
    lines.forEach((line, i) => {
      if (line.trimEnd() === name) starts.push(i);
    });
    if (starts.length !== 1 || starts[0] >= end) return;
    blocks.set(name, {start: starts[0], end, indent});
  });
  const blockAt = (i) => [...blocks].find(([, {start, end}]) => i > start && i < end);
  const facts = new Map();
  blocks.forEach(({start, end}, name) => {
    // (Nothing runs into the label from the line before it.)
    let before = start - 1;
    while (before >= 0 && (lines[before].trim() === '' || /^\s*rem\b/.test(lines[before]))) before--;
    if (before >= 0 && !/^\s*(return\b|goto\b|bank\s)/.test(lines[before])) return;
    const inside = new Set();
    for (let i = start + 1; i < end; i++) {
      if (isLabel(lines[i])) inside.add(lines[i].trim());
    }
    const insideWords = [...inside].map((label) => new RegExp(`(^|[^\\w.])\\.?${escape(label)}(?!\\w)`));
    let same = 0;
    let other = 0;
    let ok = true;
    const tails = new Set();
    const nameWord = new RegExp(`(^|[^\\w.])\\.?${escape(name)}(?!\\w)`, 'g');
    const tailGoto = new RegExp(`^\\s*goto\\s+${escape(name)}\\s*$`);
    lines.forEach((line, i) => {
      if (!ok || i === start || line.trim().startsWith('rem')) return;
      const outside = i < start || i > end;
      if (outside && insideWords.some((word) => word.test(line))) {
        ok = false;
        return;
      }
      const all = (line.match(nameWord) || []).length;
      if (!all) return;
      // (A goto from inside the subroutine to its label is a loop inside it.)
      if (!outside && (line.match(new RegExp(`\\bgoto\\s+${escape(name)}(?!\\w)(?!\\s+bank\\d)`, 'g')) || []).length === all) return;
      const caller = outside && tailGoto.test(line) ? blockAt(i) : null;
      if (caller) {
        tails.add(caller[0]);
        return;
      }
      const plain = (line.match(new RegExp(`\\bgosub\\s+${escape(name)}(?!\\w)(?!\\s+bank\\d)`, 'g')) || []).length;
      const banked = (line.match(new RegExp(`\\bgosub\\s+${escape(name)}\\s+bank\\d+`, 'g')) || []).length;
      const jsr = (line.match(new RegExp(`\\bjsr\\s+\\.${escape(name)}(?!\\w)`, 'gi')) || []).length;
      if (plain + banked + jsr !== all) {
        ok = false;
        return;
      }
      same += plain + jsr;
      other += banked;
    });
    if (ok) facts.set(name, {same, other, tails});
  });
  // The kinds, worked out again until none changes (a subroutine reached by a tail call takes its kind from the one that makes it).
  const kinds = new Map();
  for (let pass = 0; pass <= facts.size; pass++) {
    let changed = false;
    facts.forEach(({same, other, tails}, name) => {
      if (kinds.has(name)) return;
      const tailKinds = [...tails].map((caller) => kinds.get(caller));
      if (tailKinds.some((kind) => kind === undefined)) return;
      const all = new Set([...(same ? ['thisbank'] : []), ...(other ? ['otherbank'] : []), ...tailKinds]);
      kinds.set(name, all.size === 1 ? [...all][0] : null);
      changed = true;
    });
    if (!changed) break;
  }
  kinds.forEach((kind, name) => {
    if (!kind) return;
    const {end, indent} = blocks.get(name);
    lines[end] = `${indent}return ${kind}`;
    narrowed++;
  });
  if (enabled) narrowed += narrowFunctionReturns(lines);
  return {code: lines.join('\n'), narrowed};
};

// A Function (function ... end) is only ever called with batari Basic's call of a value, name(arguments), which is a jsr in the bank of the call: its
// "return value" lines become "return value thisbank" (the value loaded and an rts: 3 bytes instead of 17, about 9 cycles instead of 20). Lines of the
// blocks inside it (asm, data, playfield: and the like, up to their end) are left alone, and so is a return inside an if.
const INNER_BLOCK = /^\s*(asm|data\s|playfield:|pfcolors:|pfheights:|bkcolors:|player\d*(color)?:|lives:|scorecolors:)/i;
const narrowFunctionReturns = (lines) => {
  let count = 0;
  let inFunction = false;
  let depth = 0;
  lines.forEach((line, i) => {
    const text = line.trim();
    if (!inFunction) {
      if (/^function\s+\S+$/i.test(text)) {
        inFunction = true;
        depth = 0;
      }
      return;
    }
    if (INNER_BLOCK.test(text)) {
      depth++;
      return;
    }
    if (/^end$/i.test(text)) {
      if (depth > 0) depth--;
      else inFunction = false;
      return;
    }
    if (depth > 0) return;
    const ret = /^(\s*)return\s+(\S.*?)\s*$/i.exec(line);
    if (ret && !/\b(thisbank|otherbank)$/i.test(ret[2])) {
      lines[i] = `${ret[1]}return ${ret[2]} thisbank`;
      count++;
    }
  });
  return count;
};
