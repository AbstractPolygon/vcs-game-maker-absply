// usage: node runoncereset.cjs -> the per-frame reset of the DPC+ "Run once" flag bytes (runOnceResetLines in src/utils/dpc-ram-flags.js), assembled with
// dasm.wasm and run on 6502.ts's CPU with a model of the two data fetchers it uses (DF0 reads, DF1 writes, each moving on by one a byte), for 1 to 3
// bytes and every value of each byte: a fired bit (high nibble) stays only when its touched bit (low nibble) is set, the touched bits clear, and no
// byte of the display RAM but those changes (a byte that stays the same need not be written). Prints the cases that differ.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {WASI} = require('node:wasi');
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;

// The registers of the fetchers (their names as in DPCplus.h, at addresses of the test below the RAM, away from the code) and temp1.
const REG = {DF0LOW: 0x50, DF1LOW: 0x51, DF0HI: 0x58, DF1HI: 0x59, DF0DATA: 0x48, DF1WRITE: 0x71, temp1: 0x80};
const loadFlags = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runonce-'));
  fs.copyFileSync(P.REPO + 'src/utils/dpc-ram-flags.js', path.join(dir, 'flags.mjs'));
  return import('file://' + path.join(dir, 'flags.mjs').replace(/\\/g, '/'));
};
const assemble = async (lines, dir) => {
  const body = lines.filter((line) => line !== 'asm' && line !== '@end').map((line) => (line.startsWith('@') ? line.slice(1) : `  ${line}`)).join('\n');
  const src = ['  processor 6502', ...Object.entries(REG).map(([name, at]) => `${name} = $${at.toString(16)}`), '  org $F000', 'start', body,
    '  jmp stopHere', '  org $FF00', 'stopHere', '  jmp stopHere', '  org $FFFC', '  .word start', '  .word start'].join('\n');
  fs.writeFileSync(path.join(dir, 't.asm'), src);
  const wasi = new WASI({version: 'preview1', args: ['dasm', 't.asm', '-f3', '-ot.bin'], preopens: {'.': dir},
    stdout: fs.openSync(path.join(dir, 'out.txt'), 'w'), stderr: 2, returnOnExit: true});
  const mod = await WebAssembly.compile(fs.readFileSync(P.REPO + 'public/bb19/dasm.wasm'));
  wasi.start(await WebAssembly.instantiate(mod, wasi.getImportObject()));
  if (!fs.existsSync(path.join(dir, 't.bin'))) throw new Error(`dasm failed:\n${src}`);
  return new Uint8Array(fs.readFileSync(path.join(dir, 't.bin')));
};
// Runs the code with the display RAM's page $0F holding `bytes` at its start (the fetchers' pointers start anywhere: the code has to aim them);
// returns that page afterwards.
const run = (rom, bytes) => {
  const mem = new Uint8Array(65536);
  mem.set(rom, 0xF000);
  const display = new Uint8Array(4096).map((_, i) => (i * 37 + 11) & 255);
  bytes.forEach((v, i) => { display[0xF00 + i] = v; });
  const ptr = [0x123, 0x456];
  const bus = {
    read: (a) => {
      a &= 0x1fff;
      if (a === REG.DF0DATA) { const v = display[ptr[0] & 0xfff]; ptr[0] = (ptr[0] + 1) & 0xfff; return v; }
      return mem[a < 0x1000 ? a : 0xF000 + (a & 0xfff)];
    },
    write: (a, v) => {
      a &= 0x1fff;
      if (a === REG.DF0LOW) ptr[0] = (ptr[0] & 0xf00) | v;
      else if (a === REG.DF1LOW) ptr[1] = (ptr[1] & 0xf00) | v;
      else if (a === REG.DF0HI) ptr[0] = ((v & 0x0f) << 8) | (ptr[0] & 0xff);
      else if (a === REG.DF1HI) ptr[1] = ((v & 0x0f) << 8) | (ptr[1] & 0xff);
      else if (a === REG.DF1WRITE) { display[ptr[1] & 0xfff] = v; ptr[1] = (ptr[1] + 1) & 0xfff; } else if (a < 0x1000) mem[a] = v;
    },
    peek: (a) => mem[a & 0xffff],
  };
  const cpu = new CpuFactory(CpuFactory.Type.stateMachine).create(bus);
  // (The reset vector, read from the ROM image at $FFFC.)
  mem[0xFFFC] = 0; mem[0xFFFD] = 0xF0;
  cpu.reset();
  for (let i = 0; i < 20000 && cpu.getLastInstructionPointer() !== 0xFF00; i++) cpu.cycle();
  return display;
};
(async () => {
  const {runOnceResetLines} = await loadFlags();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runonceasm-'));
  let cases = 0; let bad = 0;
  const want = (v) => (((v >> 4) & v) << 4) & 255;
  for (let count = 1; count <= 3; count++) {
    const rom = await assemble(runOnceResetLines(count), dir);
    for (let v = 0; v < 256; v++) {
      for (const pattern of [[v, 0, 0], [0, v, 0], [0, 0, v], [v, 0x5A, v ^ 0xFF], [0xF3, v, 0x3C]]) {
        const bytes = pattern.slice(0, count);
        const after = run(rom, bytes);
        const fresh = new Uint8Array(4096).map((_, i) => (i * 37 + 11) & 255);
        bytes.forEach((b, i) => { fresh[0xF00 + i] = want(b); });
        cases++;
        const wrong = [];
        for (let i = 0; i < 4096; i++) if (after[i] !== fresh[i]) wrong.push(i);
        if (wrong.length && bad++ < 5) console.log(`count ${count} bytes ${bytes}: wrong at ${wrong.slice(0, 4).map((i) => '$' + i.toString(16))}`);
      }
    }
  }
  console.log(`${cases} cases, ${bad} differ`);
  process.exit(bad ? 1 : 0);
})();
