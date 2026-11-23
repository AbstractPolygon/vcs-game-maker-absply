// usage: node tests/projects/mksingleheight.cjs -> tests/projects/singleheight_<dpc|pxe>_<one|two>.vcsgm from gravout_<kernel>_when.vcsgm: Player 0 shows
// animation 0 (8 rows, each 2 lines tall: a box with a cross row in the middle), Player 1 animation 1 (16 rows, single height: the same box with stripes
// every other row, each row 1 line). one: animation 1 has one picture (the statements of a picture); two: two pictures (the tables), the second with the
// stripes moved down a row. In frame 60 both sprites are 16 lines tall; Player 1's rows alternate every line (the stripes), Player 0's every 2 lines.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const box8 = ['XXXXXXXX', 'X......X', 'X......X', 'XXXXXXXX', 'X......X', 'X......X', 'X......X', 'XXXXXXXX'];
const stripes = (shift) => Array.from({length: 16}, (_, r) => (r === 0 || r === 15 ? 'XXXXXXXX' : (r + shift) % 2 ? 'XXXXXXXX' : 'X......X'));
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const set = (p, v, n) => `<block type="sprite_player_set"><field name="PLAYER">${p}</field><field name="VAR">player${p}${v}</field><field name="LOOP">TRUE</field>` +
  `<field name="ORIGIN">FALSE</field><value name="VALUE">${num(n)}</value></block>`;
const anim = (p, a) => `<block type="sprite_player_set_animation"><field name="PLAYER">${p}</field><field name="VAR">${a}</field><field name="RESTART">TRUE</field>` +
  '<field name="START">1</field><field name="LOOP">TRUE</field></block>';
const chain = (blocks) => blocks.reduceRight((rest, block) => (rest ? block.replace(/<\/block>$/, `<next>${rest}</next></block>`) : block), '');
['dpc', 'pxe'].forEach((kernel) => {
  ['one', 'two'].forEach((key) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `gravout_${kernel}_when.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Single height ${kernel} ${key}`;
    doc['player-animations'] = {animations: [
      {id: 0, name: 'Doubled', frames: [{id: 1, duration: 8, pixels: box8.join('\n')}], previewWidthScale: 1},
      {id: 1, name: 'Single', singleHeight: true, previewWidthScale: 1, frames: [{id: 1, duration: 8, pixels: stripes(0).join('\n')},
        ...(key === 'two' ? [{id: 2, duration: 8, pixels: stripes(1).join('\n')}] : [])]},
    ]};
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field>' +
      `<statement name="DO">${chain([anim(0, 0), anim(1, 1), set(0, 'x', 40), set(0, 'y', 50), set(1, 'x', 100), set(1, 'y', 50)])}</statement></block></xml>`;
    fs.writeFileSync(path.join(dir, `singleheight_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
