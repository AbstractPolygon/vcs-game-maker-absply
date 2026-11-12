// usage: node scoredigits.cjs rom.bin [frame] -> the score of a frame (90) as text: lines 150 to 259, one character a pixel from 40 to 119 (X: not
// the line's most common color), the lines with any.
// For tests/projects/score_dpc.vcsgm (mkscore.cjs): the digits 123456 must read the right way round and line up.
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, frameArg] = process.argv;
  const cart = await makeCart(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  if (cart.setCpuTimeProvider) cart.setCpuTimeProvider(() => board.getCpuTime());
  const surf = {buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  const tia = board.getVideoOutput();
  tia.setSurfaceFactory(() => surf);
  let frame = 0; let last = null;
  tia.newFrame.addHandler((s) => { frame++; last = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  const end = +(frameArg || 90); let g = 0;
  while (frame < end && g++ < 1e8) board.tick(500);
  // Each line: X where a pixel differs from the line's most common color (from 40 to 119); the lines below the playfield that have any.
  for (let y = 150; y < 260; y++) {
    const counts = new Map();
    for (let x = 40; x < 120; x++) { const c = last[y * 160 + x]; counts.set(c, (counts.get(c) || 0) + 1); }
    const common = [...counts.entries()].sort((m, n) => n[1] - m[1])[0][0];
    let text = '';
    for (let x = 40; x < 120; x++) text += last[y * 160 + x] !== common ? 'X' : '.';
    if (text.includes('X')) console.log(String(y).padStart(3), text);
  }
})();
