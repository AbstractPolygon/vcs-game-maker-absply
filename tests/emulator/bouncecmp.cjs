// usage: node bouncecmp.cjs prog.bin: for every stage byte of a bounce past its first frame (bits 4 and 5 not 0), 8 and 16 directions, with and without Gravity,
// the coprocessor's bounce (function 100) against what the 6502 lines of the Bounce stage subroutine now do for those frames (generators/bbasic/sprites.js).
const P = require('../lib/paths.cjs');
const REPO = P.REPO;
const fs = require('fs');
const Soc = require(REPO + 'node_modules/6502.ts/lib/machine/stella/cartridge/harmony/Soc').default;
const program = new Uint8Array(fs.readFileSync(process.argv[2]));
const soc = new Soc();
let trapped = null;
soc.trap.addHandler((message) => { if (!message.includes('$00008004')) trapped = message; });
const rom = soc.getRom(); const ram = soc.getRam();
rom.set(program, 0x1000);
rom[0x61A0 + 0xC00] = 0x00; rom[0x61A1 + 0xC00] = 0x40; rom[0xC00 + 0x4000 + 38] = 0; rom[0xC00 + 0x4000 + 46] = 4;
const CF = 0xC00 + 0x1A4;
// The 6502 lines: stages 1 and 2 go on (stage + 16, bit 6 set), the heading kept; stage 3 turns the heading the bounce started from round.
const model = (dir, stage, steps) => {
  const mark = stage & 48;
  if (mark === 16 || mark === 32) return [dir, ((stage + 16) | 64) & 255];
  let d = (stage & 15) + steps / 2;
  if (d >= steps) d -= steps;
  return [d & 255, stage | 112];
};
let n = 0; let bad = 0;
for (const steps of [8, 16]) {
  for (const grav of [0, 1]) {
    for (let stage = 0; stage < 256; stage++) {
      if (!(stage & 48)) continue;
      for (const dir of [0, 3, 7, 9, 15, 17]) {
        [100, 80, 40, dir, steps, 22, 17, 32, stage, grav, 200].forEach((v, k) => { ram[CF + k] = v; });
        trapped = null;
        soc.run(0x1000 | 1);
        if (trapped) throw new Error(trapped);
        const got = [ram[CF + 1], ram[CF + 2]];
        const want = model(dir, stage, steps);
        n++;
        if (got[0] !== want[0] || got[1] !== want[1]) {
          if (bad++ < 10) console.log(`steps ${steps} grav ${grav} stage ${stage} dir ${dir}: coprocessor ${got} 6502 ${want}`);
        }
      }
    }
  }
}
console.log(`${n} cases, ${bad} differ`);
