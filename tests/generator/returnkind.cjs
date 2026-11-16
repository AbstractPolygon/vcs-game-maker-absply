// usage: node returnkind.cjs -> the cases of narrowSubroutineReturns (src/generators/bbasic/return-kind.js): the return that ends a subroutine becomes
// return thisbank when every call is in its bank, return otherbank when every call is from another bank, and stays as it is otherwise; a Function's
// return value lines get thisbank. Prints each case that does not give what it should.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const MARK = '; subroutine end';
const sub = (name, body = [' a = 1']) => [name, ...body, ` return ${MARK} ${name}`];
const cases = [
  ['same bank', ['main', ' gosub s1', ' goto main', ...sub('s1')], 's1', ' return thisbank'],
  ['another bank', ['main', ' gosub s1 bank2', ' goto main', ...sub('s1')], 's1', ' return otherbank'],
  ['mixed', ['main', ' gosub s1', ' gosub s1 bank2', ' goto main', ...sub('s1')], 's1', ' return'],
  ['jsr from asm', ['main', ' asm', '  jsr .s1', 'end', ' goto main', ...sub('s1')], 's1', ' return thisbank'],
  ['goto into it', ['main', ' gosub s1', ' goto s1', ...sub('s1')], 's1', ' return'],
  ['goto a label inside', ['main', ' gosub s1', ' goto inner', ...sub('s1', [' a = 1', 'inner', ' b = 2'])], 's1', ' return'],
  ['falls into it', ['main', ' gosub s1', ' a = 3', ...sub('s1')], 's1', ' return'],
  ['no call', ['main', ' goto main', ...sub('s1')], 's1', ' return'],
  ['if gosub', ['main', ' if a then gosub s1 bank3', ' goto main', ...sub('s1')], 's1', ' return otherbank'],
  // A tail call: s2 ends with "goto s1", so s1 returns to whoever called s2.
  ['tail call, same bank', ['main', ' gosub s2', ' goto main', ...sub('s1'), ...sub('s2', [' gosub s1', ' goto s1'])], 's1', ' return thisbank'],
  ['tail call, other bank', ['main', ' gosub s2 bank2', ' goto main', ...sub('s1'), ...sub('s2', [' goto s1'])], 's1', ' return otherbank'],
  ['tail call, mixed', ['main', ' gosub s2 bank2', ' gosub s1', ' goto main', ...sub('s1'), ...sub('s2', [' goto s1'])], 's1', ' return'],
  ['tail call from the main loop', ['main', ' gosub s1', ' goto s1', ...sub('s1')], 's1', ' return'],
  ['loop back to its label', ['main', ' gosub s1', ' goto main', ...sub('s1', [' a = a - 1', ' if a then goto s1', ' goto s1'])], 's1', ' return thisbank'],
];
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'returnkind-'));
  fs.copyFileSync(P.REPO + 'src/generators/bbasic/return-kind.js', path.join(dir, 'rk.mjs'));
  const {narrowSubroutineReturns} = await import('file://' + path.join(dir, 'rk.mjs').split(path.sep).join('/'));
  let bad = 0;
  for (const [title, lines, name, want] of cases) {
    const out = narrowSubroutineReturns(lines.join('\n'), true).code.split('\n');
    const got = out.find((line) => /^\s*return\b/.test(line) && out.indexOf(line) > out.indexOf(name));
    if (got !== want) { bad++; console.log(`${title}: got "${got}", want "${want}"`); }
    if (out.some((line) => line.includes(MARK))) { bad++; console.log(`${title}: the mark is left in`); }
  }
  // Off (PXE, 64k): the mark goes, the return stays.
  const off = narrowSubroutineReturns(cases[0][1].join('\n'), false).code;
  if (!/\n return$/.test(off) || off.includes(MARK)) { bad++; console.log('off: not a plain return'); }
  // A Function: its return value lines get thisbank, not the lines of an asm block in it, nor a return inside an if.
  const fn = ['main', ' a = f(1)', ' goto main', ' function f', ' if temp1 then return 1', ' asm', '  rts', 'end', ' return temp1 + 1', ' return 0', 'end'];
  const fnOut = narrowSubroutineReturns(fn.join('\n'), true).code.split('\n');
  const wantFn = ['main', ' a = f(1)', ' goto main', ' function f', ' if temp1 then return 1', ' asm', '  rts', 'end', ' return temp1 + 1 thisbank', ' return 0 thisbank', 'end'];
  if (fnOut.join('|') !== wantFn.join('|')) { bad++; console.log('function:', fnOut.join(' | ')); }
  console.log(`${cases.length + 2} cases, ${bad} wrong`);
})();
