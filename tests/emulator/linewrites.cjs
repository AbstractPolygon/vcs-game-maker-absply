// usage: KIND=std|dpc node linewrites.cjs rom frame fromLine toLine -> the writes to GRP0, GRP1, ENABL, COLUP0, COLUP1 on those scanlines of that frame
// (line = color clocks from VSYNC / 228), each as "reg@clock"
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
  const [, , file, frame, from, to] = process.argv;
  const names = {0x1b: 'G0', 0x1c: 'G1', 0x1f: 'BL', 0x06: 'C0', 0x07: 'C1', 0x0a: 'CT', 0x24: 'HB', 0x2a: 'HM', 0x2b: 'HC'};
  const rom = new Uint8Array(fs.readFileSync(file));
  const kind = process.env.KIND || 'dpc';
  const cart = await new CF().createCartridge(rom); if (kind === 'dpc') matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  board.getVideoOutput().newFrame.addHandler(() => { n++; });
  const bus = board.getBus();
  let t = 0; let vsyncAt = 0; const lines = {};
  const origWrite = bus.write.bind(bus);
  bus.write = (address, value) => {
    const a = address & 0x1fff;
    if (!(a & 0x1080)) {
      const reg = a & 0x3f;
      if (reg === 0 && (value & 2)) vsyncAt = t;
      const rel = t - vsyncAt; const line = Math.floor(rel / 228);
      if (n === +frame && names[reg] && line >= +from && line <= +to) (lines[line] = lines[line] || []).push(`${names[reg]}@${board._tia._hctr}`);
    }
    return origWrite(address, value);
  };
  if (kind === 'std') { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  let g = 0;
  while (n <= +frame && g++ < 3e8) { board.tick(1); t++; }
  Object.keys(lines).forEach((line) => console.log(line, lines[line].join(' ')));
})();
