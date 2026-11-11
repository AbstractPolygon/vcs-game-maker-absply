module.exports = async (ctx) => {
  const {evaluate, sleep} = ctx;
  await require('./dragtest_open.cjs')(ctx);
  const S = "document.querySelector('.editor-sidebar .playfield-color-strip')";
  await evaluate(`(() => { const v = ${S}.__vue__; Object.defineProperty(v, 'paintColor', {get: () => null, configurable: true}); })()`);
  await evaluate(`${S}.scrollIntoView({block: 'center'})`); await sleep(300);
  await evaluate(`${S}.querySelectorAll('.row-swatch')[25].click()`);
  await sleep(800);
  console.log('open menus', await evaluate("document.querySelectorAll('.menuable__content__active').length"), 'menuRow', await evaluate(`${S}.__vue__.menuRow`),
    'menu at', await evaluate(`(() => { const m = document.querySelector('.menuable__content__active'); const r = m.getBoundingClientRect(); const s = ${S}.querySelectorAll('.row-swatch')[25].getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), 'row', Math.round(s.right), Math.round(s.y)].join(' '); })()`));
  await evaluate("document.querySelector('.menuable__content__active .palette-grid:last-of-type .palette-swatch:nth-child(20)').click()");
  await sleep(800);
  console.log('row 25 now', await evaluate(`${S}.__vue__.value[25].toString(16)`), 'open menus', await evaluate("document.querySelectorAll('.menuable__content__active').length"));
};
