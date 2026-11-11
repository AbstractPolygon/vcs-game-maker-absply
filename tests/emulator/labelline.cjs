// usage: node labelline.cjs rom sym frame label... -> the scanline (color clocks / 228 from the frame's VSYNC) and the clock in the line at which
// each label is first reached in that frame (DPC+ or KIND=std)
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
  const [, , file, symFile, frame, ...labels] = process.argv;
  const symText = fs.readFileSync(symFile, 'utf8');
  const sym = (name) => { const m = new RegExp('^(?:\\d+\\.)?' + name + '[ \\t]+([0-9a-f]+)', 'm').exec(symText); return m ? parseInt(m[1], 16) : null; };
  const watch = labels.map((name) => ({name, addr: sym(name)}));
  const rom = new Uint8Array(fs.readFileSync(file));
  const kind = process.env.KIND || 'dpc';
  const cart = await new CF().createCartridge(rom); if (kind === 'dpc') matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  board.getVideoOutput().newFrame.addHandler(() => { n++; });
  const bus = board.getBus(); const cpu = board.getCpu();
  let t = 0; let vsyncAt = 0;
  const origWrite = bus.write.bind(bus);
  bus.write = (address, value) => { const a = address & 0x1fff; if (!(a & 0x1080) && (a & 0x3f) === 0 && (value & 2)) vsyncAt = t; return origWrite(address, value); };
  if (kind === 'std') { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  const seen = {}; let g = 0; let last = -1;
  while (n <= +frame && g++ < 3e8) {
    board.tick(1); t++;
    const pc = cpu.getLastInstructionPointer();
    if (n === +frame && pc !== last) watch.forEach((w) => { if (w.addr === pc && !seen[w.name]) seen[w.name] = t - vsyncAt; });
    last = pc;
  }
  watch.forEach((w) => console.log(w.name, seen[w.name] === undefined ? 'not reached' : `line ${Math.floor(seen[w.name] / 228)} clock ${seen[w.name] % 228}`));
})();
