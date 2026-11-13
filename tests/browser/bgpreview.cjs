// STEPS module for cdp2c.cjs: loads VCSGM_PATH, opens the Playfield tab and clicks the Test button of background card BG_CARD (1 = the first card shown),
// then prints whether the preview built and the error lines. With ROMOUT the preview ROM is saved (and the symbols / assembly with the hooks on).
// usage (from tests/browser): VCSGM_PATH=... BG_CARD=1 [ROMOUT=...] STEPS=./bgpreview.cjs node cdp2c.cjs
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
  await evaluate(`location.hash = '#/background'`);
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await evaluate("[...document.querySelectorAll('button')].filter((b) => /Test this background/.test(b.title)).length")) break; }
  await sleep(1500);
  const page = +(process.env.BG_CARD || 1);
  const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].filter((b) => /Test this background/.test(b.title))[${page - 1}]; if (!b) return false; b.click(); return true; })()`);
  if (!clicked) { console.log('NO TEST BUTTON for card', page); return; }
  let text = '';
  for (let i = 0; i < 400; i++) { await sleep(500); text = await evaluate('document.body.innerText'); if (/Preview build succeeded|Preview build failed|Error while (compiling|generating)/i.test(text)) break; }
  await sleep(1000);
  text = await evaluate('document.body.innerText');
  console.log(/Error while (compiling|generating)/i.test(text) ? 'PREVIEW FAILED' : /Preview build succeeded/i.test(text) ? 'PREVIEW SUCCEEDED' : 'NO RESULT');
  console.log(text.split('\n').filter((line) => /error|fail|reverse|estimated|bytes|unresolved/i.test(line)).slice(0, 20).join('\n'));
  if (process.env.ROMOUT) {
    const base64 = await evaluate("sessionStorage.getItem('vcsgm-last-loaded-rom')");
    if (base64) fs.writeFileSync(process.env.ROMOUT, Buffer.from(base64, 'base64'));
    const sym = await evaluate("window.__vcsSymText || ''"); if (sym) fs.writeFileSync(process.env.ROMOUT.replace(/\.bin$/, '.sym.txt'), sym);
    const asmText = await evaluate("window.__vcsAsm || ''"); if (asmText) fs.writeFileSync(process.env.ROMOUT.replace(/\.bin$/, '.asm.txt'), asmText);
    const bb = await evaluate("window.__vcsBb || ''"); if (bb) fs.writeFileSync(process.env.ROMOUT.replace(/\.bin$/, '.bb.txt'), bb);
  }
};
