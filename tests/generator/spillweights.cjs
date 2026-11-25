// usage: node spillweights.cjs -> the weights describeSpill (src/generators/bbasic/spill.js) gives the uses of a name do not depend on where the bank layout
// puts the code that uses it: a unit reached by a goto or gosub, a subroutine a Function calls and a label an asm block jumps to take the weight of the lines that reach them,
// not the one of the section the text puts before them (code of every frame counts 100 a use, code that runs once 1, a jump inside an if a quarter).
// Prints each case that does not give what it should.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
// The code of a build: the main loop reaches the unit, which the layout put after a section that runs once (title_start) or one of every frame
// (_sprite_box_checks).
const layouts = (reach, unit) => ({
  afterCold: ['main', ...reach, ' goto main', 'title_start_begin', ' b = 1', ' goto main', ...unit],
  afterHot: ['main', ...reach, ' goto main', '_sprite_box_checks', ' b = 1', ' return thisbank', ...unit],
});
const cases = [
  ['goto to a unit', [' goto unit_reloc_entry bank2', 'unit_reloc_return'], ['unit_reloc_entry', ' v1 = v1 + 1', ' goto unit_reloc_return bank1'], 100],
  ['gosub to a subroutine', [' gosub sub1 bank2'], ['sub1', ' v1 = v1 + 1', ' return otherbank'], 100],
  ['gosub inside an if', [' if a then gosub sub1 bank2'], ['sub1', ' v1 = v1 + 1', ' return otherbank'], 25],
  ['a gosub inside a Function', [' c = fn1(a, b)'], [' function fn1', ' gosub sub1', ' return 1', ' end', 'sub1', ' v1 = v1 + 1', ' return thisbank'], 100],
  ['an asm jmp', [' asm', '  jmp .lab1', 'end'], ['lab1', ' v1 = v1 + 1', ' goto main'], 100],
  // (The body of an If block, which the test jumps over, runs on some of the frames: a quarter, and the code after its end label the full weight again.)
  ['the body of an If block', [' if a then goto _if_7_end', ' v1 = v1 + 1', '_if_7_end', ' b = 2'], ['unit1', ' b = 3', ' return'], 25],
  ['a Function called from an If body', [' if a then goto _if_3_end', ' c = fn1(a, b)', '_if_3_end'], [' function fn1', ' gosub sub1', ' return 1', ' end', 'sub1', ' v1 = v1 + 1', ' return thisbank'], 25],
  // (The end label after a subroutine's return is not a way into the next one.)
  ['a subroutine after the end label of another', [' if a then gosub sub1'], ['sub0', ' b = 1', ' return', 'sub0__end', 'sub1', ' v1 = v1 + 1', ' return', 'sub1__end'], 25],
  // (One label of an on ... goto list runs each time.)
  ['a label of an on goto list', [' on a goto lab1 lab2 lab3 lab4'], ['lab1', ' b = 1', ' goto main', 'lab2', ' v1 = v1 + 1', ' goto main', 'lab3', ' goto main', 'lab4', ' goto main'], 25],
  // (A sprite pool's step counts as every frame code, even from an event: a spawn's frame is the longest one.)
  ['a pool step called from an if', [' if a then gosub _poolstep_1_2_for_body'], ['_poolstep_1_2_for_body', ' v1 = v1 + 1', ' return'], 100],
];
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spillweights-'));
  fs.copyFileSync(P.REPO + 'src/generators/bbasic/spill.js', path.join(dir, 'spill.mjs'));
  const {describeSpill} = await import('file://' + path.join(dir, 'spill.mjs').split(path.sep).join('/'));
  const usesOf = (lines) => describeSpill(lines.join('\n'), ['v1']).find(({name}) => name === 'v1').uses;
  let failed = 0;
  cases.forEach(([title, reach, unit, perUse]) => {
    const {afterCold, afterHot} = layouts(reach, unit);
    const cold = usesOf(afterCold);
    const hot = usesOf(afterHot);
    // (A line counts once, whatever number of times it names v1.)
    if (cold !== hot || cold !== perUse) {
      failed++;
      console.log(`FAIL ${title}: after a section that runs once ${cold}, after one of every frame ${hot}, wanted ${perUse}`);
    }
  });
  fs.rmSync(dir, {recursive: true, force: true});
  console.log(`${cases.length - failed} of ${cases.length} cases right`);
  process.exit(failed ? 1 : 0);
})();
