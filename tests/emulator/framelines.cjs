// node framelines.cjs rom -> the number of scanlines between VSYNC starts (CPU cycles / 76) for frames 95..105
const P = require('../lib/paths.cjs');
const fs = require('fs');
const ROOT = P.REPO + '';
const req = (m) => require(ROOT + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
(async () => {
  const cart = await new CF().createCartridge(new Uint8Array(fs.readFileSync(process.argv[2])));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const bus = board.getBus(); let ticks = 0; let last = 0; let vs = false; const out = [];
  const ow = bus.write.bind(bus);
  bus.write = (a, v) => { if (!(a & 0x1080) && (a & 0x3f) === 0) { const on = !!(v & 2); if (on && !vs) { out.push(((ticks - last) / 76).toFixed(1)); last = ticks; } vs = on; } return ow(a, v); };
  board.reset(); let g = 0;
  while (out.length < 110 && g++ < 1e9) { board.tick(1); ticks++; }
  console.log(out.slice(95, 110).join(' '));
})();
