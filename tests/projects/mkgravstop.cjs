// usage: node tests/projects/mkgravstop.cjs -> tests/projects/gravstop_<std|dpc|pxe>_<a|b|c|d|e|f>.vcsgm from tv_<kernel>_score_ntsc.vcsgm (Player 0 stands at line 52 in front of a playfield shape to its left).
// At the start of the game Gravity starts for Player 0, pulling toward the left (a heading of 192, 2 eighths a frame, max fall speed 3, bounce 0). In the frames of the game, a: If Collided Player 0
// and Playfield then Stop gravity Player 0 (the square has to stop at the shape); b: nothing (the control: the square goes through the shape and out the other side); c: the When Player 0 and
// Playfield collide block with Stop gravity inside (the same as a); d: When Any sprite and Playfield collide with Stop gravity Colliding sprite inside (the same as a: the sprite that collided is Player 0); e: Start gravity in the frames of the game (it runs every frame, no Stop): the fall goes on, the square ends where b has it (Start turns the gravity on in the first frame only); f: e with the d block after it (the square stops at the shape and stays: the Start of the next frames does not turn the gravity on again). tests/emulator/picsame.cjs renders the picture (SHOW=frame) to see where the square is.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const gravity = `<block type="object_gravity"><field name="ACTION">start</field><field name="OBJECT">player0</field><field name="BOUNCE">0</field><value name="PULL">${num(2)}</value><value name="MAXFALL">${num(3)}</value><value name="ANGLE">${num(192)}</value></block>`;
const stop = '<block type="object_gravity_control"><field name="ACTION">stop</field><field name="OBJECT">player0</field></block>';
const collided = '<block type="collision_get"><field name="VAR0">player0</field><field name="VAR1">playfield</field></block>';
const ifBlock = `<block type="controls_if"><value name="IF0">${collided}</value><statement name="DO0">${stop}</statement></block>`;
const whenBlock = `<block type="collision_when"><field name="VAR0">player0</field><field name="VAR1">playfield</field><field name="BOX">FALSE</field><statement name="DO">${stop}</statement></block>`;
const stopColliding = '<block type="object_gravity_control"><field name="ACTION">stop</field><field name="OBJECT">colliding</field></block>';
const whenAny = `<block type="collision_when"><field name="VAR0">any</field><field name="VAR1">playfield</field><field name="BOX">FALSE</field><statement name="DO">${stopColliding}</statement></block>`;
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
const updates = {a: ifBlock, b: null, c: whenBlock, d: whenAny, e: gravity, f: gravity.slice(0, -'</block>'.length) + `<next>${whenAny}</next></block>`};
['std', 'dpc', 'pxe'].forEach((kernel) => {
  Object.entries(updates).forEach(([key, update]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Gravity stop ${kernel} ${key}`;
    doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml">${key === 'e' || key === 'f' ? '' : event('gameplay_start', 'ev0', 20, gravity)}${update ? event('gameplay_update', 'ev1', 300, update) : ''}</xml>`;
    fs.writeFileSync(path.join(dir, `gravstop_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
