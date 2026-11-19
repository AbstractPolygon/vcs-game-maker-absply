// usage: node terraincmp.cjs terrain_std_<side>.bin side [frames] [roughness] [least height] [most height] [overhangs] -> a standard kernel ROM of tests/projects/terrain_std_<side>.vcsgm (mkterrain.cjs) run for
// that many frames (400) with picsame's input (reset on frames 21 to 29): its playfield (the RAM at $A4, four bytes a row, 32 columns by 11 rows) checked
// as terrain on the side (bottom, top, left or right): at every position along the side the pixels that are on are one run from the edge (with overhangs there are gaps, and at least one), as high as the heights allow, the first one in the middle of them (with roughness 0 all
// the same), the height at the next position the same or one more or less, and no pixel on anywhere else; the score 777 shows once
// the terrain is done (Playfield terrain done). Prints the depths and exits with 1 when any rule breaks.
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require('../lib/cart.cjs');

const COLUMNS = 32;
const ROWS = 11;
(async () => {
  const [, , file, side, framesText = '400', roughText = '2', minText = '3', maxText = '6', overText = '0'] = process.argv;
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await makeCart(rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() {
    return this.buf;
  }, getWidth() {
    return 160;
  }, getHeight() {
    return 400;
  }}));
  let frames = 0;
  board.getVideoOutput().newFrame.addHandler(() => frames++);
  cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime());
  board._tia._frameManager._kernelLines = 200;
  board.boot();
  let guard = 0;
  while (frames < Number(framesText) && guard++ < 1e8) {
    board.getControlPanel().getResetButton().toggle(frames > 20 && frames < 30);
    board.tick(200);
  }
  const bus = board.getBus();
  const pixel = (x, y) => {
    const byte = bus.peek(0xA4 + y * 4 + (x >> 3));
    return (byte >> ((x >> 3) % 2 === 0 ? 7 - (x & 7) : x & 7)) & 1;
  };
  const vertical = side === 'bottom' || side === 'top';
  const minHeight = Number(minText);
  const maxHeight = Number(maxText);
  const over = Number(overText);
  const rough = Number(roughText);
  const length = vertical ? COLUMNS : ROWS;
  const size = vertical ? ROWS : COLUMNS;
  const at = (position, depthIndex) => {
    // (the pixel depthIndex pixels in from the edge, at that position along the side)
    if (side === 'bottom') return pixel(position, ROWS - 1 - depthIndex);
    if (side === 'top') return pixel(position, depthIndex);
    if (side === 'left') return pixel(depthIndex, position);
    return pixel(COLUMNS - 1 - depthIndex, position);
  };
  const depths = [];
  const errors = [];
  const most = Math.min(maxHeight, size);
  const least = Math.min(minHeight, most);
  const middle = Math.floor((least + most) / 2);
  let gaps = 0;
  for (let position = 0; position < length; position++) {
    // (The height is where the highest lit pixel is; with no overhangs every pixel below it is lit too.)
    let depth = 0;
    for (let k = size - 1; k >= 0; k--) {
      if (at(position, k)) {
        depth = k + 1; break;
      }
    }
    for (let k = 0; k < depth; k++) {
      if (!at(position, k)) {
        gaps++; if (!over) errors.push(`gap in the ground at ${position}, ${k}`); break;
      }
    }
    if (depth < least || depth > most) errors.push(`height ${depth} at ${position}`);
    // (A ledge of an overhang ends over ground that has dropped, so with overhangs the height jumps there.)
    if (!over && position && Math.abs(depth - depths[position - 1]) > 1) errors.push(`height jumps ${depths[position - 1]} to ${depth} at ${position}`);
    if (position === 0 && depth !== middle) errors.push(`starts at ${depth}, not ${middle}`);
    if (rough === 0 && depth !== middle) errors.push(`flat ground has height ${depth} at ${position}`);
    depths.push(depth);
  }
  if (over && !gaps) errors.push('overhangs asked for and none found');
  // (How smooth it flows: the times the slope turns from up to down or back, steps of 0 left out.)
  let turns = 0;
  let last = 0;
  depths.forEach((d, i) => {
    const step = i ? Math.sign(d - depths[i - 1]) : 0;
    if (step && last && step !== last) turns++;
    if (step) last = step;
  });
  console.log(`${side}: ${depths.join(' ')}  (${turns} turns)`);
  errors.slice(0, 8).forEach((error) => console.log(`WRONG: ${error}`));
  console.log(errors.length ? `${errors.length} rules broken` : 'terrain right');
  process.exit(errors.length ? 1 : 0);
})();
