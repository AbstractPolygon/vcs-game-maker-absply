// usage: node tests/projects/mkscore.cjs -> tests/projects/score_dpc.vcsgm: a DPC+ project that shows the score 123456 from the start (Score set
// to, in Gameplay start), made from scroll_dpc_fit.vcsgm (made by mkscroll.cjs). For checking the score digits after a change in the size of the
// DPC+ coprocessor program (custom2*.bin) or in the kernel code ahead of the score loop: the loop is cycle exact and draws the digits wrong when
// it crosses a page (tests/emulator/scoredigits.cjs).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'scroll_dpc_fit.vcsgm'), 'utf8'));
doc.configuration = {...doc.configuration, projectTitle: 'Score digits dpc', showScore: true};
doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
  '<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">' +
  '<block type="score_set" id="s0"><value name="VALUE"><block type="math_number" id="s0n"><field name="NUM">123456</field></block></value></block>' +
  '</statement></block></xml>';
const out = path.join(__dirname, 'score_dpc.vcsgm');
fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
console.log(out);
