// usage: node tests/projects/mkcolliding.cjs -> tests/projects/colliding_<std|dpc|pxe>.vcsgm from tv_<kernel>_score_ntsc.vcsgm: every block with "Colliding sprite" in its sprite
// dropdown (see generators/bbasic/colliding-sprite.js) set to it, inside "When any sprite and Playfield collide" in Gameplay update, the getters in the setters' values, and a
// "When player sprites and Playfield collide" with the blocks that move objects (Seek, Gravity, Bounce, Stop fire, Inertia, Scroll with playfield), one that
// sets the colliding player's x to a random number (one code for both players), and a Wait, a score color and Player 0's y set to the colliding player's x (blocks made once for both players). Every one must build; the generated code has each block once for each sprite it can take.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const colliding = (type, field, inner = '') => `<block type="${type}"><field name="${field}">colliding</field>${inner}</block>`;
const value = (name, block) => `<value name="${name}">${block}</value>`;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chainOf = (list) => list.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const statements = [
  colliding('sprite_player_set', 'PLAYER', value('VALUE', colliding('sprite_player_get', 'PLAYER'))),
  colliding('sprite_player_change', 'PLAYER', value('DELTA', colliding('sprite_scroll_with_playfield_get', 'OBJECT'))),
  colliding('sprite_player_size', 'PLAYER'),
  colliding('sprite_player_mask', 'PLAYER'),
  colliding('sprite_player_animation_playback', 'PLAYER'),
  colliding('sprite_player_rom_noise', 'PLAYER'),
  colliding('sprite_player_rom_noise_stop', 'PLAYER'),
  colliding('sprite_player_rainbow_colors', 'PLAYER'),
  colliding('sprite_player_rainbow_colors_stop', 'PLAYER'),
  colliding('sprite_missile_set', 'MISSILE', value('VALUE', colliding('sprite_missile_get', 'MISSILE'))),
  colliding('sprite_missile_change', 'MISSILE', value('DELTA', num(1))),
  colliding('sprite_missile_size', 'MISSILE'),
];
// (The object blocks in the When block of the two players: for all five sprites they need more variables than there are.)
const objectStatements = [
  colliding('object_seek_to', 'OBJECT'),
  colliding('object_gravity', 'OBJECT', value('PULL', num(2)) + value('MAXFALL', num(2)) + value('ANGLE', num(128))),
  colliding('object_gravity_control', 'OBJECT'),
  colliding('object_bounce', 'OBJECT'),
  colliding('object_fire_stop', 'OBJECT'),
  colliding('sprite_inertia_accelerate', 'OBJECT'),
  colliding('sprite_inertia_decelerate', 'OBJECT'),
  colliding('sprite_scroll_with_playfield_set', 'OBJECT'),
];
const when = (first, body) => `<block type="collision_when"><field name="VAR0">${first}</field><field name="VAR1">playfield</field><field name="BOX">FALSE</field>` +
  `<field name="BOXMODE">whole</field><statement name="DO">${body}</statement></block>`;
// (Random between: long enough code that one code for both players, through the address of the byte, is the smaller, see colliding-index.js.)
const setX = `<block type="sprite_player_set"><field name="PLAYER">colliding</field><field name="VAR">player0x</field>${value('VALUE', `<block type="random_between_get">${value('MIN', num(17))}${value('MAX', num(124))}</block>`)}</block>`;
// Blocks that are not "Colliding sprite" (so that the blocks inside are made once, see collisionWhenSharedCode), one of them with a getter that is: Player 0's
// y is set to the colliding player's x (worked out into temp1 in front of it).
const shared = [
  `<block type="wait_frames">${value('FRAMES', num(1))}</block>`,
  `<block type="score_color_set">${value('VALUE', '<block type="color_get"><field name="COLOR">14</field></block>')}</block>`,
  `<block type="sprite_player_set"><field name="PLAYER">0</field><field name="VAR">player0y</field>${value('VALUE', colliding('sprite_player_get', 'PLAYER'))}</block>`,
];
[['std', 'std'], ['dpc', 'dpc'], ['pxe', 'pxe']].forEach(([kernel, base]) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${base}_score_ntsc.vcsgm`), 'utf8'));
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_update</field>' +
    `<statement name="DO">${chainOf([when('any', chainOf(statements)), when('anyplayer', chainOf([...objectStatements, setX, ...shared]))])}</statement></block></xml>`;
  doc.configuration.projectTitle = `Colliding sprite ${kernel}`;
  if (kernel === 'std') doc.configuration.enableSuperchip = true;
  fs.writeFileSync(path.join(dir, `colliding_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
