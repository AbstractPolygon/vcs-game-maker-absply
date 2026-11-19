// usage: node terrainseed.cjs terrain_std_<name>.bin [frameA] [frameB] -> a standard kernel ROM of a terrain project (mkterrain.cjs) run with picsame's input
// (reset on frames 21 to 29) and Fire pressed on frames 450 to 460 (the terrain is made again on each of them) (the project makes the terrain again then): the playfield RAM (the 4 bytes of each of the 11
// rows at $A4) at frame A (400) and at frame B (900). Prints "same" when the terrain made the second time is the same as the first (the project sets the
// random seed before it makes it: a seed the project shares with every block that uses random numbers) and "different" when not; exits with 1 when it
// is different. For the project without a seed, "different" is what is right (the random numbers have gone on).
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , file, aText = '400', bText = '900'] = process.argv;
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await makeCart(rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  let frames = 0;
  board.getVideoOutput().newFrame.addHandler(() => frames++);
  cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime());
  board._tia._frameManager._kernelLines = 200;
  board.boot();
  const bus = board.getBus();
  const snapshot = () => Array.from({length: 44}, (_, i) => bus.peek(0xA4 + i).toString(16).padStart(2, '0')).join('');
  const shots = [];
  let guard = 0;
  while (frames <= Number(bText) && guard++ < 1e8) {
    board.getControlPanel().getResetButton().toggle(frames > 20 && frames < 30);
    board.getJoystick0().getFire().toggle(frames >= 450 && frames <= 460);
    board.tick(200);
    if (frames === Number(aText) && shots.length === 0) shots.push(snapshot());
  }
  shots.push(snapshot());
  const same = shots[0] === shots[1];
  console.log(`first ${shots[0]}\nagain ${shots[1]}\n${same ? 'same' : 'different'}`);
  process.exit(same ? 0 : 1);
})();
