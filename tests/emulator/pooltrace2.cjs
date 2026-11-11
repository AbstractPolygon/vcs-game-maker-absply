// usage: node pooltrace2.cjs rom sym passes [kind] -> at each entry to drawscreen: the pool slots (frame <> 255 => active) and their y; prints every pass where the
// active set changes, and every pass where an active slot's y does not go up by exactly 1 (a slot moved by something other than its fall)
const P = require('../lib/paths.cjs');
const fs = require('fs');
const ROOT = P.REPO + '';
const req = (m) => require(ROOT + 'node_modules/' + m);
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const CF = req('6502.ts/lib/machine/stella/cartridge/CartridgeFactory').default;
const {matchDriverFractionalFetchers} = require(ROOT + 'tools/stellerator/dpcplus-driver');
(async () => {
  const [, , file, symFile, total = '1500', kind = 'dpc'] = process.argv;
  const symText = fs.readFileSync(symFile, 'utf8');
  const sym = (name) => { const m = new RegExp('^' + name + '[ \t]+([0-9a-f]+)', 'm').exec(symText); return m ? parseInt(m[1], 16) : null; };
  const F = [1, 2, 3].map((i) => sym(`player${i}frame`)); const Y = [1, 2, 3].map((i) => sym(`player${i}y`)); const X = [1, 2, 3].map((i) => sym(`player${i}x`));
  const DRAW = sym("drawscreen"); const CALL = parseInt(process.env.WATCH, 16); let calls = 0; const SC = sym("score");
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await new CF().createCartridge(rom); if (kind === 'dpc') matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart); let n = 0;
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  board.getVideoOutput().newFrame.addHandler(() => { n++; });
  const J = board.getJoystick0(); const bus = board.getBus(); const cpu = board.getCpu();
  board.reset();
  let g = 0; let last = -1; let pass = 0; let prev = null; let lastActive = '';
  while (pass < +total && g++ < 4e8) {
    board.tick(1);
    J.getFire().toggle(n > 340 && n % 40 < 8); J.getLeft().toggle(n > 500 && n % 120 < 40); J.getRight().toggle(n > 500 && n % 120 >= 60 && n % 120 < 100);
    const pc = cpu.getLastInstructionPointer(); if (process.env.W2 && pc === parseInt(process.env.W2, 16) && last !== pc) console.log("  w2 pass", pass, "active", bus.peek(0xde), "rand", bus.peek(sym("rand"))); if (pc === CALL && last !== CALL) { calls++; console.log("call", calls, "pass", pass, "score", [0, 1, 2].map((i) => bus.peek(SC + i).toString(16)).join("")); }
    if (pc === DRAW && last !== DRAW) {
      pass++;
      const s = F.map((a, i) => ({on: bus.peek(a) !== 255, y: bus.peek(Y[i]), x: bus.peek(X[i])}));
      const active = s.map((v) => (v.on ? '+' : '-')).join('');
      const odd = prev ? s.map((v, i) => (v.on && prev[i].on && v.y !== ((prev[i].y + 1) & 255) ? `slot${i + 1} ${prev[i].y}->${v.y}` : '')).filter(Boolean) : [];
      if (active !== lastActive || odd.length) console.log('pass', pass, 'frame', n, active, s.map((v, i) => (v.on ? `${i + 1}@${v.x},${v.y}` : '-')).join(' '), odd.length ? 'JUMP ' + odd.join(' ') : '');
      lastActive = active; prev = s; if (pass % 150 === 0) console.log("  pass", pass, "ball", bus.peek(sym("ballx")), bus.peek(sym("bally")), "paddle", bus.peek(sym("player0x")), bus.peek(sym("player0y")), "score", [0, 1, 2].map((i) => bus.peek(SC + i).toString(16)).join(""));
    }
    last = pc;
  }
})();
