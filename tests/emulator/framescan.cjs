// usage: node frameball.cjs rom.bin frame r,g,b [dump.json] -> runs the ROM to the frame (no input), prints each line that has pixels of the
// color: "line min,max" in pixels (0..159); with dump.json writes the frame's lines (a color list per line) for framecmp.
const P = require('../lib/paths.cjs');
const root = P.REPO + 'node_modules/6502.ts/lib/';
const fs = require('fs');
const Board = require(root + 'machine/stella/Board').default;
const Config = require(root + 'machine/stella/Config').default;
const Factory = require(root + 'machine/stella/cartridge/CartridgeFactory').default;
(async () => {
  const [, , rom, frameText, rgb, dump] = process.argv;
  const cart = await new Factory().createCartridge(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  if (cart.setCpuTimeProvider) cart.setCpuTimeProvider(() => board.getCpuTime());
  const surf = {buf: new Uint32Array(160 * 400).fill(0xff000000), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  const tia = board.getVideoOutput();
  tia.setSurfaceFactory(() => surf);
  const [R0, G0, B0] = process.argv[4].split(",").map(Number); const COLOR = (0xff000000 | (B0 << 16) | (G0 << 8) | R0) >>> 0; let n = 0; let shot = null; const want = +frameText;
  tia.newFrame.addHandler((s) => { n++; if (n % 25 === 0 && !shot) { const buf = (s || surf).getBuffer(); let c = 0; for (let i = 0; i < buf.length; i++) if ((buf[i] >>> 0) === COLOR) c++; if (c) console.log("frame", n, c); } if (n === want) shot = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  let guard = 0;
  while (!shot && guard++ < 1e8) board.tick(2000);
  const [r, g, b] = rgb.split(',').map(Number);
  const color = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const lines = [];
  for (let y = 0; y < 400; y++) {
    const row = Array.from(shot.slice(y * 160, y * 160 + 160));
    lines.push(row);
    const xs = row.map((c, x) => ((c >>> 0) === color ? x : -1)).filter((x) => x >= 0);
    if (xs.length) console.log(y, `${xs[0]},${xs[xs.length - 1]}`, xs.length);
  }
  if (dump) fs.writeFileSync(dump, JSON.stringify(lines));
})();
