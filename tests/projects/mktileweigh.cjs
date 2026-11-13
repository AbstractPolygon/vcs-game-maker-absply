// usage: node tests/projects/mktileweigh.cjs -> tests/projects/tileweigh_<many|few>_<rows|tiles>.vcsgm: whether DPC+ keeps the tiles only when they and
// their part of the coprocessor program take fewer bytes than the rows. many: 6 backgrounds of 96 rows (2304 bytes as rows: 12 do not fit in the graphics bank) made of the same few blocks (the tiles take far
// fewer bytes: kept); few: one background of 24 rows (the tiles and their program take more: loaded as rows). Each as rows (the tilemap off) and with
// the tilemap on, for tests/emulator/framecmp.cjs (the same frames). Made from dpcstress_96.vcsgm (mkdpcstress.cjs).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const block = (kind, y, x) => {
  const shapes = ['XXXXXXXX', 'X......X', 'X.XX.XX.', '..XXXX..'];
  return shapes[(kind + Math.floor(y / 8)) % 4][x % 8];
};
const backgroundOf = (rows, seed) => Array.from({length: rows}, (_, y) => Array.from({length: 32}, (_, x) => {
  const cell = (Math.floor(x / 8) * 7 + Math.floor(y / 8) * 3 + seed) % 5;
  return cell === 4 ? '.' : block(cell, y, x);
}).join('')).join('\n');
for (const [name, count, rows] of [['many', 6, 96], ['few', 1, 24]]) {
  for (const variant of ['rows', 'tiles']) {
    const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'dpcstress_96.vcsgm'), 'utf8'));
    doc.configuration = {...doc.configuration, projectTitle: `Tile weigh ${name} ${variant}`, dpcPlusPfres: rows, dpcPlusRowScanlines: 192 / rows,
      dpcPlusTilemap: variant === 'tiles', dpcPlusRuns: false};
    const base = doc.backgrounds.backgrounds[0];
    doc.backgrounds.backgrounds = Array.from({length: count}, (_, i) => ({...base, id: i + 1, name: `BG${i + 1}`, pixels: backgroundOf(rows, i)}));
    // Every background is set (one after the other at the start, then the next on Fire), so none is left out of the build.
    const sets = doc.backgrounds.backgrounds.map(({id}) => `<block type="background_set_select"><field name="VAR">${id}</field></block>`);
    const chain = sets.reduceRight((next, b) => (next ? b.replace(/<\/block>$/, `<next>${next}</next></block>`) : b), '');
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
      `<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${chain}</statement></block></xml>`;
    const out = `tileweigh_${name}_${variant}.vcsgm`;
    fs.writeFileSync(path.join(__dirname, out), yaml.dump(doc, {lineWidth: -1}));
    console.log(out);
  }
}
