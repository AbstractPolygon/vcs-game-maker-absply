const P = require('../lib/paths.cjs');
const root = P.REPO + 'node_modules/6502.ts/lib/';
const fs = require('fs');
const Board = require(root + 'machine/stella/Board').default;
const Config = require(root + 'machine/stella/Config').default;
const Factory = require(root + 'machine/stella/cartridge/CartridgeFactory').default;
(async () => {
  const [, , rom, addrs, from, to] = process.argv;
  const cart = await new Factory().createCartridge(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  const tia = board.getVideoOutput();
  tia.setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const bus = board.getBus(); const list = addrs.split(',').map((a) => parseInt(a, 16)); let n = 0; const out = [];
  tia.newFrame.addHandler(() => { n++; if (n >= +from && n <= +to) out.push(n + ':' + list.map((a) => bus.peek(a).toString(16)).join('/')); });
  board.boot(); let g = 0; while (n < +to && g++ < 1e8) board.tick(2000);
  console.log(out.join(' '));
})();
