// Drives a headless Chrome over the DevTools protocol to take the web page's screenshots of the app: a fresh profile (the default project), 960x540 at
// twice the pixel density (1920x1080), the same shape as the first round of screenshots.
const P = require('../lib/paths.cjs');
const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');
const CHROME = P.CHROME;
const APP = process.env.APP || 'http://localhost:8086/';
const OUT = process.env.OUT || P.OUT + '/shots';
const PROFILE = process.env.PROFILE || P.OUT + '/chrome-profile';
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

global.__chunks = [];
(async () => {
  fs.rmSync(PROFILE, {recursive: true, force: true});
  fs.mkdirSync(OUT, {recursive: true});
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--disable-gpu', '--window-size=1280,720', ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank'], {stdio: 'ignore'});
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.find((t) => t.type === 'page')) break;
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (m) => {
    const data = JSON.parse(m.data);
    if (data.method === 'HeapProfiler.addHeapSnapshotChunk') global.__chunks.push(data.params.chunk);
    if (data.method === 'Tracing.dataCollected') (global.__trace = global.__trace || []).push(...data.params.value);
    if (data.method === 'Tracing.tracingComplete') global.__traceDone = true;
    if (data.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION', JSON.stringify(data.params.exceptionDetails).slice(0, 1500));
    if (data.method === 'Runtime.consoleAPICalled' && (data.params.type === 'error' || data.params.type === 'warning')) console.log('PAGE ' + data.params.type, data.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 1500));
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({id: n, method, params}));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false});
  const steps = require(process.env.STEPS || './steps.cjs');
  await steps({send, evaluate, sleep, OUT, fs, path, APP});
  ws.close();
  chrome.kill();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
