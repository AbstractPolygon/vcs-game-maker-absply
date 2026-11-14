// usage: node tests/projects/mktall127.cjs -> tests/projects/tall127_<dpc_plain|std_fit>_<rows|t80>.vcsgm: the scroll projects of mkscroll.cjs with the background made 160 rows tall (the first 80 drawn again, the same 8 pixels in every column so that tiles take fewer bytes than the rows)
// (the 60 or 12 rows drawn again and again) as rows and as tiles 160 rows tall (the first 80 drawn again) (the tallest tile is 127), for tests/emulator/framecmp.cjs (the same frames).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const load = (name) => yaml.load(fs.readFileSync(path.join(__dirname, name), 'utf8'));
for (const base of ['dpc_plain', 'std_fit']) {
  for (const variant of ['rows', 't80']) {
    const doc = load(`scroll_${base}.vcsgm`);
    const background = doc.backgrounds.backgrounds[0];
    const rows = String(background.pixels).split('\n');
    background.pixels = Array.from({length: 160}, (_, y) => (((y % 80) * 37 + 11) % 256).toString(2).padStart(8, '0').replace(/1/g, 'X').replace(/0/g, '.').repeat(4)).join('\n');
    doc.configuration = {...doc.configuration, projectTitle: `Tall127 ${base} ${variant}`, dpcPlusTilemap: variant === 't80'};
    if (variant === 't80') doc.backgrounds.tileSet = {width: 8, height: 80, tiles: []};
    const name = `tall127_${base}_${variant}.vcsgm`;
    fs.writeFileSync(path.join(__dirname, name), yaml.dump(doc, {lineWidth: -1}));
    console.log(name);
  }
}
