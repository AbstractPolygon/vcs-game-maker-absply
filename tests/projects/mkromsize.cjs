// usage: node tests/projects/mkromsize.cjs -> tests/projects/romsize_<ball2|gametitle>_<16k|32k|64k>.vcsgm: standard kernel projects that do not fit in bank 1
// (ball2: a Bricks game; gametitle_std: a title screen and a game) built as 16K, 32K and 64K ROMs, for the bank layout of the bankswitched standard ROMs (the
// units the planner moves out of bank 1, see planLayoutFromMeasurement in src/hooks/rom.js). tests/emulator/picsame.cjs compares the pictures with another build.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
[['ball2', 'ball2'], ['gametitle', 'gametitle_std']].forEach(([key, base]) => {
  ['16k', '32k', '64k'].forEach((size) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `${base}.vcsgm`), 'utf8'));
    doc.configuration.romSize = size;
    doc.configuration.projectTitle = `ROM size ${key} ${size}`;
    fs.writeFileSync(path.join(dir, `romsize_${key}_${size}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
