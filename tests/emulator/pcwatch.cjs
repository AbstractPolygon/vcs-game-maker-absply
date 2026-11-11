// usage: node pcwatch.cjs rom sym frames name,name,... -> how many times each label is reached in each of the first frames (DPC+), and the frame it was first reached
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
  const [, , file, symFile, frames = '20', names = ''] = process.argv;
  const symText = fs.readFileSync(symFile, 'utf8');
  const sym = (name) => { const m = new RegExp('^(?:\\d+\\.)?' + name + '[ \\t]+([0-9a-f]+)', 'm').exec(symText); return m ? parseInt(m[1], 16) : null; };
  const watch = names.split(',').filter(Boolean).map((name) => ({name, addr: sym(name)}));
  watch.filter((w) => w.addr === null).forEach((w) => console.log('no symbol', w.name));
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await new CF().createCartridge(rom); matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const counts = {};
  board.getVideoOutput().newFrame.addHandler(() => { console.log('frame', n, JSON.stringify(counts)); Object.keys(counts).forEach((k) => delete counts[k]); n++; });
  const cpu = board.getCpu(); const bus = board.getBus();
  board.reset(); let g = 0; let last = -1;
  while (n < +frames && g++ < 1e8) {
    board.tick(1);
    const pc = cpu.getLastInstructionPointer();
    if (pc !== last) watch.forEach((w) => { if (w.addr === pc) counts[w.name] = (counts[w.name] || 0) + 1; });
    last = pc;
  }
  if (process.env.PEEK) console.log(process.env.PEEK.split(',').map((name) => `${name}=${bus.peek(sym(name))}`).join(' '));
})();
