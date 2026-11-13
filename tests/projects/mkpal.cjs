// usage: node tests/projects/mkpal.cjs -> tests/projects/tv_<kernel>_<what>_<tv>.vcsgm: a project that shows the score 123456 (what = score) or the
// Text Minikernel's "HELLO 123" (what = text) from the start, on the standard kernel, DPC+ and PXE (kernel = std, dpc, pxe), NTSC or PAL 50 Hz
// (tv = ntsc, pal); made from the scroll test projects of mkscroll.cjs (their background stays). For comparing the score and text between the
// two TV standards (tests/emulator/tvcompare.cjs).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bases = {std: 'scroll_std_fit.vcsgm', dpc: 'scroll_dpc_fit.vcsgm', pxe: 'scroll_pxe_fit.vcsgm'};
const shows = {
  score: '<block type="score_set" id="s0"><value name="VALUE"><block type="math_number" id="s0n"><field name="NUM">123456</field></block></value></block>',
  text: '<block type="text_minikernel_show" id="t0"><field name="TEXT">HELLO 123</field></block>',
};
for (const [kernel, base] of Object.entries(bases)) {
  for (const [what, block] of Object.entries(shows)) {
    for (const tv of ['ntsc', 'pal']) {
      const doc = yaml.load(fs.readFileSync(path.join(__dirname, base), 'utf8'));
      doc.configuration = {...doc.configuration, projectTitle: `TV ${kernel} ${what} ${tv}`, showScore: true, tvStandard: tv};
      doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
        `<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${block}</statement></block></xml>`;
      const out = path.join(__dirname, `tv_${kernel}_${what}_${tv}.vcsgm`);
      fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
      console.log(path.basename(out));
    }
  }
}
