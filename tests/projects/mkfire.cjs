// usage: node tests/projects/mkfire.cjs -> tests/projects/fire_<kernel>_<mode>_<variant>.vcsgm (kernel std, dpc, pxe; mode 8, 16 or any, the direction
// choice of the Fire block; variant: the angle set of any direction a, b, c, d, or for 8 and 16: plain, pf (check playfield + same speed) and bounce
// (Bounce off screen edges every frame; the any ones also b8, b16 are not made)). Gameplay start fires Missile 0, Missile 1 and the ball from the middle
// of the screen (with the playfield check after a Run once that clears the playfield) at the angles and speeds of the variant. tests/emulator/firetrace.cjs reads the positions of the three each frame. Made from the tv_ score projects of mkpal.cjs.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const bases = {std: 'tv_std_score_ntsc.vcsgm', dpc: 'tv_dpc_score_ntsc.vcsgm', pxe: 'tv_pxe_score_ntsc.vcsgm'};
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const chain = (blocks) => blocks.reduceRight((next, block) => (next ? block.replace(/<\/block>$/, `<next>${next}</next></block>`) : block), '');
const fire = (object, angle, speed, mode, pf, y = 96) => `<block type="sprite_missile_fire"><field name="MISSILE">${object}</field>` +
  `<field name="DIRECTIONS16">${{8: 'FALSE', 16: 'TRUE', any: 'ANY'}[mode]}</field><field name="EVENSPEED">${pf === 'pf' && mode !== 'any' ? 'TRUE' : 'FALSE'}</field><field name="PFCHECK">${pf === 'pf' ? 'TRUE' : 'FALSE'}</field>` +
  `<value name="X">${num(80)}</value><value name="Y">${num(y)}</value><value name="ANGLE">${num(angle)}</value><value name="SPEED">${num(speed)}</value></block>`;
const bounce = (object) => `<block type="object_bounce"><field name="OBJECT">${object}</field><field name="EDGES">TRUE</field><value name="SPREAD_STEPS">${num(1)}</value><value name="ANGLE">${num(0)}</value></block>`;
// [object, angle, speed] for the three objects
const sets = {
  8: {plain: [['0', 1, 2], ['1', 3, 3], ['ball', 6, 1]]},
  16: {plain: [['0', 3, 2], ['1', 5, 3], ['ball', 13, 1]]},
  any: {
    a: [['0', 0, 1], ['1', 16, 2], ['ball', 32, 3]],
    b: [['0', 64, 4], ['1', 100, 5], ['ball', 128, 6]],
    c: [['0', 200, 7], ['1', 45, 2], ['ball', 250, 3]],
    d: [['0', 255, 5], ['1', 1, 3], ['ball', 192, 1]],
    e: [['0', 20, 1], ['1', 76, 2], ['ball', 150, 3]],
  },
};
sets[8].pf = sets[8].plain;
sets[8].bounce = [['0', 1, 3], ['1', 3, 2], ['ball', 6, 4]];
sets[16].pf = sets[16].plain;
sets[16].bounce = [['0', 3, 3], ['1', 5, 2], ['ball', 13, 4]];
sets.any.pf = sets.any.a;
sets.any.bounce = [['0', 20, 3], ['1', 100, 2], ['ball', 230, 4]];
sets.any.pfb = sets.any.c;
// pfs: the playfield check with the shots made at Gameplay start (the floor of the playfield is in the way): for comparing a ROM built before a change of the Fire code.
sets[8].pfs = sets[8].plain;
sets[16].pfs = sets[16].plain;
// wall: the ball checks the playfield and bounces off a wall (a vertical line of the playfield at column 25, rows 0 to 10; the ball starts left of it
// and goes right, from y 40), the playfield bounce of the heading (the Bounce runs while the ball is within a few pixels of the wall: the hardware collision of
// the ball and the playfield is not seen in the standard and PXE kernels with this setup). wall2: a floor (a horizontal line at row 6, columns 0 to 31) for a ball that goes down, from y 24.
sets.any.wall = [['ball', 80, 2]];
sets.any.wall2 = [['ball', 100, 2]];
sets[16].wall = [['ball', 5, 2]];
sets[8].wall = [['ball', 2, 2]];
const names = {0: 'missile0', 1: 'missile1', ball: 'ball'};
for (const [kernel, base] of Object.entries(bases)) {
  for (const [mode, variants] of Object.entries(sets)) {
    for (const [variant, objects] of Object.entries(variants)) {
      const doc = yaml.load(fs.readFileSync(path.join(__dirname, base), 'utf8'));
      doc.configuration = {...doc.configuration, projectTitle: `Fire ${kernel} ${mode} ${variant}`, showScore: false};
      const wall = /^wall/.test(variant);
      const pf = variant === 'pf' || variant === 'pfb' || variant === 'pfs' || wall ? 'pf' : '';
      if (process.argv[2] && !process.argv.slice(2).includes(variant)) continue;
      const fires = objects.map(([o, a, s]) => fire(o, a, s, mode, pf, variant === 'wall2' ? 24 : wall ? 40 : 96));
      const line = (dir, len, x, y) => `<block type="background_change_hv_line"><field name="DIRECTION">${dir}</field><field name="OPERATION">on</field><value name="LENGTH">${num(len)}</value><value name="X">${num(x)}</value><value name="Y">${num(y)}</value></block>`;
      const wallBlocks = !wall ? [] : variant === 'wall2' ? [line('pfhline', 32, 0, 6)] : [line('pfvline', 11, 25, 0)];
      const bounceOnWall = `<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">GTE</field><value name="A"><block type="sprite_ball_get"><field name="VAR">${variant === 'wall2' ? 'bally' : 'ballx'}</field></block></value><value name="B">${num(variant === 'wall2' ? 44 : 116)}</value></block></value>` +
        `<statement name="DO0">${bounce('ball').replace('<field name="EDGES">TRUE</field>', '<field name="EDGES">FALSE</field>')}</statement></block>`;
      // (With the playfield check the playfield is cleared first, in a Run once of Gameplay update: the project's background is loaded after Gameplay start.)
      const start = pf && variant !== 'pfs' ? '' : chain(fires);
      const update = pf && variant !== 'pfs' ? chain([`<block type="event_run_once"><statement name="DO">${chain(['<block type="background_clear"></block>', ...wallBlocks, ...(wall ? [`<block type="sprite_ball_set"><field name="VAR">ballheight</field><value name="VALUE">${num(4)}</value></block>`] : []), ...fires])}</statement></block>`, ...(wall ? [bounceOnWall] : [])]) :
        variant === 'bounce' ? chain(objects.map(([o]) => bounce(names[o]))) : '<block type="event_comment"><field name="TEXT">x</field></block>';
      doc['blockly-workspace'] = '<xml xmlns="https://developers.google.com/blockly/xml">' +
        `<block type="event_block" id="ev0" x="20" y="20"><field name="EVENT">gameplay_start</field><statement name="DO">${start}</statement></block>` +
        `<block type="event_block" id="ev1" x="20" y="400"><field name="EVENT">gameplay_update</field><statement name="DO">${update}</statement></block></xml>`;
      const out = `fire_${kernel}_${mode}_${variant}.vcsgm`;
      fs.writeFileSync(path.join(__dirname, out), yaml.dump(doc, {lineWidth: -1}));
      console.log(out);
    }
  }
}
