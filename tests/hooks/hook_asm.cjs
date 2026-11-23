// Puts a TEMP-DEBUG line in src/hooks/rom.js that keeps the assembly of the last build (game or preview) in window.__vcsAsm before it is
// assembled, so a build that fails to assemble can be looked at (tests/browser/loadsym.cjs and titlepreview.cjs save it as .asm.txt).
// tests/hooks/unhook.cjs takes it out again.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const p = P.REPO + 'src/hooks/rom.js';
let s = fs.readFileSync(p, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
// (The line that assembles, at whatever indent: compileAndAssemble has it for the game and the previews.)
const at = /^( *)const compiledResult = await assembleBatariBasic\(compiled\.mainAsm, compiled\.workDir, log\);$/gm;
if (!at.test(s)) throw new Error('anchor');
// (The bB text of that build too, for tests/browser/loadsym.cjs: the last compile is not always the one assembled, see hook_bb.cjs.)
s = s.replace(at, (line, indent) => `${indent}window.__vcsAsm = compiled.mainAsm; window.__vcsBbAtAsm = window.__vcsBb; // TEMP-DEBUG remove\n${line}`);
if (crlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(p, s);
console.log('asm hook on');
