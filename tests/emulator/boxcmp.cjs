// usage: node boxcmp.cjs [trials] [seed] -> the box comparison of two sprites as generateBoxChecks makes it (src/generators/bbasic/sprite-box-width.js),
// assembled with the project's dasm.wasm and run on 6502.ts's CPU, against a model of the boxes, for random sprites: every kind of box (a fixed
// width, the width from the size byte, the width and the copies from the size byte, the right half of a wide player), every size code, x and y
// anywhere, hidden sprites. Prints the cases that differ.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {WASI} = require('node:wasi');
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;

const RIGHT_EDGE = 177;
const COPIES = [[0], [0, 16], [0, 32], [0, 16, 32], [0, 64], [0], [0, 32, 64], [0]];
const WIDTHS = [8, 8, 8, 8, 8, 16, 8, 32];
// RAM of the test: the bytes of the two sprites (and the partner of a), temp1 to temp7 and the hit byte.
const RAM = {temp1: 0x80, temp2: 0x81, temp3: 0x82, temp4: 0x83, temp5: 0x84, temp6: 0x85, temp7: 0x86, hit: 0x87};
['spra', 'sprb', 'sprc'].forEach((name, i) => ['x', 'y', 'height', 'size', 'frame'].forEach((role, k) => { RAM[`${name}${role}`] = 0x90 + i * 8 + k; }));

// The generator, loaded as a module with the flag pool helpers replaced (the hit is bit 0 of `hit`).
const loadGenerator = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boxcmp-'));
  const src = fs.readFileSync(P.REPO + 'src/generators/bbasic/sprite-box-width.js', 'utf8')
      .replace(/import \{flagPoolVar, flagPoolBit\} from '\.\/flag-pool';/, "const flagPoolVar = () => 'hit'; const flagPoolBit = () => 0;");
  fs.writeFileSync(path.join(dir, 'gen.mjs'), src);
  return import('file://' + path.join(dir, 'gen.mjs').replace(/\\/g, '/'));
};

// The batari Basic the generator makes, as plain assembly: asm blocks as they are, a label as ".label", "hit{0} = 0/1" as the store.
const toAsm = (code) => {
  const out = [];
  let inAsm = false;
  code.split('\n').forEach((line) => {
    const text = line.trim();
    if (!text || /^rem\b/.test(text)) return;
    if (text === 'asm') { inAsm = true; return; }
    if (text === 'end') { inAsm = false; return; }
    if (inAsm) { out.push(/^\s/.test(line) ? `  ${text}` : text); return; }
    const set = /^hit\{0\} = ([01])$/.exec(text);
    if (set) { out.push(`  lda #${set[1]}`, '  sta hit'); return; }
    if (/^[A-Za-z_]\w*$/.test(text)) { out.push(`.${text}`); return; }
    throw new Error(`not handled: ${text}`);
  });
  return out.join('\n');
};

const assemble = async (asmText, dir) => {
  const src = ['  processor 6502', ...Object.entries(RAM).map(([name, at]) => `${name} = $${at.toString(16)}`), '  org $F000', 'start',
    asmText, '  jmp stopHere', '  org $FF00', 'stopHere', '  jmp stopHere', '  org $FFFC', '  .word start', '  .word start'].join('\n');
  fs.writeFileSync(path.join(dir, 't.asm'), src);
  const wasi = new WASI({version: 'preview1', args: ['dasm', 't.asm', '-f3', '-ot.bin', '-lt.lst'], preopens: {'.': dir}, stdout: fs.openSync(path.join(dir, 'out.txt'), 'w'), stderr: 2, returnOnExit: true});
  const mod = await WebAssembly.compile(fs.readFileSync(P.REPO + 'public/bb19/dasm.wasm'));
  const inst = await WebAssembly.instantiate(mod, wasi.getImportObject());
  wasi.start(inst);
  if (!fs.existsSync(path.join(dir, 't.bin'))) throw new Error(`dasm failed:\n${src}`);
  return new Uint8Array(fs.readFileSync(path.join(dir, 't.bin')));
};

// The boxes of an object, by the model: [x, width] for each.
const modelBoxes = (s, kind, partner) => {
  const code = s.size & 7;
  if (Number.isInteger(kind)) return [[s.x, kind]];
  let width = WIDTHS[code];
  if (kind === 'full' && partner && partner.frame !== 255 && !(partner.shared && (partner.size & 64))) width *= 2;
  if (kind === 'size') return [[s.x, width]];
  return COPIES[code].map((off) => [off === 0 ? s.x : s.x + off, width]).filter(([, w], i) => i === 0 || s.x < RIGHT_EDGE)
      .map(([x, w], i) => [i && x >= RIGHT_EDGE ? x - 160 : x, w]);
};
const modelHit = (a, b, ka, kb, partner, hideable) => {
  if (hideable.includes('a') && a.frame === 255) return 0;
  if (hideable.includes('b') && b.frame === 255) return 0;
  if (((a.y + a.height) & 255) < b.y || ((b.y + b.height) & 255) < a.y) return 0;
  return modelBoxes(a, ka, partner).some(([ax, aw]) => modelBoxes(b, kb, null).some(([bx, bw]) => ((ax + aw) & 255) >= bx && ((bx + bw) & 255) >= ax)) ? 1 : 0;
};

