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
  await evaluate(`(() => { const btn = [...document.querySelectorAll('button')].find((b) => /update rom/i.test(b.textContent)); if (btn) btn.click(); return 1; })()`);
  for (let i = 0; i < 400; i++) { await sleep(500); const tx = await evaluate('document.body.innerText'); if (/Build succeeded|Build failed/i.test(tx)) break; }
  await sleep(1500);
  const base64 = await evaluate("sessionStorage.getItem('vcsgm-last-loaded-rom')");
  if (base64) fs.writeFileSync(process.env.ROMOUT, Buffer.from(base64, 'base64'));
  const sym = await evaluate("window.__vcsSymText || ''"); const asmText = await evaluate("window.__vcsAsm || ''"); if (asmText) fs.writeFileSync(process.env.ROMOUT.replace(/.bin$/, '.asm.txt'), asmText);
  if (sym) fs.writeFileSync(process.env.ROMOUT.replace(/\.bin$/, '.sym.txt'), sym);
  // (The bB text, with tests/hooks/hook_bb.cjs on.)
  const bb = await evaluate("window.__vcsBb || ''");
  if (bb) fs.writeFileSync(process.env.ROMOUT.replace(/\.bin$/, '.bb.txt'), bb);
  console.log('saved', !!base64, sym.length);
};
