// usage: node tests/projects/mktextif.cjs -> tests/projects/textif_<std|dpc|pxe>_<ctl|if>.vcsgm: the Text Minikernel projects of mkpal.cjs (tv_*_text_ntsc)
// showing "HELLO 123" when gameplay starts; the _if ones also have, every frame, an "if fire is pressed" with every kind of text block in it. Run with no
// input (fire is never pressed), the two of each kernel must give the same pictures: nothing under an if that does not trigger may run.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const num = (n) => `<value name="VALUE"><block type="math_number"><field name="NUM">${n}</field></block></value>`;
const val = (name, n) => `<value name="${name}"><block type="math_number"><field name="NUM">${n}</field></block></value>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const textBlocks = chain([
  '<block type="text_minikernel_show"><field name="TEXT">BAD TEXT</field></block>',
  '<block type="text_minikernel_show_row"><field name="ROW">2</field><field name="TEXT">ROW BAD</field></block>',
  '<block type="text_minikernel_show_named"><field name="TEXT_ID">1</field></block>',
  '<block type="text_minikernel_show_named_row"><field name="ROW">1</field><field name="TEXT_ID">1</field></block>',
  '<block type="text_minikernel_show_named_scroll"><field name="TEXT_ID">1</field></block>',
  '<block type="text_minikernel_show_scroll"><field name="TEXT">A LONG MESSAGE THAT SCROLLS ALONG</field></block>',
  `<block type="text_minikernel_show_by_id">${num(1)}</block>`,
  `<block type="text_minikernel_set_color">${num(68)}</block>`,
  `<block type="text_minikernel_set_background">${num(134)}</block>`,
  `<block type="text_minikernel_fade_to">${num(14)}${val('FRAMES', 30)}</block>`,
  `<block type="text_minikernel_blink">${val('FRAMES', 8)}</block>`,
  `<block type="text_minikernel_clear_after">${val('FRAMES', 10)}</block>`,
  '<block type="text_minikernel_clear"></block>',
]);
const ifFire = '<block type="controls_if"><value name="IF0"><block type="input_joystick_get"><field name="JOYSTICK">0</field><field name="VAR">joy0fire</field></block></value>' +
  `<statement name="DO0">${textBlocks}</statement></block>`;
for (const kernel of ['std', 'dpc', 'pxe']) {
  const doc = yaml.load(fs.readFileSync(path.join(__dirname, `tv_${kernel}_text_ntsc.vcsgm`), 'utf8'));
  for (const kind of ['ctl', 'if']) {
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
      '<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">' +
      '<block type="text_minikernel_show" id="t0"><field name="TEXT">HELLO 123</field></block></statement></block>' +
      (kind === 'if' ? `<block type="event_block" id="ev1" x="20" y="300"><field name="EVENT">gameplay_update</field><statement name="DO">${ifFire}</statement></block>` : '') +
      '</xml>';
    const out = `textif_${kernel}_${kind}.vcsgm`;
    fs.writeFileSync(path.join(__dirname, out), yaml.dump(doc, {lineWidth: -1}));
    console.log(out);
  }
}
