// usage: node tests/projects/mkevery.cjs -> tests/projects/every_x_<std|dpc>.vcsgm from tv_<kernel>_score_ntsc.vcsgm: in gameplay_update an Every x frames block with x 3 (a counter byte)
// adds 1 to the score, one with x 8 (the frame counter mask) adds 1000, and one with the blocks 5 + 5 (not a plain number, a counter byte) adds 10000.
// After 90 frames the score has to show the number of times each ran: 31 (the first run is at once), 12 and 10: 112031 at frame 91.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const change = (amount) => `<block type="score_change"><value name="DELTA">${num(amount)}</value></block>`;
const every = (x, amount) => `<block type="event_frame_every_x"><value name="X">${x}</value><statement name="DO">${change(amount)}</statement></block>`;
const sum = `<block type="math_arithmetic"><field name="OP">ADD</field><value name="A">${num(5)}</value><value name="B">${num(5)}</value></block>`;
['std', 'dpc'].forEach((kernel) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, `tv_${kernel}_score_ntsc.vcsgm`), 'utf8'));
  const chain = [every(num(3), 1), every(num(8), 1000), every(sum, 10000)];
  const body = chain.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_update</field>' +
    `<statement name="DO">${body}</statement></block></xml>`;
  doc.configuration.projectTitle = `Every x frames ${kernel}`;
  fs.writeFileSync(path.join(dir, `every_x_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
