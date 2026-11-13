// usage: node tests/projects/mkdpcstress.cjs -> tests/projects/dpcstress_<rows>.vcsgm: DPC+ with a playfield of 32, 48, 64, 96 or 192 rows (6, 4, 3, 2 and 1
// scanlines a row) and walls, a floor and platforms, and every frame: Player 0 as a platformer (the box collision, walls stopping it, jumping on Fire), the playfield
// collision of Player 0 (Player 1 changes color), Missile 0 fired from Player 0 on Fire (it stops at the playfield), the ball fired at the start and bouncing
// off the playfield, Missile 1 with gravity bouncing. For tests/emulator/rollcheck.cjs (the frames stay the same length: no rolling) with framecmp's input.
// _fc: with the Fire movement on the coprocessor (Options). Made from scroll_dpc_plain.vcsgm (mkscroll.cjs).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const setPlayer = (player, variable, value) =>
  `<block type="sprite_player_set"><field name="PLAYER">${player}</field><field name="VAR">player${player}${variable}</field><value name="VALUE">${num(value)}</value></block>`;
// (Each with the playfield check: it stops at a lit pixel, what the coprocessor can do.)
const fire = (object, x, y, angle, speed) => `<block type="sprite_missile_fire"><field name="MISSILE">${object}</field><field name="PFCHECK">TRUE</field>` +
  `<value name="X">${x}</value><value name="Y">${y}</value><value name="ANGLE">${num(angle)}</value><value name="SPEED">${num(speed)}</value></block>`;
const get = (player, variable) => `<block type="sprite_player_get"><field name="PLAYER">${player}</field><field name="VAR">player${player}${variable}</field></block>`;
for (const [rows, fc] of [32, 48, 64, 96, 192].flatMap((n) => [[n, false], [n, true]])) {
  const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'scroll_dpc_plain.vcsgm'), 'utf8'));
  doc.configuration = {...doc.configuration, projectTitle: `DPC+ stress ${rows} rows`, dpcPlusPfres: rows, dpcPlusRowScanlines: 192 / rows, showScore: false,
    enableFireCoprocessor: fc};
  // Walls left and right, a floor, platforms every quarter of the height, a block in the middle.
  const pixels = Array.from({length: rows}, (_, y) => Array.from({length: 32}, (_, x) => {
    const wall = x === 0 || x === 31 || y >= rows - Math.max(1, rows / 24);
    const platform = [1, 2, 3].some((q) => y >= (rows * q) / 4 && y < (rows * q) / 4 + Math.max(1, rows / 48) && ((x + q * 5) % 16) < 7);
    const block = x >= 14 && x <= 17 && y >= rows * 0.6 && y < rows * 0.7;
    return wall || platform || block ? 'X' : '.';
  }).join('')).join('\n');
  doc.backgrounds.backgrounds = [{...doc.backgrounds.backgrounds[0], pixels, customHeight: false}];
  const start = chain([
    `<block type="background_set_select"><field name="VAR">${doc.backgrounds.backgrounds[0].id}</field></block>`,
    setPlayer(0, 'x', 50), setPlayer(0, 'y', 60), setPlayer(1, 'x', 120), setPlayer(1, 'y', 30),
    fire('ball', num(80), num(40), 3, 2),
    fire('1', num(100), num(30), 5, 1),
  ]);
  const update = chain([
    '<block type="sprite_platformer"><field name="PLAYER">0</field><field name="WALLS">TRUE</field>' +
      `<value name="SPEED">${num(5)}</value><value name="GRAVITY">${num(3)}</value><value name="MAXFALL">${num(6)}</value></block>`,
    '<block type="controls_if"><value name="IF0"><block type="collision_get"><field name="VAR0">player0</field><field name="VAR1">playfield</field></block></value>' +
      `<statement name="DO0">${setPlayer(1, 'color', 0x46)}</statement></block>`,
    '<block type="controls_if"><value name="IF0"><block type="input_joystick_get"><field name="JOYSTICK">0</field><field name="VAR">joy0fire</field></block></value>' +
      `<statement name="DO0">${fire('0', get(0, 'x'), get(0, 'y'), 4, 2)}</statement></block>`,
    `<block type="object_bounce"><field name="OBJECT">ball</field><value name="SPREAD_STEPS">${num(1)}</value><value name="ANGLE">${num(0)}</value></block>`,
    `<block type="object_gravity"><field name="OBJECT">missile1</field><value name="RATE">${num(4)}</value><value name="MAXFALL">${num(4)}</value></block>`,
    `<block type="object_bounce"><field name="OBJECT">missile1</field><value name="SPREAD_STEPS">${num(1)}</value><value name="ANGLE">${num(0)}</value></block>`,
  ]);
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
    `<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${start}</statement></block>` +
    `<block type="event_block" id="ev1" x="20" y="400"><field name="EVENT">gameplay_update</field><statement name="DO">${update}</statement></block></xml>`;
  const out = `dpcstress_${rows}${fc ? '_fc' : ''}.vcsgm`;
  fs.writeFileSync(path.join(__dirname, out), yaml.dump(doc, {lineWidth: -1}));
  console.log(out);
}
