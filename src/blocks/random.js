import * as Blockly from 'blockly/core';

import {DICE_ICON} from './icon';
import {registerExtension} from './extension';
import {useConfigurationStorage} from '../hooks/project';

const RAND_OPTIONS = [
  ['0 to 1', '(rand/128)'],
  ['1 to 2', '(rand/128) + 1'],
  ['0 to 3', '(rand/64)'],
  ['1 to 4', '(rand/64) + 1'],
  ['0 to 7', '(rand/32)'],
  ['1 to 8', '(rand/32) + 1'],
  ['0 to 15', '(rand/16)'],
  ['1 to 16', '(rand/16) + 1'],
  ['0 to 31', '(rand/8)'],
  ['1 to 32', '(rand/8) + 1'],
  ['0 to 63', '(rand/4)'],
  ['1 to 64', '(rand/4) + 1'],
  ['0 to 127', '(rand/2)'],
  ['1 to 128', '(rand/2) + 1'],
];

Blockly.defineBlocksWithJsonArray([
  // Block for the getter.
  {
    'type': `random_get`,
    'message0': `Random 1 .. 255`,
    'args0': [],
    'output': 'Number',
    'icon': DICE_ICON,
    'colour': 'purple',
    'tooltip': `A random number from 1 to 255.`,
  },
]);

Blockly.defineBlocksWithJsonArray([
  // Block for the getter.
  {
    'type': `random_range_get`,
    'message0': `Random %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'RAND_CODE',
        'options': RAND_OPTIONS,
      },
    ],
    'output': 'Number',
    'icon': DICE_ICON,
    'colour': 'purple',
    'tooltip': `A random number between the given numbers.`,
  },
]);

// Reseeds the kernel's  random number generator - "rand" always starts
// from the exact same fixed byte ($A2, see 2600basic.h) on every power-on,
// so without this, every playthrough's "random" sequence starts
// identically. Also seeds "rand16" whenever the Options tab's "Use
// 16-bit random number generator" toggle is on (see
// generators/bbasic/random.js) - rand16 is itself just another plain byte
// that starts at 0 every boot (nothing in the kernel initializes it), so
// leaving it unseeded would still make the COMBINED sequence deterministic
// even with a fresh "rand" seed. Its generator clamps the plugged-in
// value to a real byte (0-255) and, when rand16 is on, seeds it with that
// same byte XORed against 255 rather than the identical value "rand" gets -
// seeding both with the exact same byte would only ever reach 256 of
// rand16's  65,536 possible combined starting states, since the two
// would always start in lockstep.
// The second number of "Set random seed" (and the word before it) only has a use on DPC+: it is hidden with any other kernel (the way the column of the
// background blocks is, see background_scroll_direction_sync in blocks/background.js).
registerExtension('random_seed_second_sync', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  const apply = () => {
    const input = block.getInput('SEED2');
    if (!input || block.disposed || !block.workspace || !block.workspace.rendered) return;
    const wanted = ((useConfigurationStorage() || {}).value || {}).kernel === 'dpcplus';
    if (input.isVisible() === wanted) return;
    input.setVisible(wanted);
    if (typeof block.queueRender === 'function') block.queueRender();
    else if (typeof block.render === 'function') block.render();
  };
  block.setOnChange(apply);
  setTimeout(apply, 0);
});

Blockly.defineBlocksWithJsonArray([
  {
    'type': `random_seed_set`,
    'message0': `Set random seed to %1 and %2`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'SEED',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'SEED2',
        'check': 'Number',
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'icon': DICE_ICON,
    'colour': 'purple',
    'extensions': ['random_seed_second_sync'],
    'tooltip': `Reseeds the random number generator so "Random" blocks do not repeat the same sequence every start. Clamped to 0-255. Seed it with a value that differs between playthroughs. The second number is for DPC+ only (0-255): it fills the other two bytes of the 32-bit generator, so DPC+ has 65536 starts; 0 and other kernels ignore it.`,
  },
]);

Blockly.defineBlocksWithJsonArray([
  // A random number between a minimum and a maximum the user chooses.
  {
    'type': `random_between_get`,
    'message0': `Random from %1 to %2`,
    'args0': [
      {'type': 'input_value', 'name': 'MIN', 'check': 'Number'},
      {'type': 'input_value', 'name': 'MAX', 'check': 'Number'},
    ],
    'inputsInline': true,
    'output': 'Number',
    'icon': DICE_ICON,
    'colour': 'purple',
    'tooltip': `A random number from the first number to the second, both included (up to 255; swapped if the first is bigger). Slow: use a quicker "Random" block when a power of two range is enough.`,
  },
]);
