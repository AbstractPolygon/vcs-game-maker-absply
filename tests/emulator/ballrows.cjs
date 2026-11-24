// usage: node ballrows.cjs dump.json project.vcsgm screenIndex cardId top [frame] -> every row of a 48x2 title graphic with the ball (a frame dump of
// frameball.cjs; top: the first line of the graphic's row 0): the pixels where titleFrameBallLines puts the row's ball and the picture is off must be
// in the row's ball color (frame.ballColors: two rows at a time on a graphic with row colors, else the frame's picture background color), and no other pixel of the row's lines in a ball color.
// Prints the rows that are wrong. For tests/projects/ballrows_<moves|colors|rowcolors>.vcsgm (mkballrows.cjs).
const P = require('../lib/paths.cjs');
const fs = require('fs');
const yaml = require(P.REPO + 'node_modules/js-yaml');
const src = fs.readFileSync(P.REPO + 'src/blocks/titlescreen.js', 'utf8');
const body = src.slice(src.indexOf('export const TITLE_BALL_WIDTHS'), src.indexOf('// Whether a graphic draws the ball')).replace(/export const /g, 'const ');
const titleFrameBallLines = eval(body + '\ntitleFrameBallLines;');
const pal = fs.readFileSync(P.REPO + 'src/utils/palette.js', 'utf8');
const ntsc = pal.slice(pal.indexOf('export const NTSC_COLORS')).match(/'([0-9a-fA-F]{6})'/g).slice(0, 128).map((h) => h.slice(1, 7));
const [, , dump, vcsgm, si, cid, topText, frameText = '0'] = process.argv;
const lines = JSON.parse(fs.readFileSync(dump));
const doc = yaml.load(fs.readFileSync(vcsgm, 'utf8'));
const card = doc['title-screen'].screens[+si].cards.find((c) => c.id === +cid);
const frame = card.frames[+frameText];
const toM = (t) => t.split('\n').map((r) => r.split('').map((ch) => (ch === 'X' ? 1 : 0)));
const pixels = toM(frame.pixels);
const height = pixels.length;
const box = frame.background !== undefined ? frame.background : (card.background || 0);
const ball = titleFrameBallLines({ballPixels: toM(frame.ballPixels), ballColors: frame.ballColors}, height, box, !card.singleColor);
const rgbOf = (byte) => { const h = ntsc[(byte & 0xff) >> 1]; const n = parseInt(h, 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
const top = +topText;
let bad = 0;
let checked = 0;
ball.rows.forEach((row, y) => {
  if (!row.on) return;
  const want = rgbOf(row.c);
  [0, 1].forEach((half) => {
    const line = lines[top + 2 * y + half];
    for (let x = row.x; x < row.x + row.width; x++) {
      if (pixels[y][x]) continue;
      checked++;
      if ((line[56 + x] >>> 0) !== want) {
        bad++;
        if (bad < 15) console.log('row', y, 'line', half, 'x', x, 'got', ((line[56 + x] >>> 0) & 0xffffff).toString(16), 'want', (want & 0xffffff).toString(16));
      }
    }
  });
});
console.log('ball pixels checked', checked, 'wrong', bad);
