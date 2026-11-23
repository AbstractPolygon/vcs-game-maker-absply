// usage: node tests/projects/mkgravout.cjs -> tests/projects/gravout_<std|dpc|pxe>_<when|any>.vcsgm from tv_<kernel>_score_ntsc.vcsgm (Player 0 stands at line 52 in front of a playfield
// shape to its left). At the start of the game Player 0 is put at x 140 (clear of the shape), a Draw block fills the bottom rows of the playfield (a floor: rows 9 and 10 on the standard
// kernel, which has 11 rows without Superchip RAM; 18 to 22 on DPC+ and PXE, 23 rows) and Gravity starts for Player 0, pulling down (a heading of 128, 2 eighths a frame,
// max fall speed 3, bounce 0). In the frames of the game, when: the When Player 0 and Playfield collide block with Stop gravity Player 0 inside; any: When Any sprite and Playfield collide with
// Stop gravity Colliding sprite. The hardware collision is only seen once the square is in the floor (by up to its fall speed): the Stop takes it back up out of it (the next pass through
// the gravity checks), so it rests on the floor with no line of it over the floor's top row. Before the fix the square sat in the floor. tests/emulator/picsame.cjs renders the picture (SHOW=frame) to see where the square is.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const gravity = `<block type="object_gravity"><field name="ACTION">start</field><field name="OBJECT">player0</field><field name="BOUNCE">0</field><value name="PULL">${num(2)}</value><value name="MAXFALL">${num(3)}</value><value name="ANGLE">${num(128)}</value></block>`;
const floor = (top, bottom) => '<block type="sprite_player_set"><field name="PLAYER">0</field><field name="VAR">player0x</field><field name="LOOP">TRUE</field><field name="ORIGIN">FALSE</field>' +
  `<value name="VALUE">${num(140)}</value><next><block type="background_fill_area"><value name="X1">${num(0)}</value><value name="Y1">${num(top)}</value><value name="X2">${num(31)}</value>` +
  `<value name="Y2">${num(bottom)}</value><next>${gravity}</next></block></next></block>`;
const stop = (object) => `<block type="object_gravity_control"><field name="ACTION">stop</field><field name="OBJECT">${object}</field></block>`;
const when = (first, object) => `<block type="collision_when"><field name="VAR0">${first}</field><field name="VAR1">playfield</field><field name="BOX">FALSE</field><statement name="DO">${stop(object)}</statement></block>`;
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
const updates = {when: when('player0', 'player0'), any: when('any', 'colliding')};
['std', 'dpc', 'pxe'].forEach((kernel) => {
  Object.entries(updates).forEach(([key, update]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Gravity back out ${kernel} ${key}`;
    doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml">${event('gameplay_start', 'ev0', 20, kernel === 'std' ? floor(9, 10) : floor(18, 22))}${event('gameplay_update', 'ev1', 300, update)}</xml>`;
    fs.writeFileSync(path.join(dir, `gravout_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
