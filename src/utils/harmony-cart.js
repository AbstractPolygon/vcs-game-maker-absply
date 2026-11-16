'use strict';

import {HARMONY_PARTS} from './harmony-parts';

// Writes a ROM straight into a Harmony Cart over its USB serial port (the cart's developer mode). The cart's chip is an NXP LPC part
// (the Harmony Cart's is the LPC2103), programmed through the chip's serial bootloader, the way the HarmonyCart program does it
// (version 2.0, https://github.com/sa666666/harmonycart, src/common/CartProgrammer.cxx, from lpc21isp): its ISP commands, with CR LF
// line ends, are in NXP's LPC user manuals (UM10161 for the LPC2101/02/03).
//
// A link is what the protocol talks through (utils/harmony-serial.js makes one from a Web Serial port; the tests use a fake):
//   write(textOrBytes) -> Promise, clear() drops what came in so far, sleep(ms) -> Promise,
//   setModemLines(dtr, rts) -> Promise (the cart's wiring: see resetInto below),
//   waitFor(test, ms) -> Promise of test's value or null after ms: test(text) gets everything received and not yet used (one character a
//   byte) and gives back null (wait for more) or {value, end} (end: how many characters it used up).

export const BAUD_RATE = 38400;
export const DEFAULT_OSCILLATOR_KHZ = 10000;
// The HarmonyCart program's defaults: 5 tries to reach the bootloader, each block sent once (more when asked), no pause after writes.
export const DEFAULT_CONNECTION_ATTEMPTS = 5;
export const DEFAULT_RETRIES = 1;
// The pause after each write when "delay after each write" is on (for USB serial adapters that drop bytes).
const DELAY_AFTER_WRITE_MS = 100;

// The ISP unlock code (in the user manuals).
const UNLOCK_CODE = 23130;
// A uuencoded line carries 45 bytes; the bootloader checks a sum after each 20 lines.
const LINE_BYTES = 45;
const LINES_PER_SUM = 20;
// Writes into RAM go in whole groups of 4 lines (180 bytes, a multiple of 4 as the bootloader asks).
const WRITE_STEP = LINE_BYTES * 4;
// The first 64 bytes of flash read as the boot block's vectors while the bootloader runs, so compares start after them.
const REMAPPED_BYTES = 64;

// What differs between the families of parts: where the bootloader takes the data for a write in RAM (it uses the RAM below), where
// the vector table's checksum goes, and how the program is started (ARM or Thumb).
const FAMILIES = {
  LPC2XXX: {ramBase: 0x40000200, checksumAt: 0x14, go: 'G 0 A'},
  LPC17XX: {ramBase: 0x10000200, checksumAt: 0x1C, go: 'G 0 T'},
  LPC13XX: {ramBase: 0x10000300, checksumAt: 0x1C, go: 'G 0 T'},
  LPC11XX: {ramBase: 0x10000300, checksumAt: 0x1C, go: 'G 0 T'},
};

// The bootloader's return codes (the user manuals).
const RETURN_CODES = {
  1: 'invalid command', 2: 'source address error', 3: 'destination address error', 4: 'source address not mapped',
  5: 'destination address not mapped', 6: 'count error', 7: 'invalid sector', 8: 'sector not blank',
  9: 'sector not prepared for writing', 10: 'compare error', 11: 'busy', 12: 'parameter error', 13: 'address error',
  14: 'address not mapped', 15: 'command locked', 16: 'invalid code', 17: 'invalid baud rate', 18: 'invalid stop bit',
  19: 'code read protection enabled',
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const checkCancelled = (signal) => {
  if (signal && signal.aborted) throw new Error('Cancelled.');
};

// The checksum the bootloader looks for before it starts a program: the eight words of the vector table add up to 0. The word at
// checksumAt (0x14 on the LPC2xxx, 0x1C on the Cortex-M parts) is set to make them do so. Returns a copy.
export const withVectorChecksum = (image, checksumAt = 0x14) => {
  const out = new Uint8Array(image);
  for (let i = 0; i < 4; i++) out[checksumAt + i] = 0;
  let sum = 0;
  for (let i = 0; i < 32; i += 4) {
    sum = (sum + (out[i] | (out[i + 1] << 8) | (out[i + 2] << 16) | (out[i + 3] << 24))) >>> 0;
  }
  const fix = (0x100000000 - sum) >>> 0;
  for (let i = 0; i < 4; i++) out[checksumAt + i] = (fix >>> (8 * i)) & 0xFF;
  return out;
};

// One uuencoded line of up to 45 bytes (the length character, then 4 characters for each 3 bytes; 0 is written as a backtick).
export const uuencodeLine = (bytes) => {
  const char = (v) => String.fromCharCode(v === 0 ? 0x60 : 0x20 + v);
  let line = char(bytes.length);
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const group = (b0 << 16) | (b1 << 8) | b2;
    line += char((group >> 18) & 63) + char((group >> 12) & 63) + char((group >> 6) & 63) + char(group & 63);
  }
  return line;
};

