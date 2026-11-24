// usage: node tests/projects/mkscratch.cjs -> tests/projects/scratch_std_<area|both>.vcsgm from offset_std_left.vcsgm: Playfield offset left on an area (columns 3 to 12,
// rows 2 to 6: not whole bytes, so the routine that works the edges out when the game runs, with its working bytes) every frame; both: also an AtariVox high scores
// clear in a Run once (its three working bytes share the slots of the offset's: the scratch pool, see scratchGroup in generators/bbasic.js). picsame.cjs: the
// same pictures as a build without the pool; the variables of both: 3 fewer slots.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const offset = '<block type="background_offset"><mutation whole="0"></mutation><field name="DIRECTION">left</field><field name="WHOLE">FALSE</field>' +
  `<value name="X1">${num(3)}</value><value name="X2">${num(12)}</value><value name="Y1">${num(2)}</value><value name="Y2">${num(6)}</value></block>`;
const clear = '<block type="event_run_once"><statement name="DO"><block type="avox_highscore_clear"></block></statement></block>';
[['area', false], ['both', true]].forEach(([key, avox]) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, 'offset_std_left.vcsgm'), 'utf8'));
  doc.configuration.projectTitle = `Scratch std ${key}`;
  // (Superchip RAM: the Draw engine of the fill and the offset's bytes are more than the letters hold.)
  doc.configuration.enableSuperchip = true;
  doc.configuration.enableAtariVox = avox;
  const body = avox ? clear.replace(/<\/block>$/, `<next>${offset}</next></block>`) : offset;
  doc['blockly-workspace'] = doc['blockly-workspace'].replace(/<block type="background_offset">.*?<\/block>/, body);
  fs.writeFileSync(path.join(dir, `scratch_std_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
