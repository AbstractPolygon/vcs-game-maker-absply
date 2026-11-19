// usage: node tooltipsonly.cjs file.js [file.js ...] -> for each file of src, whether the working copy differs from the last commit only in the text of
// tooltips: the values of `tooltip:` properties, the arguments of setTooltip(...) and the initial values of constants whose name has "tooltip" in it are
// cut out of both versions (by the syntax tree, not by lines), and what is left must be the same. Prints each file as "same outside tooltips" or what
// differs, and the number of characters the tooltips lost; exits with 1 when a file changed anywhere else. Run after shortening tooltips.
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const P = require('../lib/paths.cjs');
const espree = require(P.REPO + 'node_modules/espree');

const stripTooltips = (source) => {
  const ast = espree.parse(source, {ecmaVersion: 2021, sourceType: 'module', range: true});
  const cuts = [];
  let tooltipChars = 0;
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    const keyName = (key) => (key && (key.name || key.value));
    if (node.type === 'Property' && keyName(node.key) === 'tooltip') cuts.push(node.value.range);
    else if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && keyName(node.callee.property) === 'setTooltip') node.arguments.forEach((arg) => cuts.push(arg.range));
    else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.computed && /TOOLTIP/.test(String(node.left.property.value))) cuts.push(node.right.range);
    else if (node.type === 'VariableDeclarator' && node.id.name && /tooltip/i.test(node.id.name) && node.init) cuts.push(node.init.range);
    Object.values(node).forEach((child) => {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    });
  };
  visit(ast);
  // (Cuts inside cuts, as a tooltip function holding another, are covered by the outer one.)
  const sorted = cuts.sort((a, b) => a[0] - b[0]);
  let out = '';
  let at = 0;
  sorted.forEach(([from, to]) => {
    if (from < at) return;
    out += source.slice(at, from);
    tooltipChars += to - from;
    at = to;
  });
  return {text: out + source.slice(at), tooltipChars};
};
let bad = 0;
process.argv.slice(2).forEach((file) => {
  const relative = path.relative(P.REPO, path.resolve(file)).split(path.sep).join('/');
  // (TIP_BASE=folder: the file of that name in the folder instead of the last commit, for files with other changes not committed yet.)
  const original = process.env.TIP_BASE ? fs.readFileSync(path.join(process.env.TIP_BASE, path.basename(file)), 'utf8') :
    execFileSync('git', ['show', `HEAD:${relative}`], {cwd: P.REPO, encoding: 'utf8', maxBuffer: 1 << 26});
  const before = stripTooltips(original.replace(/\r\n/g, '\n'));
  const after = stripTooltips(fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n'));
  if (before.text === after.text) {
    console.log(`${relative}: same outside tooltips, tooltips ${before.tooltipChars} -> ${after.tooltipChars} characters`);
  } else {
    bad++;
    const a = before.text.split('\n');
    const b = after.text.split('\n');
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    console.log(`${relative}: CHANGED outside tooltips, first at line ${i + 1}:\n  was: ${String(a[i]).slice(0, 140)}\n  now: ${String(b[i]).slice(0, 140)}`);
  }
});
process.exit(bad ? 1 : 0);
