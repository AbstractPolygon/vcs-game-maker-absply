// usage: node tests/projects/mknarrow.cjs -> tests/projects/narrow_*.vcsgm: the 4-pixel tiles of the playfield tilemap (the Tiles section 4 pixels
// wide). (1) narrow_<base>_<rows|t4>: the scroll projects of mkscroll.cjs (dpc_plain, dpc_tall, std_fit, std_tall) as rows and as 4-pixel tiles, for
// tests/emulator/framecmp.cjs (the same frames). (2) narrow_set_<dpc|std>_<tiles|rows>[_flip]: Set playfield tile at columns 2, 4, 5 and 7 row 0 to the tile of
// column 1 (the section's tile 1, 4 rows), against a background drawn that way as rows (flip: tile 1 + 128, the tile flipped, DPC+ only).
// The standard kernel only keeps 4-pixel tiles when they take fewer bytes: tileSet.forceNarrow (with tests/hooks/hook_narrow.cjs on) makes it
// use them. (The tall scroll keeps 8-pixel tiles: the hooks do not change that.)
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const load = (name) => yaml.load(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const save = (doc, name) => {
  fs.writeFileSync(path.join(__dirname, name), yaml.dump(doc, {lineWidth: -1}));
  console.log(name);
};
const tileSetOf = (tiles = []) => ({width: 4, height: 4, tiles, forceNarrow: true});

// (1) The scroll projects.
for (const base of ['dpc_plain', 'dpc_tall', 'std_fit', 'std_tall']) {
  for (const variant of ['rows', 't4']) {
    const doc = load(`scroll_${base}.vcsgm`);
    doc.configuration = {...doc.configuration, projectTitle: `Narrow ${base} ${variant}`, dpcPlusTilemap: variant === 't4'};
    if (variant === 't4') doc.backgrounds.tileSet = tileSetOf();
    save(doc, `narrow_${base}_${variant}.vcsgm`);
  }
}

// (2) Set playfield tile.
// The columns set (the right and the left half of a byte, in the bytes drawn as they are and the ones drawn reversed).
// (The standard kernel keeps a tile for the place it is in: tile 1, of column 1, is set in column 5, the same place in its byte.)
const SET_COLUMNS = [2, 4, 5, 7];
const setColumnsOf = (kernel) => (kernel === 'std' ? [5] : SET_COLUMNS);
const PATTERN = ['X..X', '.XX.', 'XX..', '...X'];
const backgroundPixels = (rows, columns) => Array.from({length: rows}, (_, y) => {
  const row = new Array(32).fill('.');
  if (y < 4) columns.forEach(({column, flip}) => [...PATTERN[y]].forEach((c, i) => { row[column * 4 + (flip ? 3 - i : i)] = c; }));
  return row.join('');
}).join('\n');
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
for (const kernel of ['dpc', 'std']) {
  for (const flip of kernel === 'dpc' ? [false, true] : [false]) {
    for (const variant of ['tiles', 'rows']) {
      const doc = load(`tv_${kernel}_score_ntsc.vcsgm`);
      const background = doc.backgrounds.backgrounds[0];
      const rows = String(background.pixels).split('\n').length;
      doc.backgrounds.backgrounds = [{...background, pixels: backgroundPixels(rows, variant === 'tiles' ? [{column: 1}] : [{column: 1}, ...setColumnsOf(kernel).map((column) => ({column, flip}))])}];
      doc.configuration = {...doc.configuration, projectTitle: `Narrow set ${kernel} ${variant}${flip ? ' flip' : ''}`, showScore: false, dpcPlusTilemap: variant === 'tiles'};
      if (variant === 'tiles') {
        // (Kept as text, as the project file has a background's pixels.)
        doc.backgrounds.tileSet = tileSetOf([{id: 1, pixels: '....\n....\n....\n....'}, {id: 2, pixels: PATTERN.join('\n')}]);
      }
      const set = variant === 'tiles' ? setColumnsOf(kernel).map((column) => '<block type="background_tile_set">' +
        `<value name="COLUMN">${num(column)}</value><value name="ROW">${num(0)}</value><value name="TILE">${num(flip ? 129 : 1)}</value>`)
        .reduceRight((next, block) => `${block}${next ? `<next>${next}</next>` : ''}</block>`, '') : '';
      doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
        '<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">' +
        `<block type="background_set_select"><field name="VAR">${background.id}</field></block></statement></block>` +
        // (Every frame: the background's load, the frame it is set, would put the tile back.)
        `<block type="event_block" id="ev1" x="20" y="200"><field name="EVENT">gameplay_update</field><statement name="DO">${set}</statement></block></xml>`;
      save(doc, `narrow_set_${kernel}_${variant}${flip ? '_flip' : ''}.vcsgm`);
    }
  }
}
