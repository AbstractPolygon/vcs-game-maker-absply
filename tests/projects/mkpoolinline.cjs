// usage: node tests/projects/mkpoolinline.cjs -> tests/projects/poolinline_<dpc|pxe>_<small|big>.vcsgm from fire_<kernel>_8_plain.vcsgm. Gameplay start makes pool 1 (Players 1
// to 3) and spawns its three sprites at x 30, 70 and 110, y 20. Gameplay update runs "each sprite of pool 1": small: its y goes up by 1 and back to 20 past 150 (the copy of the
// blocks for each sprite is smaller than the exchange, so the build runs it in place of the exchange); big: the same and twelve moves of x by +1 and -1 (a copy bigger than the
// exchange: the build keeps the exchange). tests/emulator/picsame.cjs compares the pictures with a build that always exchanges (the sprites where they were, frame by frame).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((rest, block) => (rest ? block.replace(/<\/block>$/, `<next>${rest}</next></block>`) : block), '');
const setPool = (role, value) => `<block type="sprite_player_set"><field name="PLAYER">pool</field><field name="VAR">playerpool${role}</field><field name="LOOP">TRUE</field>` +
  `<field name="ORIGIN">FALSE</field><value name="VALUE">${value}</value></block>`;
const changePool = (role, delta) => `<block type="sprite_player_change"><field name="PLAYER">pool</field><field name="VAR">playerpool${role}</field><field name="LOOP">TRUE</field>` +
  `<value name="DELTA">${num(delta)}</value></block>`;
const poolY = '<block type="sprite_player_get"><field name="PLAYER">pool</field><field name="VAR">playerpooly</field></block>';
const gX = '<block type="variables_get"><field name="VAR" id="gx">gX</field></block>';
const setX = (value) => `<block type="variables_set"><field name="VAR" id="gx">gX</field><value name="VALUE">${value}</value></block>`;
const plus40 = `<block type="math_arithmetic"><field name="OP">ADD</field><value name="A">${gX}</value><value name="B">${num(40)}</value></block>`;
const define = '<block type="sprite_pool_define"><field name="ID">1</field><field name="FROM">1</field><field name="TO">3</field></block>';
const spawn = `<block type="sprite_pool_spawn"><value name="ID">${num(1)}</value><statement name="DO">${chain([setPool('x', gX), setPool('y', num(20))])}</statement></block>`;
const start = chain([define, setX(num(30)), spawn, setX(plus40), spawn, setX(plus40), spawn]);
const wrap = `<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">GT</field><value name="A">${poolY}</value><value name="B">${num(150)}</value></block></value>` +
  `<statement name="DO0">${setPool('y', num(20))}</statement></block>`;
const each = (body) => `<block type="sprite_pool_each"><value name="ID">${num(1)}</value><statement name="DO">${chain(body)}</statement></block>`;
const small = [changePool('y', 1), wrap];
const big = [...small, ...Array.from({length: 12}, (_, i) => changePool('x', i % 2 ? -1 : 1))];
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
['dpc', 'pxe'].forEach((kernel) => {
  [['small', small], ['big', big]].forEach(([key, body]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `fire_${kernel}_8_plain.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Pool inline ${kernel} ${key}`;
    doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="gx">gX</variable></variables>` +
      `${event('gameplay_start', 'ev0', 20, start)}${event('gameplay_update', 'ev1', 300, each(body))}</xml>`;
    fs.writeFileSync(path.join(dir, `poolinline_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
