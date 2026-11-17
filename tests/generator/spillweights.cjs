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
