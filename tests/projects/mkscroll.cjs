// usage: node mkscroll.cjs -> scroll_<name>.vcsgm in this folder: a background whose every row is different (the row's number in binary, a
// border, and one column further along in each row so a sideways turn shows), scrolled by the joystick (Down: Playfield scroll down, Up: up,
// both without stopping at the edge; in the sideways projects Left and Right too) and put back by Fire (Reset playfield scroll). Used by
// tests/emulator/scrollreset.cjs. The projects (kernel, rows):
//   std_fit, std_tall: standard kernel, 12 rows (scrolls round in place) and 36 (taller than the screen);
//   std_fit2: two backgrounds, the second shown at the start (the reset has to work on that one);
//   std_fitc, std_tallc: with row colors that scroll with the rows;
//   dpc_fit, dpc_tall, pxe_fit, pxe_tall: DPC+ and PXE, 24 rows of 8 lines and 60 (the tall scroll);
//   dpc_plain, pxe_plain: 60 rows of 9 lines (pfres 22: too many lines for the tall scroll, so a plain pfscroll);
//   dpc_tallc: DPC+ tall with playfield colors that scroll with the rows;
//   std_fith, std_tallh: standard 12 and 36 rows, Left and Right scroll sideways too (Playfield scroll left/right);
//   pxe_wideh: PXE with a playfield 64 columns wide, Left and Right move it a pixel with the PXE playfield scroll block (going round);
//   std_fite, std_talle, dpc_talle, pxe_talle: Up and Down stop at the edges.
const fs = require('fs');
const path = require('path');
const yaml = require('../../node_modules/js-yaml');
const P = require('../lib/paths.cjs');
const base = yaml.load(fs.readFileSync(path.join(__dirname, 'ball2.vcsgm'), 'utf8'));

const rowPattern = (y, flip, width = 32) => {
  const bits = Array.from({length: 8}, (_, b) => ((y >> b) & 1 ? 'XX' : '..')).join('');
  const row = ('X' + bits + '.'.repeat(width - 18) + bits.split('').reverse().join('') + 'X').slice(0, width).split('')
      .map((c, x) => (x === 2 + (y * 3) % (width - 4) ? 'X' : c)).join('');
  // (the second background: the rows of other numbers, so it differs from the first and keeps the border at column 0)
  return flip ? rowPattern(y + 100, false, width) : row;
};
const background = (id, rows, colors, flip, width) => ({id, name: `Background ${id}`,
  pixels: Array.from({length: rows}, (_, y) => rowPattern(y, flip, width)).join('\n'), customHeight: true,
  ...(colors ? {rowColors: Array.from({length: rows}, (_, y) => [0x46, 0x1e, 0xc6, 0x86, 0x0e][y % 5])} : {})});