// The sectors an image of this many bytes needs, each {index, start, length} with length cut at the image's end.
export const sectorsFor = (length, part) => {
  const sectors = [];
  let start = 0;
  for (let index = 0; index < part.sectorSizes.length && start < length; index++) {
    const size = part.sectorSizes[index];
    sectors.push({index, start, length: Math.min(size, length - start)});
    start += size;
  }
  if (start < length) throw new Error('The ROM is too large for the cart\'s flash.');
  return sectors;
};

// The pieces a sector is written in (each at most the part's largest copy), each {offset, length, sendLength (rounded up to whole
// groups of 4 lines), copyLength (what the copy into flash takes, the HarmonyCart program's rule)}; none for a sector that is
// all 0xFF (erased flash already holds it).
const chunksOf = (data, sector, part) => {
  const blank = data.subarray(sector.start, sector.start + sector.length).every((b) => b === 0xFF);
  if (blank) return [];
  const chunks = [];
  for (let offset = 0; offset < sector.length; offset += part.maxCopy) {
    const length = Math.min(part.maxCopy, sector.length - offset);
    const sendLength = Math.ceil(length / WRITE_STEP) * WRITE_STEP;
    let copyLength;
    if (sendLength < 512) copyLength = 512;
    else if (sector.length < 1024) copyLength = 1024;
    else if (sector.length < 4096) copyLength = 4096;
    else copyLength = 8192;
    chunks.push({offset, length, sendLength, copyLength: Math.min(copyLength, part.maxCopy)});
  }
  return chunks;
};

/**
 * Talks to a Harmony Cart's bootloader through a link.
 */
export class HarmonyCart {
  /**
   * oscillatorKhz: the cart's crystal; retries: how often a block is sent before giving up; connectionAttempts: how often the
   * bootloader is reset and asked to synchronize; delayAfterWrite: a pause after each write; log(line): progress lines.
   * @param {Object} link see the top of this file
   * @param {Object=} options {oscillatorKhz, retries, connectionAttempts, delayAfterWrite, log}
   */
  constructor(link, {
    oscillatorKhz = DEFAULT_OSCILLATOR_KHZ, retries = DEFAULT_RETRIES, connectionAttempts = DEFAULT_CONNECTION_ATTEMPTS,
    delayAfterWrite = false, log = () => {},
  } = {}) {
    this.link = link;
    this.oscillatorKhz = oscillatorKhz;
    this.retries = Math.max(1, retries | 0);
    this.connectionAttempts = Math.max(1, connectionAttempts | 0);
    this.delayAfterWrite = !!delayAfterWrite;
    this.log = log;
    this.part = null;
  }

  /**
   * Writes to the link, then pauses when "delay after each write" is on.
   * @param {string|Uint8Array} data
   */
  async send(data) {
    await this.link.write(data);
    if (this.delayAfterWrite) await this.link.sleep(DELAY_AFTER_WRITE_MS);
  }

  /**
   * The cart's USB serial chip drives the LPC's reset from RTS and its bootloader pin from DTR (the lines are swapped on the cart
   * against what NXP's boards use, so a program that sets "DTR" for reset sets RTS here). Holding the bootloader pin low through
   * the reset starts the bootloader; letting it go high starts the program in flash.
   * @param {boolean} bootloader true for the bootloader, false for the program in flash
   */
  async resetInto(bootloader) {
    const {link} = this;
    if (bootloader) {
      await link.setModemLines(true, true);
      await link.sleep(100);
      link.clear();
      await link.sleep(100);
      await link.setModemLines(true, false);
      await link.sleep(500);
      await link.setModemLines(false, false);
    } else {
      await link.setModemLines(false, true);
      await link.sleep(100);
      link.clear();
      await link.sleep(100);
      await link.setModemLines(false, false);
      await link.sleep(100);
    }
  }

