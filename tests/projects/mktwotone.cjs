// usage: node tests/projects/mktwotone.cjs -> tests/projects/twotone_dpc.vcsgm from gametitle_dpc.vcsgm: a title screen with one two-tone 48x2 graphic (see
// public/bb19/titlescreen/48x2_T_kernel.asm): 16 rows, a frame of lit pixels around a see-through middle and a test row of 1 to 6 lit pixels a column
// (rows 6 and 7), the left colors a blue ramp and the right colors an orange ramp, one a row. The title screen stays (no End title screen).
// Render frame 60 with emulator/framepng.cjs and read the pixels with a color map: left half of each row its blue, right half its orange,
// the edges at the graphic's 48 pixels, nothing outside them.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
// BG=n: the page's background color (twotone_dpc_bg.vcsgm): the graphic's unlit pixels and its edges in that color.
const bg = Number(process.env.BG) || 0;
// STD=1: the standard kernel (twotone_std.vcsgm, from gametitle_std.vcsgm): one left and one right color, the first row's.
const std = process.env.STD === '1';
const doc = yaml.load(fs.readFileSync(path.join(__dirname, std ? 'gametitle_std.vcsgm' : 'gametitle_dpc.vcsgm'), 'utf8'));
const rows = [];
for (let r = 0; r < 16; r++) {
  if (r === 0 || r === 15) rows.push('X'.repeat(48));
  else if (r === 6 || r === 7) rows.push(Array.from({length: 6}, (_, k) => 'X'.repeat(k + 1) + '.'.repeat(7 - k)).join(''));
  else rows.push('X' + '.'.repeat(46) + 'X');
}
// ROWS=1: row r lights r + 1 pixels at the left (to see which row each line draws; twotone_<kernel>_rows.vcsgm).
if (process.env.ROWS === '1') rows.splice(0, 16, ...Array.from({length: 16}, (_, r) => 'X'.repeat(r + 1) + '.'.repeat(47 - r)));
const left = Array.from({length: 16}, (_, r) => 0x80 + 2 * (r % 8));
const right = Array.from({length: 16}, (_, r) => 0x30 + 2 * (r % 8));
doc.configuration = {...doc.configuration, projectTitle: std ? 'Two tone std' : 'Two tone dpc'};
doc['title-screen'] = {...doc['title-screen'], screens: [{...doc['title-screen'].screens[0], backgroundColor: bg, cards: [
  {id: 1, type: 'space', lines: 20},
  {id: 2, type: '48x2', color: 0x0e, twoTone: true, rightRowColors: right, pf1: 0, pf2: 0, background: 0,
    frames: [{id: 1, duration: 16, pixels: rows.join('\n'), rowColors: left, pf1: 0, pf2: 0, background: 0}]},
]}]};
doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
  '<block type="event_block" id="ev_title_update" x="20" y="20"><field name="EVENT">title_update</field><statement name="DO">' +
  '<block type="titlescreen_draw"><field name="SCREEN">3</field></block></statement></block></xml>';
const out = path.join(__dirname, (std ? 'twotone_std' : (bg ? 'twotone_dpc_bg' : 'twotone_dpc')) + (process.env.ROWS === '1' ? '_rows' : '') + '.vcsgm');
fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
console.log(path.basename(out));
