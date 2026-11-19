// usage: node tests/projects/mkgrav.cjs -> tests/projects/grav_<std|dpc>_<a|b>.vcsgm from tv_<kernel>_score_ntsc.vcsgm: at the start of the game three objects (missile 0, missile 1 and
// the ball) start Gravity (a speed-up every 4 frames, max fall speed 2, bounce keeps 100%) pulling toward a direction (a heading of 256 to the turn, 128 down: the old gravity).
// Set a: 64 (right), 0 (up), 200; set b: 128 (down, the old code), 192 (left), 100. From frame 30 to frame 60 the speed is 2: an object has moved about 60 pixels along the heading.
// tests/emulator/ reads (a varwatch style script) the x and y of the objects (missile0x, missile0y, ...) at the two frames.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const gravity = (object, angle) => `<block type="object_gravity"><field name="ACTION">start</field><field name="OBJECT">${object}</field><field name="BOUNCE">4</field>` +
  `<value name="PULL">${num(2)}</value><value name="MAXFALL">${num(2)}</value><value name="ANGLE">${num(angle)}</value></block>`;
const sets = {
  a: [['missile0', 64], ['missile1', 0], ['ball', 200]],
  b: [['missile0', 128], ['missile1', 192], ['ball', 100]],
};
['std', 'dpc'].forEach((kernel) => {
  Object.entries(sets).forEach(([key, list]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
    const chain = list.map((args) => gravity(...args)).reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field>' +
      `<statement name="DO">${chain}</statement></block></xml>`;
    doc.configuration.projectTitle = `Gravity direction ${kernel} ${key}`;
    // (Three objects with gravity need more variables than the standard kernel has without Superchip RAM.)
    if (kernel === 'std') doc.configuration.enableSuperchip = true;
    fs.writeFileSync(path.join(dir, `grav_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