  /**
   * A command line; gives back the return code (thrown as an error when not 0, unless allowed is given and has it).
   * @param {string} text the command, without its line end
   * @param {Object=} options {timeout, allowed: codes that are not errors}
   * @return {Promise<number>}
   */
  async command(text, {timeout = 5000, allowed = []} = {}) {
    const {link} = this;
    link.clear();
    await this.send(`${text}\r\n`);
    // The bootloader echoes the command, then the return code on a line.
    const pattern = new RegExp(`^[\\s\\0?]*${escapeRegExp(text)}[\\r\\n]+(\\d+)[\\r\\n]`);
    const code = await link.waitFor((received) => {
      const match = pattern.exec(received);
      return match ? {value: Number(match[1]), end: match[0].length} : null;
    }, timeout);
    if (code === null) throw new Error(`The cart did not answer "${text}".`);
    if (code !== 0 && !allowed.includes(code)) {
      throw new Error(`The cart refused "${text}": ${RETURN_CODES[code] || `code ${code}`}.`);
    }
    return code;
  }

  /**
   * Expects a reply that is the echo of what was sent and then OK.
   * @param {string} text
   * @param {number} timeout milliseconds
   * @return {Promise<boolean|null>}
   */
  async expectOk(text, timeout) {
    const {link} = this;
    link.clear();
    await this.send(`${text}\r\n`);
    const pattern = new RegExp(`${escapeRegExp(text)}[\\r\\n]+OK[\\r\\n]`);
    return link.waitFor((received) => {
      const match = pattern.exec(received);
      return match ? {value: true, end: match.index + match[0].length} : null;
    }, timeout);
  }

  /**
   * Resets the cart into its bootloader, agrees on the baud rate and reads which part it is. Gives back the part.
   */
  async connect() {
    const {link} = this;
    let synchronized = false;
    await this.resetInto(true);
    for (let attempt = 0; attempt < this.connectionAttempts && !synchronized; attempt++) {
      if (attempt > 0) await this.resetInto(true);
      link.clear();
      await this.send('?');
      synchronized = !!(await link.waitFor((received) => {
        const match = /Synchronized[\r\n]/.exec(received);
        return match ? {value: true, end: match.index + match[0].length} : null;
      }, 400));
    }
    if (!synchronized) throw new Error('No Harmony Cart answered on this port.');
    if (!(await this.expectOk('Synchronized', 1000))) throw new Error('The cart did not finish synchronizing.');
    if (!(await this.expectOk(String(this.oscillatorKhz), 1000))) throw new Error('The cart did not take the oscillator frequency.');
    await this.command(`U ${UNLOCK_CODE}`);
    link.clear();
    await this.send('J\r\n');
    const id = await link.waitFor((received) => {
      const match = /^[\s\0?]*J[\r\n]+0[\r\n]+(\d+)[\r\n]/.exec(received);
      return match ? {value: Number(match[1]), end: match[0].length} : null;
    }, 5000);
    if (id === null) throw new Error('The cart did not give its part number.');
    const part = HARMONY_PARTS[id >>> 0];
    if (!part) throw new Error(`The cart's chip (part number 0x${(id >>> 0).toString(16).toUpperCase()}) is not one this can write.`);
    this.part = {...part, id, ...FAMILIES[part.family]};
    this.log(`Found ${part.name} (${part.flashKb} KB flash).`);
    return this.part;
  }

