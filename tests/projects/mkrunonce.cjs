// usage: node tests/projects/mkrunonce.cjs -> tests/projects/runonce_<std|dpc|pxe>.vcsgm from fire_<kernel>_8_plain.vcsgm (std: gametitle_std.vcsgm's configuration):
// Gameplay update has a Run once block that adds 1 to the score, and an Every 32 frames block that adds 100 (a control that the game runs). After 300 frames the
// score has to read 1 in its ones: the Run once ran once. Before the fix of 2026-11-23 PXE added 1 every frame (its flag bytes in display memory page $0F, which
// the PXE kernel does not keep).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const change = (n) => `<block type="score_change"><value name="DELTA">${num(n)}</value></block>`;
const body = `<block type="event_run_once"><statement name="DO">${change(1)}</statement><next><block type="event_frame_every_n"><field name="MASK">31</field><field name="DELTA">0</field>` +
  `<statement name="DO">${change(100)}</statement></block></next></block>`;
[['std', 'fire_std_8_plain'], ['dpc', 'fire_dpc_8_plain'], ['pxe', 'fire_pxe_8_plain']].forEach(([kernel, base]) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, `${base}.vcsgm`), 'utf8'));
  doc.configuration.projectTitle = `Run once ${kernel}`;
  doc.configuration.showScore = true;
  doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev1" x="20" y="20"><field name="EVENT">gameplay_update</field>' +
    `<statement name="DO">${body}</statement></block></xml>`;
  fs.writeFileSync(path.join(dir, `runonce_${kernel}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
