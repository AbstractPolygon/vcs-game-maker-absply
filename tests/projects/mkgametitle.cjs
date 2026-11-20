// usage: node tests/projects/mkgametitle.cjs -> tests/projects/gametitle_<std|dpc>.vcsgm from ball2.vcsgm: the title screen (Titlescreen Kernel) changes the state to gameplay while the variable gState is 0, gameplay start fills the playfield
// and puts Player 0 in view, and gameplay update has a Run once with Start title screen. The title screen is back after that: it must not show the playfield and Player 0 of the game.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const set = (v, n) => `<block type="sprite_player_set"><field name="VAR">${v}</field><value name="VALUE">${num(n)}</value></block>`;
const fill = '<block type="background_fill_area"><value name="X1">' + num(0) + '</value><value name="Y1">' + num(0) + '</value><value name="X2">' + num(31) + '</value><value name="Y2">' + num(10) + '</value></block>';
const ev = (name, body, x) => `<block type="event_block" id="ev_${name}" x="${x}" y="20"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
['std', 'dpc'].forEach((kernel) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, 'ball2.vcsgm'), 'utf8'));
  if (kernel === 'dpc') doc.configuration.kernel = 'dpcplus';
  doc.configuration.projectTitle = `Game title ${kernel}`;
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="gs">gState</variable></variables>' +
    ev('title_update', chain(['<block type="titlescreen_draw"><field name="SCREEN">3</field></block>', '<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="variables_get"><field name="VAR" id="gs">gState</field></block></value><value name="B">' + num(0) + '</value></block></value><statement name="DO0"><block type="variables_set"><field name="VAR" id="gs">gState</field><value name="VALUE">' + num(1) + '</value><next><block type="event_change_state"><field name="STATE">gameplay</field></block></next></block></statement></block>']), 20) +
    ev('gameplay_start', chain([fill, set('player0x', 80), set('player0y', 60), set('player1x', 40), set('player1y', 30), '<block type="sprite_missile_set"><value name="VALUE">' + num(70) + '</value></block>', '<block type="score_set"><value name="VALUE">' + num(5) + '</value></block>']), 300) +
    ev('gameplay_update', chain(['<block type="sprite_player_change"><value name="DELTA">' + num(1) + '</value></block>', '<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="sprite_player_get"></block></value><value name="B">' + num(100) + '</value></block></value><statement name="DO0"><block type="titlescreen_start"></block></statement></block>']), 600) + '</xml>';
  fs.writeFileSync(path.join(dir, `gametitle_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
