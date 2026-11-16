// usage: node edgecmp.cjs -> the flag lines of an edge (a switch just switched on, Fire just pressed: edgeFlagLines in src/generators/bbasic/input.js) for
// every pair of bits and every value of the flag byte, up and down, assembled with dasm.wasm and run on 6502.ts's CPU, against what the statements of
// batari Basic they replace did: down: just = !prev, prev = 1; up: prev = 0, just = 0; the other bits kept.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {WASI} = require('node:wasi');
const CpuFactory = require(P.REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;

const loadInput = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgecmp-'));
  const src = fs.readFileSync(P.REPO + 'src/generators/bbasic/input.js', 'utf8');
  // (Only the helper: the module imports the rest of the generator.)
  const helper = /const edgeFlagLines = [\s\S]*?\n};\r?\n/.exec(src)[0];
  fs.writeFileSync(path.join(dir, 'edge.mjs'), `${helper}\nexport {edgeFlagLines};\n`);
  return import('file://' + path.join(dir, 'edge.mjs').replace(/\\/g, '/'));
};
const assemble = async (lines, dir) => {
  const body = lines.filter((line) => line.trim() !== 'asm' && line.trim() !== 'end').map((line) => (/^\s/.test(line) ? `  ${line.trim()}` : line)).join('\n');
  const src = ['  processor 6502', 'flags = $80', '  org $F000', 'start', body, '  jmp stopHere', '  org $FF00', 'stopHere', '  jmp stopHere',
    '  org $FFFC', '  .word start', '  .word start'].join('\n');
  fs.writeFileSync(path.join(dir, 't.asm'), src);
  const wasi = new WASI({version: 'preview1', args: ['dasm', 't.asm', '-f3', '-ot.bin'], preopens: {'.': dir},
    stdout: fs.openSync(path.join(dir, 'out.txt'), 'w'), stderr: 2, returnOnExit: true});
  const mod = await WebAssembly.compile(fs.readFileSync(P.REPO + 'public/bb19/dasm.wasm'));
  wasi.start(await WebAssembly.instantiate(mod, wasi.getImportObject()));
  return new Uint8Array(fs.readFileSync(path.join(dir, 't.bin')));
};
const run = (rom, value) => {
  const mem = new Uint8Array(65536);
  mem.set(rom, 0xF000);
  mem[0xFFFC] = 0; mem[0xFFFD] = 0xF0;
  mem[0x80] = value;
  const bus = {read: (a) => mem[a & 0xffff], write: (a, v) => { mem[a & 0xffff] = v; }, peek: (a) => mem[a & 0xffff]};
  const cpu = new CpuFactory(CpuFactory.Type.stateMachine).create(bus);
  cpu.reset();
  for (let i = 0; i < 10000 && cpu.getLastInstructionPointer() !== 0xFF00; i++) cpu.cycle();
  return mem[0x80];
};
(async () => {
  const {edgeFlagLines} = await loadInput();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeasm-'));
  let cases = 0; let bad = 0;
  for (let prevBit = 0; prevBit < 8; prevBit++) {
    for (let justBit = 0; justBit < 8; justBit++) {
      if (prevBit === justBit) continue;
      const edge = edgeFlagLines('flags', prevBit, justBit, '_t');
      const up = await assemble(edge.up, dir);
      const down = await assemble(edge.down, dir);
      for (let v = 0; v < 256; v++) {
        const prev = 1 << prevBit; const just = 1 << justBit;
        const wantUp = v & ~prev & ~just & 255;
        const wantDown = ((v & ~just) | prev | ((v & prev) ? 0 : just)) & 255;
        const gotUp = run(up, v); const gotDown = run(down, v);
        cases += 2;
        if (gotUp !== wantUp || gotDown !== wantDown) {
          if (bad++ < 5) console.log(`prev ${prevBit} just ${justBit} value ${v}: up ${gotUp}/${wantUp} down ${gotDown}/${wantDown}`);
        }
      }
    }
  }
  console.log(`${cases} cases, ${bad} differ`);
})();
