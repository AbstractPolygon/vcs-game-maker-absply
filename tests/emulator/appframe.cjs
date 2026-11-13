// usage: node appframe.cjs rom.bin frame out.png -> a frame the way the app's emulator shows it: 6502.ts set up as tools/stellerator/worker-entry.js
// sets it up (the frame start, the NTSC picture lines, the DPC+ fractional fetchers, PXE through CartridgePXE) and the lines it sends to the
// screen (the top getHeight() lines of the surface, at most 320), each pixel 2 wide. TV=pal for a PAL 50 Hz project. Prints the lines shown.
const fs = require('fs');
const zlib = require('zlib');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CartridgeFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
const {matchDriverFractionalFetchers} = require(P.REPO + 'tools/stellerator/dpcplus-driver');
const CartridgePXE = require(P.REPO + 'tools/stellerator/pxe/CartridgePXE');
// (As in worker-entry.js.)
const FRAME_WIDTH = 160;
const MAX_FRAME_HEIGHT = 320;
const NTSC_FRAME_START = 23;
const NTSC_PICTURE_LINES = 200;
(async () => {
  const [, , romPath, frameArg, out] = process.argv;
  const rom = new Uint8Array(fs.readFileSync(romPath));
  const pal = process.env.TV === 'pal';
  const config = Config.create({tvMode: pal ? 1 : 0, enableAudio: false, randomSeed: 1, frameStart: pal ? -1 : NTSC_FRAME_START});
  let cartridge;
  if (CartridgePXE.matchesBuffer(rom)) {
    cartridge = new CartridgePXE(rom, {tvSpec: pal ? 'PAL' : 'NTSC'});
    if (cartridge.init) await cartridge.init();
  } else {
    cartridge = await new CartridgeFactory().createCartridge(rom);
    matchDriverFractionalFetchers(cartridge, rom);
  }
  const board = new Board(config, cartridge);
  if (cartridge.setCpuTimeProvider) cartridge.setCpuTimeProvider(() => board.getCpuTime());
  if (!pal && board._tia && board._tia._frameManager) board._tia._frameManager._kernelLines = NTSC_PICTURE_LINES;
  const surf = {buf: new Uint32Array(FRAME_WIDTH * MAX_FRAME_HEIGHT), getBuffer() { return this.buf; }, getWidth() { return FRAME_WIDTH; }, getHeight() { return MAX_FRAME_HEIGHT; }};
  board.getVideoOutput().setSurfaceFactory(() => surf);
  let frame = 0; let last = null;
  board.getVideoOutput().newFrame.addHandler((s) => { frame++; last = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  let g = 0;
  while (frame < +frameArg && g++ < 1e8) board.tick(500);
  const H = Math.min(board.getVideoOutput().getHeight(), MAX_FRAME_HEIGHT);
  const W = FRAME_WIDTH * 2;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = last[y * FRAME_WIDTH + (x >> 1)];
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
  console.log(`frame ${frame}: ${H} lines shown, written ${out}`);
})();
