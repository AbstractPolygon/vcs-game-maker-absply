// node exactball.cjs dump.json vcsgm screen cardId top r,g,b [offset]: every line of the graphic (top = its first line): the ball's pixels
// against titleFrameBallLines; offset 1 = the ball a line lower (the row color loop).
const P = require('../lib/paths.cjs');
const fs = require('fs');
const yaml = require(P.REPO + 'node_modules/js-yaml');
const src = fs.readFileSync(P.REPO + 'src/blocks/titlescreen.js', 'utf8');
const body = src.slice(src.indexOf('export const TITLE_BALL_WIDTHS'), src.indexOf('// Whether a graphic draws the ball')).replace(/export const /g, 'const ');
const titleFrameBallLines = eval(body + '\ntitleFrameBallLines;');
const [, , dump, vcsgm, si, cid, topText, rgb, offText = '0', frameText = '0'] = process.argv;
const lines = JSON.parse(fs.readFileSync(dump));
const doc = yaml.load(fs.readFileSync(vcsgm, 'utf8'));
const card = doc['title-screen'].screens[+si].cards.find((c) => c.id === +cid);
const frame = card.frames[+frameText];
const toM = (t) => t.split('\n').map((r) => r.split('').map((ch) => (ch === 'X' ? 1 : 0)));
const pixels = toM(frame.pixels); const height = pixels.length;
const ball = titleFrameBallLines({ballPixels: toM(frame.ballPixels)}, height);
const [r, g, b] = rgb.split(',').map(Number); const color = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const top = +topText; const off = +offText; let bad = 0; let ballPx = 0;
for (let L = -2; L < height * 2 + 2; L++) {
  const row = lines[top + L];
  const ballRow = Math.floor((L - off) / 2);
  const br = ball.rows[ballRow];
  for (let x = 0; x < 48; x++) {
    const px = 56 + x;
    const isBall = (row[px] >>> 0) === color;
    const picRow = Math.floor(L / 2);
    const picOn = L >= 0 && L < height * 2 && pixels[picRow][x];
    const want = !!br && br.on && x >= br.x && x < br.x + br.width && !picOn;
    if (isBall) ballPx++;
    if (isBall !== want) { bad++; if (bad < 12) console.log('line', L, 'x', x, 'ball', isBall, 'expected', want); }
  }
}
console.log('ball pixels', ballPx, 'wrong pixels', bad);
