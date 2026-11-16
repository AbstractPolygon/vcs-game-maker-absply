'use strict';

// Checks src/utils/harmony-rom.js: the bankswitch file and SD card extension for each kind of ROM, and the F4 layout (the last bank
// packed, unpacked again, everything within 32760 bytes). Usage: node tests/harmony/rom-images.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const {pathToFileURL} = require('url');

const root = path.join(__dirname, '..', '..');

// harmony-rom.js imports ./pxe without an extension (webpack's way); a copy of both with the extension added loads in Node.
const load = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harmony-rom-'));
  fs.copyFileSync(path.join(root, 'src', 'utils', 'pxe.js'), path.join(dir, 'pxe.mjs'));
  const source = fs.readFileSync(path.join(root, 'src', 'utils', 'harmony-rom.js'), 'utf8').replace(`from './pxe'`, `from './pxe.mjs'`);
  fs.writeFileSync(path.join(dir, 'harmony-rom.mjs'), source);
  return import(pathToFileURL(path.join(dir, 'harmony-rom.mjs')).href);
};

const main = async () => {
  const lib = await load();
  let failed = 0;
  const check = (name, ok, detail = '') => {
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
  };
  const tryIt = (fn) => {
    try {
      return fn();
    } catch (e) {
      return `error: ${e.message}`;
    }
  };
  const std = {kernel: 'standard'};
  const sc = {kernel: 'standard', enableSuperchip: true};
  const dpc = {kernel: 'dpcplus'};
  const pxe = {kernel: 'dpcplus', pxe: true};
  const sized = (n) => new Uint8Array(n);
  const table = [
    [2048, std, '2K4K.arm', '2K'], [4096, std, '2K4K.arm', '4K'], [8192, std, 'F8.arm', 'F8'], [8192, sc, 'F8SC.arm', 'F8S'],
    [16384, std, 'F6.arm', 'F6'], [16384, sc, 'F6SC.arm', 'F6S'], [32768, std, 'F4.arm', 'F4'], [32768, sc, 'F4SC.arm', 'F4S'],
    [32768, dpc, null, 'CU'],
  ];
  for (const [size, config, arm, ext] of table) {
    const gotArm = tryIt(() => lib.harmonyArmFileFor(sized(size), config));
    const gotExt = tryIt(() => lib.harmonySdExtensionFor(sized(size), config));
    check(`${size} ${config.kernel}${config.enableSuperchip ? ' SC' : ''}`, gotArm === arm && gotExt === ext, `${gotArm}, .${gotExt}`);
  }
  check('PXE refused', /PXE/.test(tryIt(() => lib.harmonySdExtensionFor(sized(32768), pxe))));
  check('64K refused in developer mode', /does not fit Developer Mode/.test(tryIt(() => lib.harmonyArmFileFor(sized(65536), std))));
  check('64K for the SD card (Encore)', tryIt(() => lib.harmonySdExtensionFor(sized(65536), std)) === 'EF' &&
      tryIt(() => lib.harmonySdExtensionFor(sized(65536), sc)) === 'EFS' && lib.harmonyNeedsEncore(sized(65536), std));
  check('128K refused', /does not run/.test(tryIt(() => lib.harmonySdExtensionFor(sized(131072), std))));

  // F4: a 32K ROM made of the 8K test ROM's banks with a few bytes changed in each, as banks of a bB program share much of their code.
  const base = new Uint8Array(fs.readFileSync(path.join(root, 'tests', 'roms', 'ball2.bin')));
  const rom = new Uint8Array(32768);
  for (let bank = 0; bank < 8; bank++) {
    rom.set(base.subarray((bank % 2) * 4096, (bank % 2) * 4096 + 4096), bank * 4096);
    for (let i = 0; i < 40; i++) rom[bank * 4096 + ((i * 97 + bank * 13) % 4096)] ^= bank + 1;
  }
  const arm = new Uint8Array(668).fill(0x11);
  const f4 = tryIt(() => lib.harmonyImageFor(rom, std, {'f4.ARM': arm}).image);
  if (typeof f4 === 'string') check('F4 image', false, f4);
  else {
    const order = [...f4.subarray(arm.length, arm.length + 8)];
    const last = order.indexOf(7);
    const banks = f4.subarray(arm.length + 8, arm.length + 8 + 7 * 4096);
    const packed = f4.subarray(arm.length + 8 + 7 * 4096);
    const back = lib.unpackF4Bank(banks, packed);
    const same = back.length === 4096 && back.every((b, i) => b === rom[last * 4096 + i]);
    const keptSame = order.every((slot, bank) => slot === 7 ||
      banks.subarray(slot * 4096, slot * 4096 + 4096).every((b, i) => b === rom[bank * 4096 + i]));
    check('F4 image', same && keptSame && f4.length - 8 < 32760,
        `${f4.length} bytes, bank ${last} packed to ${packed.length} bytes, order ${order.join('')}`);
  }
  // F4 with Superchip RAM: the stub over the first 256 bytes of banks 0 and 1, the rest the ROM.
  const scArm = new Uint8Array(4352).fill(0x22);
  const f4sc = lib.harmonyImageFor(rom, sc, {'F4SC.arm': scArm}).image;
  const scOk = f4sc.length === 32768 && f4sc[0] === 0x22 && f4sc[255] === 0x22 && f4sc[256] === rom[256] &&
    f4sc[4096] === 0x22 && f4sc[4351] === 0x22 && f4sc[4352] === rom[4352];
  check('F4SC image', scOk);
  check('missing bankswitch file named', /F8\.arm/.test(tryIt(() => lib.harmonyImageFor(sized(8192), std, {}))));
  // 2K mirrored into 4K behind the stub.
  const two = new Uint8Array(2048).map((_, i) => i & 255);
  const twoImage = lib.harmonyImageFor(two, std, {'2K4K.arm': new Uint8Array(412)}).image;
  check('2K mirrored', twoImage.length === 412 + 4096 && twoImage[412 + 2048 + 5] === 5);
  process.exit(failed ? 1 : 0);
};

main();
