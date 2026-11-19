// usage: node tests/projects/mkterrain.cjs -> tests/projects/terrain_<kernel>_<side>.vcsgm (std and dpc: bottom, top, left and right; pxe: bottom and
// right): a Run once block of Gameplay update clears the playfield and makes terrain on that side, up to 5 pixels deep (the Generate terrain block of
// Playfield > Utility > Draw); pressing Fire makes new terrain. Made from the tv_ score projects of mkpal.cjs. tests/emulator/terraincmp.cjs checks the
// standard kernel's playfield.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bases = {std: 'tv_std_score_ntsc.vcsgm', dpc: 'tv_dpc_score_ntsc.vcsgm', pxe: 'tv_pxe_score_ntsc.vcsgm'};
const sidesOf = {std: ['bottom', 'top', 'left', 'right'], dpc: ['bottom', 'top', 'left', 'right'], pxe: ['bottom', 'right']};
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => block.replace(/<\/block>$/, next ? `<next>${next}</next></block>` : '</block>'), '');
const terrain = (side, rough = 2, least = 3, most = 6, over = 0) => `<block type="background_generate_terrain"><field name="SIDE">${side.toUpperCase()}</field>` +
  `<value name="MIN">${num(least)}</value><value name="MAX">${num(most)}</value><value name="ROUGH">${num(rough)}</value><value name="OVER">${num(over)}</value></block>`;
const fire = '<block type="input_joystick_get"><field name="JOYSTICK">0</field><field name="VAR">joy0fire</field></block>';
// (The standard kernel's bottom also with roughness 0 and 4, heights 2 to 3, overhangs, and the seeds 7 and 9; the left with heights 4 to 8.)
const seedBlock = (seed) => `<block type="random_seed_set"><value name="SEED">${num(seed)}</value></block>`;
// [side, roughness, name, least height, most height, overhangs, seed]
const variants = (kernel) => [...sidesOf[kernel].map((side) => [side, 2, side, 3, 6, 0, 0]), ...(kernel !== 'pxe' ? [['bottom', 0, 'bottom_r0', 3, 6, 0, 0], ['bottom', 4, 'bottom_r4', 3, 6, 0, 0], ['bottom', 2, 'bottom_h23', 2, 3, 0, 0], ['left', 2, 'left_h48', 4, 8, 0, 0], ['bottom', 5, 'bottom_over4', 3, 10, 4, 0], ['bottom', 2, 'bottom_seed7', 3, 6, 0, 7], ['bottom', 2, 'bottom_seed9', 3, 6, 0, 9]] : [])];
const done = '<block type="controls_if"><value name="IF0"><block type="background_generate_terrain_done"></block></value><statement name="DO0"><block type="score_set"><value name="VALUE">' + num(777) + '</value></block></statement></block>';
for (const [kernel, base] of Object.entries(bases)) {
  for (const [side, rough, name, least, most, over, seed] of variants(kernel)) {
    const doc = yaml.load(fs.readFileSync(path.join(__dirname, base), 'utf8'));
    doc.configuration = {...doc.configuration, projectTitle: `Terrain ${kernel} ${side}`, showScore: true};
    const make = chain([...(seed ? [seedBlock(seed)] : []), '<block type="background_clear"></block>', terrain(side, rough, least, most, over)]);
    doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
      '<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_update</field><statement name="DO">' +
      `<block type="event_run_once"><statement name="DO">${make}</statement><next>` +
      `<block type="controls_if"><value name="IF0">${fire}</value><statement name="DO0">${make}</statement><next>${done}</next></block></next></block>` +
      '</statement></block></xml>';
    const out = path.join(__dirname, `terrain_${kernel}_${name}.vcsgm`);
    fs.writeFileSync(out, yaml.dump(doc, {lineWidth: -1}));
    console.log(path.basename(out));
  }
}
