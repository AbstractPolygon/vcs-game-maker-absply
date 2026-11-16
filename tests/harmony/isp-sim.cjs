'use strict';

// Writes ROMs through src/utils/harmony-cart.js into a simulated LPC2103 (the Harmony Cart's chip) or LPC2148 bootloader (the ISP commands of NXP's UM10139, echo on)
// and checks what lands in its flash. Usage: node tests/harmony/isp-sim.cjs [rom.bin ...] (default: tests/roms/p6_ball2.bin, a
// 32 KB DPC+ ROM, and tests/roms/ball2.bin, an 8K ROM, behind a made-up 452-byte bankswitch stub).
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');

const RAM_BASE = 0x40000200;
const CHIPS = {
  LPC2103: {id: 0x0004FF11, flash: 32 * 1024, ram: 8 * 1024, sectors: Array(8).fill(4096)},
  LPC2106: {id: 0xFFF0FF32, flash: 128 * 1024, ram: 64 * 1024, sectors: Array(15).fill(8192)},
  LPC2148: {id: 0x0402FF25, flash: 512 * 1024, ram: 40 * 1024, sectors: [...Array(8).fill(4096), ...Array(14).fill(32768), ...Array(6).fill(4096)]},
};

class FakeChip {
  constructor({corruptLine = -1, chip = 'LPC2103'} = {}) {
    this.chip = CHIPS[chip];
    this.flash = new Uint8Array(this.chip.flash).fill(0xFF);
    this.ram = new Uint8Array(this.chip.ram);
    this.out = '';
    this.input = '';
    this.mode = 'baud';
    this.prepared = new Set();
    this.unlocked = false;
    this.corruptLine = corruptLine;
    this.linesSeen = 0;
    this.log = [];
    this.bootloader = false;
  }

  sectorStart(index) {
    return this.chip.sectors.slice(0, index).reduce((a, b) => a + b, 0);
  }

  setModemLines(dtr, rts) {
    // RTS is reset, DTR the bootloader pin: releasing reset with DTR held starts the bootloader.
    if (this.lastRts && !rts) {
      this.bootloader = !!dtr;
      this.mode = this.bootloader ? 'baud' : 'running';
      this.input = '';
    }
    this.lastRts = rts;
  }

  receive(text) {
    if (this.mode === 'running') return;
    for (const ch of text) {
      if (this.mode === 'baud') {
        if (ch === '?') {
          this.out += 'Synchronized\r\n';
          this.mode = 'sync';
        }
        continue;
      }
      // (Echo on.)
      this.out += ch;
      // (A CR before the LF ends no line; the LF does.)
      if (ch === String.fromCharCode(13)) continue;
      this.input += ch;
      if (ch === '\n') {
        const line = this.input.slice(0, -1);
        this.input = '';
        this.line(line);
      }
    }
  }

  line(line) {
    if (this.mode === 'sync') {
      if (line === 'Synchronized') this.out += 'OK\r\n';
      else if (/^\d+$/.test(line)) {
        this.out += 'OK\r\n';
        this.mode = 'command';
      }
      return;
    }
    if (this.mode === 'data') {
      this.dataLine(line);
      return;
    }
    const [name, ...args] = line.split(' ');
    const n = args.map(Number);
    const reply = (code) => {
      this.out += `${code}\r\n`;
    };
    this.log.push(line);
    switch (name) {
      case 'U': this.unlocked = n[0] === 23130; return reply(this.unlocked ? 0 : 16);
      case 'J': reply(0); this.out += `${this.chip.id}\r\n`; return;
      case 'P': for (let s = n[0]; s <= n[1]; s++) this.prepared.add(s); return reply(0);
      case 'E': {
        if (!this.unlocked) return reply(15);
        for (let s = n[0]; s <= n[1]; s++) {
          if (!this.prepared.has(s)) return reply(9);
          this.flash.fill(0xFF, this.sectorStart(s), this.sectorStart(s) + this.chip.sectors[s]);
        }
        this.prepared.clear();
        return reply(0);
      }
      case 'W': {
        if (n[0] !== RAM_BASE || n[1] % 4) return reply(n[1] % 4 ? 6 : 3);
        this.data = {at: n[0] - 0x40000000, left: n[1], lines: [], sum: 0};
        this.mode = 'data';
        return reply(0);
      }
      case 'C': {
        const [dst, src, count] = n;
        // (8192 on the parts that copy that much at once.)
        if (![256, 512, 1024, 4096, 8192].includes(count)) return reply(6);
        let s = 0;
        while (this.sectorStart(s + 1) <= dst) s++;
        if (!this.prepared.has(s)) return reply(9);
        for (let i = 0; i < count; i++) {
          // Flash bits only go from 1 to 0 without an erase.
          if (this.flash[dst + i] !== 0xFF && this.ram[src - 0x40000000 + i] !== this.flash[dst + i]) return reply(8);
        }
        this.flash.set(this.ram.subarray(src - 0x40000000, src - 0x40000000 + count), dst);
        this.prepared.clear();
        return reply(0);
      }
      case 'M': {
        const [a, b, count] = n;
        for (let i = 0; i < count; i++) if (this.flash[a + i] !== this.ram[b - 0x40000000 + i]) return reply(10);
        return reply(0);
      }
      case 'G': this.mode = 'running'; return reply(0);
      default: return reply(1);
    }
  }

