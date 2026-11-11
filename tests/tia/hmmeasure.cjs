// usage: node hmmeasure.cjs rom -> for each line of the test (lines with the ball): the ball's left x and Player 0's x, the move from the line
// before, and the clock (in the line, 0-227) of the HMOVE write on the line before
const P = require('../lib/paths.cjs');
const fs = require('fs');
const ROOT = P.REPO + '';
const req = (m) => require(ROOT + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
(async () => {
  const file = process.argv[2];
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await new CF().createCartridge(rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0; let frameBuf = null;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  board.getVideoOutput().newFrame.addHandler((s) => { n++; if (n === 5) frameBuf = Uint32Array.from(s.getBuffer()); });
  const bus = board.getBus();
  let t = 0; let vs = 0; const hm = [];
  const ow = bus.write.bind(bus);
  bus.write = (a, v) => { const r = a & 0x3f; if (!(a & 0x1080)) { if (r === 0 && (v & 2)) vs = t; if (r === 0x2a && n === 4) hm.push(board._tia._hctr); } return ow(a, v); };
  board.reset();
  let g = 0; while (n < 6 && g++ < 1e8) { board.tick(1); t++; }
  // the colors: the ball is the brightest, Player 0 the reddest
  const rows = [];
  for (let y = 0; y < 400; y++) {
    const ballXs = []; const p0Xs = [];
    for (let x = 0; x < 160; x++) {
      const v = frameBuf[y * 160 + x] & 0xffffff; const r = v & 255; const gg = (v >> 8) & 255; const b = (v >> 16) & 255;
      if (r > 200 && gg > 200 && b > 200) ballXs.push(x);
      else if (r > 120 && gg < 110) p0Xs.push(x);
    }
    if (ballXs.length || p0Xs.length) rows.push({y, ball: ballXs.length ? ballXs[0] : null, p0: p0Xs.length ? p0Xs[0] : null});
  }
  console.log('HMOVE clocks', [...new Set(hm)].join(','));
  const lines = rows.filter((row, i) => i % 2 === 0);
  lines.forEach((row, i) => {
    const prev = lines[i - 1];
    console.log(row.y, 'ball', row.ball, 'p0', row.p0, prev ? `moves: ball ${row.ball - prev.ball} p0 ${row.p0 - prev.p0} (value ${(i - 1) & 15})` : '');
  });
})();
