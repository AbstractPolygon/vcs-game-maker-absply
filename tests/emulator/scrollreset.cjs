// usage: node scrollreset.cjs rom.bin [plan] -> runs a ROM made from tests/projects/mkscroll.cjs's projects with joystick input: the frame
// before any scroll, then for each step of the plan ("d37" = Down held 37 frames, "u20" = Up held 20, "l13" = Left held 13, "r5" = Right held 5, "f" = Fire 4 frames, each followed by
// 30 quiet frames) whether the picture moved and, after each Fire, whether it is the same as before the scroll (the lines that differ).
// Default plan: d37 f d200 f u23 f d5 u9 f; for a ROM named *h.bin (the sideways projects) l13 f r40 f l70 r5 d9 l3 f d30 r20 f. WAIT: the frames before the first (90; a PXE ROM takes longer to start).
const fs = require('fs');
const P = require('../lib/paths.cjs');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, planArg] = process.argv;
  const planText = planArg || (/h.bin$/.test(rom) ? 'l13 f r40 f l70 r5 d9 l3 f d30 r20 f' : 'd37 f d200 f u23 f d5 u9 f');
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
  // Player 1 is left out: it follows the scroll in the projects of mkscroll.cjs and Reset playfield scroll does not move it back. Pixels
  // 90 to 139 (where it is drawn, x 100) are not compared, nor a pixel with one of its colors in either frame (with its y gone round it
  // can be drawn at the left edge on DPC+): the colors the start frame has at pixels 100 to 107 and nowhere left of 90 or right of 139
  // (on PXE there can be none).
  let sprite = new Set();
  const diff = (a, b) => {
    const lines = [];
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 160; x++) {
        if (!(x >= 90 && x < 140) && a[y * 160 + x] !== b[y * 160 + x] && !sprite.has(a[y * 160 + x]) && !sprite.has(b[y * 160 + x])) { lines.push(y); break; }
      }
    }
    return lines;
  };
  const show = (lines) => (lines.length ? `${lines.length} lines (${lines.slice(0, 8).join(',')}${lines.length > 8 ? '...' : ''})` : 'none');
  runFrames(+(process.env.WAIT || 90));
  const start = last;
  const inside = new Set(); const outside = new Set();
  for (let y = 0; y < 400; y++) {
    for (let x = 0; x < 160; x++) (x >= 100 && x < 108 ? inside : x < 90 || x >= 140 ? outside : new Set()).add(start[y * 160 + x]);
  }
  sprite = new Set([...inside].filter((c) => !outside.has(c)));
  const out = [];
  for (const step of planText.split(/\s+/)) {
    const before = last;
    if (step === 'f') {
      press(joy.getFire(), 4);
      const left = diff(start, last);
      out.push(`reset: ${left.length ? 'NOT back, lines that differ from the start ' + show(left) : 'back to the start'}`);
    } else {
      const n = +step.slice(1);
      press({d: joy.getDown(), u: joy.getUp(), l: joy.getLeft(), r: joy.getRight()}[step[0]], n);
      out.push(`${step}: moved ${show(diff(before, last))}`);
    }
  }
  console.log(rom.replace(/\\/g, '/').split('/').pop(), '|', out.join(' | '));
})();
