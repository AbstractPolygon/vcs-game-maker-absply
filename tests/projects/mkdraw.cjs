// usage: node tests/projects/mkdraw.cjs -> tests/projects/draw_<kernel>.vcsgm (kernel = std, dpc, pxe): every Draw block of Playfield > Utility in
// a Run once block of Gameplay update (Gameplay start is too early: the project's background is loaded on the first frame after it), after the
// playfield is cleared: a rectangle of straight lines (columns 4 to 23, rows 1 to 8), a line inside it, a fill from
// inside it, a circle, an area flipped, a pixel, a centered area, then an erase from the center of the circle; Gameplay update also sets the
// score to 777 once "Playfield fill done" is true. For checking the drawing engine (generators/bbasic/pf-draw.js) in the emulator: the picture once the
// queue is done, and the score. Made from the tv_ score projects of mkpal.cjs.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bases = {std: 'tv_std_score_ntsc.vcsgm', dpc: 'tv_dpc_score_ntsc.vcsgm', pxe: 'tv_pxe_score_ntsc.vcsgm'};
const num = (n) => `<value name="__"><block type="math_number"><field name="NUM">${n}</field></block></value>`;
const v = (name, n) => num(n).replace('__', name);
const chain = (blocks) => blocks.reduceRight((next, block) => block.replace(/<\/block>$/, next ? `<next>${next}</next></block>` : '</block>'), '');
const hv = (dir, op, len, x, y) => `<block type="background_change_hv_line"><field name="DIRECTION">${dir}</field><field name="OPERATION">${op}</field>` +
  `${v('LENGTH', len)}${v('X', x)}${v('Y', y)}</block>`;
const draws = [
  '<block type="background_clear"></block>',
  hv('pfhline', 'on', 20, 4, 1), hv('pfhline', 'on', 20, 4, 8), hv('pfvline', 'on', 8, 4, 1), hv('pfvline', 'on', 8, 23, 1),
  `<block type="background_draw_line"><field name="OPERATION">on</field>${v('X1', 6)}${v('Y1', 2)}${v('X2', 12)}${v('Y2', 6)}</block>`,
  `<block type="background_flood_fill"><field name="OPERATION">on</field>${v('X', 20)}${v('Y', 3)}</block>`,
  `<block type="background_fill_circle"><field name="OPERATION">on</field><field name="PADMODE">ALL</field>${v('X', 28)}${v('Y', 4)}${v('RADIUS', 2)}${v('PADDING', 0)}</block>`,
  `<block type="background_fill_area"><field name="OPERATION">flip</field><field name="MODE">CORNERS</field><field name="PADMODE">ALL</field>${v('X1', 0)}${v('Y1', 9)}${v('X2', 3)}${v('Y2', 10)}</block>`,
  `<block type="background_change_pixel"><field name="OPERATION">on</field>${v('X', 31)}${v('Y', 0)}</block>`,
  `<block type="background_fill_area"><field name="OPERATION">on</field><field name="MODE">CENTER</field><field name="PADMODE">ALL</field>${v('X1', 28)}${v('Y1', 9)}${v('WIDTH', 5)}${v('HEIGHT', 1)}${v('PADDING', 0)}</block>`,
  `<block type="background_flood_fill"><field name="OPERATION">off</field>${v('X', 28)}${v('Y', 4)}</block>`,
];
for (const [kernel, base] of Object.entries(bases)) {
  const doc = yaml.load(fs.readFileSync(path.join(__dirname, base), 'utf8'));
  doc.configuration = {...doc.configuration, projectTitle: `Draw ${kernel}`, showScore: true};
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
    '<block type="event_block" id="ev1" x="20" y="20"><field name="EVENT">gameplay_update</field><statement name="DO">' +
    `<block type="event_run_once"><statement name="DO">${chain(draws)}</statement><next>` +
    '<block type="controls_if"><value name="IF0"><block type="background_flood_fill_done"></block></value><statement name="DO0">' +
    `<block type="score_set">${v('VALUE', 777)}</block></statement></block></next></block></statement></block></xml>`;
  const out = path.join(__dirname, `draw_${kernel}.vcsgm`);
  fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
  console.log(path.basename(out));
}
