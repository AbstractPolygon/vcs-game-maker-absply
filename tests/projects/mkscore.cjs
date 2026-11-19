// usage: node tests/projects/mkscore.cjs -> tests/projects/score_layout_<layout>.vcsgm for the Score tab's layouts (normal, 33, 42, 51), the standard kernel with the
// score 123456 (tv_std_score_ntsc.vcsgm) and the layout set; and score_blocks_<layout>.vcsgm, which set and change the left and the right score with the
// Score left and Score right blocks (left set to 123, right set to 45, left change by 2, right change by 960 to hit the limit) at the start of the game.
// tests/emulator/picsame.cjs renders the picture (PNG=prefix SHOW=frame) to look at the digits.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const scoreBlock = (type, value) => `<block type="${type}"><value name="VALUE">${num(value)}</value></block>`;
const changeBlock = (type, value) => `<block type="${type}"><value name="DELTA">${num(value)}</value></block>`;
const layouts = {normal: 'normal', 33: '3+3', 42: '4+2', 51: '5+1'};
const load = () => yaml.load(fs.readFileSync(path.join(dir, 'tv_std_score_ntsc.vcsgm'), 'utf8'));
const save = (name, doc) => fs.writeFileSync(path.join(dir, `${name}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
Object.entries(layouts).forEach(([key, layout]) => {
  const doc = load();
  doc.configuration.scoreLayout = layout;
  doc.configuration.projectTitle = `Score layout ${layout}`;
  save(`score_layout_${key}`, doc);
  if (key === 'normal') return;
  const blocks = load();
  blocks.configuration.scoreLayout = layout;
  blocks.configuration.projectTitle = `Score blocks ${layout}`;
  const body = chain([
    scoreBlock('score_left_set', 123), scoreBlock('score_right_set', 45),
    changeBlock('score_left_change', 2), changeBlock('score_right_change', 5),
  ]);
  blocks['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${body}</statement></block></xml>`;
  save(`score_blocks_${key}`, blocks);
});
console.log('ok');

// score_multi_<a|b|c>: the Score tab's layout 3+3 with Set score layout blocks (more than one layout in the ROM, each minikernel behind the dispatcher):
// a: Set score layout 4+2 at the start of the game (picture 1234 and 56); b: 5+1 and then Score left change by 2 (the left score is tens: 12365 and 6);
// c: 4+2, then back to 3+3 (picture 123 and 456; both minikernels are in the ROM).
const layoutBlock = (value) => `<block type="score_layout_set"><field name="LAYOUT">${value}</field></block>`;
Object.entries({a: [layoutBlock('4+2')], b: [layoutBlock('5+1'), changeBlock('score_left_change', 2)], c: [layoutBlock('4+2'), layoutBlock('3+3')]}).forEach(([key, blocks]) => {
  const doc = load();
  doc.configuration.scoreLayout = '3+3';
  doc.configuration.projectTitle = `Score multi ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain(blocks)}</statement></block></xml>`;
  save(`score_multi_${key}`, doc);
});

// score_font_<a|b>: a secondary score font (alarmclock) with a two score layout. a: 3+3 only, Set font secondary, left 123 and right 255; b: 3+3 and a switch to 4+2
// (two minikernels in the ROM), Set font secondary, left 200 and right 56. The digits have to come out in the secondary font.
const fontBlock = `<block type="score_font_set"><field name="FONT">secondary</field></block>`;
Object.entries({a: [fontBlock, scoreBlock('score_left_set', 123), scoreBlock('score_right_set', 255)],
  b: [layoutBlock('4+2'), fontBlock, scoreBlock('score_left_set', 200), scoreBlock('score_right_set', 56)]}).forEach(([key, blocks]) => {
  const doc = load();
  doc.configuration.scoreLayout = '3+3';
  doc.configuration.secondaryScoreFont = 'alarmclock';
  doc.configuration.projectTitle = `Score font ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain(blocks)}</statement></block></xml>`;
  save(`score_font_${key}`, doc);
});

// score_value_<a|b>: the Score left and Score right value blocks. a: 3+3, left set 123, right set 200, left set to (Score right), right set to (Score left + 1): the picture reads 200 and 201.
// b: 3+3 with a switch to 4+2, left set 99, right set to (Score left): 0099 and 99. (The values pass through the blocks, so a wrong digit shows in the picture.)
const getBlock = (type) => `<block type="${type}"></block>`;
const setTo = (type, inner) => `<block type="${type}"><value name="VALUE">${inner}</value></block>`;
const plusOne = (inner) => `<block type="math_arithmetic"><field name="OP">ADD</field><value name="A">${inner}</value><value name="B">${num(1)}</value></block>`;
Object.entries({
  a: [scoreBlock('score_left_set', 123), scoreBlock('score_right_set', 200), setTo('score_left_set', getBlock('score_right_get')), setTo('score_right_set', plusOne(getBlock('score_left_get')))],
  b: [layoutBlock('4+2'), scoreBlock('score_left_set', 99), setTo('score_right_set', getBlock('score_left_get'))],
}).forEach(([key, blocks]) => {
  const doc = load();
  doc.configuration.scoreLayout = '3+3';
  doc.configuration.projectTitle = `Score value ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain(blocks)}</statement></block></xml>`;
  save(`score_value_${key}`, doc);
});

