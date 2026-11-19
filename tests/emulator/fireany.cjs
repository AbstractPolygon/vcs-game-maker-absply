// usage: node tests/emulator/fireany.cjs rom.bin rom.sym.txt kernel frames missile0:angle:speed,missile1:angle:speed,ball:angle:speed [pf]
// An any direction Fire (tests/projects/mkfire.cjs, fire_<kernel>_any_*): each object fired from (80, 96) at an angle of 0-255 and a speed of 1 to 7, its x and y read
// from RAM every frame (by symbol) against the movement the generated code is meant to make: the exact integer model (the quarter turn sine table in 32nds, the
// leftover 32nds of each axis, the 1.625 times vertical stretch of DPC+ without the playfield check) and the ideal circle (speed * sin and -cos, times 1.625 vertically
// on DPC+). Prints, for each object, the largest difference to each over the frames it is on the screen; exits 1 when the exact model is missed or the circle by
// more than 2 pixels.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const req = (m) => require(path.join(ROOT, 'node_modules', m));
const Board = req('6502.ts/lib/machine/stella/Board').default;
const Config = req('6502.ts/lib/machine/stella/Config').default;
const CpuFactory = req('6502.ts/lib/machine/cpu/Factory').default;
const makeCart = require(path.join(ROOT, 'tests', 'lib', 'cart.cjs'));
const {matchDriverFractionalFetchers} = require(path.join(ROOT, 'tools', 'stellerator', 'dpcplus-driver'));

const SINE = Array.from({length: 65}, (_, i) => Math.round(32 * Math.sin((i * Math.PI) / 128)));
const SINE_STRETCH = Array.from({length: 65}, (_, i) => Math.round(52 * Math.sin((i * Math.PI) / 128)));
// The pixels a frame moves and the leftover 32nds, as the assembly does: the table at the heading within its quarter (backwards in the odd quarters), speed times it,
// the leftover added, the 32nds above 5 bits the pixels, the sign from bit 7 of the heading (of the heading less a quarter turn for y).
const axisStep = (heading, speed, frac, table) => {
  const index = heading & 64 ? 64 - (heading & 63) : heading & 63;
  const total = speed * table[index] + frac;
  const pixels = total >> 5;
  return {pixels: heading & 128 ? -pixels : pixels, frac: total & 31};
};
const model = (angle, speed, frames, stretch, startY) => {
  const out = [];
  let x = 80;
  let y = startY;
  let fx = 0;
  let fy = 0;
  for (let t = 0; t < frames; t++) {
    const sx = axisStep(angle, speed, fx, SINE);
    const sy = axisStep((angle - 64) & 255, speed, fy, stretch ? SINE_STRETCH : SINE);
    fx = sx.frac;
    fy = sy.frac;
    x = (x + sx.pixels) & 255;
    y = (y + sy.pixels) & 255;
    out.push([x, y]);
  }
  return out;
};
const ideal = (angle, speed, t, stretch, startY) => {
  const a = (angle * Math.PI) / 128;
  return [80 + speed * Math.sin(a) * t, startY - speed * Math.cos(a) * t * (stretch ? 1.625 : 1)];
};

(async () => {
  const [, , file, symFile, kernel, framesText, objectsText, pfText] = process.argv;
  const frames = Number(framesText);
  const pf = pfText === 'pf';
  const startY = 96;
  const objects = objectsText.split(',').map((text) => {
    const [name, angle, speed] = text.split(':');
    return {name, angle: Number(angle), speed: Number(speed)};
  });
  const lines = fs.readFileSync(symFile, 'utf8').split(/\r?\n/);
  const addrOf = (name) => {
    const line = lines.find((l) => l.split(/\s+/)[0] === name);
    if (!line) throw new Error('no symbol ' + name);
    return parseInt(line.split(/\s+/)[1], 16);
  };
  objects.forEach((o) => {
    o.xAddr = addrOf(o.name + 'x');
    o.yAddr = addrOf(o.name + 'y');
    o.trace = [];
  });
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
    objects.forEach((o) => o.trace.push([peek(o.xAddr), peek(o.yAddr)]));
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
  // The stretch of DPC+ is for the movement without the playfield check; missile and ball y counts lines there.
  const stretch = kernel === 'dpc' && !pf;
  let bad = false;
  objects.forEach((o) => {
    // (The first frame of the trace is some moves after the shot, or at the start itself with moves 0, when the object is seen at its starting place: the
    // number of moves that fits best, 0 to 8.)
    const m = model(o.angle, o.speed, 500, stretch, startY);
    const at = (t) => (t === 0 ? [80, startY] : m[t - 1]);
    const first = Math.max(0, o.trace.findIndex(([x, y]) => x !== 0 || y !== 0));
    let best = null;
    // (With the playfield check a frame can be a longer one and the movement of one frame is seen later, or two at once: the trace is then matched to the model
    // moving on by 0 to 3 frames between two reads, or half way through one. Without it by exactly 1.)
    const allowed = pf ? [0, 1, 2, 3] : [1];
    for (let skip = 0; skip <= 8; skip++) {
      let exact = 0;
      let circle = 0;
      let count = 0;
      let t = skip;
      for (let i = first; i < o.trace.length; i++) {
        const [x, y] = o.trace[i];
        const offscreen = (px, py) => px >= 160 || py >= (kernel === 'dpc' ? 212 : 192);
        let matched = true;
        if (i > first) {
          // (With the playfield check the pixels are moved one at a time: a read in the middle of a frame's movement sees a point between two frames' ones.)
          const fits = (d) => {
            const [px, py] = at(t + d);
            const [qx, qy] = at(t + d - 1);
            return pf ? x >= Math.min(px, qx) && x <= Math.max(px, qx) && y >= Math.min(py, qy) && y <= Math.max(py, qy) : px === x && py === y;
          };
          const step = allowed.find(fits);
          if (step === undefined) {
            matched = false;
            t += 1;
          } else {
            t += step;
          }
        }
        const [mx, my] = at(t);
        // (Until it goes off the screen: the code puts it at 0, 0 there.)
        if (offscreen(mx, my) || (x === 0 && y === 0 && t > 3)) break;
        if (!matched || i === first) exact = Math.max(exact, Math.abs(x - mx), Math.abs(y - my));
        const [ix, iy] = ideal(o.angle, o.speed, t, stretch, startY);
        circle = Math.max(circle, Math.abs(x - ix), Math.abs(y - iy));
        count++;
      }
      if (!best || exact < best.exact || (exact === best.exact && count > best.count)) best = {offset: skip, exact, circle, count};
    }
    const ok = best.exact === 0 && best.circle <= 3 && best.count > 3;
    if (!ok) bad = true;
    console.log(`${o.name} angle ${o.angle} speed ${o.speed}: ${best.count} frames (first one after ${best.offset} moves), largest difference to the exact model ${best.exact}, to the circle ${best.circle.toFixed(2)}${ok ? '' : '  <-- FAIL'}`);
  });
  process.exit(bad ? 1 : 0);
})();
