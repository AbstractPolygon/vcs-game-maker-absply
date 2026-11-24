// usage: node tests/projects/mkcolorcycle.cjs -> tests/projects/colorcycle_dpc.vcsgm from fire_dpc_8_plain.vcsgm: per-row playfield and background colors on, the playfield
// rows a ramp of hues (row r: hue r, brightness 8) and the background rows dark blue; Every 8 frames changes the playfield row colors by 16 (the next hue), the background row
// colors by 2 and the score color by 16. Frames 100 and 108 (with picsame.cjs PNG=... SHOW=...): each playfield row one hue further on, the background a step brighter.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const doc = yaml.load(fs.readFileSync(path.join(dir, 'fire_dpc_8_plain.vcsgm'), 'utf8'));
doc.configuration.projectTitle = 'Color cycle dpc';
doc.configuration.enableDpcPlusPfColors = true;
doc.configuration.enableDpcPlusBkColors = true;
doc.configuration.showScore = true;
const background = doc.backgrounds.backgrounds[0];
const rows = background.pixels.split('\n').length;
background.rowColors = Array.from({length: rows}, (_, r) => ((r % 16) << 4) | 8);
background.bkRowColors = Array.from({length: rows}, () => 0x80);
const change = (kind) => `<block type="background_change_row_colors"><field name="VAR">${kind}</field><value name="VALUE">${num(kind === 'COLUPF' ? 16 : 2)}</value></block>`;
const score = `<block type="score_color_change"><value name="DELTA">${num(16)}</value></block>`;
const chain = (blocks) => blocks.reduceRight((rest, block) => (rest ? block.replace(/<\/block>$/, `<next>${rest}</next></block>`) : block), '');
doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_block" id="ev1" x="20" y="20"><field name="EVENT">gameplay_update</field>' +
  `<statement name="DO"><block type="event_frame_every_n"><field name="MASK">7</field><field name="DELTA">0</field><statement name="DO">${chain([change('COLUPF'), change('COLUBK'), score])}</statement></block></statement></block></xml>`;
fs.writeFileSync(path.join(dir, 'colorcycle_dpc.vcsgm'), yaml.dump(doc, {lineWidth: -1}));
console.log('ok');
// colorcycle_text_<std|dpc><_blink>.vcsgm from blink_<kernel>_plain.vcsgm: HELLO 123 shown; Every 8 frames "Text change row 1 color by 16"; _blink keeps the
// Blink text forever block (in the off phase the saved color changes, the text stays hidden). Read TextColor by symbol (ramwatch.cjs): 16 more every 8 frames.
['std', 'dpc'].forEach((kernel) => {
  [false, true].forEach((blink) => {
    const textDoc = yaml.load(fs.readFileSync(path.join(dir, `blink_${kernel}_plain.vcsgm`), 'utf8'));
    textDoc.configuration.projectTitle = `Color cycle text ${kernel}${blink ? ' blink' : ''}`;
    let xml = textDoc['blockly-workspace'];
    if (!blink) xml = xml.replace(/<next><block type="text_minikernel_blink">.*?<\/block><\/next>/, '');
    const textChange = `<block type="text_minikernel_change_color"><field name="ROW">1</field><value name="VALUE">${num(16)}</value></block>`;
    xml = xml.replace('</xml>', '<block type="event_block" id="ev1" x="20" y="300"><field name="EVENT">gameplay_update</field><statement name="DO">' +
      `<block type="event_frame_every_n"><field name="MASK">7</field><field name="DELTA">0</field><statement name="DO">${textChange}</statement></block></statement></block></xml>`);
    textDoc['blockly-workspace'] = xml;
    fs.writeFileSync(path.join(dir, `colorcycle_text_${kernel}${blink ? '_blink' : ''}.vcsgm`), yaml.dump(textDoc, {lineWidth: -1}));
  });
});
