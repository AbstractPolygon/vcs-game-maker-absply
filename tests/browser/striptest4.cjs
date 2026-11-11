// Steps for cdp2c.cjs: opens VCSGM_PATH, goes to ROUTE, opens the cards; on the first picture with a color strip beside it, sets row ROW's color to
// $46 in the strip (so the row's color is known), then draws a stroke across that row with the Pencil, and prints the row's colors in the strip,
// the picture canvas and its backdrop canvas after each step.
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
  const row = +(process.env.ROW || 20);
  const parts = "const strip = document.querySelector('.editor-sidebar .playfield-color-strip'); const box = strip.closest('.editor-with-sidebar');" +
    " const ed = box.querySelector('canvas.editor-canvas:not(.backdrop-canvas)'); const bd = box.querySelector('canvas.backdrop-canvas');";
  const probe = `(() => { ${parts}
    const sc = strip.querySelector('canvas.strip-paint'); const rows = strip.querySelectorAll('.row-swatch').length;
    const sd = sc.getContext('2d').getImageData(0, Math.floor((${row} + 0.5) * sc.height / rows), 1, 1).data;
    const cells = new Set(); for (let x = 0; x < ed.width; x++) { const d = ed.getContext('2d').getImageData(x, ${row}, 1, 1).data; cells.add(d.slice(0, 3).join(',')); }
    const bcells = new Set(); if (bd) for (let x = 0; x < ed.width; x++) { const d = bd.getContext('2d').getImageData(Math.floor((x + 0.5) * bd.width / ed.width), Math.floor((${row} + 0.5) * bd.height / ed.height), 1, 1).data; bcells.add(d.slice(0, 3).join(',')); }
    return {strip: sd.slice(0, 3).join(','), picture: [...cells].join(' | '), backdrop: bd ? [...bcells].join(' | ') : 'none'};
  })()`;
  console.log('before', JSON.stringify(await evaluate(probe)));
  await evaluate(`document.querySelector('.editor-sidebar .playfield-color-strip').__vue__.handleTake(0x46)`);
  console.log('tool', await evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('Pencil')); b.click(); return b.getAttribute('title'); })()"));
  await sleep(300);
  await evaluate(`document.querySelector('.editor-sidebar .playfield-color-strip').querySelectorAll('.row-swatch')[${row}].click()`);
  await sleep(1000);
  console.log('row color set', JSON.stringify(await evaluate(probe)));
  await evaluate(`(() => { ${parts} ed.scrollIntoView({block: 'center'}); })()`);
  await sleep(500);
  const r = await evaluate(`(() => { ${parts} const rc = ed.getBoundingClientRect(); return {x: rc.x, y: rc.y, w: rc.width, h: rc.height, rows: ed.height}; })()`);
  const y = r.y + (row + 0.5) * r.h / r.rows;
  await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: r.x + 3, y});
  await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: r.x + 3, y, button: 'left', clickCount: 1, buttons: 1});
  for (let i = 0; i <= 20; i++) await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: r.x + 3 + (r.w - 6) * i / 20, y, button: 'left', buttons: 1});
  await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: r.x + r.w - 3, y, button: 'left', clickCount: 1, buttons: 0});
  await sleep(1000);
  console.log('after stroke', JSON.stringify(await evaluate(probe)));
};
