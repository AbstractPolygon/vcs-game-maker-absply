// usage: node rollcheck.cjs rom.bin [frames] [seed] -> runs a ROM (KIND=dpc, the default, or std) with the joystick input of framecmp.cjs (a pattern of fire,
// left, right, up, down from the seed) and counts the scanlines of each frame (from VSYNC to VSYNC); prints how many frames had each count and the
// first frames with another count than most (a frame that is longer or shorter makes the picture roll). The first 30 frames (the start) are left out.
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
  const [, , file, frames = '1500', seed = '1'] = process.argv;
  const rom = new Uint8Array(fs.readFileSync(file));
  const kind = process.env.KIND || 'dpc';
  const cart = await new CF().createCartridge(rom);
  if (kind === 'dpc') matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const J = board.getJoystick0();
  let r = Number(seed) * 7919 + 13; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let held = {};
  const lines = [];
  // The scanlines between the starts of VSYNC, from the CPU time (in seconds; 1193182 CPU cycles a second, 76 a line).
  const bus = board.getBus(); const write = bus.write.bind(bus); let vs = false; let last = -1;
  bus.write = (a, v) => {
    if (!(a & 0x1080) && (a & 0x3f) === 0) {
      const on = !!(v & 2);
      if (on && !vs) {
        const now = board.getCpuTime();
        if (last >= 0) lines.push((now - last) * 1193182 / 76);
        last = now;
        if (lines.length % 15 === 0) held = {fire: rnd() < 0.3, left: rnd() < 0.3, right: rnd() < 0.3, up: rnd() < 0.2, down: rnd() < 0.1};
        J.getFire().toggle(!!held.fire); J.getLeft().toggle(!!held.left && !held.right); J.getRight().toggle(!!held.right && !held.left);
        J.getUp().toggle(!!held.up); J.getDown().toggle(!!held.down && !held.up);
      }
      vs = on;
    }
    return write(a, v);
  };
  board.reset();
  let g = 0;
  while (lines.length < Number(frames) && g++ < 1e9) board.tick(2000);
  // (The emulator's clock can make a 262-line frame measure a little under 262: a frame is compared with the count most frames have.)
  const counts = {};
  const after = lines.slice(30);
  after.forEach((n) => { const key = n.toFixed(1); counts[key] = (counts[key] || 0) + 1; });
  const usual = Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]);
  const odd = [];
  after.forEach((n, i) => { if (Math.abs(n - usual) > 0.5 && odd.length < 10) odd.push(`${i + 31}:${n.toFixed(1)}`); });
  const rolled = after.filter((n) => Math.abs(n - usual) > 0.5).length;
  console.log(file.split(/[\\/]/).pop(), 'frames', lines.length, 'lines per frame', JSON.stringify(counts),
      rolled ? `${rolled} frames not ${usual.toFixed(1)}: ${odd.join(' ')}` : 'all the same');
})();
