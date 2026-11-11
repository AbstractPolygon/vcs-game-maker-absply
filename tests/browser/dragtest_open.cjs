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
  await evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('Pencil')); b.click(); })()");
};
