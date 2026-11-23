// usage: node tests/projects/mkfirethrottle.cjs -> tests/projects/firethrottle_<std|dpc|pxe>_<same|mixed>.vcsgm from fire_<kernel>_8_plain.vcsgm. In Gameplay update an Every 4 frames
// block has, under If gState = 0 (then gState = 1), a Fire block for the ball with throttle movement (x 20, y 50, angle 2 (right), speed 1): the ball moves a pixel every 4 frames. same: that is the
// only Fire block of the ball (the interval is a constant, the throttle one byte, the countdown). mixed: a second Fire block of the ball, without throttle movement, under
// If ball x > 60 and gState = 1 (then gState = 2), fires it back left (angle 6, speed 1, from x 60): it then moves every frame (the throttle byte keeps the countdown in its low nibble and the interval in
// the high one). tests/emulator/picsame.cjs compares the pictures with a build of the code before the packing (the ball where it was, frame by frame).
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
const num = (n) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const fire = (throttle, x, angle) => `<block type="sprite_missile_fire"><field name="MISSILE">ball</field><field name="DIRECTIONS16">FALSE</field><field name="EVENSPEED">FALSE</field>` +
  `<field name="PFCHECK">FALSE</field><field name="THROTTLE">${throttle ? 'TRUE' : 'FALSE'}</field><value name="X">${x}</value><value name="Y">${num(50)}</value>` +
  `<value name="ANGLE">${num(angle)}</value><value name="SPEED">${num(1)}</value></block>`;
const gState = '<block type="variables_get"><field name="VAR" id="gs">gState</field></block>';
const cmp = (op, a, b) => `<block type="logic_compare"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const setState = (n) => `<block type="variables_set"><field name="VAR" id="gs">gState</field><value name="VALUE">${num(n)}</value></block>`;
const once = (state, body) => `<block type="controls_if"><value name="IF0">${cmp('EQ', gState, num(state))}</value><statement name="DO0">${setState(state + 1).replace(/<\/block>$/, `<next>${body}</next></block>`)}</statement></block>`;
const every4 = `<block type="event_frame_every_n"><field name="MASK">3</field><statement name="DO">${once(0, fire(true, num(20), 2))}</statement></block>`;
const ballX = '<block type="sprite_ball_get"><field name="VAR">ballx</field></block>';
const back = `<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">GT</field><value name="A">${ballX}</value><value name="B">${num(60)}</value></block></value>` +
  `<statement name="DO0">${once(1, fire(false, num(60), 6))}</statement></block>`;
const event = (name, id, y, body) => `<block type="event_block" id="${id}" x="20" y="${y}"><field name="EVENT">${name}</field><statement name="DO">${body}</statement></block>`;
['std', 'dpc', 'pxe'].forEach((kernel) => {
  [['same', every4], ['mixed', every4.replace(/<\/block>$/, `<next>${back}</next></block>`)]].forEach(([key, update]) => {
    const doc = yaml.load(fs.readFileSync(path.join(dir, `fire_${kernel}_8_plain.vcsgm`), 'utf8'));
    doc.configuration.projectTitle = `Fire throttle ${kernel} ${key}`;
    doc['blockly-workspace'] = `<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="gs">gState</variable></variables>${event('gameplay_start', 'ev0', 20, '')}${event('gameplay_update', 'ev1', 300, update)}</xml>`;
    fs.writeFileSync(path.join(dir, `firethrottle_${kernel}_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
  });
});
console.log('ok');
