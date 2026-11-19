// usage: node tests/projects/mkblink.cjs -> tests/projects/blink_<std|dpc>_<plain|color>.vcsgm from textif_<kernel>_ctl.vcsgm (HELLO 123 shown at the start of the game).
// plain: Blink text forever. color: the same, and every frame a Text set color block sets row 1 to the color $46 (a red) in gameplay_update: the blink has to keep
// working (the text shows in $46 and is hidden in the other phase). tests/emulator/blinkcolor.cjs counts the frames the text is lit and the colors it shows.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
['std', 'dpc'].forEach((kernel) => {
  ['plain', 'color'].forEach((variant) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `textif_${kernel}_ctl.vcsgm`), 'utf8'));
    const start = '<block type="text_minikernel_show" id="t0"><field name="TEXT">HELLO 123</field><next><block type="text_minikernel_blink"><field name="FOREVER">TRUE</field><field name="CLEAR">FALSE</field>' +
      `<value name="TIMES">${num(3)}</value></block></next></block>`;
    const update = variant === 'color' ? '<block type="event_block" id="ev1" x="20" y="200"><field name="EVENT">gameplay_update</field><statement name="DO">' +
      `<block type="text_minikernel_set_color"><field name="ROW">1</field><value name="VALUE">${num(70)}</value></block></statement></block>` : '';
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field>' +
      `<statement name="DO">${start}</statement></block>${update}</xml>`;
    doc.configuration.projectTitle = `Blink ${kernel} ${variant}`;
    fs.writeFileSync(path.join(dir, `blink_${kernel}_${variant}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
