// Steps for cdp2c.cjs: opens VCSGM_PATH, Title tab, turns on Ball mode on the first 48x2 card, then:
// (1) draws 3 cells on row ROW (x 10..12) with the Pencil, prints the row's ball cells after (expected 4: 10..13);
// (2) draws 5 cells on row ROW+2 (x 20..24) (expected 8: 20..27), then erases x 27 (expected 4: 20..23);
// (3) times a long stroke of 40 moves; (4) checks the backdrop canvas color at a picture pixel that is on over a painted cell (should be the
// picture's color, not the ball's), in Ball mode and out of it.
module.exports = async ({send, evaluate, sleep, APP}) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `if (!sessionStorage.__t) { sessionStorage.__t = '1'; localStorage.clear(); localStorage.setItem('vcs-game-maker.showStartupTips','false'); }`});
  await send('Page.navigate', {url: APP + '#/project'});
  for (let i = 0; i < 40; i++) { await sleep(1000); if (await evaluate("[...document.querySelectorAll('button')].some((b) => /update rom|rom up to date/i.test(b.textContent))")) break; }
  await sleep(2000);
  const doc = await send('DOM.getDocument', {depth: -1});
  const found = await send('DOM.querySelectorAll', {nodeId: doc.result.root.nodeId, selector: 'input[type=file]'});
  await send('DOM.setFileInputFiles', {nodeId: found.result.nodeIds[0], files: [process.env.VCSGM_PATH]});
  await sleep(4000);
  await send('Page.navigate', {url: APP + '#/titlescreen'});
  await sleep(6000);
  for (let k = 0; k < 3; k++) { await evaluate("[...document.querySelectorAll('.v-icon.mdi-chevron-down')].forEach((i) => { const b = i.closest('button'); if (b) b.click(); })"); await sleep(1200); }
  console.log('ball button', await evaluate(`(() => { const i = document.querySelector('.v-icon.mdi-circle-outline'); if (!i) return null; const b = i.closest('button'); b.click(); return b.getAttribute('title'); })()`));
  await sleep(1500);
  const VM = `(() => { const out = []; const walk = (v) => { out.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__); return out; })().find((v) => v && v.$props && v.$props.rowRunWidths)`;
  console.log('editor found', await evaluate(`!!(${VM})`));
  const tool = async (name) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('${name}')); b.click(); return b.getAttribute('title').slice(0, 30); })()`);
  await evaluate(`(${VM}).$el.scrollIntoView({block: 'center'})`);
  await sleep(500);
  const geo = async () => evaluate(`(() => { const vm = ${VM}; const c = vm.$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)'); const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, rows: vm.editor.height}; })()`);
  let g = await geo();
  console.log('geo', JSON.stringify(g));
  const at = (x, y) => [g.x + (x + 0.5) * g.w / 48, g.y + (y + 0.5) * g.h / g.rows];
  const stroke = async (y, x0, x1) => {
    let [px, py] = at(x0, y);
    await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py});
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1, buttons: 1});
    for (let x = x0; x <= x1; x++) { [px, py] = at(x, y); await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py, button: 'left', buttons: 1}); }
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1, buttons: 0});
    await sleep(400);
  };
  const ballRow = (y) => evaluate(`(() => { const vm = ${VM}; const row = (vm.value || [])[${y}] || []; return row.map((c, x) => (c ? x : -1)).filter((x) => x >= 0).join(','); })()`);
  const editorRow = (y) => evaluate(`(() => { const vm = ${VM}; const row = vm.getPixels()[${y}] || []; return row.map((c, x) => (c ? x : -1)).filter((x) => x >= 0).join(','); })()`);
  if (process.env.UNDOFIRST) { const before = await evaluate(`JSON.stringify((${VM}).value)`); await evaluate(`(${VM}).undo()`); await sleep(500); const after = await evaluate(`JSON.stringify((${VM}).value)`); console.log('undo right after Ball mode: ball cells unchanged', before === after, 'cells on', (after.match(/1/g) || []).length); return; }
  const ROW = +(process.env.ROW || 4);
  console.log('tool', await tool('Pencil'));
  if (process.env.CLEAR) { await evaluate(`(() => { const vm = ${VM}; vm.$emit('input', vm.getPixels().map((r) => r.map(() => 0))); })()`); await sleep(500); }
  console.log('row', ROW, 'before', await ballRow(ROW));
  await stroke(ROW, 10, 12);
  console.log('3 cells -> value', await ballRow(ROW), 'editor', await editorRow(ROW));
  await stroke(ROW + 2, 20, 24);
  console.log('5 cells -> value', await ballRow(ROW + 2), 'editor', await editorRow(ROW + 2));
  console.log('tool', await tool('Eraser'));
  await stroke(ROW + 2, 27, 27);
  console.log('erase 27 -> value', await ballRow(ROW + 2), 'editor', await editorRow(ROW + 2));
  console.log('undo');
  await evaluate(`(${VM}).undo()`); await sleep(300);
  console.log('after undo', await ballRow(ROW + 2), 'editor', await editorRow(ROW + 2));
  console.log('tool', await tool('Pencil'));
  // (3) a long stroke
  await send('Profiler.enable'); await send('Profiler.setSamplingInterval', {interval: 200}); await send('Profiler.start');
  const t0 = Date.now();
  {
    const y = ROW + 1; let [px, py] = at(0, y);
    await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py});
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1, buttons: 1});
    for (let i = 0; i < 40; i++) { [px, py] = at(i % 48, y + (i % 3)); await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py, button: 'left', buttons: 1}); }
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1, buttons: 0});
    await evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  }
  console.log('40-move stroke ms', Date.now() - t0);
  { const prof = await send('Profiler.stop'); const nodes = prof.result.profile.nodes; const byId = new Map(nodes.map((n) => [n.id, n])); const self = new Map(); let total = 0; prof.result.profile.samples.forEach((id, i) => { const n = byId.get(id); const d = prof.result.profile.timeDeltas[i] || 0; total += d; const k = (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop() + ':' + (n.callFrame.lineNumber + 1); self.set(k, (self.get(k) || 0) + d); }); console.log('profile total ms', (total / 1000).toFixed(0)); [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log('  ' + (v / 1000).toFixed(1) + 'ms', k)); }
  await sleep(500);
  // (4) a picture pixel that is on, under a painted cell
  const probe = `(() => { const vm = ${VM}; const bd = vm.$el.querySelector('canvas.backdrop-canvas'); const pic = vm.$props.cellColors; let hit = null;
    const ball = vm.value || [];
    for (let y = 0; y < vm.editor.height && !hit; y++) for (let x = 0; x < 48 && !hit; x++) if (ball[y] && ball[y][x] && pic && pic[y] && pic[y][x]) hit = {x, y};
    if (!hit || !bd) return {hit, bd: !!bd};
    const d = bd.getContext('2d').getImageData(Math.floor((hit.x + 0.5) * bd.width / 48), Math.floor((hit.y + 0.5) * bd.height / vm.editor.height), 1, 1).data;
    return {hit, canvas: [...d.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join(''), picture: pic[hit.y][hit.x], ball: vm.$props.fgColor};
  })()`;
  console.log('ball mode probe', JSON.stringify(await evaluate(probe)));
  // out of Ball mode: the ball cells only on the cells that are off
  const hit = await evaluate(`(() => { const vm = ${VM}; const ball = vm.value; const out = []; return ball.map((row, y) => row.map((c, x) => (c ? [x, y] : null)).filter(Boolean)).flat(); })()`);
  await evaluate(`(() => { const i = document.querySelector('.v-icon.mdi-circle'); i.closest('button').click(); })()`);
  await sleep(1200);
  console.log('out of ball mode', await evaluate(`(() => {
    const vms = (() => { const out = []; const walk = (v) => { out.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__); return out; })().filter((v) => v && v.$props && v.$props.cellColors !== undefined && v.editor && v.editor.width === 48);
    const vm = vms.find((v) => v.$props.cellColors); if (!vm) return 'no ball cell colors';
    const bd = vm.$el.querySelector('canvas.backdrop-canvas'); const rows = vm.editor.height; const pic = vm.value;
    let bad = 0; let checked = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < 48; x++) {
      if (!pic[y] || !pic[y][x]) continue;
      const d = bd.getContext('2d').getImageData(Math.floor((x + 0.5) * bd.width / 48), Math.floor((y + 0.25) * bd.height / rows), 1, 1).data;
      const hex = '#' + [...d.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
      const halves = vm.$props.cellColors; const inBall = (halves[y] || [])[x];
      if (inBall) { checked++; if (hex === inBall) bad++; }
    }
    return 'picture pixels in the ball: ' + checked + ', drawn in the ball color: ' + bad;
  })()`));
};
