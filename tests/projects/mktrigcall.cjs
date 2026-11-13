// usage: node tests/projects/mktrigcall.cjs -> tests/projects/trigcall_<kernel>_<what>.vcsgm: a scene with Player 0 left of a trigger, moving right
// a pixel a frame into it; the trigger calls (what = sub) a Subroutine that sets the score to 123456, or (what = fn) a Function with the
// arguments 100 and 23 that sets the score to their sum (123). No "On trigger" block: the call alone makes the triggers work. Made from the
// tv_ score projects of mkpal.cjs (kernel = std, dpc, pxe).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bases = {std: 'tv_std_score_ntsc.vcsgm', dpc: 'tv_dpc_score_ntsc.vcsgm', pxe: 'tv_pxe_score_ntsc.vcsgm'};
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const defs = {
  sub: '<block type="subroutine_define" id="d0" x="400" y="20"><field name="NAME">hit</field><statement name="DO">' +
    `<block type="score_set"><value name="VALUE">${num(123456)}</value></block></statement></block>`,
  fn: '<block type="function_define" id="d0" x="400" y="20"><field name="NAME">addup</field><statement name="DO">' +
    '<block type="score_set"><value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field>' +
    '<value name="A"><block type="function_param_get"><field name="INDEX">1</field></block></value>' +
    '<value name="B"><block type="function_param_get"><field name="INDEX">2</field></block></value></block></value>' +
    `<next><block type="function_return"><value name="VALUE">${num(0)}</value></block></next></block></statement></block>`,
};
const calls = {sub: {type: 'subroutine', name: 'hit', args: []}, fn: {type: 'function', name: 'addup', args: [100, 23]}};
for (const [kernel, base] of Object.entries(bases)) {
  for (const what of Object.keys(defs)) {
    const doc = yaml.load(fs.readFileSync(path.join(__dirname, base), 'utf8'));
    doc.configuration = {...doc.configuration, projectTitle: `Trigger call ${kernel} ${what}`, showScore: true};
    const tables = doc['data-tables'].dataTables;
    const id = Math.max(...tables.map((table) => table.id)) + 1;
    // Header, Player 0 at x 30 y 50, a trigger 100 to 119 across and the whole height, set off by Player 0, kind "none" (64).
    const values = [1, 0, 1, 1, 0, 0, 0, 0, 0, 30, 50, 0x40, 0, 255, 0, 4, 100, 0, 20, 191, 0, 0, 1, 64];
    tables.push({id, name: 'Scene T', values, valueFormats: values.map(() => 'dec'), valueNotes: [], triggerNames: ['T1'],
      triggerCalls: [calls[what]], columns: 8, scene: true});
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
      '<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">' +
      `<block type="score_set"><value name="VALUE">${num(0)}</value><next><block type="scene_set"><field name="SCENE">${id}</field></block></next></block>` +
      '</statement></block>' +
      '<block type="event_block" id="ev1" x="20" y="200"><field name="EVENT">gameplay_update</field><statement name="DO">' +
      `<block type="sprite_player_change"><field name="PLAYER">0</field><field name="VAR">player0x</field><value name="DELTA">${num(1)}</value></block>` +
      `</statement></block>${defs[what]}</xml>`;
    const out = path.join(__dirname, `trigcall_${kernel}_${what}.vcsgm`);
    fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
    console.log(path.basename(out));
  }
}
