// usage: node scrollreset.cjs rom.bin [plan] -> runs a ROM made from tests/projects/mkscroll.cjs's projects with joystick input: the frame
// before any scroll, then for each step of the plan ("d37" = Down held 37 frames, "u20" = Up held 20, "f" = Fire 4 frames, each followed by
// 30 quiet frames) whether the picture moved and, after each Fire, whether it is the same as before the scroll (the lines that differ).
// Default plan: d37 f d200 f u23 f d5 u9 f. WAIT: the frames before the first (90; a PXE ROM takes longer to start).
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, planText = 'd37 f d200 f u23 f d5 u9 f'] = process.argv;
  const cart = await makeCart(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  if (cart.setCpuTimeProvider) cart.setCpuTimeProvider(() => board.getCpuTime());
  const surf = {buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  const tia = board.getVideoOutput();
  tia.setSurfaceFactory(() => surf);
  const joy = board.getJoystick0();
  let frame = 0; let last = null;
  tia.newFrame.addHandler((s) => { frame++; last = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  const runFrames = (n) => { const end = frame + n; let g = 0; while (frame < end && g++ < 1e8) board.tick(500); };
  const press = (button, frames) => { button.toggle(true); runFrames(frames); button.toggle(false); runFrames(30); };
  const diff = (a, b) => { const lines = []; for (let y = 0; y < 400; y++) { for (let x = 0; x < 160; x++) if (a[y * 160 + x] !== b[y * 160 + x]) { lines.push(y); break; } } return lines; };
  const show = (lines) => (lines.length ? `${lines.length} lines (${lines.slice(0, 8).join(',')}${lines.length > 8 ? '...' : ''})` : 'none');
  runFrames(+(process.env.WAIT || 90));
  const start = last;
  const out = [];
  for (const step of planText.split(/\s+/)) {
    const before = last;
    if (step === 'f') {
      press(joy.getFire(), 4);
      const left = diff(start, last);
      out.push(`reset: ${left.length ? 'NOT back, lines that differ from the start ' + show(left) : 'back to the start'}`);
    } else {
      const n = +step.slice(1);
      press(step[0] === 'd' ? joy.getDown() : joy.getUp(), n);
      out.push(`${step}: moved ${show(diff(before, last))}`);
    }
  }
  console.log(rom.replace(/\\/g, '/').split('/').pop(), '|', out.join(' | '));
})();
