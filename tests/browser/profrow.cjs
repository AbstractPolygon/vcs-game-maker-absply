// Steps for cdp2c.cjs: opens VCSGM_PATH, goes to ROUTE, opens the cards; takes $46 into the draw color, selects the Pencil, then clicks COUNT rows of
// the first strip beside a picture one after another under the CPU profiler, timing each click in the page (from the click to two animation
// frames later); prints the times and the functions with the most time (self and inclusive).
const P = require('../lib/paths.cjs');
const fs = require('fs');
module.exports = async ({send, evaluate, sleep, APP}) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `if (!sessionStorage.__t) { sessionStorage.__t = '1'; localStorage.clear(); localStorage.setItem('vcs-game-maker.showStartupTips','false'); }`});
  await send('Page.navigate', {url: APP + '#/project'});
  for (let i = 0; i < 40; i++) { await sleep(1000); if (await evaluate("[...document.querySelectorAll('button')].some((b) => /update rom|rom up to date/i.test(b.textContent))")) break; }
  await sleep(2000);
  const doc = await send('DOM.getDocument', {depth: -1});
  const found = await send('DOM.querySelectorAll', {nodeId: doc.result.root.nodeId, selector: 'input[type=file]'});
  await send('DOM.setFileInputFiles', {nodeId: found.result.nodeIds[0], files: [process.env.VCSGM_PATH]});
  await sleep(4000);
  await send('Page.navigate', {url: APP + '#/' + (process.env.ROUTE || 'titlescreen')});
  await sleep(6000);
  for (let i = 0; i < 20; i++) {
    if (await evaluate("!!document.querySelector('.editor-sidebar .playfield-color-strip')")) break;
    await evaluate("[...document.querySelectorAll('.v-icon.mdi-chevron-down')].forEach((i) => { const b = i.closest('button'); if (b) b.click(); })");
    await sleep(1000);
  }
  await evaluate(`document.querySelector('.editor-sidebar .playfield-color-strip').__vue__.handleTake(0x46)`);
  await evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('Pencil')); b.click(); })()");
  await sleep(500);
  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', {interval: 200});
  await send('Profiler.start');
  const count = +(process.env.COUNT || 10);
  const times = await evaluate(`(async () => {
    const strip = document.querySelector('.editor-sidebar .playfield-color-strip');
    const swatches = strip.querySelectorAll('.row-swatch');
    const out = [];
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < ${count}; i++) {
      const t0 = performance.now();
      swatches[(i * 3) % swatches.length].click();
      const t1 = performance.now();
      await frame(); await frame();
      out.push([Math.round(t1 - t0), Math.round(performance.now() - t0)]);
      await new Promise((r) => setTimeout(r, 50));
    }
    return out;
  })()`);
  const prof = await send('Profiler.stop');
  console.log('per click [ms in the click handler, ms until 2 frames later]', JSON.stringify(times));
  const nodes = prof.result.profile.nodes; const samples = prof.result.profile.samples; const deltas = prof.result.profile.timeDeltas;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
  const self = new Map();
  samples.forEach((id, i) => { const k = name(byId.get(id)); self.set(k, (self.get(k) || 0) + (deltas[i] || 0)); });
  console.log('--- self');
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log((v / 1000).toFixed(1) + 'ms', k));
  const parent = new Map(); nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const incl = new Map();
  samples.forEach((id, i) => {
    const seen = new Set(); let cur = id;
    while (cur !== undefined) { const k = name(byId.get(cur)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + (deltas[i] || 0)); } cur = parent.get(cur); }
  });
  console.log('--- inclusive');
  [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, v]) => console.log((v / 1000).toFixed(1) + 'ms', k));
  fs.writeFileSync(P.OUT + '/row.cpuprofile', JSON.stringify(prof.result.profile));
};
