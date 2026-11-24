// usage: node tests/projects/mkterrqueue.cjs -> tests/projects/terrqueue_<std|stdsc|pxe>.vcsgm from terrain_<std|pxe>_bottom.vcsgm: right after the Generate terrain block a
// Draw block fills an area (columns 10 to 14, rows 1 to 2), so it comes while the terrain is being drawn. Since 2026-11-23 the terrain keeps its record in the queue while it
// is drawn (see the a3 entry in generators/bbasic/pf-draw.js): with one record (std without Superchip RAM) the fill finishes the terrain at once in that frame; with more
// (stdsc: Superchip, 3; PXE: 2) it waits. picsame.cjs against a build before: the same final picture.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const fill = `<block type="background_fill_area"><field name="OPERATION">on</field><field name="MODE">CORNERS</field><value name="X1">${num(10)}</value>` +
  `<value name="Y1">${num(1)}</value><value name="X2">${num(14)}</value><value name="Y2">${num(2)}</value></block>`;
const terrainEnd = '<value name="OVER"><block type="math_number"><field name="NUM">0</field></block></value></block>';
[['std', 'terrain_std_bottom', false], ['stdsc', 'terrain_std_bottom', true], ['pxe', 'terrain_pxe_bottom', false]].forEach(([key, base, superchip]) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, `${base}.vcsgm`), 'utf8'));
  doc.configuration.projectTitle = `Terrain queue ${key}`;
  if (superchip) doc.configuration.enableSuperchip = true;
  const xml = doc['blockly-workspace'];
  const at = xml.indexOf(terrainEnd);
  if (at < 0) throw new Error('terrain');
  doc['blockly-workspace'] = xml.slice(0, at) + terrainEnd.replace(/<\/block>$/, `<next>${fill}</next></block>`) + xml.slice(at + terrainEnd.length);
  fs.writeFileSync(path.join(dir, `terrqueue_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
