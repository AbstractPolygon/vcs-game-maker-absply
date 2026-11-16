// usage: node returnasm.cjs -> compiles a short program with the batari Basic compiler of the app (public/bb19, preprocess.wasm and 2600basic.wasm
// run with WASI) and checks the code it makes for the return forms narrowSubroutineReturns writes: return thisbank is an RTS, return otherbank a
// JMP BS_return, return value thisbank a load and an RTS.
const fs = require('fs');
const path = require('path');
const {WASI} = require('node:wasi');
const B = require('../lib/paths.cjs').REPO + 'public/bb19/';
const runWasm = async (wasm, args, stdin, dir) => {
  fs.writeFileSync(path.join(dir, 'stdin.txt'), stdin);
  const inFd = fs.openSync(path.join(dir, 'stdin.txt'), 'r');
  const outFd = fs.openSync(path.join(dir, 'stdout.txt'), 'w');
  const errFd = fs.openSync(path.join(dir, 'stderr.txt'), 'w');
  const wasi = new WASI({version: 'preview1', args: ['x', ...args], preopens: {'.': dir, '/bbinc': B}, stdin: inFd, stdout: outFd, stderr: errFd, returnOnExit: true});
  const mod = await WebAssembly.compile(fs.readFileSync(B + wasm));
  const code = wasi.start(await WebAssembly.instantiate(mod, wasi.getImportObject()));
  [inFd, outFd, errFd].forEach((fd) => fs.closeSync(fd));
  return {code, out: fs.readFileSync(path.join(dir, 'stdout.txt'), 'utf8'), err: fs.readFileSync(path.join(dir, 'stderr.txt'), 'utf8')};
};
const compileBas = async (src) => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'returnasm-'));
  const pre = await runWasm('preprocess.wasm', [], src, dir);
  const comp = await runWasm('2600basic.wasm', ['-i', '/bbinc'], pre.out, dir);
  return comp.out;
};
// The instructions the compiler makes for a statement (the lines after its ";;line" mark up to the next mark or label).
const statementCode = (asm, text) => {
  const lines = asm.split(/\r?\n/);
  const at = lines.findIndex((line) => line.includes(';;') && line.includes(text));
  const out = [];
  for (let i = at + 1; i < lines.length && !/^\S/.test(lines[i]); i++) if (lines[i].trim()) out.push(lines[i].trim().split(/\s*;/)[0]);
  return out.join(' | ');
};
(async () => {
  const asm = await compileBas([' set romsize 8k', 'main', ' a = f(1)', ' gosub s', ' gosub t bank2', ' drawscreen', ' goto main',
    ' function f', ' return temp1 thisbank', 'end', 's', ' return thisbank', ' bank 2', 't', ' return otherbank', ' a = 2', ''].join('\n'));
  const checks = [['return temp1 thisbank', 'LDA temp1 | RTS'], ['return thisbank', 'RTS'], ['return otherbank', 'JMP BS_return']];
  let bad = 0;
  checks.forEach(([text, want]) => {
    const got = statementCode(asm, text);
    if (got !== want) { bad++; console.log(`${text}: got "${got}", want "${want}"`); }
  });
  console.log(`${checks.length} statements, ${bad} wrong`);
})();
