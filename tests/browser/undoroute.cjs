// Undo after a tab change made by the router, as a click on a tab makes it (pushState, no hashchange): loads VCSGM_PATH on #/project, opens TAB
// through the router (NAV=1: by its address instead; FOLDER: a folder of the Sprites tab to open), expands the cards, then a pencil and an
// eraser stroke in the middle rows of the first canvas shown, Undo x2 and Redo x2 with the toolbar buttons; prints the picture's hash after
// each and ok when it is the one of the step expected, and the tab the undo list takes as shown (before the fix of 2026-11-25 the tab the
// page was loaded on, and Undo did nothing). SHOT=file.png: a screenshot after the cards are opened. (A stroke over pixels already on
// changes nothing and is no step: the Redo after it then shows the next one.)
const fs = require('fs');
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
  const TAB = process.env.TAB || 'player';
  if (process.env.NAV) await send('Page.navigate', {url: APP + '#/' + TAB});
  else await evaluate(`(() => { document.querySelector('#inspire').__vue__.$router.push('/${TAB}'); return 1; })()`);
  await sleep(8000);
  if (process.env.FOLDER) {
    console.log('folder', await evaluate('(() => { const e = [...document.querySelectorAll(\'button, a, span, div\')].filter((x) => x.offsetParent && x.textContent.trim() === \'' + process.env.FOLDER + '\' && x.children.length <= 2).pop(); if (!e) return false; (e.closest(\'button\') || e).click(); return true; })()')); await sleep(3000);
  }
  for (let k = 0; k < 2; k++) {
    console.log('  chevrons', await evaluate('document.querySelectorAll(\'.v-icon.mdi-chevron-down\').length + \' down, \' + document.querySelectorAll(\'.v-icon.mdi-chevron-up\').length + \' up, \' + document.querySelectorAll(\'canvas\').length + \' canvases\''));
    await evaluate('[...document.querySelectorAll(\'.v-icon.mdi-chevron-down\')].forEach((i) => { const b = i.closest(\'button\'); if (b) b.click(); })');
    await sleep(2500);
  }
  if (process.env.SHOT) {
    const sh = await send('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(process.env.SHOT, Buffer.from(sh.result.data, 'base64'));
  }
  console.log('hash', await evaluate('location.hash'), 'list route', await evaluate('window.__vcsgmTabUndo && window.__vcsgmTabUndo.route.value'));
  const ALL = `(() => { const out = []; const walk = (v) => { out.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__); return out; })()`;
  const ED = `${ALL}.filter((v) => v.editor && typeof v.hookTabHistory === 'function' && v.$el.offsetParent && !v.outsideHistory && !v.noDrawing && !v.stamp)[0]`;
  console.log('editor', await evaluate(`!!(${ED})`), await evaluate(`(() => { const l = ${ALL}.filter((v) => typeof v.hookTabHistory === 'function'); return l.length + ' pixel editors, ' + l.filter((v) => v.editor).length + ' with editor, ' + l.filter((v) => v.$el.offsetParent).length + ' shown, ' + l.filter((v) => v.outsideHistory || v.noDrawing || v.stamp).length + ' outside/nodraw/stamp'; })()`));
  const hash = async () => evaluate(`(() => { const vm = ${ED}; if (!vm) return 'gone'; const p = vm.getPixels(); let h = 0; p.flat().forEach((c, k) => { if (c) h = (h * 31 + k + 1) % 1000003; }); return p.length + 'r/' + p.flat().filter(Boolean).length + 'on/' + h; })()`);
  const tool = async (name) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((el) => el.getAttribute('value') === '${name}' && el.offsetParent); if (b) b.click(); return !!b; })()`);
  const titled = async (start) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((el) => (el.getAttribute('title') || '').startsWith('${start}') && el.offsetParent); if (!b) return 'none'; if (b.disabled) return 'disabled'; b.click(); return 'clicked'; })()`);
  const stroke = async (x0, y0, x1, y1) => {
    await evaluate(`(${ED}).$el.scrollIntoView({block: 'center'})`); await sleep(400);
    const g = await evaluate(`(() => { const vm = ${ED}; const c = vm.$el.querySelector('canvas.editor-canvas:not(.backdrop-canvas)') || vm.$refs.editor; const r = c.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, cols: vm.editor.width, rows: vm.editor.height}; })()`);
    const mid = Math.floor(g.rows / 2); const at = (x, y) => [g.x + (x + 0.5) * g.w / g.cols, g.y + (y + mid + 0.5) * g.h / g.rows];
    let [px, py] = at(x0, y0);
    console.log('  hit', await evaluate(`(() => { const h = document.elementFromPoint(${px}, ${py}); return h && h.tagName + '.' + String(h.className).slice(0, 50); })()`));
    await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py});
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1, buttons: 1});
    for (let k = 1; k <= 6; k++) {
      [px, py] = at(x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6);
      await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: px, y: py, button: 'left', buttons: 1}); await sleep(30);
    }
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1, buttons: 0});
    await sleep(900);
  };
  const s0 = await hash(); console.log('loaded ', s0);
  await tool('pencil'); await stroke(0, 0, 6, 3); const s1 = await hash(); console.log('pencil ', s1);
  await tool('eraser'); await stroke(0, 1, 6, 1); const s2 = await hash(); console.log('eraser ', s2);
  let r = await titled('Undo'); await sleep(900); const u1 = await hash(); console.log('undo   ', u1, r, u1 === s1 ? 'ok' : 'WRONG');
  r = await titled('Undo'); await sleep(900); const u2 = await hash(); console.log('undo   ', u2, r, u2 === s0 ? 'ok' : 'WRONG');
  r = await titled('Redo'); await sleep(900); const r1 = await hash(); console.log('redo   ', r1, r, r1 === s1 ? 'ok' : 'WRONG');
  r = await titled('Redo'); await sleep(900); const r2 = await hash(); console.log('redo   ', r2, r, r2 === s2 ? 'ok' : 'WRONG');
};
