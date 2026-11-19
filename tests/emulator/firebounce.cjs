// usage: node tests/emulator/firebounce.cjs rom.bin rom.sym.txt frames object[,object...]
// A fired object with a Bounce block (tests/projects/mkfire.cjs: fire_<kernel>_any_bounce with the screen edges, fire_<kernel>_any_wall and wall2 with a wall and a
// floor of the playfield): its heading byte (<object>FireDir) and its x and y read every frame. Every frame the heading changes is a bounce: it is checked to be
// the mirror of the old heading over a vertical wall (0 - heading) or a horizontal one (128 - heading), or, off the playfield, a turn right round (+ 128), within
// `tolerance` (default 0, 16 for the playfield walls, where the wall is told from the nearest of 16 directions). Prints the bounces and the position range; exits
// 1 when a heading changes by anything else, or the object never bounces. The 8 and 16 direction projects (a heading of 0-7 or 0-15) are read as they are.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const req = (m) => require(path.join(ROOT, 'node_modules', m));
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require(path.join(ROOT, 'tests', 'lib', 'cart.cjs'));
const {matchDriverFractionalFetchers} = require(path.join(ROOT, 'tools', 'stellerator', 'dpcplus-driver'));

(async () => {
  const [, , file, symFile, framesText, objectsText] = process.argv;
  const frames = Number(framesText);
  const symLines = fs.readFileSync(symFile, 'utf8').split(/\r?\n/);
  const addrOf = (name) => {
    const line = symLines.find((l) => l.split(/\s+/)[0] === name);
    if (!line) throw new Error('no symbol ' + name);
    return parseInt(line.split(/\s+/)[1], 16);
  };
  const objects = objectsText.split(',').map((name) => ({name, x: addrOf(name + 'x'), y: addrOf(name + 'y'), dir: addrOf(name + 'FireDir'), trace: []}));
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await makeCart(rom);
  const cname = (cart.constructor && cart.constructor.name) || '';
  if (/DPCPlus/.test(cname)) matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  let n = 0;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  const bus = board.getBus();
  // (A PXE program's RAM is in the ARM's memory, at pRAM, not the 6507's.)
  const pxe = /PXE/.test(cname);
  // (Not readable until the program has started: 0 until then.)
  const pxeRead = (addr) => {
    try {
      return cart._read((cart._read(cart._linked.symbols.pRAM, 4) >>> 0) + addr, 1) & 255;
    } catch (e) {
      return 0;
    }
  };
  const peek = pxe ? pxeRead : (addr) => bus.peek(addr);
  // The objects are read when a frame starts (the game logic of the frame before is done by then).
  const sample = () => {
    objects.forEach((o) => o.trace.push([peek(o.x), peek(o.y), peek(o.dir)]));
    n++;
  };
  board.getVideoOutput().newFrame.addHandler(sample);
  const std = !/DPCPlus|PXE/.test(cname);
  if (pxe) board.boot();
  else if (std) { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  let guard = 0;
  const chunk = pxe ? 500 : std ? 200 : 2000;
  while (n < frames && guard++ < 1e8) {
    if (!pxe) board.getControlPanel().getResetButton().toggle(n > 20 && n < 30);
    board.tick(chunk);
  }
  const tolerance = Number(process.env.TOLERANCE || 0);
  const turn = Number(process.env.TURN || 256);
  let bad = false;
  objects.forEach((o) => {
    const bounces = [];
    // (The first change of the heading is the shot itself, from the byte's starting value.)
    let first = true;
    for (let i = 1; i < o.trace.length; i++) {
      const [, , before] = o.trace[i - 1];
      const [x, y, after] = o.trace[i];
      if (after === before) continue;
      if (first) {
        first = false;
        continue;
      }
      const mod = (v) => ((v % turn) + turn) % turn;
      const near = (a, b) => { const d = Math.abs(mod(a) - mod(b)); return Math.min(d, turn - d) <= tolerance; };
      const kind = near(after, turn - before) ? 'vertical wall' : near(after, turn / 2 - before) ? 'horizontal wall' : near(after, before + turn / 2) ? 'both' : 'OTHER';
      bounces.push({frame: i, from: before, to: after, kind, at: [x, y]});
    }
    const xs = o.trace.map((t) => t[0]);
    const ys = o.trace.map((t) => t[1]);
    console.log(`${o.name}: ${bounces.length} bounces, x ${Math.min(...xs)}..${Math.max(...xs)}, y ${Math.min(...ys)}..${Math.max(...ys)}`);
    bounces.slice(0, 8).forEach((b) => console.log(`  frame ${b.frame}: heading ${b.from} -> ${b.to} (${b.kind}) at x ${b.at[0]} y ${b.at[1]}`));
    if (!bounces.length || bounces.some((b) => b.kind === 'OTHER')) bad = true;
  });
  process.exit(bad ? 1 : 0);
})();