const ifBlock = (id, joy, inner) => `<block type="controls_if" id="${id}"><value name="IF0"><block type="input_joystick_get" id="${id}j"><field name="JOYSTICK">0</field><field name="VAR">${joy}</field></block></value><statement name="DO0">${inner}</statement>`;
const scroll = (id, dir, colors, stop) => `<block type="background_scroll" id="${id}"><field name="DIRECTION">${dir}</field><field name="STOPATEDGE">${stop ? 'TRUE' : 'FALSE'}</field>${colors ? '<field name="COLORS">TRUE</field>' : ''}</block>`;
const pxeSideways = (id, dir) => `<block type="pxe_pf_scroll" id="${id}"><field name="DIRECTION">${dir}</field><field name="EDGE">wrap</field><value name="AMOUNT"><block type="math_number" id="${id}n"><field name="NUM">1</field></block></value></block>`;
// The blocks of gameplay_update, one after another.
const num = (id, n) => `<block type="math_number" id="${id}"><field name="NUM">${n}</field></block>`;
const setPlayer = (id, player, field, value) => `<block type="sprite_player_set" id="${id}"><field name="PLAYER">${player}</field><field name="VAR">player${player}${field}</field><field name="LOOP">FALSE</field><value name="VALUE">${value}</value>`;
const setMissile = (id, field, value) => `<block type="sprite_missile_set" id="${id}"><field name="MISSILE">0</field><field name="VAR">missile0${field}</field><value name="VALUE">${value}</value>`;
// At the start: Player 1 follows the scroll (at x 100, y 60) for tests/emulator/scrollpos.cjs to see where it goes; Player 0 and missile 0 off
// the screen.
const startBlocks = (startBackground) => [
  ...(startBackground ? [`<block type="background_set_select" id="bs1"><field name="VAR">${startBackground}</field>`] : []),
  '<block type="sprite_scroll_with_playfield_set" id="ssp"><field name="OBJECT">player1</field><value name="VALUE"><block type="logic_boolean" id="lbt"><field name="BOOL">TRUE</field></block></value>',
  setPlayer('p1x', 1, 'x', num('n1', 100)), setPlayer('p1y', 1, 'y', num('n2', 60)), setPlayer('p0y', 0, 'y', num('n3', 240)),
  setMissile('m0y', 'y', num('n4', 240)),
];
// (The scroll position goes into missile0x every frame, for tests/emulator/scrollpos.cjs to read.)
const updateBlocks = (colors, sideways, stop) => [
  setMissile('spx', 'x', '<block type="background_scroll_position" id="gpos"></block>'),
  ...(sideways === 'std' ? [ifBlock('if4', 'joy0left', scroll('sc4', 'left')), ifBlock('if5', 'joy0right', scroll('sc5', 'right'))] : []),
  ...(sideways === 'pxe' ? [ifBlock('if4', 'joy0left', pxeSideways('px4', 'left')), ifBlock('if5', 'joy0right', pxeSideways('px5', 'right'))] : []),
  ifBlock('if1', 'joy0down', scroll('sc1', 'down', colors, stop)),
  ifBlock('if2', 'joy0up', scroll('sc2', 'up', colors, stop)),
  ifBlock('if3', 'joy0fire', '<block type="background_scroll_reset" id="rs1"></block>'),
];
// (each block an open <block>: the next one goes in its <next>, then all are closed)
const chain = (blocks) => blocks.reduceRight((rest, block) => block + (rest ? `<next>${rest}</next>` : '') + '</block>', '');
const workspace = (colors, startBackground, sideways, stop) => '<xml xmlns="https://developers.google.com/blockly/xml">' +
  '<block type="event_block" id="ev0" x="20" y="400"><field name="EVENT">gameplay_start</field><statement name="DO">' + chain(startBlocks(startBackground)) + '</statement></block>' +
  '<block type="event_block" id="ev1" x="20" y="20"><field name="EVENT">gameplay_update</field><statement name="DO">' + chain(updateBlocks(colors, sideways, stop)) +
  '</statement></block></xml>';

const DPC = {kernel: 'dpcplus', dpcPlusRowScanlines: 8, dpcPlusPfres: 24, romSize: '32k'};
const PXE = {kernel: 'dpcplus', pxe: true, dpcPlusRowScanlines: 8, dpcPlusPfres: 24, romSize: '64k'};
const projects = {
  std_fit: {rows: 12},
  std_tall: {rows: 36},
  std_fit2: {rows: 12, second: true},
  std_fitc: {rows: 12, colors: true, config: {enablePfColors: true}},
  std_tallc: {rows: 36, colors: true, config: {enablePfColors: true}},
  dpc_fit: {rows: 24, config: DPC},
  dpc_tall: {rows: 60, config: DPC},
  dpc_plain: {rows: 60, config: {...DPC, dpcPlusPfres: 22}},
  dpc_tallc: {rows: 60, colors: true, config: {...DPC, enableDpcPlusPfColors: true}},
  pxe_fit: {rows: 24, config: PXE},
  pxe_tall: {rows: 60, config: PXE},
  pxe_plain: {rows: 60, config: {...PXE, dpcPlusPfres: 22}},
  std_fith: {rows: 12, sideways: 'std'},
  std_tallh: {rows: 36, sideways: 'std'},
  pxe_wideh: {rows: 60, sideways: 'pxe', width: 64, config: {...PXE, pxePfWidth: 64}},
  std_fite: {rows: 12, stop: true},
  std_talle: {rows: 36, stop: true},
  dpc_talle: {rows: 60, stop: true, config: DPC},
  pxe_talle: {rows: 60, stop: true, config: PXE},
};
for (const [name, {rows, colors, config = {}, second, sideways, width, stop}] of Object.entries(projects)) {
  const doc = JSON.parse(JSON.stringify(base));
  doc.configuration = {...doc.configuration, ...config, projectTitle: `Scroll reset ${name}`, showScore: false};
  delete doc.screenshot;
  doc['blockly-workspace'] = workspace(colors, second ? 2 : 0, sideways, stop);
  doc.backgrounds = {backgrounds: [background(1, rows, colors, false, width), ...(second ? [background(2, rows, colors, true, width)] : [])]};
  doc['title-screen'] = {...doc['title-screen'], screens: []};
  // (a player that shows: a block of 8 lines)
  doc['player-animations'].animations[0].frames[0].pixels = Array(8).fill('XXXXXXXX').join('\n');
  const out = path.join(__dirname, `scroll_${name}.vcsgm`);
  fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
  console.log(out.replace(/\\/g, '/').replace(P.REPO, ''), rows, 'rows');
}