  /**
   * Sends bytes into the bootloader's RAM buffer: a W command, then the uuencoded lines, with the sum after each 20.
   * @param {Uint8Array} bytes a multiple of 4 bytes
   * @param {Object=} options {signal, onLine}
   */
  async sendToRam(bytes, {signal, onLine} = {}) {
    const {link} = this;
    await this.command(`W ${this.part.ramBase} ${bytes.length}`);
    const lines = [];
    for (let at = 0; at < bytes.length; at += LINE_BYTES) lines.push(bytes.subarray(at, at + LINE_BYTES));
    for (let first = 0; first < lines.length; first += LINES_PER_SUM) {
      const group = lines.slice(first, first + LINES_PER_SUM);
      const sum = group.reduce((total, line) => line.reduce((s, b) => s + b, total), 0);
      let accepted = false;
      for (let attempt = 0; attempt < this.retries && !accepted; attempt++) {
        for (const line of group) {
          checkCancelled(signal);
          link.clear();
          await this.send(`${uuencodeLine(line)}\r\n`);
          // (The echo of the line; nothing is checked in it.)
          await link.waitFor((received) => {
            const end = received.indexOf('\n');
            return end >= 0 ? {value: true, end: end + 1} : null;
          }, 5000);
          if (onLine && attempt === 0) onLine();
        }
        accepted = !!(await this.expectOk(String(sum), 5000));
        if (!accepted) this.log(`The cart got lines ${first + 1} to ${first + group.length} wrong.`);
      }
      if (!accepted) {
        throw new Error('The cart kept getting the data wrong (the sum did not match). Try more tries per block or the delay after ' +
          'each write.');
      }
    }
  }

  /**
   * Writes an image (the bytes the cart's flash should hold from address 0). onProgress(done, total) counts lines.
   * @param {Uint8Array} image
   * @param {Object=} options {verify, signal, onProgress}
   */
  async write(image, {verify = true, signal, onProgress = () => {}} = {}) {
    const {part} = this;
    if (!part) throw new Error('Connect to the cart first.');
    if (image.length > part.flashKb * 1024) throw new Error('The ROM is too large for the cart\'s flash.');
    const padded = new Uint8Array(Math.ceil(image.length / 4) * 4).fill(0xFF);
    padded.set(image);
    const data = withVectorChecksum(padded, part.checksumAt);
    const sectors = sectorsFor(data.length, part);
    const plan = sectors.map((sector) => ({...sector, chunks: chunksOf(data, sector, part)}));
    const totalLines = plan.reduce((total, sector) => total + sector.chunks.reduce((t, c) => t + c.sendLength / LINE_BYTES, 0), 0);
    let doneLines = 0;
    onProgress(0, totalLines);
    // Sector 0 first loses its checksum (so a write that stops half way leaves the cart in its bootloader, not running half a
    // program), and is written last.
    this.log('Erasing sector 0.');
    await this.command('P 0 0');
    await this.command('E 0 0');
    const order = [...plan.slice(1), plan[0]];
    for (const sector of order) {
      checkCancelled(signal);
      this.log(`Writing sector ${sector.index}.`);
      await this.command(`P ${sector.index} ${sector.index}`);
      if (sector.index !== 0) await this.command(`E ${sector.index} ${sector.index}`);
      for (const chunk of sector.chunks) {
        const flashAddress = sector.start + chunk.offset;
        const bytes = new Uint8Array(chunk.sendLength).fill(0xFF);
        bytes.set(data.subarray(flashAddress, flashAddress + chunk.length));
        await this.sendToRam(bytes, {signal, onLine: () => onProgress(++doneLines, totalLines)});
        await this.command(`P ${sector.index} ${sector.index}`);
        await this.command(`C ${flashAddress} ${part.ramBase} ${chunk.copyLength}`);
        if (verify) {
          const skip = Math.max(0, REMAPPED_BYTES - flashAddress);
          const compareLength = Math.floor((chunk.length - skip) / 4) * 4;
          if (compareLength > 0) {
            const code = await this.command(`M ${flashAddress + skip} ${part.ramBase + skip} ${compareLength}`, {allowed: [10]});
            if (code === 10) throw new Error(`Sector ${sector.index} did not read back the same as it was written.`);
          }
        }
      }
    }
    this.log(verify ? 'Written and read back.' : 'Written.');
  }

  /**
   * Starts the program in flash.
   */
  async run() {
    const {link} = this;
    const go = (this.part && this.part.go) || 'G 0 A';
    link.clear();
    await this.send(`${go}\r\n`);
    // (The program starts right away; an answer may or may not come before the bootloader is gone.)
    await link.waitFor((received) => (received.includes(go) ? {value: true, end: received.length} : null), 500);
  }
}
