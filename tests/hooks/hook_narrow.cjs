// node tests/hooks/hook_narrow.cjs on|off: TEMP-DEBUG hooks that make the standard build use 4-pixel tiles (at the tileSet's height) for a project
// whose tileSet has forceNarrow, also when rows take fewer bytes (tests/projects/mknarrow.cjs). Turn them off before a commit.
const fs = require('fs');
const p = require('path').join(__dirname, '../../src/generators/bbasic.js');
let s = fs.readFileSync(p, 'utf8');
const pairs = [
  [`  if (fits(narrow) && (!fits(wide) || cost(narrow) < cost(wide))) return narrow;`,
    `  if (tileSet && tileSet.forceNarrow && narrow) return narrow; // TEMP-DEBUG\r\n  if (fits(narrow) && (!fits(wide) || cost(narrow) < cost(wide))) return narrow;`],
  [`    if (tileBytes >= rowBytes) {\r\n      this.pfTilemapStandardKept = {tileBytes, rowBytes};`,
    `    if (tileBytes >= rowBytes && !(((this.getBackgroundsData() || {}).tileSet || {}).forceNarrow)) { // TEMP-DEBUG\r\n      this.pfTilemapStandardKept = {tileBytes, rowBytes};`],
  [`    if (plan && tileBytes < rowBytes) {\r\n      tiles = plan;`,
    `    if (plan && (tileBytes < rowBytes || plan.forced)) { // TEMP-DEBUG\r\n      tiles = plan;`],
  [`? planStandardTilemap(backgrounds, NARROW_TILE_WIDTH) : null;`, `? planStandardTilemap(backgrounds, NARROW_TILE_WIDTH, tileSet.forceNarrow ? tileSet.height : 0) : null; // TEMP-DEBUG`],
  [`  if (tileSet && tileSet.forceNarrow && narrow) return narrow; // TEMP-DEBUG`,
    `  if (tileSet && tileSet.forceNarrow && narrow) return {...narrow, forced: true}; // TEMP-DEBUG`],
];
const on = process.argv[2] === 'on';
if (on) {
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw new Error('not once: ' + a.slice(0, 60));
    s = s.replace(a, () => b);
  }
} else {
  for (const [a, b] of pairs.slice().reverse()) {
    if (s.split(b).length !== 2) throw new Error('not on: ' + b.slice(0, 60));
    s = s.replace(b, () => a);
  }
}
fs.writeFileSync(p, s);
console.log(on ? 'on' : 'off', (s.match(/TEMP-DEBUG/g) || []).length);
