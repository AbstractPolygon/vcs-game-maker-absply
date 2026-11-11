// Takes the TEMP-DEBUG lines that hook_bb.cjs and hook_symtext.cjs put in src/hooks/bb-compiler.js back out. Run it before committing.
const fs = require('fs');
const P = require('../lib/paths.cjs');
const p = P.REPO + 'src/hooks/bb-compiler.js';
const s = fs.readFileSync(p, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const lines = s.split(/\r?\n/);
const kept = lines.filter((line) => !line.includes('TEMP-DEBUG'));
fs.writeFileSync(p, kept.join(eol));
console.log('removed', lines.length - kept.length, 'line(s)');
