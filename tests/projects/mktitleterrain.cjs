// usage: node tests/projects/mktitleterrain.cjs -> tests/projects/titleterr_<std|dpc>.vcsgm from ball2.vcsgm (the Title Screen Kernel demo): in Title screen update a Run once block clears the playfield
// and makes terrain on the bottom, the Draw title screen block shows the title screen (the Titlescreen Kernel runs), and when Terrain done is true the End title screen block shows the game screen
// (the terrain has to be there: the project was reported not to make terrain while the Title Screen Kernel runs) and the score is set to 777. tests/emulator/picsame.cjs renders the picture (SHOW=frame).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const terrain = '<block type="background_generate_terrain"><field name="SIDE">BOTTOM</field><value name="MIN">' + num(3) + '</value><value name="MAX">' + num(6) + '</value><value name="ROUGH">' + num(2) + '</value><value name="OVER">' + num(0) + '</value></block>';
const done = '<block type="controls_if"><value name="IF0"><block type="background_generate_terrain_done"></block></value><statement name="DO0">' + chain(['<block type="score_set"><value name="VALUE">' + num(777) + '</value></block>', '<block type="titlescreen_end"></block>']) + '</statement></block>';
const update = chain([`<block type="event_run_once"><statement name="DO">${chain(['<block type="background_clear"></block>', terrain])}</statement></block>`, '<block type="titlescreen_draw"><field name="SCREEN">3</field></block>', done]);
['std', 'dpc'].forEach((kernel) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, 'ball2.vcsgm'), 'utf8'));
  if (kernel === 'dpc') doc.configuration.kernel = 'dpcplus';
  doc.configuration.projectTitle = `Title terrain ${kernel}`;
  doc.configuration.showScore = true;
  doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">title_update</field><statement name="DO">${update}</statement></block></xml>`;
  fs.writeFileSync(path.join(dir, `titleterr_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
