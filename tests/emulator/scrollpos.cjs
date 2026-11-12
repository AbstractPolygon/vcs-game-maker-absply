// usage: node scrollpos.cjs rom.bin project.vcsgm [plan] -> runs a ROM of tests/projects/mkscroll.cjs (its projects put the Playfield scroll
// position into missile0x every frame and have Player 1 follow the scroll) with joystick input, and after each step of the plan (as in
// scrollreset.cjs) checks:
//   the position: the background row shown at the top of the playfield (read from the picture: every row of the test background is different)
//   against the position the program has (missile0x, its address from the ROM's symbols, rom.sym.txt);
//   the sprite: how far Player 1 has moved on the screen since the start against how far the picture has (both in lines), while the picture
//   has moved less than 40 lines from where it started (further, the picture's shift is not measured).
// Default plan: u1 u7 u8 u20 d3 d9 u2 d40 u100 f u5 d2 d3 u4; for the projects that stop at the edges (*e.bin) u300 d10 u10 d300 u5 d1.
// "(part)" after a row: the top row is not shown whole (the view is between two rows). WAIT: the frames before the first (90; 400 for PXE).
const fs = require('fs');
const P = require('../lib/paths.cjs');
const yaml = require(P.REPO + 'node_modules/js-yaml');
const Board = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Board').default;
const Config = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/Config').default;
const makeCart = require('../lib/cart.cjs');
(async () => {
  const [, , rom, project, planArg] = process.argv;
  // (a ROM named *e.bin: the projects that stop at the edges)
  const edges = /e.bin$/.test(rom);
  const planText = planArg || (edges ? 'u300 d10 u10 d300 u5 d1' : 'u1 u7 u8 u20 d3 d9 u2 d40 u100 f u5 d2 d3 u4');
  const doc = yaml.load(fs.readFileSync(project, 'utf8'));
  // (the background showing is the one whose row 0 is at the top at the start: see below)
  let rows = doc.backgrounds.backgrounds[0].pixels.split('\n').map((row) => row.slice(0, 32));
  const sym = fs.readFileSync(rom.replace(/\.bin$/, '.sym.txt'), 'utf8');
  const address = (name) => { const m = sym.match(new RegExp('^' + name + '\\s+([0-9a-f]{4})', 'mi')); return m ? parseInt(m[1], 16) : null; };
  const posAddress = address('missile0x');
  const cart = await makeCart(new Uint8Array(fs.readFileSync(rom)));
  const board = new Board(Config.create({tvMode: 0, enableAudio: false, randomSeed: 1}), cart);
  if (cart.setCpuTimeProvider) cart.setCpuTimeProvider(() => board.getCpuTime());
  const surf = {buf: new Uint32Array(160 * 400), getBuffer() { return this.buf; }, getWidth() { return 160; }, getHeight() { return 400; }};
  const tia = board.getVideoOutput();
  tia.setSurfaceFactory(() => surf);
  const joy = board.getJoystick0();
  const bus = board.getBus();
  // The position: on PXE from the program's memory (the software 6502 keeps its RAM in the ARM's memory, at pRAM), elsewhere from the bus.
  const peekPos = () => (cart._linked && cart._linked.symbols.pRAM !== undefined ?
    cart._read((cart._read(cart._linked.symbols.pRAM, 4) >>> 0) + posAddress, 1) & 255 : bus.peek(posAddress));
  let frame = 0; let last = null;
  tia.newFrame.addHandler((s) => { frame++; last = Uint32Array.from((s || surf).getBuffer()); });
  board.boot();
  const runFrames = (n) => { const end = frame + n; let g = 0; while (frame < end && g++ < 1e8) board.tick(500); };
  const press = (button, n) => { button.toggle(true); runFrames(n); button.toggle(false); runFrames(10); };
  // A playfield column's pixels on the screen (32 columns of 4 pixels from pixel 16): its middle pixel.
  const columnX = (c) => 16 + c * 4 + 2;
  runFrames(+(process.env.WAIT || 90));
  // The playfield's first line: the first where the border (column 0) differs from column 1 (off in row 0 of every test background); the
  // background color is column 1's there (the left edge of the screen can have another color, as on PXE).
  let top = -1;
  for (let y = 0; y < 260 && top < 0; y++) if (last[y * 160 + columnX(0)] !== last[y * 160 + columnX(1)]) top = y;
  const bg = last[top * 160 + columnX(1)];
  // Player 1 (x 100): the color of a block of about 8 pixels across from 90 to 140, of at least 32 pixels (the playfield's colors spread wider).
  const spans = new Map();
  for (let y = 0; y < 260; y++) {
    for (let x = 90; x < 140; x++) {
      const c = last[y * 160 + x];
      if (c === bg) continue;
      const e = spans.get(c) || {n: 0, x0: 999, x1: -1};
      e.n++; e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); spans.set(c, e);
    }
  }
  const spriteEntry = [...spans.entries()].find(([, e]) => e.n >= 32 && e.x1 - e.x0 <= 10);
  const sprite = spriteEntry ? spriteEntry[0] : -1;
  // A playfield pixel: the color of the line's border (column 0, on in every row: the rows can have colors of their own, and the sprites and
  // missiles have other colors); the columns the sprite can be over (20 to 24) are left out of the comparison, the rows still differ in the
  // others.
  const masked = (c) => c >= 20 && c <= 24;
  const lineText = (buf, y) => {
    const border = buf[y * 160 + columnX(0)];
    return Array.from({length: 32}, (_, c) => {
      if (masked(c)) return '?';
      const v = buf[y * 160 + columnX(c)];
      return border !== bg && v === border ? 'X' : '.';
    }).join('');
  };
  const mask = (row) => row.split('').map((ch, c) => (masked(c) ? '?' : ch)).join('');
  rows = rows.map(mask);
  const shownRow = (y = top) => rows.indexOf(lineText(last, y));
  for (const background of doc.backgrounds.backgrounds) {
    const candidate = background.pixels.split('\n').map((row) => mask(row.slice(0, 32)));
    if (candidate.indexOf(lineText(last, top)) === 0) rows = candidate;
  }
  // Player 1: the first line with a pixel of its color, from pixel 90 to 140.
  const spriteTop = (buf) => {
    for (let y = 0; y < 260; y++) for (let x = 90; x < 140; x++) if (buf[y * 160 + x] === sprite) return y;
    return -1;
  };
  // The picture's shift since the start: the lines it has to move by (-40 to 40) for the playfield lines to match.
  const pfLines = (buf) => Array.from({length: 260}, (_, y) => lineText(buf, y));
  const startLines = pfLines(last);
  const pictureShift = () => {
    const now = pfLines(last);
    let best = null;
    for (let s = -40; s <= 40; s++) {
      let same = 0; let n = 0;
      for (let y = top + 45; y < top + 130; y++) { if (y - s < 0 || y - s >= 260) continue; n++; if (now[y] === startLines[y - s]) same++; }
      if (!best || same / n > best.score) best = {s, score: same / n};
    }
    return best.score > 0.95 ? best.s : null;
  };
  const sprite0 = spriteTop(last);
  // The lines of a row (from the start: row 0 at the top), and whether the row at the top is shown whole (the view on a row's top).
  let rowLines = 0;
  while (rowLines < 64 && shownRow(top + rowLines) === shownRow(top)) rowLines++;
  const aligned = () => shownRow(top + rowLines - 1) === shownRow(top) && shownRow(top + rowLines) !== shownRow(top);
  const out = [`start: row ${shownRow()} position ${peekPos()} sprite line ${sprite0}`];
  let badPos = 0; let badSprite = 0; let checkedSprite = 0; let resetDone = false;
  // (A picture that goes round its rows is the same again every rows-of-lines: the sprite's move is compared round that.)
  const roundLines = rows.length * rowLines;
  const sameMove = (a, b) => ((a - b) % roundLines + roundLines) % roundLines === 0;
  for (const step of planText.split(/\s+/)) {
    if (step === 'f') press(joy.getFire(), 4);
    else press({d: joy.getDown(), u: joy.getUp(), l: joy.getLeft(), r: joy.getRight()}[step[0]], +step.slice(1));
    const row = shownRow(); const pos = peekPos();
    // (A row whose color is the sprite's cannot be read: not counted.)
    if (row >= 0 && row !== pos) badPos++;
    const shift = pictureShift(); const moved = spriteTop(last) - sprite0;
    let spriteText = '';
    if (step === 'f') resetDone = true;
    // (Reset playfield scroll does not move the sprites that follow the scroll, so they are compared only before it.)
    // (Nor once the picture has gone so far that the sprite has been carried off the screen: further than 60 lines.)
    if (shift !== null && !resetDone && Math.abs(moved) <= 60) {
      checkedSprite++;
      if (!sameMove(moved, shift)) badSprite++;
      spriteText = ` picture ${shift} sprite ${moved}${sameMove(moved, shift) ? '' : ' SPRITE WRONG'}`;
    }
    out.push(`${step}: row ${row}${aligned() ? '' : ' (part)'} position ${pos}${row === pos ? '' : row < 0 ? ' (row not read)' : ' WRONG'}${spriteText}`);
  }
  console.log(rom.replace(/\\/g, '/').split('/').pop(), `(top line ${top})`, '|', out.join(' | '), '|',
      badPos ? `position: ${badPos} wrong` : 'position: all agree', '|', checkedSprite ? (badSprite ? `sprite: ${badSprite} of ${checkedSprite} wrong` : `sprite: all ${checkedSprite} agree`) : 'sprite: not checked');
})();
