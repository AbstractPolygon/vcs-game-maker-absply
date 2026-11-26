// What a click on a frame costs on TAB (titlescreen or player): loads VCSGM_PATH, opens TAB through the router (FOLDER: a folder of the Sprites
// tab to open), expands the cards and takes the largest list of frames (3 or more). Sends mousedown, mouseup and click to a frame's box (a click
// outside its pixels): a plain click (it selects the card), the same again, a Ctrl+click on the next frame and a Shift+click on the one after;
// prints for each the time to the next painted frame, whether the frame shows as selected, how many components and pixel editors were
// rendered again (since 2026-11-25 about 25 after the first click, which selects the card; the whole tab before) and what made the tab's
// component render again. Then whether a frame's box is draggable only while the mouse is down on it outside the canvas, and the delete of
// the selection through the delete menu of the second frame (two frames go), with its time, the long tasks of the 3 s after and a CPU profile
// (OUTDIR, default the system's temporary folder).
module.exports = async ({send, evaluate, sleep, APP}) => {
  await send('Emulation.setDeviceMetricsOverride', {width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false});
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `if (!sessionStorage.__t) { sessionStorage.__t = '1'; localStorage.clear(); localStorage.setItem('vcs-game-maker.showStartupTips','false'); }`});
  await send('Page.navigate', {url: APP + '#/project'});
  for (let i = 0; i < 40; i++) {
    await sleep(1000); if (await evaluate('[...document.querySelectorAll(\'button\')].some((b) => /update rom|rom up to date/i.test(b.textContent))')) break;
  }
  await sleep(2000);
  const doc = await send('DOM.getDocument', {depth: -1});
  const found = await send('DOM.querySelectorAll', {nodeId: doc.result.root.nodeId, selector: 'input[type=file]'});
  await send('DOM.setFileInputFiles', {nodeId: found.result.nodeIds[0], files: [process.env.VCSGM_PATH]});
  await sleep(5000);
  const TAB = process.env.TAB || 'titlescreen';
  await evaluate(`(() => { document.querySelector('#inspire').__vue__.$router.push('/${TAB}'); return 1; })()`);
  await sleep(8000);
  if (process.env.FOLDER) {
    await evaluate(`(() => { const e = [...document.querySelectorAll('button, a, span, div')].filter((x) => x.offsetParent && x.textContent.trim() === '${process.env.FOLDER}' && x.children.length <= 2).pop(); if (e) (e.closest('button') || e).click(); })()`);
    await sleep(3000);
  }
  for (let k = 0; k < 2; k++) {
    await evaluate('[...document.querySelectorAll(\'.v-icon.mdi-chevron-down\')].forEach((i) => { const b = i.closest(\'button\'); if (b) b.click(); })');
    await sleep(2500);
  }
  await sleep(2000);
  console.log(await evaluate(`(() => {
    const out = []; const walk = (v) => { out.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__);
    const eds = out.filter((v) => typeof v.hookTabHistory === 'function');
    window.__counts = {};
    const names = ['drawBackdrop', 'drawGridOverlay', 'setPixels', 'initEditor', 'scheduleBackdrop', 'redraw', 'drawCellColors', 'paintRowColors'];
    eds.forEach((vm) => names.forEach((n) => { if (typeof vm[n] !== 'function') return; const f = vm[n]; vm[n] = (...a) => { window.__counts[n] = (window.__counts[n] || 0) + 1; return f.apply(vm, a); }; }));
    const updated = new Set(); eds.forEach((vm) => vm.$on('hook:updated', () => { window.__counts.updatedEditors = (window.__counts.updatedEditors || 0) + 1; }));
    out.forEach((vm) => vm.$on('hook:updated', () => { window.__counts.updatedComponents = (window.__counts.updatedComponents || 0) + 1; }));
    const all = [...document.querySelectorAll('.pixel-editor-container')].filter((e) => e.offsetParent);
    let g = null;
    for (let up = 1; up <= 4 && !g; up++) {
      const groups = new Map(); all.forEach((e) => { let p = e; for (let k = 0; k < up; k++) p = p.parentElement; groups.set(p, (groups.get(p) || []).concat(e)); });
      g = [...groups.values()].filter((l) => l.length >= 3).sort((a, b) => b.length - a.length)[0];
    }
    window.__fr = g;
    const host = out.find((v) => typeof v.frameOwner === 'function' && typeof v.selectFrame === 'function');
    if (host) { const w = host._watcher; const u = w.update.bind(w); window.__why = []; w.update = () => { window.__why.push(new Error().stack.split(String.fromCharCode(10)).slice(2, 10).map((l) => l.trim().split('/').pop().split('?')[0] + ':' + (l.match(/:(\\d+):\\d+\\)?$/) || [])[1]).join(' < ')); return u(); }; }
    return eds.length + ' pixel editors, ' + out.length + ' components, frames in the list ' + (g ? g.length : 0) + ', containers ' + all.length;
  })()`));
  const click = async (label, i, mods) => {
    const r = await evaluate(`(async () => {
      window.__counts = {}; window.__why = []; const e = window.__fr[${i}];
      const t0 = performance.now();
      ['mousedown', 'mouseup', 'click'].forEach((type) => e.dispatchEvent(new MouseEvent(type, {bubbles: true, button: 0, ${mods}})));
      const t1 = performance.now();
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      const t2 = performance.now();
      await new Promise((r) => setTimeout(r, 1500));
      return JSON.stringify({syncMs: Math.round(t1 - t0), toPaintMs: Math.round(t2 - t0), selected: e.hasAttribute('data-frame-selected') || e.classList.contains('pixel-editor-container-active'), counts: window.__counts, why: window.__why});
    })()`);
    console.log(label, r);
  };
  await click('plain click 0', 0, '');
  await click('plain again 0', 0, '');
  await click('ctrl click 1 ', 1, 'ctrlKey: true');
  await click('shift click 2', 2, 'shiftKey: true');
  console.log('drag arm', await evaluate('(() => { const e = window.__fr[0]; const out = []; out.push(e.draggable); e.dispatchEvent(new MouseEvent(\'mousedown\', {bubbles: true, button: 0})); out.push(e.draggable); e.dispatchEvent(new MouseEvent(\'mouseup\', {bubbles: true, button: 0})); out.push(e.draggable); const c = e.querySelector(\'canvas\'); c.dispatchEvent(new MouseEvent(\'mousedown\', {bubbles: true, button: 0})); out.push(e.draggable); c.dispatchEvent(new MouseEvent(\'mouseup\', {bubbles: true, button: 0})); return \'before \' + out[0] + \', down on the box \' + out[1] + \', up \' + out[2] + \', down on the canvas \' + out[3]; })()'));
  // The delete of the selection: the confirm of frame 1's delete menu, timed to the next painted frame, with the long tasks of the 3 s after.
  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', {interval: 200});
  await evaluate('window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, Math.round(e.duration)]))).observe({entryTypes: [\'longtask\']}); 1');
  await send('Profiler.start');
  const r = await evaluate(`(async () => {
    window.__counts = {}; window.__why = [];
    const all = []; const walk = (v) => { all.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__); const menu = all.find((v) => typeof v.handleConfirm === 'function' && v.$el && window.__fr[1].contains(v.$el));
    if (!menu) return 'no menu';
    const before = document.querySelectorAll('.pixel-editor-container').length;
    const t0 = performance.now(); window.__t0 = t0;
    menu.handleConfirm();
    const t1 = performance.now();
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const t2 = performance.now();
    await new Promise((r) => setTimeout(r, 3000));
    const lt = window.__lt.filter(([s]) => s >= t0 - 5).map(([s, d]) => [Math.round(s - t0), d]);
    return JSON.stringify({syncMs: Math.round(t1 - t0), toPaintMs: Math.round(t2 - t0), containers: before + ' -> ' + document.querySelectorAll('.pixel-editor-container').length, longTasks: lt, counts: window.__counts});
  })()`);
  const prof = (await send('Profiler.stop')).result.profile;
  console.log('delete       ', r);
  const self = new Map(); const byId = new Map(prof.nodes.map((n) => [n.id, n])); const dt = prof.timeDeltas;
  prof.samples.forEach((id, i) => {
    const n = byId.get(id); if (n.callFrame.functionName === '(idle)') return;
    const k = n.callFrame.functionName + ' ' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + n.callFrame.lineNumber;
    self.set(k, (self.get(k) || 0) + (dt[i] || 0));
  });
  console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => '   ' + (v / 1000).toFixed(1).padStart(7) + ' ms ' + k).join('\n'));
  require('fs').writeFileSync((process.env.OUTDIR || require('os').tmpdir()) + '/delete_' + (process.env.TAB || 'titlescreen') + '.cpuprofile', JSON.stringify(prof));
};
