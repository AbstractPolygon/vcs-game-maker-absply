// Takes the TEMP-DEBUG lines that hook_bb.cjs, hook_symtext.cjs (src/hooks/bb-compiler.js) and hook_asm.cjs (src/hooks/rom.js) put in back
// out. Run it before committing.
const fs = require('fs');
const P = require('../lib/paths.cjs');
let removed = 0;
for (const p of [P.REPO + 'src/hooks/bb-compiler.js', P.REPO + 'src/hooks/rom.js']) {
  const s = fs.readFileSync(p, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const lines = s.split(/\r?\n/);
  const kept = lines.filter((line) => !line.includes('TEMP-DEBUG'));
  if (kept.length !== lines.length) fs.writeFileSync(p, kept.join(eol));
  removed += lines.length - kept.length;
}
console.log('removed', removed, 'line(s)');