(async () => {
  const [, , trialsText = '300', seedText = '1'] = process.argv;
  let r = Number(seedText) * 7919 + 13;
  const rnd = (n) => { r = (r * 1103515245 + 12345) & 0x7fffffff; return Math.floor((r / 0x80000000) * n); };
  const gen = await loadGenerator();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boxasm-'));
  const kindsOf = [8, 16, 32, 2, 'size', 'full'];
  let bad = 0; let hits = 0; let runs = 0;
  const cache = new Map();
  for (let t = 0; t < Number(trialsText); t++) {
    const ka = kindsOf[rnd(kindsOf.length)];
    const kb = kindsOf[rnd(kindsOf.length)];
    const withPartner = ka === 'full' && rnd(2) === 0;
    const shared = withPartner && rnd(2) === 0;
    const hideable = ['a', 'b'].filter(() => rnd(2) === 0);
    const key = JSON.stringify([ka, kb, withPartner, shared, hideable]);
    if (!cache.has(key)) {
      // (The names: spra and sprb; a kind of 2 is a missile, the others players.)
      const names = {a: Number.isInteger(ka) && ka === 2 ? 'missile0' : 'player0', b: Number.isInteger(kb) && kb === 2 ? 'missile1' : 'player1'};
      const Blockly = {BBasic: {
        boxPairs: new Set([`${names.a}|${names.b}`]), boxPairOrder: [`${names.a}|${names.b}`],
        boxKinds: new Map([[names.a, ka], [names.b, kb]].filter(([n]) => /^player/.test(n))),
        widePartners: withPartner ? {[names.a]: 'player2'} : {}, sharedPartnerVars: shared ? {player2: true} : {},
        hideablePlayers: new Set(hideable.map((side) => names[side])),
        nameDB_: {getName: (n) => n}, blockNumbers: {next: () => 1},
      }, Names: {DEVELOPER_VARIABLE_TYPE: 'dev'}};
      // (The generator's pair order is sorted: player0|player1, missile0|missile1, missile0|player1, missile1|player0 ... a is the first name.)
      const sorted = [names.a, names.b].sort();
      const swap = sorted[0] !== names.a;
      let code = gen.generateBoxChecks(Blockly);
      const rename = (text, from, to) => text.replace(new RegExp(`\\b${from}(x|y|height|size|frame)\\b`, 'g'), `${to}$1`);
      code = rename(rename(rename(code, names.a, 'spra'), names.b, 'sprb'), 'player2', 'sprc');
      const rom = await assemble(toAsm(code), dir);
      cache.set(key, {rom, swap});
    }
    const {rom} = cache.get(key);
    const spr = () => ({x: rnd(4) === 0 ? 150 + rnd(106) : rnd(170), y: rnd(200), height: rnd(4) === 0 ? 0 : 1 + rnd(30), size: rnd(256), frame: rnd(6) === 0 ? 255 : rnd(10)});
    const a = spr(); const b = spr(); const c = spr();
    // (Mostly near each other, across and down, so that the boxes and the copies overlap often.)
    if (rnd(4) !== 0) b.x = (a.x + rnd(110) - 30) & 255;
    if (rnd(4) !== 0) b.y = (a.y + rnd(24) - 12) & 255;
    if (Number.isInteger(ka)) a.size &= 0xF8;
    // (The memory: 64K, the program at $F000.)
    const mem = new Uint8Array(65536);
    mem.set(rom, 0xF000);
    mem[0xFFFC] = 0x00; mem[0xFFFD] = 0xF0;
    const put = (name, s) => ['x', 'y', 'height', 'size', 'frame'].forEach((role) => { mem[RAM[`${name}${role}`]] = s[role]; });
    put('spra', a); put('sprb', b); put('sprc', c);
    mem[RAM.hit] = 0xAA;
    const bus = {read: (addr) => mem[addr & 0xffff], write: (addr, v) => { mem[addr & 0xffff] = v; }, peek: (addr) => mem[addr & 0xffff], readWord: (addr) => mem[addr] | (mem[addr + 1] << 8)};
    const cpu = new CpuFactory(CpuFactory.Type.stateMachine).create(bus);
    cpu.reset();
    let steps = 0;
    while (steps++ < 200000) {
      cpu.cycle();
      if (cpu.getLastInstructionPointer() === 0xFF00) break;
    }
    const got = mem[RAM.hit] & 1;
    const partner = withPartner ? {frame: c.frame, size: c.size, shared} : null;
    const want = modelHit(a, b, ka, kb, partner, hideable);
    runs++; hits += want;
    if (got !== want && bad++ < 8) console.log(`differ: kinds ${JSON.stringify([ka, kb, withPartner, shared, hideable])} a ${JSON.stringify(a)} b ${JSON.stringify(b)} c ${JSON.stringify(c)}: code ${got} model ${want}`);
  }
  console.log(`${runs} cases (${hits} overlap by the model), ${bad} differ`);
})();
