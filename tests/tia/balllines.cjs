// usage: node balllines.cjs rom.bin -> every line of frame 5 with white pixels (the ball): their x (pixels 0-159), and the clock (0-227) of each
// RESBL write on the lines of frame 4 in order.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const ROOT = P.REPO + '';
const req = (m) => require(ROOT + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
(async () => {
  const rom = new Uint8Array(fs.readFileSync(process.argv[2]));
  const cart = await new CF().createCartridge(rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0; let frameBuf = null;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  board.getVideoOutput().newFrame.addHandler((s) => { n++; if (n === 5) frameBuf = Uint32Array.from(s.getBuffer()); });
  const bus = board.getBus();
  const writes = [];
  const ow = bus.write.bind(bus);
  bus.write = (a, v) => { if (!(a & 0x1080) && (a & 0x3f) === 0x14 && n === 4) writes.push(board._tia._hctr); return ow(a, v); };
  board.reset();
  let g = 0; while (n < 6 && g++ < 1e8) board.tick(1);
  console.log('RESBL clocks', writes.join(','));
  for (let y = 0; y < 400; y++) {
    const xs = [];
    for (let x = 0; x < 160; x++) { const v = frameBuf[y * 160 + x]; if ((v & 255) > 200 && ((v >> 8) & 255) > 200 && ((v >> 16) & 255) > 200) xs.push(x); }
    if (xs.length) console.log(y, xs.join(','));
  }
})();
