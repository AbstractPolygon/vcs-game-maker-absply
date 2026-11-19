// usage: node tests/projects/mkcollstart.cjs -> tests/projects/collstart_<a|b|c|d|e|f>.vcsgm, for the When ... collide block (the blocks inside run once, in the frame a collision starts), from the standard kernel
// template tv_std_score_ntsc.vcsgm (Player 0 stands at line 52, Player 1 at line 152, both at the same column). The score counts the times the blocks inside run.
// a: Player 1 moves up a pixel a frame (y - 1) through Player 0: the When Player 0 and Player 1 collide block with a Score change inside, the score has to read 1; b: the same with the Collided block (the control): the
// score grows by one a frame while they overlap; c: Player 0 moves left (x - 1) into the playfield shape of the template: the When Player 0 and Playfield collide block, 8; d: the same with Collided (the control); e, f: c and d with Any sprite as the first object (the same counts).
// tests/emulator/picsame.cjs renders the picture (SHOW=200) to read the digits.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const changePlayer = (player, variable, value) => `<block type="sprite_player_change"><field name="PLAYER">${player}</field><field name="VAR">player${player}${variable}</field><value name="DELTA">${num(value)}</value></block>`;
const scoreChange = `<block type="score_change"><value name="DELTA">${num(1)}</value></block>`;
const when = (type, first, second) => `<block type="${type}"><field name="VAR0">${first}</field><field name="VAR1">${second}</field></block>`;
const whenBlock = (first, second, body) => `<block type="collision_when"><field name="VAR0">${first}</field><field name="VAR1">${second}</field><field name="BOX">FALSE</field><statement name="DO">${body}</statement></block>`;
const ifBlock = (condition, body) => `<block type="controls_if"><value name="IF0">${condition}</value><statement name="DO0">${body}</statement></block>`;
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
const load = () => yaml.load(fs.readFileSync(path.join(dir, 'tv_std_score_ntsc.vcsgm'), 'utf8'));
const projects = {
  a: [null, chain([changePlayer(1, 'y', -1), whenBlock('player0', 'player1', scoreChange)])],
  b: [null, chain([changePlayer(1, 'y', -1), ifBlock(when('collision_get', 'player0', 'player1'), scoreChange)])],
  c: [null, chain([changePlayer(0, 'x', -1), whenBlock('player0', 'playfield', scoreChange)])],
  d: [null, chain([changePlayer(0, 'x', -1), ifBlock(when('collision_get', 'player0', 'playfield'), scoreChange)])],
  e: [null, chain([changePlayer(0, 'x', -1), whenBlock('any', 'playfield', scoreChange)])],
  f: [null, chain([changePlayer(0, 'x', -1), ifBlock(when('collision_get', 'any', 'playfield'), scoreChange)])],
};
Object.entries(projects).forEach(([key, [startBody, updateBody]]) => {
  const doc = load();
  doc.configuration.projectTitle = `Collision starts ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml">${startBody ? event('gameplay_start', 'ev0', 20, startBody) : ''}${event('gameplay_update', 'ev1', 300, updateBody)}</xml>`;
  fs.writeFileSync(path.join(dir, `collstart_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
