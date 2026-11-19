// usage: node tests/projects/mkgravctl.cjs -> tests/projects/gravctl_<std|dpc>.vcsgm from tv_<kernel>_score_ntsc.vcsgm: at the start of the game missile 0 and missile 1 both start Gravity (down,
// a speed-up every 4 frames, max fall speed 2); missile 0 then gets a Stop gravity block and stays where it is; missile 1 gets Stop gravity then Start gravity (the Start / Stop gravity
// block, no numbers) and falls about 60 pixels between frame 30 and frame 60. Read missile0y and missile1y at the two frames.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const gravity = (object) => `<block type="object_gravity"><field name="ACTION">start</field><field name="OBJECT">${object}</field><field name="BOUNCE">4</field>` +
  `<value name="PULL">${num(2)}</value><value name="MAXFALL">${num(2)}</value><value name="ANGLE">${num(128)}</value></block>`;
const control = (action, object) => `<block type="object_gravity_control"><field name="ACTION">${action}</field><field name="OBJECT">${object}</field></block>`;
['std', 'dpc'].forEach((kernel) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
  const list = [gravity('missile0'), gravity('missile1'), control('stop', 'missile0'), control('stop', 'missile1'), control('start', 'missile1')];
  const chain = list.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field>' +
    `<statement name="DO">${chain}</statement></block></xml>`;
  doc.configuration.projectTitle = `Gravity start and stop ${kernel}`;
  if (kernel === 'std') doc.configuration.enableSuperchip = true;
  fs.writeFileSync(path.join(dir, `gravctl_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
