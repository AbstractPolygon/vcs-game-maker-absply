const fs = require('fs');
const [, , A, B] = process.argv;
const a = JSON.parse(fs.readFileSync(A)); const b = JSON.parse(fs.readFileSync(B));
const d = [];
a.forEach((r, y) => { const xs = r.map((c, x) => (c !== b[y][x] ? x : -1)).filter((x) => x >= 0); if (xs.length) d.push(y + ':' + xs[0] + '-' + xs[xs.length - 1]); });
console.log('lines that differ', d.length, d.slice(0, 40).join(' '));
