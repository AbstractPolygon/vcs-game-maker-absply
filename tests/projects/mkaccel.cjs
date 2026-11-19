// usage: node tests/projects/mkaccel.cjs -> tests/projects/accel_<std|dpc>_<a|b>.vcsgm from tv_<kernel>_score_ntsc.vcsgm: at the start of the game three objects (missile 0, missile 1 and
// the ball) start Accelerate with any direction (the DIRECTIONS16 field ANY) at a heading (0 to 255 a full turn), a rate (256ths of a pixel a frame, as the fine velocity has
// it) and a speed limit. Set a: headings 0, 64, 32 (rate 16, max 4, 4, 4); set b: headings 128, 192, 100 (rate 32, max 5, 6, 3); set c: the 8 and 16 direction
// blocks of an object that also has an any one (heading 2 of 8 directions and 5 of 16) and the any direction at 200. tests/emulator/accelany.cjs reads the velocity of the objects.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const accel = (object, mode, heading, rate, max) => `<block type="sprite_inertia_accelerate"><field name="ACTION">start</field><field name="OBJECT">${object}</field>` +
  `<field name="DIRECTIONS16">${mode}</field><field name="FINE">FALSE</field><value name="DIRECTION">${num(heading)}</value><value name="RATE">${num(rate)}</value>` +
  `<value name="MAXSPEED">${num(max)}</value></block>`;
const sets = {
  a: [['missile0', 'ANY', 0, 16, 4], ['missile1', 'ANY', 64, 16, 4], ['ball', 'ANY', 32, 16, 4]],
  b: [['missile0', 'ANY', 128, 32, 5], ['missile1', 'ANY', 192, 32, 6], ['ball', 'ANY', 100, 32, 3]],
  d: [['missile0', 'ANY', 10, 16, 4], ['missile0', 'FALSE', 2, 16, 4], ['missile1', 'ANY', 0, 16, 4], ['missile1', 'TRUE', 4, 16, 4]],
  c: [['missile0', 'FALSE', 2, 16, 4], ['missile1', 'TRUE', 5, 16, 4], ['ball', 'ANY', 200, 16, 4], ['missile0', 'ANY', 128, 16, 4]],
};
['std', 'dpc'].forEach((kernel) => {
  Object.entries(sets).forEach(([key, list]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
    const chain = list.map((args) => accel(...args)).reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field>' +
      `<statement name="DO">${chain}</statement></block></xml>`;
    doc.configuration.projectTitle = `Accelerate any ${kernel} ${key}`;
    // (Three objects with the fine velocity need more variables than the standard kernel has without Superchip RAM.)
    if (kernel === 'std') doc.configuration.enableSuperchip = true;
    fs.writeFileSync(path.join(dir, `accel_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
