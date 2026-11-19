// usage: node tests/emulator/scorecols.cjs a.bin b.bin ... -> for each ROM the columns (0-159) of the first and last lit pixels of the score digits in frame 60 (the picture rows 190 to 198, where a pixel that is not the color of the row's left edge is lit), and the middle: where the score sits on the screen (the middle of the screen is 80).
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
(async () => {
  for (const file of process.argv.slice(2)) {
    const pics = await pictures(file, 61);
    const X = pics[60];
    let min = 999; let max = -1;
    for (let y = 190; y < 199; y++) for (let x = 0; x < 160; x++) {
      const v = X[y * 160 + x];
      if (v !== X[y * 160] && v !== X[y * 160 + 159]) { if (x < min) min = x; if (x > max) max = x; }
    }
    console.log(`${file}: first ${min} last ${max} middle ${(min + max) / 2}`);
  }
})();
