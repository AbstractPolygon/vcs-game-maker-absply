// usage: node scorecmp.cjs -> the assembly a Set score block makes for a value worked out while the game runs (score_set in src/generators/bbasic/score.js),
// assembled with dasm.wasm and run on 6502.ts's CPU for every byte 0 to 255: the score must read 000HTO (hundreds, tens, ones). Prints the values that
// do not and the most cycles it took.
const fs = require('fs'); const path = require('path'); const os = require('os'); const {WASI} = require('node:wasi');
const REPO = require('../lib/paths.cjs').REPO;
const CpuFactory = require(REPO + 'node_modules/6502.ts/lib/machine/cpu/Factory').default;
const src = fs.readFileSync(REPO + 'src/generators/bbasic/score.js', 'utf8');
// the asm lines of the runtime score set, built as the generator does
const hLoop = '_score_set_hloop_1'; const hDone = '_score_set_hdone_1'; const tLoop = '_score_set_tens_1_';
const body = /const lines = \[\s*`temp1 = \(\$\{argument0\}\) & 255`,\s*'asm',([\s\S]*?)'@end',\s*\];/.exec(src)[1];
const lines = eval('[' + body + ']');
const asm = lines.map((l) => (l.startsWith('@') ? l.slice(1) : '  ' + l)).join('\n');
const prog = ['  processor 6502', 'temp1 = $80', 'temp2 = $81', 'score = $82', '  org $F000', 'start', asm, 'stopHere', '  jmp stopHere', '  org $FFFC', '  .word start', '  .word start'].join('\n');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-'));
fs.writeFileSync(path.join(dir, 't.asm'), prog);
(async () => {
  const wasi = new WASI({version: 'preview1', args: ['dasm', 't.asm', '-f3', '-ot.bin', '-st.sym'], preopens: {'.': dir}, stdout: fs.openSync(path.join(dir, 'o.txt'), 'w'), stderr: 2, returnOnExit: true});
  wasi.start(await WebAssembly.instantiate(await WebAssembly.compile(fs.readFileSync(REPO + 'public/bb19/dasm.wasm')), wasi.getImportObject()));
  const rom = fs.readFileSync(path.join(dir, 't.bin')); const stop = parseInt(/stopHere\s+([0-9a-f]+)/i.exec(fs.readFileSync(path.join(dir, 't.sym'), 'utf8'))[1], 16);
  let bad = 0; let maxCyc = 0;
  for (let v = 0; v < 256; v++) {
    const mem = new Uint8Array(65536); mem.set(rom, 0xF000); mem[0x80] = v; mem[0x82] = 0x99; mem[0x83] = 0x99; mem[0x84] = 0x99;
    const cpu = new CpuFactory(CpuFactory.Type.stateMachine).create({read: (a) => mem[a], write: (a, x) => { mem[a] = x; }, peek: (a) => mem[a]});
    cpu.reset(); let c = 0; for (; c < 5000 && cpu.getLastInstructionPointer() !== stop; c++) cpu.cycle();
    maxCyc = Math.max(maxCyc, c);
    const want = [0, Math.floor(v / 100), (Math.floor(v / 10) % 10) * 16 + v % 10];
    if (mem[0x82] !== want[0] || mem[0x83] !== want[1] || mem[0x84] !== want[2]) { if (bad++ < 5) console.log(v, mem[0x82], mem[0x83], mem[0x84], want); }
  }
  console.log('bad', bad, 'max cycles (incl. reset)', maxCyc);
})();
