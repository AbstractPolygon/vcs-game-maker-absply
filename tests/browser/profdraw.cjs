// Steps for cdp2c.cjs: opens VCSGM_PATH, goes to the Title tab, draws strokes on the first picture canvas (the tallest one when TALLEST is set)
// with mouse events, timing them, under the CPU profiler; prints the time of the strokes and the functions with the most time.
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
  for (let k = 0; k < 4; k++) { await evaluate("[...document.querySelectorAll('.v-icon.mdi-chevron-down')].forEach((i) => { const b = i.closest('button'); if (b) b.click(); })"); await sleep(1500); }
  { const shot = await send('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(P.OUT + '/title_tab.png', Buffer.from(shot.result.data, 'base64')); }
  // the canvases of the pictures: the tallest one (on screen)
  const rect = await evaluate(`(() => {
    const canvases = [...document.querySelectorAll('canvas')].filter((c) => c.clientHeight > 20 && c.clientWidth > 50 && !c.className.includes('backdrop') && !c.className.includes('grid'));
    canvases.sort((a, b) => b.clientHeight - a.clientHeight);
    const c = canvases[0]; if (!c) return null;
    c.scrollIntoView({block: 'center'});
    const r = c.getBoundingClientRect();
    return {x: r.x, y: r.y, w: r.width, h: r.height, count: canvases.length};
  })()`);
  console.log('canvas', JSON.stringify(rect), await evaluate("[...document.querySelectorAll('canvas')].map((c) => c.className + ':' + c.clientWidth + 'x' + c.clientHeight).slice(0, 12).join(' ')"), await evaluate('location.hash'));
  if (!rect) return;
  await sleep(1000);
  const r2 = await evaluate(`(() => { const canvases = [...document.querySelectorAll('canvas')].filter((c) => c.clientHeight > 20 && c.clientWidth > 50 && !c.className.includes('backdrop') && !c.className.includes('grid')); canvases.sort((a, b) => b.clientHeight - a.clientHeight); const r = canvases[0].getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })()`);
  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', {interval: 200});
  await send('Profiler.start');
  const t0 = Date.now();
  const strokes = +(process.env.STROKES || 3);
  for (let s = 0; s < strokes; s++) {
    const y = r2.y + r2.h * (0.2 + 0.2 * s);
    await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: r2.x + 5, y});
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: r2.x + 5, y, button: 'left', clickCount: 1, buttons: 1});
    for (let i = 0; i < 30; i++) {
      await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: r2.x + 5 + (r2.w - 10) * i / 29, y: y + i, button: 'left', buttons: 1});
    }
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: r2.x + r2.w - 5, y: y + 29, button: 'left', clickCount: 1, buttons: 0});
    await sleep(300);
  }
  const elapsed = Date.now() - t0 - strokes * 300;
  const prof = await send('Profiler.stop');
  console.log('strokes', strokes, 'ms (without the waits)', elapsed);
  // self time by function
  const nodes = prof.result.profile.nodes; const samples = prof.result.profile.samples; const deltas = prof.result.profile.timeDeltas;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const self = new Map();
  samples.forEach((id, i) => { const n = byId.get(id); const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (deltas[i] || 0)); });
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log((v / 1000).toFixed(1) + 'ms', k));
  fs.writeFileSync(process.env.PROFOUT || P.OUT + '/draw.cpuprofile', JSON.stringify(prof.result.profile));
};
