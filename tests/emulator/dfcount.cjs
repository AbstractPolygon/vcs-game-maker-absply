// usage: node dfcount.cjs rom.bin [frames] [seed] -> a DPC+ ROM run with rollcheck.cjs's joystick input: how many times a frame (after the first 300) each byte of
// the DPC+ stack area (where the build puts variables in the display memory, see generators/bbasic/spill.js) is read and written through data fetcher 6.
const P = require('../lib/paths.cjs');
const REPO = P.REPO;
const fs = require('fs');
const req = (m) => require(REPO + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
const {matchDriverFractionalFetchers, cartridgeTypeOf} = require(REPO + 'tools/stellerator/dpcplus-driver');
(async () => {
  const [, , file, frames = '1300', seed = '1'] = process.argv;
  // (STACKbegin in DPCplusbB.h, BKCOLS + 256: its place in the display memory.)
  const STACK = 0x0ca5;
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await new CF().createCartridge(rom, cartridgeTypeOf(rom)); matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const J = board.getJoystick0();
  let r = Number(seed) * 7919 + 13; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let held = {}; let n = 0;
  const bus = board.getBus(); const write = bus.write.bind(bus); const read = bus.read.bind(bus); let vs = false;
  let lo = 0; let hi = 0; const reads = new Map(); const writes = new Map(); let ptrSets = 0; let hiSets = 0;
  const slot = () => ((hi & 0x0f) << 8 | lo) - STACK;
  bus.write = (a, v) => {
    if (!(a & 0x1080) && (a & 0x3f) === 0) {
      const on = !!(v & 2);
      if (on && !vs) {
        n++;
        if (n % 15 === 0) held = {fire: rnd() < 0.3, left: rnd() < 0.3, right: rnd() < 0.3, up: rnd() < 0.2, down: rnd() < 0.1};
        J.getFire().toggle(!!held.fire); J.getLeft().toggle(!!held.left && !held.right); J.getRight().toggle(!!held.right && !held.left);
        J.getUp().toggle(!!held.up); J.getDown().toggle(!!held.down && !held.up);
      }
      vs = on;
    }
    const c = a & 0x1fff;
    if (n > 300) {
      if (c === 0x1056) { lo = v; ptrSets++; }
      if (c === 0x106e) { hi = v; hiSets++; }
      if (c === 0x107e) { const s = slot(); if (s >= 0 && s < 256) writes.set(s, (writes.get(s) || 0) + 1); lo = (lo + 1) & 255; }
    }
    return write(a, v);
  };
  bus.read = (a) => {
    const c = a & 0x1fff;
    if (n > 300 && c === 0x100e) { const s = slot(); if (s >= 0 && s < 256) reads.set(s, (reads.get(s) || 0) + 1); lo = (lo + 1) & 255; }
    return read(a);
  };
  board.reset();
  let g = 0;
  while (n < Number(frames) && g++ < 4e9) board.tick(1);
  const f = Number(frames) - 300;
  const all = [...new Set([...reads.keys(), ...writes.keys()])].sort((x, y) => x - y);
  let tr = 0; let tw = 0;
  all.forEach((s) => { tr += reads.get(s) || 0; tw += writes.get(s) || 0; console.log(`+${s}: reads ${((reads.get(s) || 0) / f).toFixed(2)} writes ${((writes.get(s) || 0) / f).toFixed(2)}`); });
  console.log(`a frame: reads ${(tr / f).toFixed(2)} writes ${(tw / f).toFixed(2)}, DF6LOW sets ${(ptrSets / f).toFixed(2)} DF6HI sets ${(hiSets / f).toFixed(2)}`);
})();
