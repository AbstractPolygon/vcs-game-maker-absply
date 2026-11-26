// usage: node terrarm.cjs prog.bin [least] [most] [roughness] [overhangs] [rows] -> the coprocessor's Generate terrain (function 113 of armprog.c, a program
// with the set k, e.g. public/bb19/includes/custom/prog/ocpk.bin) run alone on the Harmony's ARM for the bottom side and every seed 1 to 255 (32 columns,
// rows 11), each picture checked as terraincmp.cjs checks one with overhangs: at most two runs a position (the ground, at least the least height, and a
// ledge over a void), every pixel joined to the ground (8 ways round), the heights inside the range. Prints the seeds that break a rule (the first picture
// that does) and exits with 1 when any does.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const Soc = require(P.REPO + 'node_modules/6502.ts/lib/machine/stella/cartridge/harmony/Soc').default;
const [, , file, leastText = '3', mostText = '10', roughText = '5', overText = '4', rowsText = '11'] = process.argv;
const soc = new Soc();
let trapped = null;
soc.trap.addHandler((message) => {
  if (!message.includes('$00008004')) trapped = message;
});
const rom = soc.getRom();
const ram = soc.getRam();
rom.set(new Uint8Array(fs.readFileSync(file)), 0x1000);
// (The kernel's fetcher table: the playfield at display memory $400, see run() in armprog.c.)
rom[0x61A0 + 0xC00] = 0x00; rom[0x61A1 + 0xC00] = 0x40; rom[0xC00 + 0x4000 + 38] = 0; rom[0xC00 + 0x4000 + 46] = 4;
const CF = 0xC00 + 0x1A4;
const PF = 0xC00 + 0x400;
const COLUMNS = 32;
const ROWS = Number(rowsText);
const least = Number(leastText);
const most = Math.min(Number(mostText), ROWS);
const pixel = (c, y) => (ram[PF + ((c >> 3) << 8) + y] >> ((c ^ (((c >> 3) & 1) ? 0 : 7)) & 7)) & 1;
let bad = 0;
for (let seed = 1; seed < 256; seed++) {
  for (let k = 0; k < 4 * 256; k++) ram[PF + k] = 0;
  [113, 0, least, Number(mostText), Number(roughText), Number(overText), seed, ROWS - 1, COLUMNS - 1].forEach((v, k) => {
    ram[CF + k] = v;
  });
  trapped = null;
  soc.run(0x1000 | 1);
  if (trapped) throw new Error(trapped);
  const at = (position, depth) => pixel(position, ROWS - 1 - depth);
  const errors = [];
  for (let position = 0; position < COLUMNS; position++) {
    const runs = [];
    for (let k = 0; k < ROWS; k++) {
      if (at(position, k) && !(k && at(position, k - 1))) runs.push([k, k]);
      if (at(position, k)) runs[runs.length - 1][1] = k;
    }
    if (runs.length > 2) errors.push(`${runs.length} runs at ${position}`);
    if (!runs.length || runs[0][0] !== 0) errors.push(`no ground at ${position}`);
    else if (runs[0][1] + 1 < least) errors.push(`ground ${runs[0][1] + 1} high at ${position}`);
    if (runs.length && runs[runs.length - 1][1] + 1 > most) errors.push(`height ${runs[runs.length - 1][1] + 1} at ${position}`);
  }
  const seen = new Set();
  const queue = [];
  for (let position = 0; position < COLUMNS; position++) {
    if (at(position, 0)) {
      seen.add(`${position},0`); queue.push([position, 0]);
    }
  }
  while (queue.length) {
    const [p, k] = queue.pop();
    for (let dp = -1; dp <= 1; dp++) {
      for (let dk = -1; dk <= 1; dk++) {
        const [np, nk] = [p + dp, k + dk];
        if (np < 0 || np >= COLUMNS || nk < 0 || nk >= ROWS || seen.has(`${np},${nk}`) || !at(np, nk)) continue;
        seen.add(`${np},${nk}`); queue.push([np, nk]);
      }
    }
  }
  for (let position = 0; position < COLUMNS; position++) {
    for (let k = 0; k < ROWS; k++) {
      if (at(position, k) && !seen.has(`${position},${k}`)) errors.push(`pixel ${k} up at ${position} not joined`);
    }
  }
  if (errors.length) {
    if (bad < 6) {
      console.log(`seed ${seed}: ${errors.slice(0, 3).join('; ')}`);
      if (bad === 0) for (let y = 0; y < ROWS; y++) console.log(Array.from({length: COLUMNS}, (_, c) => (pixel(c, y) ? '#' : '.')).join(''));
    }
    bad++;
  }
}
console.log(`255 seeds, ${bad} break a rule`);
process.exit(bad ? 1 : 0);
