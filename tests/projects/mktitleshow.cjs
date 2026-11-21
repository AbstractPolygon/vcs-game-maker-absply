// usage: node tests/projects/mktitleshow.cjs -> tests/projects/titleshow_<std|dpc>_<on|off>.vcsgm from gametitle_<std|dpc>.vcsgm: "Title screen start" has Start title
// screen, Draw title screen and an Every 30 frames block that adds 1 to the variable gState; on: the Every block is inside "While title screen is showing", off: it is
// not (it runs once, with the event). Read gState (the symbol file) every frame with emulator/ramwatch.cjs: on goes up by 1 every 30 frames while the title screen
// shows, off stays at 0 or 1.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const ev = (name, body, x) => `<block type="event_block" id="ev_${name}" x="${x}" y="20"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
['std', 'dpc'].forEach((kernel) => {
  ['on', 'off'].forEach((mode) => {
    const doc = yaml.load(fs.readFileSync(path.join(__dirname, `gametitle_${kernel}.vcsgm`), 'utf8'));
    const add = '<block type="variables_set"><field name="VAR" id="gs">gState</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field>' +
      `<value name="A"><block type="variables_get"><field name="VAR" id="gs">gState</field></block></value><value name="B">${num(1)}</value></block></value></block>`;
    const every = `<block type="event_frame_every_x"><value name="X">${num(30)}</value><statement name="DO">${add}</statement></block>`;
    const body = mode === 'on' ? `<block type="titlescreen_while_showing"><statement name="DO">${every}</statement></block>` : every;
    doc.configuration = {...doc.configuration, projectTitle: `Title show ${kernel} ${mode}`};
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="gs">gState</variable></variables>' +
      ev('title_start', chain(['<block type="titlescreen_start"></block>', '<block type="titlescreen_draw"><field name="SCREEN">3</field></block>', body]), 20) +
      ev('title_update', '<block type="titlescreen_draw"><field name="SCREEN">3</field></block>', 400) + '</xml>';
    const out = path.join(__dirname, `titleshow_${kernel}_${mode}.vcsgm`);
    fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
    console.log(path.basename(out));
  });
});
