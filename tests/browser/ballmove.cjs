// Steps for cdp2c.cjs: opens VCSGM_PATH (tests/projects/ballrows_colors.vcsgm: card 6 of screen 0 has the ball on rows 4 to 40, columns 10-11
// on even rows and 16-17 on odd ones, a ball color a row), Title tab, out of Ball mode: a rectangle marquee over columns 6 to 22 and rows 4 to
// 20, then the Move tool drags it 5 columns right and 3 rows down. Prints the ball cells of rows 4, 5, 7 and 22 and the ball colors of rows
// 4 and 7 after the move, after Undo and after Redo (the user, 2026-11-23: the marquee and Move take the ball rows along).
// Expected after the move: rows 4..20 of the ball gone from their rows and at row + 3, 5 columns right (row 7: 15,16 from row 4; row 23 from
// row 20), rows 21..40 where they were; the colors of rows 4..20 at row + 3. Undo: as loaded; Redo: as after the move.
module.exports = async ({send, evaluate, sleep, APP}) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `if (!sessionStorage.__t) { sessionStorage.__t = '1'; localStorage.clear(); localStorage.setItem('vcs-game-maker.showStartupTips','false'); }`});
  await send('Page.navigate', {url: APP + '#/project'});
  for (let i = 0; i < 40; i++) {
    await sleep(1000); if (await evaluate('[...document.querySelectorAll(\'button\')].some((b) => /update rom|rom up to date/i.test(b.textContent))')) break;
  }
  await sleep(2000);
  const doc = await send('DOM.getDocument', {depth: -1});
  const found = await send('DOM.querySelectorAll', {nodeId: doc.result.root.nodeId, selector: 'input[type=file]'});
  await send('DOM.setFileInputFiles', {nodeId: found.result.nodeIds[0], files: [process.env.VCSGM_PATH]});
  await sleep(4000);
  await send('Page.navigate', {url: APP + '#/titlescreen'});
  await sleep(6000);
  for (let k = 0; k < 3; k++) {
    await evaluate('[...document.querySelectorAll(\'.v-icon.mdi-chevron-down\')].forEach((i) => { const b = i.closest(\'button\'); if (b) b.click(); })'); await sleep(1200);
  }
  // The frame editor of the ball's card: the PixelEditor that listens to move-cells and has 48 columns and more than 30 rows.
  const VM = `(() => { const out = []; const walk = (v) => { out.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__); return out; })().find((v) => v && v.$listeners && v.$listeners['move-cells'] && v.editor && v.editor.width === 48 && v.editor.height > 30)`;
  console.log('editor found', await evaluate(`!!(${VM})`));
  await evaluate(`(${VM}).$el.scrollIntoView({block: 'center'})`);
  await sleep(600);
  let g = await evaluate(`(() => { const vm = ${VM}; const c = vm.$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)'); const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, rows: vm.editor.height}; })()`);
  const at = (x, y) => [g.x + (x + 0.5) * g.w / 48, g.y + (y + 0.5) * g.h / g.rows];
  const drag = async (x0, y0, x1, y1) => {
    g = await evaluate(`(() => { const vm = ${VM}; const c = vm.$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)'); const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, rows: vm.editor.height}; })()`);
    let [px, py] = at(x0, y0);
    await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py});
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1, buttons: 1});
    for (let k = 1; k <= 8; k++) {
      [px, py] = at(x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8); await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py, button: 'left', buttons: 1}); await sleep(30);
    }
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1, buttons: 0});
    await sleep(500);
  };
  const button = async (value) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((el) => el.getAttribute('value') === '${value}'); if (b) b.click(); return !!b; })()`);
  const titled = async (start) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((el) => (el.getAttribute('title') || '').startsWith('${start}')); if (b) b.click(); return !!b; })()`);
  // (Activate the frame: the toolbar acts on the frame clicked last.)
  // (Select the card (as a click on it does), then the frame: the toolbar acts on the frame of the card selected.)
  console.log('card selected', await evaluate(`(() => { const all = []; const walk = (v) => { all.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__); const t = all.find((v) => typeof v.selectCard === 'function' && typeof v.handleMoveBall === 'function'); const screen = JSON.parse(localStorage.getItem('vcs-game-maker.titleScreen')).screens[0]; t.selectCard(6, screen.id); return !!t; })()`));
  await sleep(400);
  await evaluate(`(${VM}).handleActivate()`);
  await sleep(500);
  const state = async (label) => {
    await sleep(1200);
    const v = await evaluate(`(() => { const t = JSON.parse(localStorage.getItem('vcs-game-maker.titleScreen')); const card = t.screens[0].cards.find((c) => c.id === 6); const f = card.frames[0];
      const ball = typeof f.ballPixels === 'string' ? f.ballPixels.split(String.fromCharCode(10)).map((r) => r.split('').map((ch) => (ch === 'X' ? 1 : 0))) : f.ballPixels;
      const row = (y) => (ball[y] || []).map((c, x) => (c ? x : -1)).filter((x) => x >= 0).join(',');
      return [4, 5, 7, 20, 22, 23].map((y) => y + ':' + row(y)).join(' ') + ' | colors 4:' + (f.ballColors || [])[4] + ' 7:' + (f.ballColors || [])[7] + ' 23:' + (f.ballColors || [])[23]; })()`);
    console.log(label.padEnd(8), v);
  };
  // (The canvas's top 150 pixels down: the app bar is fixed over the top 72.)
  await evaluate(`(() => { const c = (${VM}).$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)'); c.scrollIntoView({block: 'start'}); let e = c.parentElement; while (e && !(e.scrollHeight > e.clientHeight && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement; (e || document.scrollingElement).scrollTop -= 150; return true; })()`);
  await sleep(600);
  g = await evaluate(`(() => { const vm = ${VM}; const c = vm.$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)'); const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, rows: vm.editor.height}; })()`);
  if (process.env.DEBUG) console.log('geo', JSON.stringify(g), await evaluate(`JSON.stringify([innerWidth, innerHeight, ...[...document.querySelectorAll('.v-toolbar')].map((t) => { const r = t.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), getComputedStyle(t).position]; })])`));
  await state('loaded');
  if (process.env.DEBUG) await evaluate(`(() => { const vm = ${VM}; window.__mc = []; vm.$on('move-cells', (m) => window.__mc.push(JSON.stringify({...m, cells: m.cells && m.cells.length}))); window.__pic0 = JSON.stringify(vm.getPixels()); return true; })()`);
  if (process.env.DEBUG) console.log('buttons', await evaluate(`[...document.querySelectorAll('button')].filter((el) => el.getAttribute('value') === 'rect-select').map((b) => b.disabled + ' ' + b.offsetParent + ' ' + b.className.slice(0, 40)).join(' | ')`));
  console.log('marquee', await button('rect-select'));
  await sleep(300);
  if (process.env.DEBUG) console.log('under', await evaluate(`(() => { const [x, y] = [${at(6, 4)}]; const e = document.elementFromPoint(x, y); return e.tagName + '.' + e.className + ' same=' + (e === (${VM}).$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)')) + ' tool=' + (${VM}).toggledTool; })()`));
  await drag(6, 4, 22, 20);
  if (process.env.DEBUG) console.log('after marquee', await evaluate(`(() => { const vm = ${VM}; return vm.selection ? vm.selection.size : null; })()`));
  console.log('move', await button('move'));
  await sleep(300);
  await drag(16, 5, 21, 8);
  if (process.env.DEBUG) console.log('debug', await evaluate(`(() => { const vm = ${VM}; return {sel: vm.selection ? vm.selection.size : null, tool: vm.toggledTool, events: window.__mc.slice(0, 4).concat(window.__mc.slice(-2)), n: window.__mc.length, picChanged: JSON.stringify(vm.getPixels()) !== window.__pic0}; })()`));
  await state('moved');
  console.log('undo', await titled('Undo'));
  await state('undo');
  console.log('redo', await titled('Redo'));
  await state('redo');
};
