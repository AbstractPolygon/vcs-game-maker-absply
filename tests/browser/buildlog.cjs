// Steps for cdp2c.cjs: loads VCSGM_PATH, builds it, and prints whether the build succeeded and the lines of the page that look like errors
// (the build log), the first 40.
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
  let text = '';
  for (let i = 0; i < 400; i++) { await sleep(500); text = await evaluate('document.body.innerText'); if (/Build succeeded|Build failed/i.test(text)) break; }
  console.log(/Build succeeded/i.test(text) ? 'BUILD SUCCEEDED' : /Build failed/i.test(text) ? 'BUILD FAILED' : 'NO RESULT');
  console.log(text.split('\n').filter((line) => /error|fail|unresolved|undefined|not found|warning/i.test(line)).slice(0, 40).join('\n'));
};
