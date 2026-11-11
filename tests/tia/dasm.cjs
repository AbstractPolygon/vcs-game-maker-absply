// usage: node dasm.cjs dir file.asm out.bin -> assembles with the project's dasm.wasm (node's WASI, the directory preopened as ".")
const P = require('../lib/paths.cjs');
const {WASI} = require('node:wasi');
const fs = require('fs');
const path = require('path');
const [, , dir, src, out] = process.argv;
const wasi = new WASI({version: 'preview1', args: ['dasm', src, '-f3', '-o' + out, '-l' + out.replace(/\.bin$/, '.lst'), '-s' + out.replace(/\.bin$/, '.sym')], preopens: {'.': dir}});
(async () => {
  const mod = await WebAssembly.compile(fs.readFileSync(P.REPO + 'public/bb19/dasm.wasm'));
  const inst = await WebAssembly.instantiate(mod, wasi.getImportObject());
  const code = wasi.start(inst);
  console.log('dasm exit', code, fs.existsSync(path.join(dir, out)) ? fs.statSync(path.join(dir, out)).size + ' bytes' : 'no output');
})();
