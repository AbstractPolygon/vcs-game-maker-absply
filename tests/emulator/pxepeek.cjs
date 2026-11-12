// usage: node pxepeek.cjs rom.bin name,name,... [plan] -> runs a PXE ROM (with its .sym.txt beside it) and after the start (WAIT frames, 400)
// and each step of the plan (d/u/l/r + frames, f: Fire 4 frames; 10 quiet frames after each) prints the named variables of the program,
// read from the PXE program's memory (the software 6502 keeps its RAM in the ARM's memory, at pRAM; the 6507's RAM is not the program's).
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, namesText, planText = 'u1 u7 d3'] = process.argv;
  const sym = fs.readFileSync(rom.replace(/\.bin$/, '.sym.txt'), 'utf8');
  const address = (name) => { const m = sym.match(new RegExp('^' + name + '\\s+([0-9a-f]{4})', 'mi')); return m ? parseInt(m[1], 16) : null; };
  const names = namesText.split(',');
  const cart = await makeCart(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  const surf = {buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  board.getVideoOutput().setSurfaceFactory(() => surf);
  let frame = 0;
  board.getVideoOutput().newFrame.addHandler(() => { frame++; });
  board.boot();
  const joy = board.getJoystick0();
  const runFrames = (n) => { const end = frame + n; let g = 0; while (frame < end && g++ < 1e8) board.tick(500); };
  const values = () => {
    const base = cart._read(cart._linked.symbols.pRAM, 4) >>> 0;
    return names.map((name) => `${name}=${cart._read(base + address(name), 1) & 255}`).join(' ');
  };
  runFrames(+(process.env.WAIT || 400));
  const out = [`start: ${values()}`];
  for (const step of planText.split(/\s+/)) {
    const button = step === 'f' ? joy.getFire() : {d: joy.getDown(), u: joy.getUp(), l: joy.getLeft(), r: joy.getRight()}[step[0]];
    button.toggle(true); runFrames(step === 'f' ? 4 : +step.slice(1)); button.toggle(false); runFrames(10);
    out.push(`${step}: ${values()}`);
  }
  console.log(out.join(' | '));
})();