// score_value_<c|d>: c: the same as score_value_a, but the two set blocks with the value blocks are inside a custom Function that the game calls (the values are read through the
// reserved bytes there): the picture reads 200 and 201. d: the cap, left set 200, left change 155 (355), right set to (Score left): the picture reads 355 and 255.
const fnDefine = (body) => `<block type="function_define" id="fn0" x="400" y="20"><field name="NAME">swapadd</field><statement name="DO">${body}</statement></block>`;
const fnCall = `<block type="function_call_statement"><field name="NAME">swapadd</field><value name="ARG1">${num(0)}</value></block>`;
Object.entries({
  c: {game: [scoreBlock('score_left_set', 123), scoreBlock('score_right_set', 200), fnCall], fn: [setTo('score_left_set', getBlock('score_right_get')), setTo('score_right_set', plusOne(getBlock('score_left_get')))]},
  d: {game: [scoreBlock('score_left_set', 200), changeBlock('score_left_change', 155), fnCall], fn: [setTo('score_right_set', getBlock('score_left_get'))]},
}).forEach(([key, parts]) => {
  const doc = load();
  doc.configuration.scoreLayout = '3+3';
  doc.configuration.projectTitle = `Score value ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain(parts.game)}</statement></block>${fnDefine(chain(parts.fn))}</xml>`;
  save(`score_value_${key}`, doc);
});

// score_bars_<normal|33|42|51>: score bars with each layout. Bar 1 health 5 (a solid block 5 wide), bar 2 lives 3 (three dots), score 123456 set at the start: the bars have to show on both sides
// of the score as they do with the normal score.
const barHealth = (value) => `<block type="score_bar_set_health"><field name="VAR">pfscore1</field><value name="VALUE">${num(value)}</value></block>`;
const barLives = (value) => `<block type="score_bar_set_lives"><field name="VAR">pfscore2</field><value name="VALUE">${num(value)}</value></block>`;
Object.entries(layouts).forEach(([key, layout]) => {
  const doc = load();
  doc.configuration.scoreLayout = layout;
  doc.configuration.projectTitle = `Score bars ${layout}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain([barHealth(5), barLives(3)])}</statement></block></xml>`;
  save(`score_bars_${key}`, doc);
});

// score_one_<a|b|c|d>: the one score layout in a project that switches layouts. a: Score tab one score, Set score layout 3+3 (123 456); b: Score tab 3+3, Set score layout one score
// (123456); c: Score tab one score, 3+3, then back to one score (123456); d: Score tab 3+3, the bars set, Set score layout one score (123456 and the bars, the score code of the kernel draws them).
Object.entries({
  a: ['normal', [layoutBlock('3+3')]], b: ['3+3', [layoutBlock('normal')]], c: ['normal', [layoutBlock('3+3'), layoutBlock('normal')]],
  d: ['3+3', [barHealth(5), barLives(3), layoutBlock('normal')]],
}).forEach(([key, [tab, blocks]]) => {
  const doc = load();
  doc.configuration.scoreLayout = tab;
  doc.configuration.projectTitle = `Score one ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain(blocks)}</statement></block></xml>`;
  save(`score_one_${key}`, doc);
});

// score_five_<a|b|c>: the Score tab's 5 digit switch (scoreDigits 5) with the one score layout. a: no layout blocks (the kernel draws the score); b: Score tab one score, 3+3 and back to one score
// (a minikernel made from the score code of the kernel draws it); c: Score tab 3+3 with a switch to one score. The pictures of a, b and c have to be the same (digits centered the same way).
Object.entries({a: ['normal', []], b: ['normal', [layoutBlock('3+3'), layoutBlock('normal')]], c: ['3+3', [layoutBlock('normal')]]}).forEach(([key, [tab, blocks]]) => {
  const doc = load();
  doc.configuration.scoreLayout = tab;
  doc.configuration.scoreDigits = 5;
  doc.configuration.projectTitle = `Score five ${key}`;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain(blocks)}</statement></block></xml>`;
  save(`score_five_${key}`, doc);
});
