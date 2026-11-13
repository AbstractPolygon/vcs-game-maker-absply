// usage: node tests/projects/mkspriteshare.cjs -> tests/projects/spriteshare.vcsgm: DPC+ with Players 1 to 4 all playing the same 3-frame animation, so the
// build keeps its frames once (utils/dpc-share-source.js: the build log says how many frames were pointed at an earlier copy). For a look at the
// sprites (tests/emulator/framepng.cjs). Made from dpcstress_96.vcsgm (mkdpcstress.cjs).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'dpcstress_96.vcsgm'), 'utf8'));
doc.configuration = {...doc.configuration, projectTitle: 'Sprite share', dpcPlusSpriteMax: 4, dpcPlusTilemap: false, dpcPlusRuns: false};
const frame = (shift) => Array.from({length: 12}, (_, y) => Array.from({length: 8}, (_, x) => (((x + y + shift) % 4) < 2 ? 'X' : '.')).join('')).join('\n');
doc['player-animations'] = {animations: [{id: 0, name: 'Shared', frames: [0, 1, 2].map((k) => ({id: k + 1, duration: 8, pixels: frame(k)})), previewWidthScale: 1}]};
const sets = [1, 2, 3, 4].flatMap((n) => [
  `<block type="sprite_player_set_animation"><field name="PLAYER">${n}</field><field name="VAR">0</field><field name="RESTART">TRUE</field><field name="START">${(n % 3) + 1}</field><field name="LOOP">TRUE</field></block>`,
  `<block type="sprite_player_set"><field name="PLAYER">${n}</field><field name="VAR">player${n}x</field><value name="VALUE">${num(20 + n * 25)}</value></block>`,
  `<block type="sprite_player_set"><field name="PLAYER">${n}</field><field name="VAR">player${n}y</field><value name="VALUE">${num(20 + n * 30)}</value></block>`,
]);
doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
  `<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain([
    `<block type="background_set_select"><field name="VAR">${doc.backgrounds.backgrounds[0].id}</field></block>`, ...sets])}</statement></block></xml>`;
fs.writeFileSync(path.join(__dirname, 'spriteshare.vcsgm'), yaml.dump(doc, {lineWidth: -1}));
console.log('spriteshare.vcsgm');
