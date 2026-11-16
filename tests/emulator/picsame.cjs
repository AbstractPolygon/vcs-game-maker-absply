// usage: node picsame.cjs a.bin b.bin [frames] -> runs two ROMs (any kind tests/lib/cart.cjs makes: standard, DPC+, PXE) with no input but the reset
// switch (pressed on frames 21 to 29, to start a game that waits for it, as framecmp.cjs does) and compares their pictures frame by frame; prints the
// first frames that differ and how many do. PNG=prefix SHOW=frame: that frame of each as prefixA.png and prefixB.png (each pixel 2 wide).
// FIRE=from-to[,from-to...]: the joystick's Fire pressed in those frames too (a game that starts with Fire, a menu).
const fs = require('fs');
const zlib = require('zlib');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require('../lib/cart.cjs');
const {matchDriverFractionalFetchers} = require(P.REPO + 'tools/stellerator/dpcplus-driver');
const pictures = async (file, frames) => {
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await makeCart(rom);
  const name = (cart.constructor && cart.constructor.name) || '';
  // (DPC+: the fractional fetchers of the driver the ROM has, as framecmp.cjs does.)
  if (/DPCPlus/.test(name)) matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const pics = [];
  board.getVideoOutput().newFrame.addHandler((s) => pics.push(Uint32Array.from(s.getBuffer())));
  // (The standard kernel's ROMs as framecmp.cjs runs them.)
  const std = !/DPCPlus|PXE/.test(name);
  if (std) { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  const fire = (process.env.FIRE || '').split(',').filter(Boolean).map((range) => range.split('-').map(Number));
  let g = 0;
  while (pics.length < frames && g++ < 1e8) {
    board.getControlPanel().getResetButton().toggle(pics.length > 20 && pics.length < 30);
    if (fire.length) board.getJoystick0().getFire().toggle(fire.some(([from, to]) => pics.length >= from && pics.length <= to));
    board.tick(std ? 200 : 2000);
  }
  return pics;
};
const writePng = (file, X) => {
  const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let r = 0xffffffff; for (const x of b) r = crcTable[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const W = 320; const H = 280; const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = X[y * 160 + (x >> 1)]; const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = v & 255; raw[o + 1] = (v >> 8) & 255; raw[o + 2] = (v >> 16) & 255; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
};
(async () => {
  const [, , a, b, framesText = '600'] = process.argv;
  const frames = Number(framesText);
  const pa = await pictures(a, frames);
  const pb = await pictures(b, frames);
  const differ = [];
  for (let f = 0; f < frames; f++) {
    const x = pa[f]; const y = pb[f];
    if (!x || !y) break;
    if (x.some((v, i) => v !== y[i])) differ.push(f);
  }
  if (process.env.PNG && process.env.SHOW) {
    writePng(`${process.env.PNG}A.png`, pa[Number(process.env.SHOW)]);
    writePng(`${process.env.PNG}B.png`, pb[Number(process.env.SHOW)]);
  }
  console.log(`${a} vs ${b}: ${frames} frames, ${differ.length} differ${differ.length ? ` (first ${differ.slice(0, 8).join(',')})` : ''}`);
})();
