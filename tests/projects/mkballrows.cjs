// usage: node tests/projects/mkballrows.cjs -> tests/projects/ballrows_<moves|colors|rowcolors>.vcsgm from ball3.vcsgm (the Title Screen demo, its logo a single color 48x2
// graphic with the ball, card 6): the logo's ball painted 2 cells wide in rows 4 to 40, at column 10 in the even rows and 16 in the odd ones (a move of 6
// before every row: the moves into the even rows, bmp_<key>_ballhm2, since 2026-11-23); colors: also a ball color for each of those rows (frame.ballColors,
// hue r % 16 at brightness 8: COLUPF a row, bmp_<key>_ballc); rowcolors: the same colors with the logo made a graphic with row colors (singleColor
// off: a ball color for two rows at a time, the first row's of the pass, since 2026-11-23). emulator/ballrows.cjs: every row's ball where titleFrameBallLines puts it, in its color.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
[['moves', false], ['colors', true], ['rowcolors', true, true]].forEach(([key, colors, rowColors]) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, 'ball3.vcsgm'), 'utf8'));
  doc.configuration.projectTitle = `Ball rows ${key}`;
  const card = doc['title-screen'].screens[0].cards.find((c) => c.id === 6);
  if (rowColors) card.singleColor = false;
  card.frames.forEach((frame) => {
    const height = frame.pixels.split('\n').length;
    frame.ballPixels = Array.from({length: height}, (_, r) => {
      const row = Array(48).fill('.');
      if (r >= 4 && r <= 40) {
        const x = r % 2 ? 16 : 10;
        row[x] = 'X';
        row[x + 1] = 'X';
      }
      return row.join('');
    }).join('\n');
    if (colors) frame.ballColors = Array.from({length: height}, (_, r) => (r >= 4 && r <= 40 ? (((r % 16) << 4) | 8) : null));
  });
  fs.writeFileSync(path.join(dir, `ballrows_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
