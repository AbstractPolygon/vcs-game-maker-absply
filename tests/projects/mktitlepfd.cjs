// usage: node tests/projects/mktitlepfd.cjs -> tests/projects/titlepfd_<std|dpc>.vcsgm from gametitle_<kernel>.vcsgm without the Start title screen of its gameplay: the
// title screen (Titlescreen Kernel, its variables) changes to gameplay, and gameplay start fills the playfield with a Draw block. No block of the title phase draws, so
// the Title Screen's variables take the slots of the Draw engine's bytes (see pfDrawTitleShared in generators/bbasic.js). picsame.cjs: the same pictures as a build without.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
['std', 'dpc'].forEach((kernel) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, `gametitle_${kernel}.vcsgm`), 'utf8'));
  doc.configuration.projectTitle = `Title pfd ${kernel}`;
  doc['blockly-workspace'] = doc['blockly-workspace'].replace(/<next><block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ<\/field><value name="A"><block type="sprite_player_get"><\/block>.*?<block type="titlescreen_start"><\/block><\/statement><\/block><\/next>/, '');
  if (doc['blockly-workspace'].includes('titlescreen_start')) throw new Error('start left');
  fs.writeFileSync(path.join(dir, `titlepfd_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
