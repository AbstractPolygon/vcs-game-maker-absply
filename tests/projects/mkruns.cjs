// usage: node tests/projects/mkruns.cjs -> tests/projects/runs_<base>_<rows|runs>.vcsgm: the backgrounds kept as runs (the Options tab's "Keep backgrounds
// as runs", DPC+) against the same project as rows, for tests/emulator/framecmp.cjs (the same frames). The scroll projects of mkscroll.cjs (dpc_plain, a
// plain scroll, and dpc_tall, the tall scroll: the runs repeated down the rows to fill) with a background of bands and blocks, so runs take fewer bytes,
// and the stress projects of mkdpcstress.cjs (96 and 192 rows).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bands = (rows) => Array.from({length: rows}, (_, y) => Array.from({length: 32}, (_, x) => {
  const band = Math.floor(y / 6) % 4;
  return (band === 0 && x % 16 < 10) || (band === 2 && (x < 4 || x > 27)) || (y % 12 === 5 && x > 12 && x < 20) ? 'X' : '.';
}).join('')).join('\n');
const bases = {dpc_plain: 'scroll_dpc_plain.vcsgm', dpc_tall: 'scroll_dpc_tall.vcsgm', stress96: 'dpcstress_96.vcsgm', stress192: 'dpcstress_192.vcsgm'};
for (const [name, file] of Object.entries(bases)) {
  for (const variant of ['rows', 'runs']) {
    const doc = yaml.load(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    doc.configuration = {...doc.configuration, projectTitle: `Runs ${name} ${variant}`, dpcPlusTilemap: false, dpcPlusRuns: variant === 'runs'};
    if (/^dpc_/.test(name)) {
      const background = doc.backgrounds.backgrounds[0];
      doc.backgrounds.backgrounds = [{...background, pixels: bands(String(background.pixels).split('\n').length)}];
    }
    const out = `runs_${name}_${variant}.vcsgm`;
    fs.writeFileSync(path.join(__dirname, out), yaml.dump(doc, {lineWidth: -1}));
    console.log(out);
  }
}
