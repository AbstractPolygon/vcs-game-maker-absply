// usage: node setupcycles.cjs rom sym frames fromLabel toLabel -> the CPU cycles from reaching fromLabel to reaching toLabel (each time, first few),
// and the scanline cycle at both ends (DPC+)
const P = require('../lib/paths.cjs');
const fs = require('fs');
const ROOT = P.REPO + '';
const req = (m) => require(ROOT + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
const {matchDriverFractionalFetchers} = require(ROOT + 'tools/stellerator/dpcplus-driver');
(async () => {
  const [, , file, symFile, frames = '20', from, to] = process.argv;
  const symText = fs.readFileSync(symFile, 'utf8');
  const sym = (name) => { const m = new RegExp('^(?:\\d+\\.)?' + name + '[ \\t]+([0-9a-f]+)', 'm').exec(symText); if (!m) throw new Error('no ' + name); return parseInt(m[1], 16); };
  const A = sym(from); const B = sym(to);
  const rom = new Uint8Array(fs.readFileSync(file));
  const kind = process.env.KIND || 'dpc';
  const cart = await new CF().createCartridge(rom); if (kind === 'dpc') matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  board.getVideoOutput().newFrame.addHandler(() => { n++; });
  const cpu = board.getCpu();
  if (kind === 'std') { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  let g = 0; let last = -1; let t = 0; let start = null; const seen = [];
  const tia = board._tia;
  while (n < +frames && g++ < 2e8) {
    board.tick(1); t++;
    const pc = cpu.getLastInstructionPointer();
    if (pc !== last) {
      if (pc === A) start = t;
      if (pc === B && start !== null) { seen.push(t - start); start = null; }
    }
    last = pc;
  }
  const counts = {}; seen.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  console.log(file.split('/').pop(), from, '->', to, 'ticks:count', JSON.stringify(counts));
})();
