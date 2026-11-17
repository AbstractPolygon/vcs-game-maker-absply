// usage: node stepcost.cjs rom.bin rom.sym.txt [frames] -> the cycles each step of the Draw blocks' engine takes (src/generators/bbasic/pf-draw.js:
// a call of _pfd_unit, from its first instruction until it has returned, the stack pointer back where it was before the call), by the kind of work
// the state byte (pfdState) holds as the step starts (none: a record starting), with picsame's input (reset on frames 21 to 29, Fire on 200 to
// 210): how many steps, the most and the mean, and the most in the timer's counts of 64 cycles (rounded up). For the time each kind of step
// needs (STEP_TIMER_COUNTS in pf-draw.js). Standard and DPC+ ROMs (PXE runs the program on its coprocessor).
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require('../lib/cart.cjs');
const {matchDriverFractionalFetchers} = require(P.REPO + 'tools/stellerator/dpcplus-driver');

const KINDS = ['none', 'pixel', 'hline', 'vline', 'area', 'line', 'circle', 'fill'];
(async () => {
  const [, , file, symFile, framesText = '600'] = process.argv;
  const symLines = fs.readFileSync(symFile, 'utf8').split(/\r?\n/);
  const addrOf = (name) => {
    const line = symLines.find((l) => l.split(/\s+/)[0] === name || l.split(/\s+/)[0] === `0.${name}`);
    return line ? parseInt(line.split(/\s+/)[1], 16) : null;
  };
  const unit = addrOf('_pfd_unit');
  const state = addrOf('pfdState');
  if (unit === null || state === null) throw new Error('no _pfd_unit or pfdState in the symbols');
  // (pfdState is a letter or var: its address is in the symbols of the letter it was given.)
  const dim = /dim pfdState = (\w+)/.exec(fs.readFileSync(symFile.replace(/\.sym\.txt$/, '.bb.txt'), 'utf8'));
  const stateAddr = dim ? addrOf(dim[1]) : state;
  const rom = new Uint8Array(fs.readFileSync(file));
  const cart = await makeCart(rom);
  const name = (cart.constructor && cart.constructor.name) || '';
  if (/DPCPlus/.test(name)) matchDriverFractionalFetchers(cart, rom);
  const config = Config.create({tvMode: 0, enableAudio: false, pcmAudio: false, emulatePaddles: false, randomSeed: 1, frameStart: 23, cpuType: CpuFactory.Type.stateMachine});
  const board = new Board(config, cart);
  board.getVideoOutput().setSurfaceFactory(() => ({buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }}));
  let frames = 0;
  board.getVideoOutput().newFrame.addHandler(() => frames++);
  const std = !/DPCPlus|PXE/.test(name);
  if (std) { cart.setCpuTimeProvider && cart.setCpuTimeProvider(() => board.getCpuTime()); board._tia._frameManager._kernelLines = 200; board.boot(); } else board.reset();
  const cpu = board.getCpu();
  const bus = board.getBus();
  const stats = KINDS.map(() => ({count: 0, most: 0, total: 0}));
  let cycles = 0;
  let open = null;
  let last = -1;
  while (frames < Number(framesText)) {
    board.getControlPanel().getResetButton().toggle(frames > 20 && frames < 30);
    board.getJoystick0().getFire().toggle(frames >= 200 && frames <= 210);
    board.tick(1);
    cycles++;
    const pc = cpu.getLastInstructionPointer();
    if (pc === last) continue;
    last = pc;
    if (open && cpu.state.s === open.sp) {
      // (A tick is a color clock: three to a cycle of the CPU.)
      const took = (cycles - open.start) / 3;
      const entry = stats[open.kind];
      entry.count++;
      entry.total += took;
      entry.most = Math.max(entry.most, took);
      open = null;
    }
    if (!open && (pc & 0xfff) === (unit & 0xfff)) open = {start: cycles, sp: (cpu.state.s + 2) & 255, kind: bus.peek(stateAddr) >> 5};
  }
  stats.forEach(({count, most, total}, kind) => {
    if (count) console.log(`${KINDS[kind].padEnd(7)} ${String(count).padStart(6)} steps, most ${String(most).padStart(5)} cycles (${Math.ceil(most / 64)} counts), mean ${(total / count).toFixed(0)}`);
  });
})();
