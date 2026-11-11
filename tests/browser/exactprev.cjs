module.exports = async (ctx) => {
  const {evaluate, sleep} = ctx;
  await require('./dragtest_open.cjs')(ctx);
  await sleep(1000);
  console.log(await evaluate(`(() => { const out = []; const walk = (v) => { out.push(v); v.$children.forEach(walk); }; walk(document.querySelector('#inspire').__vue__);
    return out.filter((v) => v.$props && v.$props.cellColors && v.editor).map((v) => { const c = v.$props.cellColors; const rows = v.editor.height; let same = 0;
      for (let y = 0; y < rows; y++) if ((c[2 * y] || []).join() === (c[2 * y + 1] || []).join()) same++;
      return rows + ' rows, halves equal in ' + same; }).join(' | '); })()`));
};
