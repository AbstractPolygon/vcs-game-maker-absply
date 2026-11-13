// usage: node framecmp.cjs romA romB frames [seed] -> runs two DPC+ ROMs with the same joystick input (a pattern of fire, left, right, up, down from the seed)
// and compares every frame's picture; prints the first frames that differ and how many differ (PNG=prefix SHOW=frame: that frame of each as a PNG)
const P = require('../lib/paths.cjs');
const fs = require('fs');
const ROOT = P.REPO + '';
const req = (m) => require(ROOT + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
const {matchDriverFractionalFetchers} = require(ROOT + 'tools/stellerator/dpcplus-driver');
const crypto = require('crypto');
const run = async (file, frames, seed) => {
  const rom = new Uint8Array(fs.readFileSync(file));
  const kind = process.env.KIND || 'dpc'; let cart; let ticks = 2000;
  if (kind === 'pxe') { const C = require(ROOT + 'tools/stellerator/pxe/CartridgePXE.js'); cart = new C(rom, {tvSpec: 'NTSC'}); await cart.init(); ticks = 456; } else { cart = await new CF().createCartridge(rom); if (kind === 'dpc') matchDriverFractionalFetchers(cart, rom); }
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0; const hashes = [];
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const J = board.getJoystick0();
  let r = seed * 7919 + 13; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let held = {};
  board.getVideoOutput().newFrame.addHandler((s) => {
    n++;
    hashes.push(Uint32Array.from(s.getBuffer()));
    if (n % 15 === 0) held = {fire: rnd() < 0.3, left: rnd() < 0.3, right: rnd() < 0.3, up: rnd() < 0.2, down: rnd() < 0.1};
    J.getFire().toggle(!!held.fire); J.getLeft().toggle(!!held.left && !held.right); J.getRight().toggle(!!held.right && !held.left);
    J.getUp().toggle(!!held.up); J.getDown().toggle(!!held.down && !held.up);
  });
  if (kind === 'std') { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  let g = 0; while (n < frames && g++ < 1e9) { if (kind === 'std') board.getControlPanel().getResetButton().toggle(n > 20 && n < 30); board.tick(ticks); }
  return hashes;
};
(async () => {
  const [, , a, b, frames = '3000', seed = '1'] = process.argv;
  const ha = await run(a, +frames, +seed); const hb = await run(b, +frames, +seed);
  const rowsOf = (x, y) => { const rows = new Set(); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) rows.add(Math.floor(i / 160)); return [...rows]; };
  const diff = ha.map((h, i) => (rowsOf(h, hb[i]).length ? i + 1 : 0)).filter(Boolean);
  const rowHist = {}; diff.forEach((f) => rowsOf(ha[f - 1], hb[f - 1]).forEach((r) => { const k = Math.floor(r / 10) * 10; rowHist[k] = (rowHist[k] || 0) + 1; }));
  if (process.env.SHOW) { const f = +process.env.SHOW; const A = ha[f - 1]; const B = hb[f - 1]; rowsOf(A, B).forEach((r) => { const cnt = (X) => { const m = {}; for (let x = 0; x < 160; x++) m[(X[r * 160 + x] & 0xffffff).toString(16)] = (m[(X[r * 160 + x] & 0xffffff).toString(16)] || 0) + 1; return JSON.stringify(m); }; console.log('line', r, 'A', cnt(A), 'B', cnt(B)); }); for (const X of [A, B]) { for (let r = 192; r < 204; r++) { let l = String(r) + ' '; for (let x = 40; x < 120; x++) l += (X[r * 160 + x] & 0xffffff) ? '#' : '.'; console.log(l); } console.log('--'); } }
  // PNG=prefix with SHOW=frame: that frame of each ROM as prefixA.png and prefixB.png (each pixel 2 wide).
  if (process.env.PNG && process.env.SHOW) {
    const zlib = require('zlib');
    const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let r = 0xffffffff; for (const x of b) r = crcTable[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
    const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    [['A', ha], ['B', hb]].forEach(([tag, frames]) => {
      const X = frames[+process.env.SHOW - 1]; const W = 320; const H = 280; const raw = Buffer.alloc(H * (W * 3 + 1));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = X[y * 160 + (x >> 1)]; const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = v & 255; raw[o + 1] = (v >> 8) & 255; raw[o + 2] = (v >> 16) & 255; }
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
      fs.writeFileSync(process.env.PNG + tag + '.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
    });
  }
  console.log('lines that differ (by 10s: count of frames)', JSON.stringify(rowHist));
  console.log(a.split('/').pop(), 'vs', b.split('/').pop(), 'frames', ha.length, 'differ', diff.length, diff.length ? 'first ' + diff.slice(0, 8).join(',') : '', '');
})();
