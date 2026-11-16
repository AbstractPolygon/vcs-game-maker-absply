'use strict';

import {isPxe} from './pxe';

// What goes onto a Harmony Cart for a built ROM, the two ways the Write ROM popup has:
// - Developer mode: one ROM written into the cart's flash over USB, which the cart then runs with or without an SD card. The cart's
//   ARM runs the 2600's cartridge port, so the ROM needs ARM code with it that answers the 6502 the way the cartridge type does:
//   - DPC+: the ROM VCS Game Maker builds is 32 KB and already starts with that code (the DPC+ driver), so it goes in as it is.
//   - The standard kernel (2K, 4K, F8, F6, F4, with or without Superchip RAM): the bankswitch file of the type goes in with the ROM.
//     Those files come with the HarmonyCart program (its "arm" folder: 2K4K.arm, F8.arm, F8SC.arm, F6.arm, F6SC.arm, F4.arm,
//     F4SC.arm); they are not part of VCS Game Maker, so the popup asks for them.
// - SD card: the ROM as it is, saved as a file on the cart's SD card, with the extension the cart's menu reads the cartridge type
//   from (the Harmony manual's list: 2K, 4K, F8, F8S, F6, F6S, F4, F4S, and CU for a ROM that holds its ARM code). The menu has the
//   bankswitch code, so no bankswitch file is needed. A 64K ROM (bB's EF, EFSC with Superchip RAM) runs only on the Harmony Encore,
//   whose extra 512 KB holds it, as .EF or .EFS (the extensions Stella documents as the Harmony Cart's).
// PXE ROMs do not run on a Harmony Cart, and 64K ROMs do not fit developer mode (the chip's 32 KB of flash).

const DPC_PLUS_FULL = 32 * 1024;
const BANK = 4096;
// The F4 layout: the bankswitch file, 8 bytes of bank order, 7 banks as they are, then the last one packed, all within 32 KB less 8
// bytes.
const F4_LIMIT = 32760;

const EF_SIZE = 64 * 1024;

// Throws when the ROM can not go on a Harmony Cart at all (sd: saved for the SD card, where the Encore also takes 64K ROMs).
const checkRunsOnHarmony = (rom, config, sd = false) => {
  if (isPxe(config)) throw new Error('PXE ROMs do not run on a Harmony Cart.');
  if (config && config.kernel === 'dpcplus') {
    if (rom.length !== DPC_PLUS_FULL) throw new Error(`This DPC+ ROM is ${rom.length} bytes; a Harmony Cart takes the 32 KB DPC+ ROM.`);
    return;
  }
  if (rom.length === EF_SIZE) {
    if (sd) return;
    throw new Error('A 64K ROM does not fit Developer Mode (the cart\'s 32 KB of flash): save it to the SD card for a Harmony Encore.');
  }
  if (![2048, 4096, 8192, 16384, 32768].includes(rom.length) && rom.length > 2048) {
    throw new Error(`A ${Math.round(rom.length / 1024)}K standard ROM does not run on a Harmony Cart.`);
  }
};

// A 64K ROM, which only the Harmony Encore runs (from its SD card).
export const harmonyNeedsEncore = (rom, config) => !!rom && rom.length === EF_SIZE && !(config && config.kernel === 'dpcplus');

// The bankswitch file a ROM needs to be written straight into the cart, or null when it needs none. Throws when the ROM can not go
// on the cart.
export const harmonyArmFileFor = (rom, config) => {
  checkRunsOnHarmony(rom, config);
  if (config && config.kernel === 'dpcplus') return null;
  const superchip = !!(config && config.enableSuperchip);
  if (rom.length <= BANK) return '2K4K.arm';
  if (rom.length === 2 * BANK) return superchip ? 'F8SC.arm' : 'F8.arm';
  if (rom.length === 4 * BANK) return superchip ? 'F6SC.arm' : 'F6.arm';
  return superchip ? 'F4SC.arm' : 'F4.arm';
};

// The extension of the SD card file (the cartridge type for the cart's menu). Throws when the ROM can not go on the cart.
export const harmonySdExtensionFor = (rom, config) => {
  checkRunsOnHarmony(rom, config, true);
  if (config && config.kernel === 'dpcplus') return 'CU';
  const sc = config && config.enableSuperchip ? 'S' : '';
  if (rom.length <= 2048) return '2K';
  if (rom.length === BANK) return '4K';
  if (rom.length === 2 * BANK) return `F8${sc}`;
  if (rom.length === 4 * BANK) return `F6${sc}`;
  if (rom.length === EF_SIZE) return `EF${sc}`;
  return `F4${sc}`;
};

