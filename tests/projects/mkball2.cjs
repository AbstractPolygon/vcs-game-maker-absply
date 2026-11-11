// usage: node mkball2.cjs in.vcsgm out.vcsgm -> Title Screen demo: card 6 (48x2 row colors) a ball 2 wide at column 10 on rows 4-11, 4 wide at
// column 14 on rows 13-20, 8 wide at 20 on rows 21-30, box blue; card 3 single color with a ball in columns 0-3 on every row, box green
const P = require('../lib/paths.cjs');
const fs = require('fs');
const yaml = require(P.REPO + 'node_modules/js-yaml');
const [, , src, dst] = process.argv;
const doc = yaml.load(fs.readFileSync(src, 'utf8'));
const screen = doc['title-screen'].screens[0];
const runs = [[4, 11, 10, 11], [13, 20, 14, 17], [21, 30, 20, 27]];
const cells = (height, list) => Array.from({length: height}, (_, y) => Array.from({length: 48}, (__, x) =>
  (list.some(([r0, r1, c0, c1]) => y >= r0 && y <= r1 && x >= c0 && x <= c1) ? 'X' : '.')).join('')).join('\n');
const logo = screen.cards.find((c) => c.id === 6);
logo.frames.forEach((f) => { const h = f.pixels.split('\n').length; f.ballPixels = cells(h, runs); f.background = 0x86; });
const small = screen.cards.find((c) => c.id === 3);
small.singleColor = true; small.color = 0x46;
small.frames.forEach((f) => { delete f.rowColors; const h = f.pixels.split('\n').length; f.ballPixels = cells(h, [[0, h - 1, 0, 3]]); f.background = 0xc6; });
fs.writeFileSync(dst, yaml.dump(doc, {lineWidth: -1}));
console.log('ok');
