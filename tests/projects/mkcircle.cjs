// usage: node tests/projects/mkcircle.cjs -> tests/projects/circle_<kernel>.vcsgm (kernel = std, dpc, dpcspread, pxe): the circle block on short rows (std: pfres 32 with
// Superchip, dpc: pfres 96), after the playfield is cleared, in a Run once block of Gameplay update: A a plain circle, B the same kept round ("keep it round on short
// rows"), C a circle kept round with a padding for each side (left 10, right 3, top 12, bottom 15, on dpc 40 as the top and bottom are a byte: it is cut to columns 10 to 28 and rows 12 to the last row less the bottom).
// dpcspread: B and C drawn over several frames (the steps of the 6502 engine, not the coprocessor). The score is set to 777 once the queue is done.
// For checking the circle of generators/bbasic/pf-draw.js (and function 96 of armprog.c) in the emulator: the picture once the queue is done.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bases = {std: 'tv_std_score_ntsc.vcsgm', dpc: 'tv_dpc_score_ntsc.vcsgm', dpcspread: 'tv_dpc_score_ntsc.vcsgm', pxe: 'tv_pxe_score_ntsc.vcsgm'};
const v = (name, n) => `<value name="${name}"><block type="math_number"><field name="NUM">${n}</field></block></value>`;
const chain = (blocks) => blocks.reduceRight((next, block) => block.replace(/<\/block>$/, next ? `<next>${next}</next></block>` : '</block>'), '');
// ERASE=1: the playfield is filled first and the circles clear it (circle_<kernel>_off.vcsgm).
const erase = process.env.ERASE === '1';
// SPEED=n: a Set playfield draw speed block (n steps a frame) first (circle_<kernel>_slow.vcsgm).
const speed = Number(process.env.SPEED) || 0;
for (const [kernel, base] of Object.entries(bases)) {
  const std = kernel === 'std';
  const rows = std ? 32 : 96;
  const spread = kernel === 'dpcspread';
  const circle = (x, y, r, stretch, pads, padAll = 0) => `<block type="background_fill_circle"><field name="OPERATION">${erase ? 'off' : 'on'}</field><field name="PADMODE">${pads ? 'EACH' : 'ALL'}</field>` +
    `<field name="SPREAD">${spread && stretch ? 'TRUE' : 'FALSE'}</field><field name="STRETCH">${stretch ? 'TRUE' : 'FALSE'}</field>` +
    `${v('X', x)}${v('Y', y)}${v('RADIUS', r)}${pads ? v('PAD_LEFT', pads[0]) + v('PAD_RIGHT', pads[1]) + v('PAD_TOP', pads[2]) + v('PAD_BOTTOM', pads[3]) : v('PADDING', padAll)}</block>`;
  const draws = [
    '<block type="background_clear"></block>',
    ...(speed ? [`<block type="background_draw_speed">${v('STEPS', speed)}</block>`] : []),
    ...(erase ? [`<block type="background_fill_area"><field name="OPERATION">on</field><field name="MODE">CORNERS</field><field name="PADMODE">ALL</field>${v('X1', 0)}${v('Y1', 0)}${v('X2', 31)}${v('Y2', rows - 1)}</block>`] : []),
    circle(7, Math.round(rows * 0.2), 6, false),
    circle(7, Math.round(rows * 0.65), 6, true),
    circle(22, Math.round(rows * 0.4), 8, true, [10, 3, 12, std ? 15 : 40]),
    // E a small circle at the left edge with the same padding, 3, on all sides (cut at column 3).
    circle(4, Math.round(rows * 0.45), 5, false, null, 3),
    // D a centered area 30 wide, cut by a padding of 4 on the left and 6 on the right (columns 4 to 25).
    `<block type="background_fill_area"><field name="OPERATION">on</field><field name="MODE">CENTER</field><field name="PADMODE">EACH</field>${v('X1', 16)}${v('Y1', Math.round(rows * 0.92))}${v('WIDTH', 30)}${v('HEIGHT', 3)}${v('PAD_LEFT', 4)}${v('PAD_RIGHT', 6)}${v('PAD_TOP', 0)}${v('PAD_BOTTOM', 0)}</block>`,
  ];
  // (A speed makes the test short: one circle, so the queue is not full: a block that finds it full draws everything waiting at once.)
  if (speed) {
    draws.splice(2, 1);
    draws.splice(3);
  }
  const doc = yaml.load(fs.readFileSync(path.join(__dirname, base), 'utf8'));
  doc.configuration = {...doc.configuration, projectTitle: `Circle ${kernel}`, showScore: true, ...(std ? {enableSuperchip: true, pfres: rows} : {dpcPlusPfres: rows})};
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
    '<block type="event_block" id="ev1" x="20" y="20"><field name="EVENT">gameplay_update</field><statement name="DO">' +
    `<block type="event_run_once"><statement name="DO">${chain(draws)}</statement><next>` +
    '<block type="controls_if"><value name="IF0"><block type="background_flood_fill_done"></block></value><statement name="DO0">' +
    `<block type="score_set">${v('VALUE', 777)}</block></statement></block></next></block></statement></block></xml>`;
  const out = path.join(__dirname, `circle_${kernel}${erase ? '_off' : ''}${speed ? '_slow' : ''}.vcsgm`);
  fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
  console.log(path.basename(out));
}
