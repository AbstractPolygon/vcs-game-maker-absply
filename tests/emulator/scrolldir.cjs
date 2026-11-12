// usage: node scrolldir.cjs rom.bin [frames] -> which way the playfield moves on the screen for Down and for Up held a number of frames (8): the
// shift of the picture in lines (positive: down the screen) that makes the frame after it match the frame before it best.
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, framesText = '8'] = process.argv;
  const cart = await makeCart(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  if (cart.setCpuTimeProvider) cart.setCpuTimeProvider(() => board.getCpuTime());
  const surf = {buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  const tia = board.getVideoOutput();
  tia.setSurfaceFactory(() => surf);
  const joy = board.getJoystick0();
  let frame = 0; let last = null;
  tia.newFrame.addHandler((s) => { frame++; last = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  const runFrames = (n) => { const end = frame + n; let g = 0; while (frame < end && g++ < 1e8) board.tick(500); };
  runFrames(+(process.env.WAIT || 90));
  // the lines that have something drawn
  const rows = (buf) => Array.from({length: 260}, (_, y) => Array.from(buf.slice(y * 160, y * 160 + 160)).join());
  const bestShift = (a, b) => {
    let best = null;
    for (let s = -40; s <= 40; s++) {
      let same = 0; let n = 0;
      for (let y = 40; y < 200; y++) { if (y - s < 0 || y - s >= 260) continue; n++; if (b[y] === a[y - s]) same++; }
      if (!best || same / n > best.score) best = {s, score: same / n};
    }
    return best;
  };
  const frames = +framesText;
  for (const [name, button] of [['Down', joy.getDown()], ['Up', joy.getUp()]]) {
    const before = rows(last);
    button.toggle(true); runFrames(frames); button.toggle(false); runFrames(10);
    const best = bestShift(before, rows(last));
    console.log(`${name} ${frames} frames: picture shifted ${best.s} lines (match ${(best.score * 100).toFixed(0)}%)`);
  }
})();