// The packed form of the F4 layout's last bank: a run of literal bytes is a count (1 to 127) and the bytes; a copy from the 7 banks
// ahead of it is 128 + its length less 4 (4 to 131 bytes), then where it starts in them (high byte, low byte).
export const packF4Bank = (banks, last) => {
  const index = new Map();
  for (let at = 0; at + 4 <= banks.length; at++) {
    const key = ((banks[at] << 24) | (banks[at + 1] << 16) | (banks[at + 2] << 8) | banks[at + 3]) >>> 0;
    const list = index.get(key);
    if (list) list.push(at);
    else index.set(key, [at]);
  }
  const out = [];
  let literals = [];
  const flush = () => {
    if (literals.length) out.push(literals.length, ...literals);
    literals = [];
  };
  let at = 0;
  while (at < last.length) {
    let bestLength = 0;
    let bestFrom = 0;
    if (at + 4 <= last.length) {
      const key = ((last[at] << 24) | (last[at + 1] << 16) | (last[at + 2] << 8) | last[at + 3]) >>> 0;
      for (const from of index.get(key) || []) {
        let length = 4;
        while (length < 131 && at + length < last.length && from + length < banks.length && banks[from + length] === last[at + length]) {
          length++;
        }
        if (length > bestLength) {
          bestLength = length;
          bestFrom = from;
          if (length === 131) break;
        }
      }
    }
    if (bestLength >= 4) {
      flush();
      out.push(128 + bestLength - 4, bestFrom >> 8, bestFrom & 255);
      at += bestLength;
    } else {
      literals.push(last[at++]);
      if (literals.length === 127) flush();
    }
  }
  flush();
  return Uint8Array.from(out);
};

// The bank the packed bytes stand for (to check packF4Bank).
export const unpackF4Bank = (banks, packed) => {
  const out = [];
  let at = 0;
  while (at < packed.length) {
    const code = packed[at];
    if (code > 127) {
      const from = (packed[at + 1] << 8) | packed[at + 2];
      for (let i = 0; i < code - 124; i++) out.push(banks[from + i]);
      at += 3;
    } else {
      for (let i = 1; i <= code; i++) out.push(packed[at + i]);
      at += code + 1;
    }
  }
  return Uint8Array.from(out);
};

// F4 (32K, no Superchip RAM): the bankswitch file, then the order the banks are kept in (the bank kept last, packed, is marked 7),
// the other 7 banks, and the packed one. The bank to pack is the first that makes it all fit.
const f4Image = (rom, arm) => {
  for (let last = 0; last < 8; last++) {
    const banks = new Uint8Array(7 * BANK);
    let slot = 0;
    for (let bank = 0; bank < 8; bank++) {
      if (bank !== last) banks.set(rom.subarray(bank * BANK, (bank + 1) * BANK), BANK * slot++);
    }
    const lastBank = rom.subarray(last * BANK, (last + 1) * BANK);
    const packed = packF4Bank(banks, lastBank);
    if (arm.length + banks.length + packed.length >= F4_LIMIT) continue;
    const back = unpackF4Bank(banks, packed);
    if (back.length !== BANK || back.some((b, i) => b !== lastBank[i])) throw new Error('The F4 ROM did not pack correctly.');
    const order = [];
    let next = 0;
    for (let bank = 0; bank < 8; bank++) order.push(bank === last ? 7 : next++);
    const image = new Uint8Array(arm.length + 8 + banks.length + packed.length);
    image.set(arm);
    image.set(order, arm.length);
    image.set(banks, arm.length + 8);
    image.set(packed, arm.length + 8 + banks.length);
    return image;
  }
  throw new Error('This F4 ROM does not fit in the cart\'s developer mode (none of its banks packs small enough): save it to the SD card instead.');
};

// F4 with Superchip RAM: the ROM as it is, with the bankswitch file over the bytes the RAM hides (its first 256 bytes over bank 0's,
// the rest from 4 KB on over bank 1's).
const f4scImage = (rom, arm) => {
  const image = new Uint8Array(rom);
  image.set(arm.subarray(0, 256));
  if (arm.length > BANK) image.set(arm.subarray(BANK), BANK);
  return image;
};

// The image for the cart's flash. armFiles: {name: Uint8Array} of the bankswitch files given so far (names compared in any case).
export const harmonyImageFor = (rom, config, armFiles = {}) => {
  const armName = harmonyArmFileFor(rom, config);
  if (!armName) return {image: rom, armName: null};
  const key = Object.keys(armFiles).find((name) => name.toLowerCase() === armName.toLowerCase());
  if (!key) throw new Error(`This ROM needs ${armName} from the HarmonyCart program's arm folder.`);
  const arm = armFiles[key];
  if (armName === 'F4.arm') return {image: f4Image(rom, arm), armName};
  if (armName === 'F4SC.arm') return {image: f4scImage(rom, arm), armName};
  let body = rom;
  if (rom.length < BANK) {
    // A 2K (or smaller) ROM fills the 4K space as copies of itself, as on a real 2K cartridge.
    let size = 1;
    while (size < rom.length) size <<= 1;
    body = new Uint8Array(BANK);
    for (let at = 0; at < BANK; at += size) body.set(rom.subarray(0, Math.min(size, BANK - at)), at);
  }
  const image = new Uint8Array(arm.length + body.length);
  image.set(arm);
  image.set(body, arm.length);
  return {image, armName};
};
