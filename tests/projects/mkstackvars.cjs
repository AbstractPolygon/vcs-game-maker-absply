// usage: node tests/projects/mkstackvars.cjs -> tests/projects/stackvars_<rows>.vcsgm: DPC+ with more variables than there are bytes for (80), so the build
// keeps some in the DPC+ stack's bytes (and at 96 rows in the tables' upper halves too; at 192 rows those are playfield rows, so only the stack). Each
// frame every variable goes up by 1 and is checked against the first: the score is the first variable (the frames since the start, 0 to 255), or 999999
// when any of them is not the first plus its number (two variables in one byte, or a byte something else writes). For tests/emulator/scoredigits.cjs.
// Made from dpcstress_96.vcsgm (mkdpcstress.cjs).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const COUNT = 80;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const get = (k) => `<block type="variables_get"><field name="VAR" id="sv${k}">v${k}</field></block>`;
const set = (k, value) => `<block type="variables_set"><field name="VAR" id="sv${k}">v${k}</field><value name="VALUE">${value}</value></block>`;
const add = (a, b) => `<block type="math_arithmetic"><field name="OP">ADD</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const minus = (a, b) => `<block type="math_arithmetic"><field name="OP">MINUS</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
for (const rows of [96, 192]) {
  const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'dpcstress_96.vcsgm'), 'utf8'));
  doc.configuration = {...doc.configuration, projectTitle: `Stack variables ${rows} rows`, dpcPlusPfres: rows, dpcPlusRowScanlines: 192 / rows, showScore: true,
    dpcPlusTilemap: false, dpcPlusRuns: false};
  const base = doc.backgrounds.backgrounds[0];
  doc.backgrounds.backgrounds = [{...base, pixels: Array.from({length: rows}, (_, y) => (y % 16 === 0 ? 'X'.repeat(32) : 'X' + '.'.repeat(30) + 'X')).join('\n')}];
  const start = chain([
    `<block type="background_set_select"><field name="VAR">${base.id}</field></block>`,
    `<block type="variables_set"><field name="VAR" id="sverr">err</field><value name="VALUE">${num(0)}</value></block>`,
    ...Array.from({length: COUNT}, (_, k) => set(k, num(k))),
  ]);
  const checks = Array.from({length: COUNT - 1}, (_, i) => i + 1).map((k) => '<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">NEQ</field>' +
    `<value name="A">${minus(get(k), get(0))}</value><value name="B">${num(k)}</value></block></value>` +
    `<statement name="DO0"><block type="variables_set"><field name="VAR" id="sverr">err</field><value name="VALUE">${num(1)}</value></block></statement></block>`);
  const score = '<block type="controls_if"><mutation else="1"></mutation><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field>' +
    `<value name="A"><block type="variables_get"><field name="VAR" id="sverr">err</field></block></value><value name="B">${num(0)}</value></block></value>` +
    `<statement name="DO0"><block type="score_set"><value name="VALUE">${get(0)}</value></block></statement>` +
    `<statement name="ELSE"><block type="score_set"><value name="VALUE">${num(999999)}</value></block></statement></block>`;
  // (The increments and the checks in Subroutines, which can go in any bank: in the update event they do not fit the main bank.)
  const call = (name) => `<block type="subroutine_call"><field name="NAME">${name}</field></block>`;
  const update = chain([call('incAll'), call('checkA'), call('checkB'), score]);
  const half = Math.ceil(checks.length / 2);
  const subroutine = (name, blocks, y) =>
    `<block type="subroutine_define" x="600" y="${y}"><field name="NAME">${name}</field><statement name="DO">${chain(blocks)}</statement></block>`;
  const subroutines = subroutine('incAll', Array.from({length: COUNT}, (_, k) => set(k, add(get(k), num(1)))), 20) +
    subroutine('checkA', checks.slice(0, half), 800) + subroutine('checkB', checks.slice(half), 1200);
  const variables = [...Array.from({length: COUNT}, (_, k) => `<variable id="sv${k}">v${k}</variable>`), '<variable id="sverr">err</variable>'].join('');
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><variables>${variables}</variables>` +
    `<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${start}</statement></block>` +
    `<block type="event_block" id="ev1" x="20" y="400"><field name="EVENT">gameplay_update</field><statement name="DO">${update}</statement></block>${subroutines}</xml>`;
  const out = `stackvars_${rows}.vcsgm`;
  fs.writeFileSync(path.join(__dirname, out), yaml.dump(doc, {lineWidth: -1}));
  console.log(out);
}
