// usage: node tests/projects/mkbouncefind.cjs -> tests/projects/bouncefind_<std|dpc|pxe>_<fire|num>.vcsgm from fire_<kernel>_8_wall.vcsgm. A Run once in Gameplay update
// clears the playfield, draws a frame round it (rows 0 and 10, columns 0 and 31) and a band of bricks (rows 2 to 4), and fires the ball (8 directions, speed 2, from x 80 y 80 at
// angle 1). Every frame: If Collided ball and playfield then Bounce ball (off the playfield) and right after it Find playfield pixel collided with for the ball, by its Fire
// angle (fire) or by the number 3 (num), and the pixel found is turned off when it is in rows 2 to 4 (a brick); inertia: the same with Player 0 moved by Accelerate (start, direction 1,
// rate 2, max speed 2) in place of the fired ball, the Find by the number 3 (a player with Inertia: the 6502's bounce on every kernel; std with Superchip RAM). The Bounce and the Find are one call of a routine (the
// Bounce block's, see object_bounce in generators/bbasic/sprites.js) on every kernel: DPC+ fire is the coprocessor's one call (function 101). tests/emulator/picsame.cjs
// compares the pictures with a build of the code before the merge (the same bricks go, the ball goes the same way).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const hv = (direction, length, x, y) => `<block type="background_change_hv_line"><field name="DIRECTION">${direction}</field><field name="OPERATION">on</field>` +
  `<value name="LENGTH">${num(length)}</value><value name="X">${num(x)}</value><value name="Y">${num(y)}</value></block>`;
const area = `<block type="background_fill_area"><value name="X1">${num(2)}</value><value name="Y1">${num(2)}</value><value name="X2">${num(29)}</value><value name="Y2">${num(4)}</value></block>`;
const fire = '<block type="sprite_missile_fire"><field name="MISSILE">ball</field><field name="DIRECTIONS16">FALSE</field><field name="EVENSPEED">FALSE</field><field name="PFCHECK">FALSE</field>' +
  `<value name="X">${num(80)}</value><value name="Y">${num(80)}</value><value name="ANGLE">${num(1)}</value><value name="SPEED">${num(2)}</value></block>`;
const accelerate = '<block type="sprite_inertia_accelerate"><field name="ACTION">start</field><field name="OBJECT">player0</field>' +
  `<value name="DIRECTION">${num(1)}</value><value name="RATE">${num(2)}</value><value name="MAXSPEED">${num(2)}</value></block>`;
const place = ['x', 80, 'y', 70].reduce((list, value, i, all) => (i % 2 ? list : [...list,
  `<block type="sprite_player_set"><field name="PLAYER">0</field><field name="VAR">player0${value}</field><value name="VALUE">${num(all[i + 1])}</value></block>`]), []);
const setup = (start) => `<block type="event_run_once"><statement name="DO">${chain(['<block type="background_clear"></block>', hv('pfhline', 32, 0, 0), hv('pfhline', 32, 0, 10),
  hv('pfvline', 11, 0, 0), hv('pfvline', 11, 31, 0), area, `<block type="sprite_ball_set"><field name="VAR">ballheight</field><value name="VALUE">${num(2)}</value></block>`, ...start])}</statement></block>`;
const bounce = (object) => `<block type="object_bounce"><field name="OBJECT">${object}</field><field name="EDGES">FALSE</field><field name="MANUAL">FALSE</field><field name="SPREAD">FALSE</field>` +
  `<value name="SPREAD_STEPS">${num(1)}</value><value name="ANGLE">${num(0)}</value></block>`;
const find = (object, direction) => `<block type="background_collision_pixel_direction"><field name="SPRITE">${object}</field><value name="DIRECTION">${direction}</value></block>`;
const fireAngle = '<block type="sprite_fire_angle_get"><field name="MISSILE">ball</field></block>';
const cmp = (op, a, b) => `<block type="logic_compare"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const rowGet = '<block type="background_collision_pixel_row"></block>';
const colGet = '<block type="background_collision_pixel_column"></block>';
const inBricks = `<block type="logic_operation"><field name="OP">AND</field><value name="A">${cmp('GTE', rowGet, num(2))}</value><value name="B">${cmp('LTE', rowGet, num(4))}</value></block>`;
const off = `<block type="background_change_pixel"><field name="OPERATION">off</field><value name="X">${colGet}</value><value name="Y">${rowGet}</value></block>`;
const hit = (object, direction) => `<block type="controls_if"><value name="IF0"><block type="collision_get"><field name="VAR0">${object}</field><field name="VAR1">playfield</field></block></value>` +
  `<statement name="DO0">${chain([bounce(object), find(object, direction), `<block type="controls_if"><value name="IF0">${inBricks}</value><statement name="DO0">${off}</statement></block>`])}</statement></block>`;
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
['std', 'dpc', 'pxe'].forEach((kernel) => {
  [['fire', 'ball', fireAngle, [fire]], ['num', 'ball', num(3), [fire]], ['inertia', 'player0', num(3), [...place, accelerate]]].forEach(([key, object, direction, start]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `fire_${kernel}_8_wall.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Bounce and find ${kernel} ${key}`;
    // (The standard kernel's 8K has too few variables for Inertia with the playfield drawing: Superchip RAM.)
    if (kernel === 'std' && key === 'inertia') doc.configuration.enableSuperchip = true;
    doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml">${event('gameplay_start', 'ev0', 20, '')}${event('gameplay_update', 'ev1', 300, chain([setup(start), hit(object, direction)]))}</xml>`;
    fs.writeFileSync(path.join(dir, `bouncefind_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
