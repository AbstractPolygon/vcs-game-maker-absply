// usage: node tests/projects/mkoffset.cjs -> tests/projects/offset_<std|dpc>_<mode>.vcsgm for the Playfield offset block's modes right, wrap_right, left and
// wrap_left (the belt and the wrap of the same row), from tv_<kernel>_score_ntsc.vcsgm: at the start of the game the playfield is cleared and 4 columns by 4 rows are
// set (columns 0 to 3, rows 2 to 5); each frame the offset block moves the whole playfield one pixel. After 40 frames the pattern has gone round the 32 columns once and
// 8 more: with the wrap it is still in rows 2 to 5, with the belt the pixels that left a row are in the next rows. tests/emulator/picsame.cjs renders the picture.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
['std', 'dpc'].forEach((kernel) => {
  ['right', 'wrap_right', 'left', 'wrap_left'].forEach((mode) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
    const start = '<block type="background_clear"><next><block type="background_fill_area"><field name="OPERATION">on</field><field name="MODE">CORNERS</field>' +
      `<value name="X1">${num(0)}</value><value name="Y1">${num(2)}</value><value name="X2">${num(3)}</value><value name="Y2">${num(5)}</value></block></next></block>`;
    const update = `<block type="background_offset"><mutation whole="1"></mutation><field name="DIRECTION">${mode}</field><field name="WHOLE">TRUE</field></block>`;
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field>' +
      `<statement name="DO">${start}</statement></block><block type="event_block" id="ev1" x="20" y="260"><field name="EVENT">gameplay_update</field><statement name="DO">${update}</statement></block></xml>`;
    doc.configuration.projectTitle = `Offset ${kernel} ${mode}`;
    fs.writeFileSync(path.join(dir, `offset_${kernel}_${mode}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
