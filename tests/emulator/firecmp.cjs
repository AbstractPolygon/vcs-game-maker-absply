// usage: node firecmp.cjs oldprog.bin newprog.bin [trials] [seed]: runs the old coprocessor Fire movement (function 101, one object, with the 6502's
// "same speed at every angle" lines around it) and the new one (function 102, a batch of 1 to 8 objects, each byte written into the call or kept in the
// display memory) in 6502.ts's ARM emulator on random objects and playfields, and compares what each gives back.
const P = require('../lib/paths.cjs');
const REPO = P.REPO;
const fs = require('fs');
const Soc = require(REPO + 'node_modules/6502.ts/lib/machine/stella/cartridge/harmony/Soc').default;
const [, , oldFile, newFile, trialsText = '20000', seedText = '1'] = process.argv;
let r = Number(seedText) * 7919 + 13;
const rnd = (n) => { r = (r * 1103515245 + 12345) & 0x7fffffff; return Math.floor((r / 0x80000000) * n); };
const PROG = 0x1000; // where each program is put in the ROM
const FA = 0x4000; // the table run() takes the playfield's place from: ROM 0xC00 + FA
const PF = 0x400; // the playfield's display memory (4 columns of 256 rows)
const CF = 0x1A4; // C_function in the display memory
const STATE = 0x900; // where the bytes kept in the display memory are put (5 a object)
const makeSoc = (program) => {
  const soc = new Soc();
  let trapped = null;
  soc.trap.addHandler((message) => { if (!message.includes('$00008004')) trapped = message; });
  const rom = soc.getRom();
  rom.set(program, PROG);
  rom[0x61A0 + 0xC00] = FA & 0xff; rom[0x61A1 + 0xC00] = FA >> 8;
  rom[0xC00 + FA + 38] = PF & 0xff; rom[0xC00 + FA + 46] = PF >> 8;
  return {soc, ram: soc.getRam(), run: () => { trapped = null; soc.run(PROG | 1); if (trapped) throw new Error(trapped); }};
};
const oldProg = new Uint8Array(fs.readFileSync(oldFile));
const newBase = new Uint8Array(fs.readFileSync(newFile));
const magic = [0x5E, 0xF1, 0x7A, 0xB1];
if (!magic.every((v, k) => newBase[newBase.length - 4 + k] === v)) throw new Error('new program does not end with the table place');
const oldSoc = makeSoc(oldProg);
let mismatches = 0; let movedCount = 0; let objectsRun = 0;
const trials = Number(trialsText);
for (let t = 0; t < trials; t++) {
  const pf = Array.from({length: 1024}, () => (rnd(4) === 0 ? rnd(256) : 0));
  const n = 1 + rnd(8);
  const objs = Array.from({length: n}, () => {
    const is16 = rnd(2);
    const rowdiv = rnd(4) === 0;
    const inc = rowdiv ? 3 + rnd(5) : [0, 2, 4, 8, 16, 32, 64, 128][rnd(8)];
    const o = {x: rnd(256), y: rnd(256), dir: rnd(5) === 0 ? rnd(256) : rnd(is16 ? 17 : 9), speed: rnd(7), frac: rnd(256), stage: rnd(256), even: rnd(16),
      hasEven: rnd(2), fl: is16 + 2 + [0, 4, 8][rnd(3)] + (rowdiv ? 64 : 0), off: rnd(32), maxrow: rnd(192), inc, go: rnd(5) !== 0,
      where: Array.from({length: 5}, () => rnd(2))}; // per byte: 0 written into the call, 1 kept in the display memory
    if (rnd(4) === 0) o.where[1] = 2; // the speed always the same
    if (!o.hasEven) o.where[4] = 3; // none
    return o;
  });
  // Old: each object alone, with the 6502's lines around the call.
  const expected = objs.map((o) => {
    const res = {x: o.x, y: o.y, frac: o.frac, stage: o.stage, even: o.even, moved: false};
    if (!o.go || o.speed === 0) return res;
    let speed = o.speed; let even = o.even;
    if (o.hasEven && !(o.dir & ((o.fl & 1) ? 3 : 1))) {
      let t1 = (speed * 7) & 255;
      t1 = (t1 + (even & 15)) & 255;
      const t2 = t1 >> 4;
      even = (t1 & 15) | (t2 << 4);
      speed = (speed + t2) & 255;
    }
    const {ram, run} = oldSoc;
    pf.forEach((v, i) => { ram[0xC00 + PF + (i >> 8) * 256 + (i & 255)] = v; });
    [101, o.x, o.y, o.dir, speed, o.frac, o.fl, o.stage, o.off, o.maxrow, o.inc].forEach((v, k) => { ram[0xC00 + CF + k] = v; });
    run();
    res.x = ram[0xC00 + CF + 1]; res.y = ram[0xC00 + CF + 2]; res.frac = ram[0xC00 + CF + 3]; res.stage = ram[0xC00 + CF + 4];
    res.even = even & 15; res.moved = true;
    return res;
  });
  // New: one batch.
  // (Objects of the batches before this one in front: the call starts at its first.)
  const pre = rnd(3) * 8;
  const table = [pre + n, ...Array.from({length: pre * 14}, () => rnd(256)), ...objs.flatMap((o) => [o.fl + (o.hasEven ? 128 : 0), o.off, o.maxrow, o.inc,
    ...[o.dir, o.speed, o.frac, o.stage, o.even].flatMap((v, k) => {
      const w = o.where[k];
      if (w === 0) return [0, 0x80];
      if (w === 2) return [v, 0x40];
      if (w === 3) return [0, 0x40];
      const at = STATE + objs.indexOf(o) * 5 + k;
      return [at & 255, at >> 8];
    })])];
  const program = new Uint8Array([...newBase.slice(0, -4), ...table]);
  const s = makeSoc(program);
  pf.forEach((v, i) => { s.ram[0xC00 + PF + (i >> 8) * 256 + (i & 255)] = v; });
  const call = [102, pre, objs.reduce((m, o, i) => m | (o.go ? 1 << i : 0), 0)];
  objs.forEach((o, i) => {
    call.push(o.x, o.y);
    [o.dir, o.speed, o.frac, o.stage, o.even].forEach((v, k) => {
      if (o.where[k] === 0) call.push(v);
      if (o.where[k] === 1) s.ram[0xC00 + STATE + i * 5 + k] = v;
    });
  });
  call.forEach((v, k) => { s.ram[0xC00 + CF + k] = v; });
  s.run();
  const moved = s.ram[0xC00 + CF + 1];
  let at = 2;
  objs.forEach((o, i) => {
    const got = {x: s.ram[0xC00 + CF + at++], y: s.ram[0xC00 + CF + at++], moved: !!(moved & (1 << i))};
    ['frac', 'stage', 'even'].forEach((key, j) => {
      const k = j + 2;
      if (o.where[k] === 0) got[key] = s.ram[0xC00 + CF + at++];
      else if (o.where[k] === 1) got[key] = s.ram[0xC00 + STATE + i * 5 + k];
      else got[key] = expected[i][key];
    });
    // (A byte that is not there is not compared; the speed and the direction are never given back.)
    if (!o.hasEven) got.even = expected[i].even;
    if (o.where[1] === 1 && s.ram[0xC00 + STATE + i * 5 + 1] !== o.speed) got.speedChanged = true;
    if (o.where[0] === 1 && s.ram[0xC00 + STATE + i * 5] !== o.dir) got.dirChanged = true;
    const want = expected[i];
    objectsRun++;
    if (want.moved) movedCount++;
    const bad = ['x', 'y', 'frac', 'stage', 'even', 'moved'].filter((key) => got[key] !== want[key]).concat(got.speedChanged ? ['speed'] : [], got.dirChanged ? ['dir'] : []);
    if (bad.length && mismatches++ < 10) console.log(`trial ${t} object ${i}/${n}: ${bad.map((key) => `${key} old ${want[key]} new ${got[key]}`).join(', ')} ${JSON.stringify(o)}`);
  });
}
console.log(`${trials} batches, ${objectsRun} objects (${movedCount} moved): ${mismatches} differ`);
