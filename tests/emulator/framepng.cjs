// usage: node framepng.cjs rom.bin frame out.png [first last] -> one frame of a ROM as a PNG, each pixel 2 wide (lines first to last, 0 to 279 by
// default). TV=pal runs it as a PAL console (its colors and 312 line frames); FIRE_AT=n holds Fire for 8 frames from frame n.
const fs = require('fs');
const zlib = require('zlib');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, frameArg, out, firstArg, lastArg] = process.argv;
  const pal = process.env.TV === 'pal';
  const cart = await makeCart(new Uint8Array(fs.readFileSync(rom)), pal ? 'PAL' : 'NTSC');
  const board = new Board(Config.create({tvMode: pal ? 1 : 0, enableAudio: false, randomSeed: 1}), cart);
  if (cart.setCpuTimeProvider) cart.setCpuTimeProvider(() => board.getCpuTime());
  const surf = {buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  board.getVideoOutput().setSurfaceFactory(() => surf);
  let frame = 0; let last = null;
  board.getVideoOutput().newFrame.addHandler((s) => { frame++; last = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  const fireAt = +(process.env.FIRE_AT || 0);
  const joy = board.getJoystick0();
  let g = 0;
  while (frame < +frameArg && g++ < 1e8) {
    if (fireAt) joy.getFire().toggle(frame >= fireAt && frame < fireAt + 8);
    board.tick(500);
  }
  const first = +(firstArg || 0), lastLine = +(lastArg || 279);
  const W = 320, H = lastLine - first + 1;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = last[(first + y) * 160 + (x >> 1)];
      const o = y * (W * 3 + 1) + 1 + x * 3;
      raw[o] = v & 255; raw[o + 1] = (v >> 8) & 255; raw[o + 2] = (v >> 16) & 255;
    }
  }
  const crcTable = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (b) => { let r = 0xffffffff; for (const x of b) r = crcTable[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('frame', frame, 'written', out);
})();
