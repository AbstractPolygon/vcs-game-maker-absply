// usage: node tests/projects/mkscorefade.cjs -> tests/projects/score_dpc_fade.vcsgm and score_dpc_flat.vcsgm: the DPC+ score project of
// mkscore.cjs (123456 from the start) with the score color $4E, with and without Score fade shading (enableScoreFade), for checking that
// the DPC+ score lines get one color less each line down with it (utils/dpc-score-colors.js) and one color without it.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const base = yaml.load(fs.readFileSync(path.join(__dirname, 'score_dpc.vcsgm'), 'utf8'));
for (const [name, fade] of [['score_dpc_fade', true], ['score_dpc_flat', false]]) {
  const doc = JSON.parse(JSON.stringify(base));
  doc.configuration = {...doc.configuration, projectTitle: name, scoreColor: 0x4E, enableScoreFade: fade};
  delete doc.configuration.dpcPlusScoreColors;
  const out = path.join(__dirname, `${name}.vcsgm`);
  fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
  console.log(out);
}
