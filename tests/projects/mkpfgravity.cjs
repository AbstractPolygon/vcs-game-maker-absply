// usage: node tests/projects/mkpfgravity.cjs -> tests/projects/pfgrav_<std|dpc|pxe>_<a|b|c>.vcsgm from tv_<kernel>_score_ntsc.vcsgm. In the first frame of the game (an if on a variable in Gameplay update: the Run once block runs every frame on PXE) the playfield is cleared and
// has: a floating line (row 2, columns 4 to 12), a floating pixel at column 20 row 4, a pixel at column 20 row 9 and one at column 8 row 10 (the ground under that part of the line).
// Each project then runs the Playfield gravity block: a: the whole playfield (every pixel ends up on the bottom row or on top of another one); b: only the area from column 0 to 9 and row 0 to 10
// (the pixel at column 20 stays where it was); c: no gravity block (the control).
// d: the whole playfield with a When playfield gravity is done block that adds 1 to the score (it must end at 1: the block runs once).
// e: the whole playfield and f: the area, falling one row every 4 frames (the pixels move down a row at a time from the bottom row up; the score is set to 7 at the end).
// Playfield gravity done sets the score to 7 once the pixels have fallen (a and b). tests/emulator/picsame.cjs renders the picture (SHOW=frame).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const pixel = (x, y) => `<block type="background_change_pixel"><field name="OPERATION">on</field><value name="X">${num(x)}</value><value name="Y">${num(y)}</value></block>`;
const line = '<block type="background_fill_area"><field name="OPERATION">on</field><field name="MODE">CORNERS</field><value name="X1">' + num(4) + '</value><value name="Y1">' + num(2) + '</value><value name="X2">' + num(12) + '</value><value name="Y2">' + num(2) + '</value></block>';
const gravityWhole = '<block type="background_gravity"><mutation whole="1"></mutation><field name="WHOLE">TRUE</field></block>';
const gravityArea = '<block type="background_gravity"><mutation whole="0"></mutation><field name="WHOLE">FALSE</field><value name="X1">' + num(0) + '</value><value name="Y1">' + num(0) + '</value><value name="X2">' + num(9) + '</value><value name="Y2">' + num(10) + '</value></block>';
const done = '<block type="controls_if"><value name="IF0"><block type="background_gravity_done"></block></value><statement name="DO0"><block type="score_set"><value name="VALUE">' + num(7) + '</value></block></statement></block>';
const whenDone = '<block type="background_when_gravity_done"><statement name="DO"><block type="score_change"><value name="DELTA">' + num(1) + '</value></block></statement></block>';
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
const withDelay = (xml, n) => xml.replace(/<\/block>$/, () => `<value name="DELAY">${num(n)}</value></block>`);
const variants = {a: gravityWhole, b: gravityArea, c: null, d: gravityWhole, e: withDelay(gravityWhole, 4), f: withDelay(gravityArea, 4)};
['std', 'dpc', 'pxe'].forEach((kernel) => {
  Object.entries(variants).forEach(([key, gravity]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Playfield gravity ${kernel} ${key}`;
    const start = chain(['<block type="background_clear"></block>', line, pixel(20, 4), pixel(20, 9), pixel(8, 10), ...(gravity ? [gravity] : [])]);
    doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="gs">started</variable></variables>${event('gameplay_update', 'ev0', 20, chain([`<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="variables_get"><field name="VAR" id="gs">started</field></block></value><value name="B">${num(0)}</value></block></value><statement name="DO0">${chain([`<block type="variables_set"><field name="VAR" id="gs">started</field><value name="VALUE">${num(1)}</value></block>`, start])}</statement></block>`, ...(gravity ? [key === 'd' ? whenDone : done] : [])]))}</xml>`;
    fs.writeFileSync(path.join(dir, `pfgrav_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
