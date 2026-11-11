// Steps for cdp2c.cjs: opens VCSGM_PATH, goes to ROUTE, opens the cards; takes $46 into the draw color, selects TOOL (default Pencil), then drags
// with the mouse down the first strip beside a picture from row FROM to row TO (real mouse events, so mouseenter fires on each row), and prints
// the strip's colors for those rows and the picture's on-pixel colors, with the time the drag took.
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
  const from = +(process.env.FROM || 5); const to = +(process.env.TO || 20);
  if (process.env.NOTAKE !== '1') await evaluate(`document.querySelector('.editor-sidebar .playfield-color-strip').__vue__.handleTake(0x46)`);
  const tool = process.env.TOOL || 'Pencil';
  console.log('tool', await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('${tool}')); b.click(); return b.getAttribute('title'); })()`));
  await evaluate("document.querySelector('.editor-sidebar .playfield-color-strip').scrollIntoView({block: 'center'})");
  await sleep(500);
  const rects = await evaluate(`(() => { const s = document.querySelector('.editor-sidebar .playfield-color-strip'); return [...s.querySelectorAll('.row-swatch')].map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); })()`);
  const t0 = Date.now();
  await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: rects[from][0], y: rects[from][1]});
  await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: rects[from][0], y: rects[from][1], button: 'left', clickCount: 1, buttons: 1});
  for (let row = from + 1; row <= to; row++) await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: rects[row][0], y: rects[row][1], button: 'left', buttons: 1});
  await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: rects[to][0], y: rects[to][1], button: 'left', clickCount: 1, buttons: 0});
  await evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  console.log('drag ms', Date.now() - t0);
  await sleep(800);
  console.log('strip rows', await evaluate(`(() => { const vm = document.querySelector('.editor-sidebar .playfield-color-strip').__vue__; return vm.value.slice(${from - 1}, ${to + 2}).map((c) => c.toString(16)).join(' '); })()`));
  console.log('open menus', await evaluate("document.querySelectorAll('.menuable__content__active').length"));
};