  dataLine(line) {
    const d = this.data;
    if (d.lines.length === 20 || (d.lines.length && d.left === 0)) {
      // The sum line.
      if (Number(line) === d.sum) {
        d.lines.forEach((bytes) => {
          this.ram.set(bytes, d.at);
          d.at += bytes.length;
        });
        d.lines = [];
        d.sum = 0;
        this.out += 'OK\r\n';
        if (d.left === 0) this.mode = 'command';
      } else {
        d.left += d.lines.reduce((t, bytes) => t + bytes.length, 0);
        d.lines = [];
        d.sum = 0;
        this.out += 'RESEND\r\n';
      }
      return;
    }
    const length = (line.charCodeAt(0) - 32) & 63;
    const bytes = [];
    for (let i = 1; i + 3 < line.length + 1 && bytes.length < length; i += 4) {
      const v = (c) => (line.charCodeAt(c) - 32) & 63;
      const group = (v(i) << 18) | (v(i + 1) << 12) | (v(i + 2) << 6) | v(i + 3);
      bytes.push((group >> 16) & 255, (group >> 8) & 255, group & 255);
    }
    const data = Uint8Array.from(bytes.slice(0, length));
    this.linesSeen++;
    if (this.linesSeen === this.corruptLine) data[0] ^= 1;
    d.lines.push(data);
    d.sum += data.reduce((a, b) => a + b, 0);
    d.left -= data.length;
  }
}

// The link utils/harmony-cart.js talks through, wired to the fake chip.
const fakeLink = (chip) => {
  let text = '';
  const pull = () => {
    text += chip.out;
    chip.out = '';
  };
  return {
    clear() {
      pull();
      text = '';
    },
    async sleep() {},
    async write(data) {
      chip.receive(typeof data === 'string' ? data : String.fromCharCode(...data));
    },
    async setModemLines(dtr, rts) {
      chip.setModemLines(dtr, rts);
    },
    async waitFor(test) {
      pull();
      const result = test(text);
      if (!result) return null;
      text = text.slice(result.end);
      return result.value;
    },
  };
};

const main = async () => {
  const root = path.join(__dirname, '..', '..');
  // harmony-cart.js imports ./harmony-parts without an extension (webpack's way); copies with the extension added load in Node.
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'harmony-cart-'));
  fs.copyFileSync(path.join(root, 'src', 'utils', 'harmony-parts.js'), path.join(dir, 'harmony-parts.mjs'));
  fs.writeFileSync(path.join(dir, 'harmony-cart.mjs'), fs.readFileSync(path.join(root, 'src', 'utils', 'harmony-cart.js'), 'utf8')
      .replace("from './harmony-parts'", "from './harmony-parts.mjs'"));
  const lib = await import(pathToFileURL(path.join(dir, 'harmony-cart.mjs')).href);
  const given = process.argv.slice(2);
  const cases = given.length ? given.map((file) => ({file, stub: 0})) : [
    {file: path.join(root, 'tests', 'roms', 'p6_ball2.bin'), stub: 0},
    {file: path.join(root, 'tests', 'roms', 'ball2.bin'), stub: 452},
    {file: path.join(root, 'tests', 'roms', 'p6_ball2.bin'), stub: 0, corruptLine: 30},
    {file: path.join(root, 'tests', 'roms', 'p6_ball2.bin'), stub: 0, chip: 'LPC2148'},
    {file: path.join(root, 'tests', 'roms', 'ball2.bin'), stub: 452, chip: 'LPC2106'},
  ];
  let failed = 0;
  for (const c of cases) {
    const rom = new Uint8Array(fs.readFileSync(c.file));
    // A made-up stub: a vector table and filler, standing in for a bankswitch file.
    const stub = new Uint8Array(c.stub);
    for (let i = 0; i < c.stub; i++) stub[i] = (i * 7 + 3) & 255;
    const image = new Uint8Array(stub.length + rom.length);
    image.set(stub);
    image.set(rom, stub.length);
    const chip = new FakeChip({corruptLine: c.corruptLine, chip: c.chip});
    const cart = new lib.HarmonyCart(fakeLink(chip), {log: () => {}, retries: c.corruptLine ? 2 : 1});
    let lines = 0;
    let total = 0;
    try {
      await cart.resetInto(true);
      const part = await cart.connect();
      await cart.write(image, {verify: true, onProgress: (done, all) => {
        lines = done;
        total = all;
      }});
      await cart.run();
      const expected = lib.withVectorChecksum(image);
      const got = chip.flash.subarray(0, expected.length);
      const same = expected.every((b, i) => b === got[i]);
      let sum = 0;
      for (let i = 0; i < 32; i += 4) sum = (sum + (got[i] | (got[i + 1] << 8) | (got[i + 2] << 16) | (got[i + 3] << 24))) >>> 0;
      const order = chip.log.filter((l) => /^E /.test(l)).join(', ');
      const ok = same && sum === 0 && chip.mode === 'running' && lines === total;
      if (!ok) failed++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.basename(c.file)}${c.stub ? ` + ${c.stub}-byte stub` : ''}` +
        `${c.corruptLine ? ` (line ${c.corruptLine} arrives wrong once)` : ''}: ${part.name}, ${image.length} bytes, flash ${same ? 'matches' : 'DIFFERS'},` +
        ` vector sum ${sum === 0 ? '0' : sum}, ${lines}/${total} lines, erased: ${order}, last copy: ${chip.log.filter((l) => /^C /.test(l)).pop()}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${path.basename(c.file)}: ${e.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
};

main();
