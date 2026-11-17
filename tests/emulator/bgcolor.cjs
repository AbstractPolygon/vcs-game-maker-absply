// usage: node bgcolor.cjs rom.bin frame[,frame...] -> runs a ROM as picsame.cjs does (reset pressed on frames 21 to 29, FIRE=from-to[,from-to...] for
// the joystick's Fire) and prints, for each frame given, the color most of the picture's rows 30 to 160 show (the background, on most screens) as
// rrggbb. EXPECT=rrggbb: exits with 1 when the last frame given shows another one.
// Made for the title screen projects of tests/projects (ball2 to ball5, rc1, rc2): after "End title screen" the title loop goes on drawing the
// game, and a variable that shared a byte with a Title Screen variable must have its starting value back (backgroundrealcolor: the green
// background, 328432 with the 6502.ts palette, not black). For example:
//   FIRE=200-210,400-410 EXPECT=328432 node bgcolor.cjs ball2.bin 250,300,500
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require('../lib/cart.cjs');
const {matchDriverFractionalFetchers} = require(P.REPO + 'tools/stellerator/dpcplus-driver');
(async () => {
  const [, , file, framesText] = process.argv;
  const wanted = framesText.split(',').map(Number);
  const last = Math.max(...wanted);
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await makeCart(rom);
  const name = (cart.constructor && cart.constructor.name) || '';
  if (/DPCPlus/.test(name)) matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const colors = new Map();
  let count = 0;
  board.getVideoOutput().newFrame.addHandler((s) => {
    if (wanted.includes(count)) {
      const buf = s.getBuffer();
      const tally = new Map();
      for (let i = 30 * 160; i < 160 * 160; i++) tally.set(buf[i], (tally.get(buf[i]) || 0) + 1);
      const most = [...tally].sort((a, b) => b[1] - a[1])[0][0];
      colors.set(count, [most & 255, (most >> 8) & 255, (most >> 16) & 255].map((v) => v.toString(16).padStart(2, '0')).join(''));
    }
    count++;
  });
  const std = !/DPCPlus|PXE/.test(name);
  if (std) { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  const fire = (process.env.FIRE || '').split(',').filter(Boolean).map((range) => range.split('-').map(Number));
  let guard = 0;
  while (count <= last && guard++ < 1e8) {
    board.getControlPanel().getResetButton().toggle(count > 20 && count < 30);
    if (fire.length) board.getJoystick0().getFire().toggle(fire.some(([from, to]) => count >= from && count <= to));
    board.tick(std ? 200 : 2000);
  }
  wanted.forEach((frame) => console.log(`frame ${frame}: ${colors.get(frame)}`));
  if (process.env.EXPECT && colors.get(wanted[wanted.length - 1]) !== process.env.EXPECT.toLowerCase()) {
    console.log(`FAIL: expected ${process.env.EXPECT}`);
    process.exit(1);
  }
})();
