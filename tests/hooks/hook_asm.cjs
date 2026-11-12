// Puts a TEMP-DEBUG line in src/hooks/rom.js that keeps the assembly of the last build (game or preview) in window.__vcsAsm before it is
// assembled, so a build that fails to assemble can be looked at (tests/browser/loadsym.cjs and titlepreview.cjs save it as .asm.txt).
// tests/hooks/unhook.cjs takes it out again.
const P = require('../lib/paths.cjs');
const fs = require('fs');
const p = P.REPO + 'src/hooks/rom.js';
let s = fs.readFileSync(p, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const a = '      const compiledResult = await assembleBatariBasic(compiled.mainAsm, compiled.workDir, log);\n';
if (s.split(a).length < 2) throw new Error('anchor');
s = s.split(a).join('      window.__vcsAsm = compiled.mainAsm; // TEMP-DEBUG remove\n' + a);
if (crlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync(p, s);
console.log('asm hook on');
