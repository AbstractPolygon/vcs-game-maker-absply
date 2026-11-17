// usage: node drawcmp.cjs draw_std.bin [frames] -> the standard kernel ROM of tests/projects/draw_std.vcsgm (mkdraw.cjs) run for that many frames
// (600) with picsame's input (reset on frames 21 to 29, Fire on 200 to 210); its playfield (the RAM at $A4, four bytes a row: the first and third
// have their left pixel in bit 7, the second and fourth in bit 0) against the same drawing done here: the straight lines, the line (Bresenham's,
// as the line block draws it), the fill (every pixel joined up, down, left or right), the circle (each row's half width the biggest whose square
// is no more than the radius squared less the row's distance squared), the flipped area, the pixel, the centered area and the erase. Prints the
// rows that differ (# on, . off) and exits with 1 when any does.
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require('../lib/cart.cjs');

const COLUMNS = 32;
const ROWS = 11;
const model = () => {
  const pf = Array.from({length: ROWS}, () => Array(COLUMNS).fill(0));
  const set = (x, y, op) => {
    if (x < 0 || x >= COLUMNS || y < 0 || y >= ROWS) return;
    pf[y][x] = op === 'flip' ? 1 - pf[y][x] : op === 'on' ? 1 : 0;
  };
  const hline = (x, y, len) => { for (let i = 0; i < len; i++) set(x + i, y, 'on'); };
  const vline = (x, y, len) => { for (let i = 0; i < len; i++) set(x, y + i, 'on'); };
  const line = (x1, y1, x2, y2) => {
    const dx = Math.abs(x2 - x1); const dy = Math.abs(y2 - y1);
    if (dx >= dy) {
      let err = 128 + 2 * dy - dx;
      for (;;) {
        set(x1, y1, 'on');
        if (x1 === x2) return;
        if (err > 128) { y1 += y1 < y2 ? 1 : -1; err -= 2 * dx; }
        err += 2 * dy; x1 += x1 < x2 ? 1 : -1;
      }
    }
    let err = 128 + 2 * dx - dy;
    for (;;) {
      set(x1, y1, 'on');
      if (y1 === y2) return;
      if (err > 128) { x1 += x1 < x2 ? 1 : -1; err -= 2 * dy; }
      err += 2 * dx; y1 += y1 < y2 ? 1 : -1;
    }
  };
  const fill = (x, y, op) => {
    const want = op === 'on' ? 0 : 1;
    if (pf[y][x] !== want) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || px >= COLUMNS || py < 0 || py >= ROWS || pf[py][px] !== want) continue;
      pf[py][px] = 1 - want;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  };
  const circle = (cx, cy, r) => {
    for (let d = 0; d <= r; d++) {
      let half = r;
      while (half > 0 && half * half > r * r - d * d) half--;
      [cy + d, ...(d ? [cy - d] : [])].forEach((y) => { for (let x = Math.max(0, cx - half); x <= cx + half; x++) set(x, y, 'on'); });
    }
  };
  const area = (x1, y1, x2, y2, op) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, op); };
  hline(4, 1, 20); hline(4, 8, 20); vline(4, 1, 8); vline(23, 1, 8);
  line(6, 2, 12, 6);
  fill(20, 3, 'on');
  circle(28, 4, 2);
  area(0, 9, 3, 10, 'flip');
  set(31, 0, 'on');
  // (centered at 28, 9, 5 wide and 1 high: columns 26 to 30)
  area(26, 9, 30, 9, 'on');
  fill(28, 4, 'off');
  return pf;
};

(async () => {
  const [, , file, framesText = '600'] = process.argv;
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
  let guard = 0;
  while (frames < Number(framesText) && guard++ < 1e8) {
    board.getControlPanel().getResetButton().toggle(frames > 20 && frames < 30);
    board.getJoystick0().getFire().toggle(frames >= 200 && frames <= 210);
    board.tick(200);
  }
  const bus = board.getBus();
  const got = Array.from({length: ROWS}, (_, y) => Array.from({length: COLUMNS}, (_, x) => {
    const byte = bus.peek(0xA4 + y * 4 + (x >> 3));
    const bit = (x >> 3) % 2 === 0 ? 7 - (x & 7) : x & 7;
    return (byte >> bit) & 1;
  }));
  const want = model();
  let bad = 0;
  want.forEach((row, y) => {
    const a = row.map((p) => (p ? '#' : '.')).join('');
    const b = got[y].map((p) => (p ? '#' : '.')).join('');
    if (a !== b) {
      bad++;
      console.log(`row ${String(y).padStart(2)} want ${a}\n       got  ${b}`);
    }
  });
  console.log(`${ROWS} rows, ${bad} differ`);
  process.exit(bad ? 1 : 0);
})();
