// usage: node tests/projects/mktitleblocks.cjs -> tests/projects/titleblocks_<std|dpc>_<switch|back|end>.vcsgm from gametitle_<std|dpc>.vcsgm, with a page 4 (a copy
// of page 3 with another background color). "Title screen start" has Start title screen, Draw title screen 3 and While title screen is showing; "Title screen
// update" is empty, so the loop draws the page the blocks pick. switch: inside While title screen is showing, When the animation of graphic 3 of page 3 finishes
// adds 1 to gState and draws page 4 (it stays on page 4). back: the same, and When the animation of graphic 3 of page 4 finishes adds 1 to gState, draws page 3
// and starts its animation again (Animate), so the pages take turns. end: When the animation of graphic 3 of page 3 finishes adds 1 to gState and ends
// the title screen (End title screen): the regular screen from then on. Read gState and titleScreenSelectedId (the symbol file) every frame, and the frame
// lengths with emulator/rollcheck.cjs (a frame drawn twice would be about 500 lines).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const ev = (name, body, x) => `<block type="event_block" id="ev_${name}" x="${x}" y="20"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
const add = '<block type="variables_set"><field name="VAR" id="gs">gState</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field>' +
  `<value name="A"><block type="variables_get"><field name="VAR" id="gs">gState</field></block></value><value name="B">${num(1)}</value></block></value></block>`;
const draw = (screen) => `<block type="titlescreen_draw"><field name="SCREEN">${screen}</field></block>`;
const finished = (ref, body) => `<block type="titlescreen_animation_finished"><field name="CARD">${ref}</field><statement name="DO">${chain(body)}</statement></block>`;
const animate = (ref) => `<block type="titlescreen_card_animate"><field name="CARD">${ref}</field><field name="DIRECTION">forward</field><field name="PLAYBACK">once</field></block>`;
['std', 'dpc'].forEach((kernel) => {
  ['switch', 'back', 'end'].forEach((mode) => {
    const doc = yaml.load(fs.readFileSync(path.join(__dirname, `gametitle_${kernel}.vcsgm`), 'utf8'));
    const page3 = doc['title-screen'].screens.find((screen) => String(screen.id) === '3');
    doc['title-screen'].screens.push({...JSON.parse(JSON.stringify(page3)), id: 4, name: 'Page 4', backgroundColor: 0x44});
    const inside = mode === 'end' ? [finished('3:3', [add, '<block type="titlescreen_end"></block>'])] : [finished('3:3', [add, draw(4)]), ...(mode === 'back' ? [finished('4:3', [add, draw(3), animate('3:3')])] : [])];
    doc.configuration = {...doc.configuration, projectTitle: `Title blocks ${kernel} ${mode}`};
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="gs">gState</variable></variables>' +
      ev('title_start', chain(['<block type="titlescreen_start"></block>', draw(3),
        `<block type="titlescreen_while_showing"><statement name="DO">${chain(inside)}</statement></block>`]), 20) +
      ev('title_update', '', 400) + '</xml>';
    const out = path.join(__dirname, `titleblocks_${kernel}_${mode}.vcsgm`);
    fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
    console.log(path.basename(out));
  });
});
